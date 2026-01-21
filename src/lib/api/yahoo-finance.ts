import YahooFinance from 'yahoo-finance2';

// Simple in-memory cache with TTL
interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class SimpleCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private defaultTTL: number;

  constructor(defaultTTLSeconds = 60) {
    this.defaultTTL = defaultTTLSeconds * 1000;
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  set<T>(key: string, data: T, ttlSeconds?: number): void {
    const ttl = ttlSeconds ? ttlSeconds * 1000 : this.defaultTTL;
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttl,
    });
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  // Clean up expired entries periodically
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }
}

// Cache instances with different TTLs
const quoteCache = new SimpleCache(30); // 30 seconds for real-time quotes
const summaryCache = new SimpleCache(300); // 5 minutes for summaries
const searchCache = new SimpleCache(600); // 10 minutes for search results

// Cleanup expired entries every 5 minutes
setInterval(
  () => {
    quoteCache.cleanup();
    summaryCache.cleanup();
    searchCache.cleanup();
  },
  5 * 60 * 1000
);

export interface QuoteResult {
  symbol: string;
  shortName: string;
  longName?: string;
  regularMarketPrice: number;
  regularMarketChange: number;
  regularMarketChangePercent: number;
  regularMarketPreviousClose: number;
  regularMarketOpen?: number;
  regularMarketDayHigh?: number;
  regularMarketDayLow?: number;
  regularMarketVolume?: number;
  marketCap?: number;
  currency: string;
  exchange: string;
  quoteType: string;
}

export interface SearchResult {
  symbol: string;
  shortname: string;
  longname?: string;
  exchange: string;
  quoteType: string;
  typeDisp: string;
  exchDisp: string;
}

export interface HistoricalData {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  adjClose: number;
}

export interface NewsItem {
  uuid: string;
  title: string;
  publisher: string;
  link: string;
  providerPublishTime: number;
  thumbnail?: {
    resolutions: Array<{
      url: string;
      width: number;
      height: number;
    }>;
  };
  relatedTickers?: string[];
}

export interface ETFHolding {
  symbol?: string;
  holdingName: string;
  holdingPercent: number;
}

export interface SectorWeighting {
  sector: string;
  weight: number;
}

export interface ETFTopHoldings {
  holdings: ETFHolding[];
  sectorWeightings: SectorWeighting[];
  stockPosition?: number;
  bondPosition?: number;
  cashPosition?: number;
  otherPosition?: number;
}

export interface ETFFundProfile {
  family?: string;
  categoryName?: string;
  legalType?: string;
  annualReportExpenseRatio?: number;
}

export interface QuoteSummary {
  // Basic info
  symbol: string;
  shortName: string;
  longName?: string;
  currency: string;
  exchange: string;
  quoteType: string;

  // Current price data
  regularMarketPrice: number;
  regularMarketChange: number;
  regularMarketChangePercent: number;
  regularMarketPreviousClose: number;
  regularMarketOpen?: number;
  regularMarketDayHigh?: number;
  regularMarketDayLow?: number;
  regularMarketVolume?: number;

  // Extended price stats
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  fiftyDayAverage?: number;
  twoHundredDayAverage?: number;
  fiftyDayAverageChange?: number;
  fiftyDayAverageChangePercent?: number;
  twoHundredDayAverageChange?: number;
  twoHundredDayAverageChangePercent?: number;

  // Fundamentals
  marketCap?: number;
  trailingPE?: number;
  forwardPE?: number;
  priceToBook?: number;
  dividendYield?: number;
  dividendRate?: number;
  beta?: number;
  trailingAnnualDividendYield?: number;

  // Company info
  sector?: string;
  industry?: string;
  fullTimeEmployees?: number;
  website?: string;
  longBusinessSummary?: string;
  city?: string;
  country?: string;

  // Volume stats
  averageVolume?: number;
  averageVolume10days?: number;

  // ETF-specific fields
  totalAssets?: number; // AUM
  topHoldings?: ETFTopHoldings;
  fundProfile?: ETFFundProfile;
}

// Create yahoo-finance instance with suppressed notices
const yahooFinance = new YahooFinance({
  suppressNotices: ['yahooSurvey'],
  validation: {
    logErrors: false,
  },
});

