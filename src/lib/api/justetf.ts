const BASE_URL = 'https://www.justetf.com';

export interface ETFHolding {
  name: string;
  weight: number; // Percentage (0-100)
  symbol?: string; // Ticker symbol (e.g., NVDA)
  isin?: string; // ISIN code
  sector?: string;
  country?: string;
  // Quote data (fetched separately)
  price?: number;
  priceChange?: number; // Daily % change
  currency?: string;
  marketCap?: number;
}

export interface AllocationItem {
  name: string;
  weight: number; // Percentage (0-100)
}

export interface ETFProfile {
  // Key Data
  isin: string;
  name: string;
  expenseRatio?: number; // TER (Total Expense Ratio) as percentage
  aum?: number; // Fund size in EUR
  inceptionDate?: string;
  replicationMethod?: string; // Physical, Synthetic
  distributionPolicy?: string; // Accumulating, Distributing
  domicile?: string;
  fundCurrency?: string;
  provider?: string; // iShares, Vanguard, etc.

  // Holdings
  holdings: ETFHolding[];
  totalHoldings?: number; // Total number of holdings in the ETF

  // Allocations
  sectorAllocation: AllocationItem[];
  countryAllocation: AllocationItem[];
  assetAllocation: AllocationItem[]; // Stocks, Bonds, Cash
}

