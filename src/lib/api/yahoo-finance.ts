import YahooFinance from 'yahoo-finance2';

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

  const results = await yahooFinance.quote(symbols);

  // Handle both single and multiple results
  const quotes = Array.isArray(results) ? results : [results];

  return quotes.map((quote) => ({
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
}

export async function searchSecurities(query: string): Promise<SearchResult[]> {
  if (!query || query.length < 1) return [];

  const results = await yahooFinance.search(query, {
    quotesCount: 10,
    newsCount: 0,
  });

  const quotes = results.quotes || [];

  return quotes
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

export async function getNews(symbols: string[]): Promise<NewsItem[]> {
  if (symbols.length === 0) return [];

  // Use search endpoint with news to get related news
  const symbol = symbols[0];
  const results = await yahooFinance.search(symbol, {
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
  const result = await yahooFinance.quoteSummary(symbol, {
    modules: ['price', 'summaryDetail', 'defaultKeyStatistics', 'assetProfile'],
  });

  const price = result.price;
  const summaryDetail = result.summaryDetail;
  const keyStats = result.defaultKeyStatistics;
  const profile = result.assetProfile;

  if (!price) {
    throw new Error(`No data found for symbol: ${symbol}`);
  }

  return {
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
  };
}
