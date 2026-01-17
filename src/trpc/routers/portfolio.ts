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

      const bestMatch = getBestTicker(mappings);

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
      .input(z.object({ symbols: z.array(z.string()) }))
      .query(async ({ input }) => {
        if (input.symbols.length === 0) return [];
        return getNews(input.symbols);
      }),
  }),
});
