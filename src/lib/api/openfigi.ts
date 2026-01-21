const BASE_URL = 'https://api.openfigi.com/v3/mapping';

export interface FigiMapping {
  figi: string;
  ticker: string;
  exchCode: string;
  name: string;
  securityType: string;
  marketSector: string;
  compositeFIGI?: string;
  shareClassFIGI?: string;
}

interface FigiResponse {
  data?: FigiMapping[];
  error?: string;
}

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
      signal: controller.signal,
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

/**
 * Validates ISIN format: 2 letter country code + 9 alphanumeric + 1 check digit
 */
export function isValidIsin(isin: string): boolean {
  const isinRegex = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/;
  return isinRegex.test(isin.toUpperCase());
}

/**
 * Maps an ISIN to trading symbols using OpenFIGI API
 * @param isin - International Securities Identification Number
 * @returns Array of FigiMapping results (may include multiple exchanges)
 */
export async function mapIsin(isin: string): Promise<FigiMapping[]> {
  const normalizedIsin = isin.toUpperCase().trim();

  if (!isValidIsin(normalizedIsin)) {
    throw new Error('Invalid ISIN format');
  }

  const response = await fetchWithTimeout(BASE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([{ idType: 'ID_ISIN', idValue: normalizedIsin }]),
  });

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error('Rate limit exceeded. Please try again later.');
    }
    throw new Error(`OpenFIGI API error: ${response.statusText}`);
  }

  const data: FigiResponse[] = await response.json();

  if (!data || data.length === 0) {
    return [];
  }

  const result = data[0];

  if (result.error) {
    throw new Error(`OpenFIGI error: ${result.error}`);
  }

  if (!result.data || result.data.length === 0) {
    return [];
  }

  // Filter to only include common stock and ETFs
  return result.data.filter(
    (mapping) =>
      mapping.securityType === 'Common Stock' ||
      mapping.securityType === 'ETP' ||
      mapping.securityType === 'REIT'
  );
}

/**
 * Gets the best ticker match for an ISIN
 * Prioritizes based on security type and region:
 * - For ETPs (ETFs): prefer European exchanges for UCITS ETFs, then major US exchanges
 * - For stocks: prefer US exchanges, then European
 */
export function getBestTicker(mappings: FigiMapping[], isin?: string): FigiMapping | null {
  if (mappings.length === 0) return null;

  // Check if this is a European UCITS ETF (Irish or Luxembourg domiciled)
  const isEuropeanFund = isin && (isin.startsWith('IE') || isin.startsWith('LU'));
  const isETP = mappings.some((m) => m.securityType === 'ETP');

  // For European ETFs, prioritize European exchanges
  // NA = Euronext Amsterdam, LN = London, GY = Germany/Xetra, SW = Switzerland, FP = Paris, IM = Italy
  if (isEuropeanFund && isETP) {
    const europeanExchanges = ['NA', 'LN', 'GY', 'SW', 'FP', 'IM'];
    for (const exchCode of europeanExchanges) {
      const match = mappings.find((m) => m.exchCode === exchCode);
      if (match) return match;
    }
  }

  // Default priority: US exchanges first, then European
  const exchangePriority = ['US', 'UN', 'UQ', 'UA', 'UW', 'UR', 'LN', 'GY', 'FP', 'NA', 'JP'];

  for (const exchCode of exchangePriority) {
    const match = mappings.find((m) => m.exchCode === exchCode);
    if (match) return match;
  }

  // Return first result if no prioritized exchange found
  return mappings[0];
}
