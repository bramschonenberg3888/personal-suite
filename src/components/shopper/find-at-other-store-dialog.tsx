'use client';

import { useState } from 'react';
import Image from 'next/image';
import { trpc } from '@/trpc/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Store, Plus, Loader2, Check } from 'lucide-react';

interface FindAtOtherStoreDialogProps {
  productName: string;
  currentStore: string;
  onTrack: (_product: {
    externalId: string;
    name: string;
    category?: string;
    imageUrl?: string;
    currentPrice: number;
    unit?: string;
    supermarket: 'Albert Heijn' | 'Jumbo';
  }) => void;
  isTracking?: boolean;
}

export function FindAtOtherStoreDialog({
  productName,
  currentStore,
  onTrack,
  isTracking,
}: FindAtOtherStoreDialogProps) {
  const [open, setOpen] = useState(false);
  const [trackedId, setTrackedId] = useState<string | null>(null);

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (newOpen) {
      setTrackedId(null);
    }
  };

  // Determine the other store
  const otherStore = currentStore === 'Albert Heijn' ? 'Jumbo' : 'Albert Heijn';

  // Extract key search terms from product name (first few meaningful words)
  const searchQuery = productName
    .split(/\s+/)
    .slice(0, 4)
    .join(' ')
    .replace(/[^\w\s]/g, '')
    .trim();

  const { data, isLoading } = trpc.shopper.search.all.useQuery(
    { query: searchQuery, supermarkets: [otherStore as 'Albert Heijn' | 'Jumbo'] },
    { enabled: open && searchQuery.length >= 2 }
  );

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR',
    }).format(price);
  };

  const handleTrack = (product: NonNullable<typeof data>['products'][0]) => {
    setTrackedId(product.externalId);
    onTrack(product);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" title={`Find at ${otherStore}`}>
          <Store className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Find at {otherStore}</DialogTitle>
          <p className="text-sm text-muted-foreground">Searching for &quot;{searchQuery}&quot;</p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-2 pr-2">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
          ) : data?.products && data.products.length > 0 ? (
            data.products.map((product) => {
              const isJustTracked = trackedId === product.externalId;

              return (
                <Card key={`${product.supermarket}-${product.externalId}`}>
                  <CardContent className="flex items-center gap-3 p-3">
                    {product.imageUrl && (
                      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded bg-muted">
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
                      <h4 className="font-medium line-clamp-1 text-sm">{product.name}</h4>
                      <p className="text-xs text-muted-foreground">{product.unit}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {product.supermarket}
                        </Badge>
                        {product.isOnSale && (
                          <Badge variant="destructive" className="text-xs">
                            Sale
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-bold">{formatPrice(product.currentPrice)}</div>
                      {product.originalPrice && product.originalPrice !== product.currentPrice && (
                        <div className="text-xs text-muted-foreground line-through">
                          {formatPrice(product.originalPrice)}
                        </div>
                      )}
                    </div>
                    <Button
                      size="icon"
                      variant={isJustTracked ? 'default' : 'ghost'}
                      onClick={() => handleTrack(product)}
                      disabled={isTracking || isJustTracked}
                      className="shrink-0"
                    >
                      {isTracking && trackedId === product.externalId ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : isJustTracked ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Plus className="h-4 w-4" />
                      )}
                    </Button>
                  </CardContent>
                </Card>
              );
            })
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              <Store className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>No matching products found at {otherStore}</p>
              <p className="text-sm mt-1">Try tracking a different product name</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
