'use client';

import { useState } from 'react';
import Image from 'next/image';
import { trpc } from '@/trpc/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Plus, Loader2 } from 'lucide-react';

interface SearchProduct {
  externalId: string;
  name: string;
  category?: string;
  imageUrl?: string;
  currentPrice: number;
  originalPrice?: number;
  unit?: string;
  isOnSale: boolean;
  salePrice?: number;
  supermarket: 'Albert Heijn' | 'Jumbo';
}

interface ProductSearchProps {
  // eslint-disable-next-line no-unused-vars
  onTrack: (product: SearchProduct) => void;
  isTracking?: boolean;
}

export function ProductSearch({ onTrack, isTracking }: ProductSearchProps) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  const { data, isLoading } = trpc.shopper.search.all.useQuery(
    { query: debouncedQuery },
    { enabled: debouncedQuery.length >= 2 }
  );

  const handleSearch = (value: string) => {
    setQuery(value);
    // Simple debounce
    setTimeout(() => {
      if (value.length >= 2) {
        setDebouncedQuery(value);
      }
    }, 300);
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR',
    }).format(price);
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search products at Albert Heijn & Jumbo..."
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : data?.products && data.products.length > 0 ? (
        <div className="space-y-2">
          {data.products.map((product) => (
            <Card key={`${product.supermarket}-${product.externalId}`} className="overflow-hidden">
              <CardContent className="flex items-center gap-4 p-4">
                {product.imageUrl && (
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded bg-muted">
                    <Image
                      src={product.imageUrl}
                      alt=""
                      fill
                      className="object-contain"
                      unoptimized
                    />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium line-clamp-1">{product.name}</h3>
                    {product.isOnSale && (
                      <Badge variant="destructive" className="shrink-0">
                        Sale
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{product.unit}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-xs">
                      {product.supermarket}
                    </Badge>
                    {product.category && (
                      <span className="text-xs text-muted-foreground">{product.category}</span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold">{formatPrice(product.currentPrice)}</div>
                  {product.originalPrice && product.originalPrice !== product.currentPrice && (
                    <div className="text-sm text-muted-foreground line-through">
                      {formatPrice(product.originalPrice)}
                    </div>
                  )}
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => onTrack(product)}
                  disabled={isTracking}
                >
                  {isTracking ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : debouncedQuery.length >= 2 ? (
        <div className="py-8 text-center text-muted-foreground">No products found</div>
      ) : null}
    </div>
  );
}