export async function getQuotes(symbols: string[]): Promise<QuoteResult[]> {
  if (symbols.length === 0) return [];

  // Check cache first
  const cacheKey = `quotes:${symbols.sort().join(',')}`;
  const cached = quoteCache.get<QuoteResult[]>(cacheKey);
  if (cached) {
    return cached;
  }

  const results = await yahooFinance.quote(symbols);

  // Handle both single and multiple results
  const quotes = Array.isArray(results) ? results : [results];

  const mapped = quotes.map((quote) => ({
    symbol: quote.symbol,
    shortName: quote.shortName || quote.symbol,
    longName: quote.longName,
    regularMarketPrice: quote.regularMarketPrice || 0,
    regularMarketChange: quote.regularMarketChange || 0,
    regularMarketChangePercent: quote.regularMarketChangePercent || 0,
    regularMarketPreviousClose: quote.regularMarketPreviousClose || 0,
    regularMarketOpen: quote.regularMarketOpen,
    regularMarketDayHigh: quote.regularMarketDayHigh,
    regularMarketDayLow: quote.regularMarketDayLow,
    regularMarketVolume: quote.regularMarketVolume,
    marketCap: quote.marketCap,
    currency: quote.currency || 'USD',
    exchange: quote.exchange || '',
    quoteType: quote.quoteType || 'EQUITY',
  }));

  quoteCache.set(cacheKey, mapped);
  return mapped;
}

export async function searchSecurities(query: string): Promise<SearchResult[]> {
  if (!query || query.length < 1) return [];

  // Check cache first
  const cacheKey = `search:${query.toLowerCase()}`;
  const cached = searchCache.get<SearchResult[]>(cacheKey);
  if (cached) {
    return cached;
  }

  const results = await yahooFinance.search(query, {
    quotesCount: 10,
    newsCount: 0,
  });

  const quotes = results.quotes || [];

  const mapped = quotes
    .filter((q) => q.quoteType === 'EQUITY' || q.quoteType === 'ETF')
    .map(
      (quote): SearchResult => ({
        symbol: String(quote.symbol),
        shortname: String(quote.shortname || quote.symbol),
        longname: quote.longname ? String(quote.longname) : undefined,
        exchange: String(quote.exchange || ''),
        quoteType: String(quote.quoteType || 'EQUITY'),
        typeDisp: String(quote.typeDisp || ''),
        exchDisp: String(quote.exchDisp || ''),
      })
    );

  searchCache.set(cacheKey, mapped);
  return mapped;
}

export async function getHistoricalData(
  symbol: string,
  period1: Date,
  period2: Date = new Date(),
  interval: '1d' | '1wk' | '1mo' = '1d'
): Promise<HistoricalData[]> {
  const results = await yahooFinance.chart(symbol, {
    period1,
    period2,
    interval,
  });

  const quotes = results.quotes || [];

  return quotes.map((quote) => ({
    date: quote.date,
    open: quote.open || 0,
    high: quote.high || 0,
    low: quote.low || 0,
    close: quote.close || 0,
    volume: quote.volume || 0,
    adjClose: quote.adjclose || quote.close || 0,
  }));
}

export async function getNews(symbols: string[], searchByName?: string): Promise<NewsItem[]> {
  if (symbols.length === 0 && !searchByName) return [];

  // Use search endpoint with news to get related news
  // For ETFs, searching by name works better than by symbol
  const searchQuery = searchByName || symbols[0];
  const results = await yahooFinance.search(searchQuery, {
    quotesCount: 0,
    newsCount: 10,
  });

  const news = results.news || [];

  return news.map((item) => ({
    uuid: item.uuid,
    title: item.title,
    publisher: item.publisher || '',
    link: item.link,
    providerPublishTime: Math.floor(item.providerPublishTime.getTime() / 1000),
    thumbnail: item.thumbnail,
    relatedTickers: item.relatedTickers,
  }));
}

