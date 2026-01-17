const BASE_URL = 'https://query1.finance.yahoo.com';

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

const DEFAULT_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
};

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeout = 10000
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...DEFAULT_HEADERS,
        ...options.headers,
      },
      signal: controller.signal,
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

export async function getQuotes(symbols: string[]): Promise<QuoteResult[]> {
  if (symbols.length === 0) return [];

  const symbolsParam = symbols.join(',');
  const url = `${BASE_URL}/v7/finance/quote?symbols=${encodeURIComponent(symbolsParam)}`;

  const response = await fetchWithTimeout(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch quotes: ${response.statusText}`);
  }

  const data = await response.json();
  const results = data?.quoteResponse?.result || [];

  return results.map(
    (quote: Record<string, unknown>): QuoteResult => ({
      symbol: quote.symbol as string,
      shortName: (quote.shortName as string) || (quote.symbol as string),
      longName: quote.longName as string | undefined,
      regularMarketPrice: quote.regularMarketPrice as number,
      regularMarketChange: quote.regularMarketChange as number,
      regularMarketChangePercent: quote.regularMarketChangePercent as number,
      regularMarketPreviousClose: quote.regularMarketPreviousClose as number,
      regularMarketOpen: quote.regularMarketOpen as number | undefined,
      regularMarketDayHigh: quote.regularMarketDayHigh as number | undefined,
      regularMarketDayLow: quote.regularMarketDayLow as number | undefined,
      regularMarketVolume: quote.regularMarketVolume as number | undefined,
      marketCap: quote.marketCap as number | undefined,
      currency: (quote.currency as string) || 'USD',
      exchange: (quote.exchange as string) || '',
      quoteType: (quote.quoteType as string) || 'EQUITY',
    })
  );
}

export async function searchSecurities(query: string): Promise<SearchResult[]> {
  if (!query || query.length < 1) return [];

  const url = `${BASE_URL}/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=10&newsCount=0`;

  const response = await fetchWithTimeout(url);

  if (!response.ok) {
    throw new Error(`Failed to search securities: ${response.statusText}`);
  }

  const data = await response.json();
  const quotes = data?.quotes || [];

  return quotes
    .filter((q: Record<string, unknown>) => q.quoteType === 'EQUITY' || q.quoteType === 'ETF')
    .map(
      (quote: Record<string, unknown>): SearchResult => ({
        symbol: quote.symbol as string,
        shortname: (quote.shortname as string) || (quote.symbol as string),
        longname: quote.longname as string | undefined,
        exchange: (quote.exchange as string) || '',
        quoteType: (quote.quoteType as string) || 'EQUITY',
        typeDisp: (quote.typeDisp as string) || '',
        exchDisp: (quote.exchDisp as string) || '',
      })
    );
}

export async function getHistoricalData(
  symbol: string,
  period1: Date,
  period2: Date = new Date(),
  interval: '1d' | '1wk' | '1mo' = '1d'
): Promise<HistoricalData[]> {
  const p1 = Math.floor(period1.getTime() / 1000);
  const p2 = Math.floor(period2.getTime() / 1000);

  const url = `${BASE_URL}/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${p1}&period2=${p2}&interval=${interval}`;

  const response = await fetchWithTimeout(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch historical data: ${response.statusText}`);
  }

  const data = await response.json();
  const result = data?.chart?.result?.[0];

  if (!result) {
    return [];
  }

  const timestamps = result.timestamp || [];
  const quote = result.indicators?.quote?.[0] || {};
  const adjClose = result.indicators?.adjclose?.[0]?.adjclose || [];

  return timestamps.map(
    (ts: number, i: number): HistoricalData => ({
      date: new Date(ts * 1000),
      open: quote.open?.[i] || 0,
      high: quote.high?.[i] || 0,
      low: quote.low?.[i] || 0,
      close: quote.close?.[i] || 0,
      volume: quote.volume?.[i] || 0,
      adjClose: adjClose[i] || quote.close?.[i] || 0,
    })
  );
}

