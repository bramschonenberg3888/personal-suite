'use client';

import { TrendingUp, TrendingDown, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import type { QuoteSummary } from '@/lib/api/yahoo-finance';

interface StockHeaderProps {
  summary: QuoteSummary;
}

export function StockHeader({ summary }: StockHeaderProps) {
  const isPositive = summary.regularMarketChange >= 0;
  const changeColor = isPositive ? 'text-green-600' : 'text-red-600';

  const formatPrice = (price: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price);
  };

  const formatPercent = (percent: number) => {
    const sign = percent >= 0 ? '+' : '';
    return `${sign}${percent.toFixed(2)}%`;
  };

  const formatChange = (change: number, currency: string) => {
    const sign = change >= 0 ? '+' : '';
    return `${sign}${formatPrice(Math.abs(change), currency)}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/portfolio">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">{summary.symbol}</h1>
            <span className="text-sm text-muted-foreground bg-muted px-2 py-0.5 rounded">
              {summary.exchange}
            </span>
          </div>
          <p className="text-muted-foreground">{summary.longName || summary.shortName}</p>
        </div>
      </div>

      <div className="flex items-baseline gap-4 flex-wrap">
        <span className="text-4xl font-bold">
          {formatPrice(summary.regularMarketPrice, summary.currency)}
        </span>
        <div className={cn('flex items-center gap-2 text-lg', changeColor)}>
          {isPositive ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
          <span>{formatChange(summary.regularMarketChange, summary.currency)}</span>
          <span>({formatPercent(summary.regularMarketChangePercent)})</span>
        </div>
      </div>

      <div className="flex gap-6 text-sm text-muted-foreground">
        {summary.regularMarketOpen && (
          <div>
            <span className="font-medium">Open:</span>{' '}
            {formatPrice(summary.regularMarketOpen, summary.currency)}
          </div>
        )}
        {summary.regularMarketDayHigh && summary.regularMarketDayLow && (
          <div>
            <span className="font-medium">Day Range:</span>{' '}
            {formatPrice(summary.regularMarketDayLow, summary.currency)} -{' '}
            {formatPrice(summary.regularMarketDayHigh, summary.currency)}
          </div>
        )}
        {summary.regularMarketVolume && (
          <div>
            <span className="font-medium">Volume:</span>{' '}
            {new Intl.NumberFormat('en-US', { notation: 'compact' }).format(
              summary.regularMarketVolume
            )}
          </div>
        )}
      </div>
    </div>
  );
}