// In-memory cache with TTL
const profileCache = new Map<string, { data: ETFProfile; fetchedAt: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

async function fetchWithTimeout(url: string, timeout = 15000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

/**
 * Parse a number from text - JustETF uses English format (. as decimal)
 */
function parseNumber(text: string | null | undefined): number | undefined {
  if (!text) return undefined;
  // Remove currency symbols, spaces, and thousand separators (commas)
  const cleaned = text
    .replace(/[€$£%]/g, '')
    .replace(/\s/g, '')
    .replace(/,/g, ''); // Remove thousand separators (commas in English format)
  const num = parseFloat(cleaned);
  return isNaN(num) ? undefined : num;
}

/**
 * Parse sector allocation from JustETF HTML
 */
function parseSectorAllocation(html: string): AllocationItem[] {
  const items: AllocationItem[] = [];

  // Pattern matches JustETF's sector rows:
  // <tr data-testid="etf-holdings_sectors_row">
  //   <td data-testid="tl_etf-holdings_sectors_value_name">Technology</td>
  //   <td>...<span data-testid="tl_etf-holdings_sectors_value_percentage">28.46%</span>...</td>
  // </tr>
  const pattern =
    /<tr[^>]*data-testid="etf-holdings_sectors_row"[^>]*>[\s\S]*?data-testid="tl_etf-holdings_sectors_value_name"[^>]*>([^<]+)<\/td>[\s\S]*?data-testid="tl_etf-holdings_sectors_value_percentage"[^>]*>([\d.,]+)%/gi;

  let match;
  while ((match = pattern.exec(html)) !== null) {
    const name = match[1].trim();
    const weight = parseNumber(match[2]);
    if (name && weight !== undefined) {
      items.push({ name, weight });
    }
  }

  return items;
}

/**
 * Parse country allocation from JustETF HTML
 */
function parseCountryAllocation(html: string): AllocationItem[] {
  const items: AllocationItem[] = [];

  // Pattern matches JustETF's country rows:
  // <tr data-testid="etf-holdings_countries_row">
  //   <td data-testid="tl_etf-holdings_countries_value_name">United States</td>
  //   <td>...<span data-testid="tl_etf-holdings_countries_value_percentage">68.89%</span>...</td>
  // </tr>
  const pattern =
    /<tr[^>]*data-testid="etf-holdings_countries_row"[^>]*>[\s\S]*?data-testid="tl_etf-holdings_countries_value_name"[^>]*>([^<]+)<\/td>[\s\S]*?data-testid="tl_etf-holdings_countries_value_percentage"[^>]*>([\d.,]+)%/gi;

  let match;
  while ((match = pattern.exec(html)) !== null) {
    const name = match[1].trim();
    const weight = parseNumber(match[2]);
    if (name && weight !== undefined) {
      items.push({ name, weight });
    }
  }

  return items;
}

/**
 * Parse total holdings count from HTML (e.g., "out of 1,318")
 */
function parseTotalHoldings(html: string): number | undefined {
  const match = html.match(/out of\s*([\d,]+)/i);
  if (match) {
    return parseInt(match[1].replace(/,/g, ''), 10);
  }
  return undefined;
}

/**
 * Parse holdings from the ETF profile page
 */
function parseHoldings(html: string): ETFHolding[] {
  const holdings: ETFHolding[] = [];

  // Pattern matches JustETF's data-testid structure with ISIN from link:
  // <tr data-testid="etf-holdings_top-holdings_row">
  //   <td><a href="/en/stock-profiles/US67066G1040" title="NVIDIA Corp."><span>NVIDIA Corp.</span></a></td>
  //   <td>...<span data-testid="tl_etf-holdings_top-holdings_value_percentage">5.21%</span>...</td>
  // </tr>
  const holdingPattern =
    /<tr[^>]*data-testid="etf-holdings_top-holdings_row"[^>]*>[\s\S]*?href="[^"]*stock-profiles\/([A-Z0-9]+)"[^>]*>[\s\S]*?<span>([^<]+)<\/span>[\s\S]*?data-testid="tl_etf-holdings_top-holdings_value_percentage"[^>]*>([\d.,]+)%/gi;

  let match;
  while ((match = holdingPattern.exec(html)) !== null && holdings.length < 15) {
    const isin = match[1];
    // Decode HTML entities in name
    const name = match[2].trim().replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    const weight = parseNumber(match[3]);
    if (name && weight !== undefined && name.length > 1) {
      holdings.push({ name, weight, isin });
    }
  }

  return holdings;
}

/**
 * Extract key data from the overview section
 */
function parseKeyData(html: string): {
  name?: string;
  expenseRatio?: number;
  aum?: number;
  inceptionDate?: string;
  replicationMethod?: string;
  distributionPolicy?: string;
  domicile?: string;
  fundCurrency?: string;
  provider?: string;
} {
  const data: {
    name?: string;
    expenseRatio?: number;
    aum?: number;
    inceptionDate?: string;
    replicationMethod?: string;
    distributionPolicy?: string;
    domicile?: string;
    fundCurrency?: string;
    provider?: string;
  } = {};

  // Extract fund name from title
  const titleMatch = html.match(/<h1[^>]*class="[^"]*etf-name[^"]*"[^>]*>(.*?)<\/h1>/i);
  if (titleMatch) {
    data.name = titleMatch[1].replace(/<[^>]*>/g, '').trim();
  } else {
    // Alternative: look for title tag
    const altTitleMatch = html.match(/<title>([^<]+)<\/title>/i);
    if (altTitleMatch) {
      data.name = altTitleMatch[1].split('|')[0].trim();
    }
  }

  // Extract TER (Total Expense Ratio) - look for specific data-testid first
  const terTestIdMatch = html.match(
    /data-testid="(?:etf-profile-header_ter-value|tl_etf-basics_value_ter)"[^>]*>([\d.,]+)%/i
  );
  if (terTestIdMatch) {
    data.expenseRatio = parseNumber(terTestIdMatch[1]);
  } else {
    // Fallback patterns
    const terPatterns = [
      /amounts to <strong>([\d.,]+)% p\.a\.<\/strong>/i,
      /TER[^<]*<[^>]*>([\d.,]+)%/i,
    ];
    for (const pattern of terPatterns) {
      const match = html.match(pattern);
      if (match) {
        data.expenseRatio = parseNumber(match[1]);
        break;
      }
    }
  }

  // Extract AUM (Fund Size) - look for specific data-testid first
  const aumMatch = html.match(
    /data-testid="etf-profile-header_fund-size-value-wrapper"[^>]*>[\s\S]*?(?:EUR|USD|GBP)\s*([\d,.]+)[\s\S]*?<\/span>\s*(m|bn)/i
  );
  if (aumMatch) {
    // Parse the number - treat comma as thousand separator here (not decimal)
    const numStr = aumMatch[1].replace(/,/g, '');
    let value = parseFloat(numStr);
    if (!isNaN(value)) {
      const multiplier = aumMatch[2].toLowerCase();
      if (multiplier === 'm') {
        value *= 1_000_000;
      } else if (multiplier === 'bn') {
        value *= 1_000_000_000;
      }
      data.aum = value;
    }
  }

  // Extract Inception Date - look for specific data-testid
  const inceptionMatch = html.match(/data-testid="[^"]*inception-date-value"[^>]*>([^<]+)/i);
  if (inceptionMatch) {
    data.inceptionDate = inceptionMatch[1].trim();
  }

  // Extract Replication Method - look for specific data-testid
  const replicationMatch = html.match(
    /data-testid="[^"]*replication-value"[^>]*>(Physical|Synthetic|Sampling|Full replication)/i
  );
  if (replicationMatch) {
    data.replicationMethod = replicationMatch[1];
  }

  // Extract Distribution Policy - look for specific data-testid
  const distributionMatch = html.match(
    /data-testid="[^"]*distribution-policy-value"[^>]*>(Accumulating|Distributing)/i
  );
  if (distributionMatch) {
    data.distributionPolicy = distributionMatch[1];
  }

  // Extract Domicile - look for specific data-testid (format: tl_etf-basics_value_domicile-country)
  const domicileMatch = html.match(
    /data-testid="tl_etf-basics_value_domicile-country"[^>]*>([^<]+)/i
  );
  if (domicileMatch) {
    data.domicile = domicileMatch[1].trim();
  }

  // Extract Fund Currency - look for specific data-testid
  const currencyMatch = html.match(
    /data-testid="tl_etf-basics_value_fund-currency"[^>]*>([A-Z]{3})/i
  );
  if (currencyMatch) {
    data.fundCurrency = currencyMatch[1];
  }

  // Extract Provider - look for specific data-testid
  const providerMatch = html.match(/data-testid="tl_etf-basics_value_fund-provider"[^>]*>([^<]+)/i);
  if (providerMatch) {
    data.provider = providerMatch[1].trim();
  }

  return data;
}