export async function getNews(symbols: string[]): Promise<NewsItem[]> {
  if (symbols.length === 0) return [];

  // Yahoo Finance doesn't have a dedicated news endpoint for multiple symbols
  // We'll use the first symbol's news as a representative sample
  const symbol = symbols[0];
  const url = `${BASE_URL}/v1/finance/search?q=${encodeURIComponent(symbol)}&quotesCount=0&newsCount=10`;

  const response = await fetchWithTimeout(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch news: ${response.statusText}`);
  }

  const data = await response.json();
  const news = data?.news || [];

  return news.map(
    (item: Record<string, unknown>): NewsItem => ({
      uuid: item.uuid as string,
      title: item.title as string,
      publisher: item.publisher as string,
      link: item.link as string,
      providerPublishTime: item.providerPublishTime as number,
      thumbnail: item.thumbnail as NewsItem['thumbnail'],
      relatedTickers: item.relatedTickers as string[] | undefined,
    })
  );
}

export async function getQuoteSummary(symbol: string): Promise<QuoteSummary> {
  const modules = 'price,summaryDetail,defaultKeyStatistics,assetProfile';
  const url = `${BASE_URL}/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=${modules}`;

  const response = await fetchWithTimeout(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch quote summary: ${response.statusText}`);
  }

  const data = await response.json();
  const result = data?.quoteSummary?.result?.[0];

  if (!result) {
    throw new Error(`No data found for symbol: ${symbol}`);
  }

  const price = result.price || {};
  const summaryDetail = result.summaryDetail || {};
  const keyStats = result.defaultKeyStatistics || {};
  const profile = result.assetProfile || {};

  // Helper to extract raw value from Yahoo Finance format
  const getRaw = (obj: Record<string, unknown> | undefined): number | undefined => {
    if (!obj) return undefined;
    return (obj.raw as number) ?? undefined;
  };

  return {
    // Basic info
    symbol: (price.symbol as string) || symbol,
    shortName: (price.shortName as string) || symbol,
    longName: price.longName as string | undefined,
    currency: (price.currency as string) || 'USD',
    exchange: (price.exchangeName as string) || '',
    quoteType: (price.quoteType as string) || 'EQUITY',

    // Current price data
    regularMarketPrice: getRaw(price.regularMarketPrice) || 0,
    regularMarketChange: getRaw(price.regularMarketChange) || 0,
    regularMarketChangePercent: (getRaw(price.regularMarketChangePercent) || 0) * 100,
    regularMarketPreviousClose: getRaw(price.regularMarketPreviousClose) || 0,
    regularMarketOpen: getRaw(price.regularMarketOpen),
    regularMarketDayHigh: getRaw(price.regularMarketDayHigh),
    regularMarketDayLow: getRaw(price.regularMarketDayLow),
    regularMarketVolume: getRaw(price.regularMarketVolume),

    // Extended price stats
    fiftyTwoWeekHigh: getRaw(summaryDetail.fiftyTwoWeekHigh),
    fiftyTwoWeekLow: getRaw(summaryDetail.fiftyTwoWeekLow),
    fiftyDayAverage: getRaw(summaryDetail.fiftyDayAverage),
    twoHundredDayAverage: getRaw(summaryDetail.twoHundredDayAverage),
    fiftyDayAverageChange: getRaw(keyStats.fiftyTwoWeekChange),
    twoHundredDayAverageChange: getRaw(keyStats['52WeekChange']),

    // Fundamentals
    marketCap: getRaw(price.marketCap),
    trailingPE: getRaw(summaryDetail.trailingPE),
    forwardPE: getRaw(summaryDetail.forwardPE),
    priceToBook: getRaw(keyStats.priceToBook),
    dividendYield: getRaw(summaryDetail.dividendYield),
    dividendRate: getRaw(summaryDetail.dividendRate),
    beta: getRaw(summaryDetail.beta),
    trailingAnnualDividendYield: getRaw(summaryDetail.trailingAnnualDividendYield),

    // Company info
    sector: profile.sector as string | undefined,
    industry: profile.industry as string | undefined,
    fullTimeEmployees: profile.fullTimeEmployees as number | undefined,
    website: profile.website as string | undefined,
    longBusinessSummary: profile.longBusinessSummary as string | undefined,
    city: profile.city as string | undefined,
    country: profile.country as string | undefined,

    // Volume stats
    averageVolume: getRaw(summaryDetail.averageVolume),
    averageVolume10days: getRaw(summaryDetail.averageVolume10days),
  };
}
