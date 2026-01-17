const BASE_URL = 'https://api.ah.nl';

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
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'PersonalSuite/1.0',
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

  // AH uses a GraphQL-like API for their mobile app
  // This is a simplified version - actual implementation would need
  // proper authentication and GraphQL queries
  const url = `${BASE_URL}/mobile-services/product/search/v2?query=${encodeURIComponent(query)}&page=${page}&size=${size}`;

  try {
    const response = await fetchWithTimeout(url, {
      headers: {
        'x-application': 'AHWEBSHOP',
      },
    });

    if (!response.ok) {
      console.error('AH API error:', response.status, response.statusText);
      return { products: [], totalCount: 0 };
    }

    const data = await response.json();

    const products: AHProduct[] = (data.products || []).map(
      (p: any): AHProduct => ({
        id: p.webshopId || p.id || String(Math.random()),
        title: p.title || '',
        salesUnitSize: p.salesUnitSize || '',
        priceBeforeBonus: p.priceBeforeBonus ? p.priceBeforeBonus / 100 : undefined,
        currentPrice: (p.currentPrice || p.price?.now || 0) / 100,
        category: p.taxonomies?.[0]?.name || p.mainCategory || '',
        brand: p.brand || undefined,
        images: (p.images || []).map((img: any) => ({
          url: img.url || '',
          width: img.width || 0,
          height: img.height || 0,
        })),
        isBonus: p.discount?.bonusType === 'BONUS' || false,
        bonusPrice: p.discount?.bonusPrice ? p.discount.bonusPrice / 100 : undefined,
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
    const response = await fetchWithTimeout(url, {
      headers: {
        'x-application': 'AHWEBSHOP',
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    return {
      id: data.webshopId || id,
      title: data.title || '',
      salesUnitSize: data.salesUnitSize || '',
      priceBeforeBonus: data.priceBeforeBonus ? data.priceBeforeBonus / 100 : undefined,
      currentPrice: (data.currentPrice || 0) / 100,
      category: data.taxonomies?.[0]?.name || '',
      brand: data.brand || undefined,
      images: (data.images || []).map((img: any) => ({
        url: img.url || '',
        width: img.width || 0,
        height: img.height || 0,
      })),
      isBonus: data.discount?.bonusType === 'BONUS' || false,
      bonusPrice: data.discount?.bonusPrice ? data.discount.bonusPrice / 100 : undefined,
    };
  } catch (error) {
    console.error('AH product fetch error:', error);
    return null;
  }
}
