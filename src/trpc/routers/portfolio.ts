import { z } from 'zod';
import { createTRPCRouter, protectedProcedure, baseProcedure } from '../init';
import {
  getQuotes,
  searchSecurities,
  getHistoricalData,
  getNews,
  getQuoteSummary,
} from '@/lib/api/yahoo-finance';
import { mapIsin, getBestTicker, isValidIsin } from '@/lib/api/openfigi';
import { getETFProfile, type ETFProfile } from '@/lib/api/justetf';

export const portfolioRouter = createTRPCRouter({
  // Portfolio items management
  items: createTRPCRouter({
    getAll: protectedProcedure.query(async ({ ctx }) => {
      return ctx.db.portfolioItem.findMany({
        where: { userId: ctx.userId },
        orderBy: { createdAt: 'desc' },
      });
    }),

    add: protectedProcedure
      .input(
        z.object({
          isin: z.string(),
          symbol: z.string(),
          name: z.string(),
          exchange: z.string(),
          currency: z.string(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        return ctx.db.portfolioItem.create({
          data: {
            userId: ctx.userId,
            isin: input.isin,
            symbol: input.symbol,
            name: input.name,
            exchange: input.exchange,
            currency: input.currency,
          },
        });
      }),

    remove: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        return ctx.db.portfolioItem.delete({
          where: {
            id: input.id,
            userId: ctx.userId,
          },
        });
      }),
  }),

  // Price data
  prices: createTRPCRouter({
    getBySymbols: protectedProcedure
      .input(z.object({ symbols: z.array(z.string()) }))
      .query(async ({ input }) => {
        if (input.symbols.length === 0) return [];
        return getQuotes(input.symbols);
      }),

    search: baseProcedure.input(z.object({ query: z.string().min(1) })).query(async ({ input }) => {
      return searchSecurities(input.query);
    }),

    getHistory: protectedProcedure
      .input(
        z.object({
          symbol: z.string(),
          days: z.number().min(1).max(365).default(30),
        })
      )
      .query(async ({ input }) => {
        const period1 = new Date();
        period1.setDate(period1.getDate() - input.days);
        return getHistoricalData(input.symbol, period1);
      }),

    lookupIsin: baseProcedure.input(z.object({ isin: z.string() })).query(async ({ input }) => {
      if (!isValidIsin(input.isin)) {
        throw new Error('Invalid ISIN format. Must be 2 letters + 9 alphanumeric + 1 check digit.');
      }

      const mappings = await mapIsin(input.isin);

      if (mappings.length === 0) {
        throw new Error('No securities found for this ISIN.');
      }

      const bestMatch = getBestTicker(mappings, input.isin.toUpperCase());

      if (!bestMatch) {
        throw new Error('Could not determine best ticker for ISIN.');
      }

      // Try to get quote data for currency, but don't fail if it doesn't work
      let currency = 'USD';
      try {
        const quotes = await getQuotes([bestMatch.ticker]);
        if (quotes[0]?.currency) {
          currency = quotes[0].currency;
        }
      } catch {
        // Use default currency if quote fetch fails
      }

      return {
        isin: input.isin.toUpperCase(),
        symbol: bestMatch.ticker,
        name: bestMatch.name,
        exchange: bestMatch.exchCode,
        securityType: bestMatch.securityType,
        currency,
        allMappings: mappings,
      };
    }),

    getSummary: protectedProcedure
      .input(z.object({ symbol: z.string() }))
      .query(async ({ input }) => {
        return getQuoteSummary(input.symbol);
      }),
  }),

  // News
  news: createTRPCRouter({
    getBySymbols: protectedProcedure
      .input(
        z.object({
          symbols: z.array(z.string()),
          searchByName: z.string().optional(),
        })
      )
      .query(async ({ input }) => {
        if (input.symbols.length === 0 && !input.searchByName) return [];
        return getNews(input.symbols, input.searchByName);
      }),
  }),

  // ETF-specific data
  etf: createTRPCRouter({
    getProfile: protectedProcedure
      .input(
        z.object({
          symbol: z.string(),
          isin: z.string().optional(),
        })
      )
      .query(async ({ input }): Promise<ETFProfile | null> => {
        // Fetch both JustETF and Yahoo Finance data in parallel
        const [justEtfProfile, yahooSummary] = await Promise.all([
          input.isin ? getETFProfile(input.isin) : Promise.resolve(null),
          getQuoteSummary(input.symbol).catch(() => null),
        ]);

        // If Yahoo Finance didn't return topHoldings, try alternative tickers
        // This happens when the symbol is listed as MUTUALFUND instead of ETF
        let yahooTopHoldings = yahooSummary?.topHoldings;
        if (!yahooTopHoldings && input.isin) {
          // First, try searching by ISIN to find an ETF-type listing
          try {
            const searchResults = await searchSecurities(input.isin);
            const etfResult = searchResults.find(
              (r) => r.quoteType === 'ETF' && r.symbol !== input.symbol
            );
            if (etfResult) {
              const altSummary = await getQuoteSummary(etfResult.symbol);
              if (altSummary?.topHoldings) {
                yahooTopHoldings = altSummary.topHoldings;
              }
            }
          } catch {
            // Search failed, continue
          }

          // If still no topHoldings, try common European exchange suffixes
          if (!yahooTopHoldings) {
            const baseSymbol = input.symbol.split('.')[0];
            const exchangeSuffixes = ['.AS', '.L', '.DE', '.SW', '.PA', '.MI'];
            for (const suffix of exchangeSuffixes) {
              try {
                const altSymbol = baseSymbol + suffix;
                if (altSymbol === input.symbol) continue;
                const altSummary = await getQuoteSummary(altSymbol);
                if (altSummary?.topHoldings) {
                  yahooTopHoldings = altSummary.topHoldings;
                  break;
                }
              } catch {
                // Continue to next suffix
              }
            }
          }
        }

        // If we have JustETF data, enhance it with Yahoo Finance data
        if (justEtfProfile) {
          // Enhance holdings with symbols from Yahoo Finance (if available)
          if (yahooTopHoldings?.holdings) {
            // Create multiple lookup maps for flexible matching
            const yahooHoldings = yahooTopHoldings.holdings.map((h) => ({
              symbol: h.symbol,
              normalized: h.holdingName.toLowerCase().replace(/[^a-z0-9]/g, ''),
              firstWord: h.holdingName
                .toLowerCase()
                .split(/\s+/)[0]
                .replace(/[^a-z0-9]/g, ''),
            }));

            justEtfProfile.holdings = justEtfProfile.holdings.map((holding) => {
              const normalizedName = holding.name.toLowerCase().replace(/[^a-z0-9]/g, '');
              const firstWord = holding.name
                .toLowerCase()
                .split(/\s+/)[0]
                .replace(/[^a-z0-9]/g, '');

              // Try exact match first
              let match = yahooHoldings.find((h) => h.normalized === normalizedName);

              // Try first word match (e.g., "Apple" matches "Apple Inc.")
              if (!match && firstWord.length >= 4) {
                match = yahooHoldings.find(
                  (h) => h.firstWord === firstWord || h.normalized.startsWith(firstWord)
                );
              }

              // Try if Yahoo name starts with JustETF name or vice versa
              if (!match) {
                match = yahooHoldings.find(
                  (h) =>
                    h.normalized.startsWith(normalizedName.slice(0, 8)) ||
                    normalizedName.startsWith(h.normalized.slice(0, 8))
                );
              }

              return match?.symbol ? { ...holding, symbol: match.symbol } : holding;
            });
          }

          // Use Yahoo Finance sector allocation if available (more comprehensive - 11 sectors vs 5)
          if (yahooTopHoldings?.sectorWeightings && yahooTopHoldings.sectorWeightings.length > 0) {
            const sectorNameMap: Record<string, string> = {
              realestate: 'Real Estate',
              consumer_cyclical: 'Consumer Cyclical',
              basic_materials: 'Basic Materials',
              consumer_defensive: 'Consumer Defensive',
              technology: 'Technology',
              communication_services: 'Communication Services',
              financial_services: 'Financial Services',
              utilities: 'Utilities',
              industrials: 'Industrials',
              energy: 'Energy',
              healthcare: 'Healthcare',
            };

            justEtfProfile.sectorAllocation = yahooTopHoldings.sectorWeightings
              .map((sw) => ({
                name: sectorNameMap[sw.sector] || sw.sector,
                weight: sw.weight,
              }))
              .filter((s) => s.weight > 0)
              .sort((a, b) => b.weight - a.weight);
          }

          // Add asset allocation from Yahoo Finance if available
          if (yahooTopHoldings) {
            justEtfProfile.assetAllocation = [
              ...(yahooTopHoldings.stockPosition !== undefined && yahooTopHoldings.stockPosition > 0
                ? [{ name: 'Stocks', weight: yahooTopHoldings.stockPosition }]
                : []),
              ...(yahooTopHoldings.bondPosition !== undefined && yahooTopHoldings.bondPosition > 0
                ? [{ name: 'Bonds', weight: yahooTopHoldings.bondPosition }]
                : []),
              ...(yahooTopHoldings.cashPosition !== undefined && yahooTopHoldings.cashPosition > 0
                ? [{ name: 'Cash', weight: yahooTopHoldings.cashPosition }]
                : []),
              ...(yahooTopHoldings.otherPosition !== undefined && yahooTopHoldings.otherPosition > 0
                ? [{ name: 'Other', weight: yahooTopHoldings.otherPosition }]
                : []),
            ];
          }

          // Fetch quote data for holdings with symbols (single batch call)
          const holdingSymbols = justEtfProfile.holdings
            .map((h) => h.symbol)
            .filter((s): s is string => !!s);

          if (holdingSymbols.length > 0) {
            try {
              const quotes = await getQuotes(holdingSymbols);
              const quotesMap = new Map(quotes.map((q) => [q.symbol, q]));

              justEtfProfile.holdings = justEtfProfile.holdings.map((holding) => {
                if (!holding.symbol) return holding;
                const quote = quotesMap.get(holding.symbol);
                if (!quote) return holding;

                return {
                  ...holding,
                  price: quote.regularMarketPrice,
                  priceChange: quote.regularMarketChangePercent,
                  currency: quote.currency,
                  marketCap: quote.marketCap,
                };
              });
            } catch {
              // Quote fetch failed, continue without price data
            }
          }

          return justEtfProfile;
        }

        // Fallback: Use only Yahoo Finance data
        if (
          yahooSummary &&
          (yahooSummary.quoteType === 'ETF' || yahooSummary.quoteType === 'MUTUALFUND') &&
          yahooSummary.topHoldings
        ) {
          const sectorNameMap: Record<string, string> = {
            realestate: 'Real Estate',
            consumer_cyclical: 'Consumer Cyclical',
            basic_materials: 'Basic Materials',
            consumer_defensive: 'Consumer Defensive',
            technology: 'Technology',
            communication_services: 'Communication Services',
            financial_services: 'Financial Services',
            utilities: 'Utilities',
            industrials: 'Industrials',
            energy: 'Energy',
            healthcare: 'Healthcare',
          };

          // Fetch quote data for holdings
          const holdingSymbols = yahooSummary.topHoldings.holdings
            .map((h) => h.symbol)
            .filter((s): s is string => !!s);

          let holdingsWithQuotes = yahooSummary.topHoldings.holdings.map((h) => ({
            name: h.holdingName,
            weight: h.holdingPercent,
            symbol: h.symbol,
          }));

          if (holdingSymbols.length > 0) {
            try {
              const quotes = await getQuotes(holdingSymbols);
              const quotesMap = new Map(quotes.map((q) => [q.symbol, q]));

              holdingsWithQuotes = holdingsWithQuotes.map((holding) => {
                if (!holding.symbol) return holding;
                const quote = quotesMap.get(holding.symbol);
                if (!quote) return holding;

                return {
                  ...holding,
                  price: quote.regularMarketPrice,
                  priceChange: quote.regularMarketChangePercent,
                  currency: quote.currency,
                  marketCap: quote.marketCap,
                };
              });
            } catch {
              // Quote fetch failed, continue without price data
            }
          }

          const profile: ETFProfile = {
            isin: input.isin || '',
            name: yahooSummary.longName || yahooSummary.shortName,
            expenseRatio: yahooSummary.fundProfile?.annualReportExpenseRatio,
            aum: yahooSummary.totalAssets,
            provider: yahooSummary.fundProfile?.family,
            fundCurrency: yahooSummary.currency,

            holdings: holdingsWithQuotes,

            sectorAllocation: yahooSummary.topHoldings.sectorWeightings
              .map((sw) => ({
                name: sectorNameMap[sw.sector] || sw.sector,
                weight: sw.weight,
              }))
              .filter((s) => s.weight > 0)
              .sort((a, b) => b.weight - a.weight),

            countryAllocation: [], // Yahoo Finance doesn't provide country allocation

            assetAllocation: [
              ...(yahooSummary.topHoldings.stockPosition !== undefined
                ? [{ name: 'Stocks', weight: yahooSummary.topHoldings.stockPosition }]
                : []),
              ...(yahooSummary.topHoldings.bondPosition !== undefined
                ? [{ name: 'Bonds', weight: yahooSummary.topHoldings.bondPosition }]
                : []),
              ...(yahooSummary.topHoldings.cashPosition !== undefined
                ? [{ name: 'Cash', weight: yahooSummary.topHoldings.cashPosition }]
                : []),
            ],
          };

          return profile;
        }

        return null;
      }),
  }),
});
