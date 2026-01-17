const BASE_URL = 'https://mobileapi.jumbo.com';

export interface JumboProduct {
  id: string;
  title: string;
  quantityOptions: Array<{
    unit: string;
    defaultAmount: number;
  }>;
  prices: {
    price: {
      currency: string;
      amount: number;
    };
    promotionalPrice?: {
      currency: string;
      amount: number;
    };
  };
  category?: string;
  brand?: string;
  imageUrl?: string;
  isPromotion: boolean;
}

export interface JumboSearchResponse {
  products: JumboProduct[];
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
  offset = 0,
  limit = 20
): Promise<JumboSearchResponse> {
  if (!query || query.length < 2) {
    return { products: [], totalCount: 0 };
  }

  const url = `${BASE_URL}/v17/search?q=${encodeURIComponent(query)}&offset=${offset}&limit=${limit}`;

  try {
    const response = await fetchWithTimeout(url);

    if (!response.ok) {
      console.error('Jumbo API error:', response.status, response.statusText);
      return { products: [], totalCount: 0 };
    }

    const data = await response.json();

    const products: JumboProduct[] = (data.products?.data || data.data || []).map(
      (p: any): JumboProduct => ({
        id: p.id || String(Math.random()),
        title: p.title || '',
        quantityOptions: (p.quantityOptions || []).map((opt: any) => ({
          unit: opt.unit || '',
          defaultAmount: opt.defaultAmount || 1,
        })),
        prices: {
          price: {
            currency: p.prices?.price?.currency || 'EUR',
            amount: (p.prices?.price?.amount || 0) / 100,
          },
          promotionalPrice: p.prices?.promotionalPrice
            ? {
                currency: p.prices.promotionalPrice.currency || 'EUR',
                amount: p.prices.promotionalPrice.amount / 100,
              }
            : undefined,
        },
        category: p.topLevelCategory || p.category || undefined,
        brand: p.brand || undefined,
        imageUrl: p.imageInfo?.primaryView?.[0]?.url || p.image || undefined,
        isPromotion: !!p.prices?.promotionalPrice,
      })
    );

    return {
      products,
      totalCount: data.products?.total || data.totalCount || products.length,
    };
  } catch (error) {
    console.error('Jumbo search error:', error);
    return { products: [], totalCount: 0 };
  }
}

export async function getProductById(id: string): Promise<JumboProduct | null> {
  const url = `${BASE_URL}/v17/products/${id}`;

  try {
    const response = await fetchWithTimeout(url);

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const p = data.product?.data || data.data || data;

    return {
      id: p.id || id,
      title: p.title || '',
      quantityOptions: (p.quantityOptions || []).map((opt: any) => ({
        unit: opt.unit || '',
        defaultAmount: opt.defaultAmount || 1,
      })),
      prices: {
        price: {
          currency: p.prices?.price?.currency || 'EUR',
          amount: (p.prices?.price?.amount || 0) / 100,
        },
        promotionalPrice: p.prices?.promotionalPrice
          ? {
              currency: p.prices.promotionalPrice.currency || 'EUR',
              amount: p.prices.promotionalPrice.amount / 100,
            }
          : undefined,
      },
      category: p.topLevelCategory || p.category || undefined,
      brand: p.brand || undefined,
      imageUrl: p.imageInfo?.primaryView?.[0]?.url || p.image || undefined,
      isPromotion: !!p.prices?.promotionalPrice,
    };
  } catch (error) {
    console.error('Jumbo product fetch error:', error);
    return null;
  }
}
