'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { trpc } from '@/trpc/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Plus, Loader2, Clock, X } from 'lucide-react';

const RECENT_SEARCHES_KEY = 'shopper-recent-searches';
const MAX_RECENT_SEARCHES = 5;

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
  onTrack: (_product: SearchProduct) => void;
  isTracking?: boolean;
}

// Load recent searches from localStorage
function getInitialRecentSearches(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch {
    // Invalid JSON, ignore
  }
  return [];
}

export function ProductSearch({ onTrack, isTracking }: ProductSearchProps) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [recentSearches, setRecentSearches] = useState<string[]>(getInitialRecentSearches);
  const [showRecent, setShowRecent] = useState(false);
  const [minPrice, setMinPrice] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Handle clicks outside to close recent searches dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowRecent(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const removeRecentSearch = (searchQuery: string) => {
    setRecentSearches((prev) => {
      const updated = prev.filter((s) => s !== searchQuery);
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  const addRecentSearch = (searchQuery: string) => {
    const trimmed = searchQuery.trim();
    if (!trimmed || trimmed.length < 2) return;

    setRecentSearches((prev) => {
      if (prev[0] === trimmed) return prev; // Already at top
      const updated = [trimmed, ...prev.filter((s) => s !== trimmed)].slice(0, MAX_RECENT_SEARCHES);
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  const { data, isLoading } = trpc.shopper.search.all.useQuery(
    { query: debouncedQuery },
    {
      enabled: debouncedQuery.length >= 2,
    }
  );

  const handleSearch = (value: string) => {
    setQuery(value);
    setShowRecent(false);
    // Simple debounce
    setTimeout(() => {
      if (value.length >= 2) {
        setDebouncedQuery(value);
        addRecentSearch(value);
      }
    }, 300);
  };

  const handleSelectRecent = (searchQuery: string) => {
    setQuery(searchQuery);
    setDebouncedQuery(searchQuery);
    setShowRecent(false);
    addRecentSearch(searchQuery);
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR',
    }).format(price);
  };

  // Filter products by price range
  const filteredProducts = data?.products.filter((product) => {
    const min = minPrice ? parseFloat(minPrice) : null;
    const max = maxPrice ? parseFloat(maxPrice) : null;

    if (min !== null && product.currentPrice < min) return false;
    if (max !== null && product.currentPrice > max) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Search Input */}
      <div className="relative" ref={containerRef}>
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          placeholder="Search products at Albert Heijn & Jumbo..."
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          onFocus={() => setShowRecent(true)}
          className="pl-10"
        />

        {/* Recent Searches Dropdown */}
        {showRecent && recentSearches.length > 0 && query.length === 0 && (
          <div className="absolute top-full left-0 right-0 z-10 mt-1 bg-popover border rounded-md shadow-lg">
            <div className="p-2">
              <p className="text-xs text-muted-foreground mb-2 px-2">Recent searches</p>
              {recentSearches.map((search) => (
                <div
                  key={search}
                  className="flex items-center justify-between hover:bg-accent rounded px-2 py-1.5 cursor-pointer group"
                >
                  <button
                    className="flex items-center gap-2 flex-1 text-left"
                    onClick={() => handleSelectRecent(search)}
                  >
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <span className="text-sm">{search}</span>
                  </button>
                  <button
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-background rounded"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeRecentSearch(search);
                    }}
                  >
                    <X className="h-3 w-3 text-muted-foreground" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Price Filter */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Price:</span>
        <Input
          type="number"
          placeholder="Min"
          value={minPrice}
          onChange={(e) => setMinPrice(e.target.value)}
          className="w-24 h-8"
          step="0.01"
        />
        <span className="text-muted-foreground">-</span>
        <Input
          type="number"
          placeholder="Max"
          value={maxPrice}
          onChange={(e) => setMaxPrice(e.target.value)}
          className="w-24 h-8"
          step="0.01"
        />
        {(minPrice || maxPrice) && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8"
            onClick={() => {
              setMinPrice('');
              setMaxPrice('');
            }}
          >
            Clear
          </Button>
        )}
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : filteredProducts && filteredProducts.length > 0 ? (
        <div className="space-y-2">
          {(minPrice || maxPrice) && filteredProducts.length !== data?.products.length && (
            <p className="text-sm text-muted-foreground">
              Showing {filteredProducts.length} of {data?.products.length} results
            </p>
          )}
          {filteredProducts.map((product) => (
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
        <div className="py-8 text-center text-muted-foreground">
          {data?.products.length === 0
            ? 'No products found'
            : 'No products match your price filter'}
        </div>
      ) : query.length === 0 ? (
        <div className="py-8 text-center">
          <Search className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground mb-2">Find products to track</p>
          <p className="text-sm text-muted-foreground">
            Search for your favorite products from Albert Heijn and Jumbo
          </p>
        </div>
      ) : null}
    </div>
  );
}
