'use client';

import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { trpc } from '@/trpc/client';
import { TrendingDown, Sparkles } from 'lucide-react';

export function BestDealsWidget() {
  const { data, isLoading } = trpc.shopper.stats.getBestDeals.useQuery();

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Best Deals This Week
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-yellow-500" />
          Best Deals This Week
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {data.map((deal) => (
            <div key={deal.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
              {deal.imageUrl && (
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded bg-background">
                  <Image src={deal.imageUrl} alt="" fill className="object-contain" unoptimized />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium line-clamp-1">{deal.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge variant="outline" className="text-xs">
                    {deal.supermarket}
                  </Badge>
                  <span className="text-sm font-semibold">{formatPrice(deal.currentPrice)}</span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <Badge className="bg-green-600">
                  <TrendingDown className="h-3 w-3 mr-1" />-{deal.percentageDrop.toFixed(0)}%
                </Badge>
                <p className="text-xs text-muted-foreground mt-1">-{formatPrice(deal.priceDrop)}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
