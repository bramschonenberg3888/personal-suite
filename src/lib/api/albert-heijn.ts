const BASE_URL = 'https://api.ah.nl';
const AUTH_URL = 'https://api.ah.nl/mobile-auth/v1/auth/token/anonymous';

export interface AHProduct {
  id: string;
  title: string;
  salesUnitSize: string;
  priceBeforeBonus?: number;
  currentPrice: number;
  category: string;
  brand?: string;
  images: Array<{
    url: string;
    width: number;
    height: number;
  }>;
  isBonus: boolean;
  bonusPrice?: number;
}

export interface AHSearchResponse {
  products: AHProduct[];
  totalCount: number;
}

// Token cache
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  // Return cached token if still valid (with 5 min buffer)
  if (cachedToken && cachedToken.expiresAt > Date.now() + 5 * 60 * 1000) {
    return cachedToken.token;
  }

  try {
    const response = await fetch(AUTH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Appie/8.63.0 Model/phone Android/14.0.0',
        'X-Application': 'AHWEBSHOP',
      },
      body: JSON.stringify({ clientId: 'appie' }),
    });

    if (!response.ok) {
      throw new Error(`Token request failed: ${response.status}`);
    }

    const data = await response.json();
    cachedToken = {
      token: data.access_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    };
    return cachedToken.token;
  } catch (error) {
    console.error('Failed to get AH access token:', error);
    throw error;
  }
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeout = 10000
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const token = await getAccessToken();
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Appie/8.63.0 Model/phone Android/14.0.0',
        'X-Application': 'AHWEBSHOP',
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

export async function searchProducts(
  query: string,
  page = 0,
  size = 20
): Promise<AHSearchResponse> {
  if (!query || query.length < 2) {
    return { products: [], totalCount: 0 };
  }

  const url = `${BASE_URL}/mobile-services/product/search/v2?query=${encodeURIComponent(query)}&page=${page}&size=${size}`;

  try {
    const response = await fetchWithTimeout(url);

    if (!response.ok) {
      console.error('AH API error:', response.status, response.statusText);
      return { products: [], totalCount: 0 };
    }

    const data = await response.json();

    const products: AHProduct[] = (data.products || []).map(
      (p: any): AHProduct => ({
        id: String(p.webshopId || p.id || Math.random()),
        title: p.title || '',
        salesUnitSize: p.salesUnitSize || '',
        // New API returns prices in euros, not cents
        priceBeforeBonus: p.priceBeforeBonus ?? undefined,
        // currentPrice may not exist in search results - use priceBeforeBonus or bonus price
        currentPrice: p.currentPrice ?? p.priceBeforeBonus ?? p.price?.now ?? 0,
        category: p.taxonomies?.[0]?.name || p.mainCategory || '',
        brand: p.brand || undefined,
        images: (p.images || []).map((img: any) => ({
          url: img.url || '',
          width: img.width || 0,
          height: img.height || 0,
        })),
        isBonus: p.isBonus ?? p.discount?.bonusType === 'BONUS',
        bonusPrice: p.bonusPrice ?? p.discount?.bonusPrice ?? undefined,
      })
    );

    return {
      products,
      totalCount: data.totalCount || data.page?.totalElements || products.length,
    };
  } catch (error) {
    console.error('AH search error:', error);
    return { products: [], totalCount: 0 };
  }
}

export async function getProductById(id: string): Promise<AHProduct | null> {
  const url = `${BASE_URL}/mobile-services/product/detail/v4/fir/${id}`;

  try {
    const response = await fetchWithTimeout(url);

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    return {
      id: String(data.webshopId || id),
      title: data.title || '',
      salesUnitSize: data.salesUnitSize || '',
      // New API returns prices in euros, not cents
      priceBeforeBonus: data.priceBeforeBonus ?? undefined,
      currentPrice: data.currentPrice ?? data.priceBeforeBonus ?? 0,
      category: data.taxonomies?.[0]?.name || data.mainCategory || '',
      brand: data.brand || undefined,
      images: (data.images || []).map((img: any) => ({
        url: img.url || '',
        width: img.width || 0,
        height: img.height || 0,
      })),
      isBonus: data.isBonus ?? data.discount?.bonusType === 'BONUS',
      bonusPrice: data.bonusPrice ?? data.discount?.bonusPrice ?? undefined,
    };
  } catch (error) {
    console.error('AH product fetch error:', error);
    return null;
  }
}