export async function getQuoteSummary(symbol: string): Promise<QuoteSummary> {
  // Check cache first
  const cacheKey = `summary:${symbol.toUpperCase()}`;
  const cached = summaryCache.get<QuoteSummary>(cacheKey);
  if (cached) {
    return cached;
  }

  // First, get basic quote to determine the type
  const basicResult = await yahooFinance.quoteSummary(symbol, {
    modules: ['price'],
  });

  const quoteType = basicResult.price?.quoteType || 'EQUITY';
  const isETF = quoteType === 'ETF' || quoteType === 'MUTUALFUND';

  // Determine modules based on security type
  const modules: (
    | 'price'
    | 'summaryDetail'
    | 'defaultKeyStatistics'
    | 'assetProfile'
    | 'topHoldings'
    | 'fundProfile'
  )[] = ['price', 'summaryDetail', 'defaultKeyStatistics'];

  if (isETF) {
    modules.push('topHoldings', 'fundProfile');
  } else {
    modules.push('assetProfile');
  }

  const result = await yahooFinance.quoteSummary(symbol, { modules });

  const price = result.price;
  const summaryDetail = result.summaryDetail;
  const keyStats = result.defaultKeyStatistics;
  const profile = result.assetProfile;
  const topHoldingsData = result.topHoldings;
  const fundProfileData = result.fundProfile;

  if (!price) {
    throw new Error(`No data found for symbol: ${symbol}`);
  }

  // Parse ETF top holdings if available
  let topHoldings: ETFTopHoldings | undefined;
  if (topHoldingsData) {
    const holdings: ETFHolding[] = (topHoldingsData.holdings || []).map((h: any) => ({
      symbol: h.symbol || undefined,
      holdingName: h.holdingName || 'Unknown',
      holdingPercent: (h.holdingPercent || 0) * 100,
    }));

    const sectorWeightings: SectorWeighting[] = [];
    if (topHoldingsData.sectorWeightings) {
      for (const sw of topHoldingsData.sectorWeightings) {
        // Each sector weighting is an object with the sector name as key
        for (const [sector, weight] of Object.entries(sw)) {
          if (typeof weight === 'number') {
            sectorWeightings.push({ sector, weight: weight * 100 });
          }
        }
      }
    }

    topHoldings = {
      holdings,
      sectorWeightings,
      stockPosition:
        typeof topHoldingsData.stockPosition === 'number'
          ? topHoldingsData.stockPosition * 100
          : undefined,
      bondPosition:
        typeof topHoldingsData.bondPosition === 'number'
          ? topHoldingsData.bondPosition * 100
          : undefined,
      cashPosition:
        typeof topHoldingsData.cashPosition === 'number'
          ? topHoldingsData.cashPosition * 100
          : undefined,
      otherPosition:
        typeof topHoldingsData.otherPosition === 'number'
          ? topHoldingsData.otherPosition * 100
          : undefined,
    };
  }

  // Parse fund profile if available
  let fundProfile: ETFFundProfile | undefined;
  if (fundProfileData) {
    fundProfile = {
      family: fundProfileData.family || undefined,
      categoryName: fundProfileData.categoryName || undefined,
      legalType: fundProfileData.legalType || undefined,
      annualReportExpenseRatio:
        typeof fundProfileData.feesExpensesInvestment?.annualReportExpenseRatio === 'number'
          ? fundProfileData.feesExpensesInvestment.annualReportExpenseRatio * 100
          : undefined,
    };
  }

  const summary: QuoteSummary = {
    // Basic info
    symbol: price.symbol || symbol,
    shortName: price.shortName || symbol,
    longName: price.longName ?? undefined,
    currency: price.currency || 'USD',
    exchange: price.exchangeName || '',
    quoteType: price.quoteType || 'EQUITY',

    // Current price data
    regularMarketPrice: price.regularMarketPrice || 0,
    regularMarketChange: price.regularMarketChange || 0,
    regularMarketChangePercent: (price.regularMarketChangePercent || 0) * 100,
    regularMarketPreviousClose: price.regularMarketPreviousClose || 0,
    regularMarketOpen: price.regularMarketOpen,
    regularMarketDayHigh: price.regularMarketDayHigh,
    regularMarketDayLow: price.regularMarketDayLow,
    regularMarketVolume: price.regularMarketVolume,

    // Extended price stats
    fiftyTwoWeekHigh: summaryDetail?.fiftyTwoWeekHigh,
    fiftyTwoWeekLow: summaryDetail?.fiftyTwoWeekLow,
    fiftyDayAverage: summaryDetail?.fiftyDayAverage,
    twoHundredDayAverage: summaryDetail?.twoHundredDayAverage,
    fiftyDayAverageChange:
      typeof keyStats?.fiftyTwoWeekChange === 'number' ? keyStats.fiftyTwoWeekChange : undefined,
    twoHundredDayAverageChange:
      typeof keyStats?.['52WeekChange'] === 'number' ? keyStats['52WeekChange'] : undefined,

    // Fundamentals
    marketCap: price.marketCap,
    trailingPE: summaryDetail?.trailingPE,
    forwardPE: summaryDetail?.forwardPE,
    priceToBook: keyStats?.priceToBook,
    dividendYield: summaryDetail?.dividendYield,
    dividendRate: summaryDetail?.dividendRate,
    beta: summaryDetail?.beta,
    trailingAnnualDividendYield: summaryDetail?.trailingAnnualDividendYield,

    // Company info
    sector: profile?.sector,
    industry: profile?.industry,
    fullTimeEmployees: profile?.fullTimeEmployees,
    website: profile?.website,
    longBusinessSummary: profile?.longBusinessSummary,
    city: profile?.city,
    country: profile?.country,

    // Volume stats
    averageVolume: summaryDetail?.averageVolume,
    averageVolume10days: summaryDetail?.averageVolume10days,

    // ETF-specific fields
    totalAssets: keyStats?.totalAssets,
    topHoldings,
    fundProfile,
  };

  summaryCache.set(cacheKey, summary);
  return summary;
}