/**
 * Fetch and parse ETF profile from JustETF
 */
export async function getETFProfile(isin: string): Promise<ETFProfile | null> {
  if (!isin || isin.length !== 12) {
    console.error('Invalid ISIN format:', isin);
    return null;
  }

  // Check cache first
  const cached = profileCache.get(isin);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return cached.data;
  }

  try {
    // Fetch the ETF profile page
    const url = `${BASE_URL}/en/etf-profile.html?isin=${isin}`;
    const response = await fetchWithTimeout(url);

    if (!response.ok) {
      console.error('JustETF request failed:', response.status, response.statusText);
      return null;
    }

    const html = await response.text();

    // Check if we got a valid ETF page
    if (!html.includes('etf-profile') && !html.includes(isin)) {
      console.error('JustETF page does not contain expected ETF data');
      return null;
    }

    // Parse the HTML to extract ETF data
    const keyData = parseKeyData(html);
    const holdings = parseHoldings(html);
    const totalHoldings = parseTotalHoldings(html);
    const sectorAllocation = parseSectorAllocation(html);
    const countryAllocation = parseCountryAllocation(html);
    const assetAllocation: AllocationItem[] = []; // JustETF doesn't show asset allocation separately

    const profile: ETFProfile = {
      isin,
      name: keyData.name || isin,
      expenseRatio: keyData.expenseRatio,
      aum: keyData.aum,
      inceptionDate: keyData.inceptionDate,
      replicationMethod: keyData.replicationMethod,
      distributionPolicy: keyData.distributionPolicy,
      domicile: keyData.domicile,
      fundCurrency: keyData.fundCurrency,
      provider: keyData.provider,
      holdings,
      totalHoldings,
      sectorAllocation,
      countryAllocation,
      assetAllocation,
    };

    // Cache the result
    profileCache.set(isin, { data: profile, fetchedAt: Date.now() });

    return profile;
  } catch (error) {
    console.error('Error fetching JustETF profile:', error);
    return null;
  }
}

/**
 * Clear the profile cache
 */
export function clearETFCache(): void {
  profileCache.clear();
}

/**
 * Get cache statistics
 */
export function getETFCacheStats(): { size: number; entries: string[] } {
  return {
    size: profileCache.size,
    entries: Array.from(profileCache.keys()),
  };
}
