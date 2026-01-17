'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trash2, TrendingUp, TrendingDown } from 'lucide-react';
import type { QuoteResult } from '@/lib/api/yahoo-finance';
import { cn } from '@/lib/utils';

interface StockCardProps {
  item: {
    id: string;
    symbol: string;
    name: string;
    exchange: string;
    currency: string;
  };
  quote?: QuoteResult;
  // eslint-disable-next-line no-unused-vars
  onRemove: (itemId: string) => void;
  isRemoving?: boolean;
}

export function StockCard({ item, quote, onRemove, isRemoving }: StockCardProps) {
  const isPositive = (quote?.regularMarketChange ?? 0) >= 0;
  const changeColor = isPositive ? 'text-green-600' : 'text-red-600';

  const formatPrice = (price?: number, currency?: string) => {
    if (price === undefined) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price);
  };

  const formatPercent = (percent?: number) => {
    if (percent === undefined) return '-';
    const sign = percent >= 0 ? '+' : '';
    return `${sign}${percent.toFixed(2)}%`;
  };

  return (
    <Card className="group relative hover:shadow-md transition-shadow">
      <Link
        href={`/portfolio/${encodeURIComponent(item.symbol)}`}
        className="absolute inset-0 z-0"
        aria-label={`View ${item.symbol} details`}
      />
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold">{item.symbol}</h3>
            <p className="text-xs text-muted-foreground line-clamp-1">{item.name}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity relative z-10"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onRemove(item.id);
            }}
            disabled={isRemoving}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {quote ? (
          <div className="space-y-2">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold">
                {formatPrice(quote.regularMarketPrice, quote.currency)}
              </span>
            </div>
            <div className={cn('flex items-center gap-1 text-sm', changeColor)}>
              {isPositive ? (
                <TrendingUp className="h-4 w-4" />
              ) : (
                <TrendingDown className="h-4 w-4" />
              )}
              <span>{formatPrice(Math.abs(quote.regularMarketChange), quote.currency)}</span>
              <span>({formatPercent(quote.regularMarketChangePercent)})</span>
            </div>
            <div className="text-xs text-muted-foreground">
              {item.exchange} · {item.currency}
            </div>
          </div>
        ) : (
          <div className="space-y-2 animate-pulse">
            <div className="h-8 bg-muted rounded" />
            <div className="h-5 bg-muted rounded w-24" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
