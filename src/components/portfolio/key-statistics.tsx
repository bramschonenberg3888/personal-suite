'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { QuoteSummary } from '@/lib/api/yahoo-finance';

interface KeyStatisticsProps {
  summary: QuoteSummary;
}

interface StatItemProps {
  label: string;
  value: string | undefined;
}

function StatItem({ label, value }: StatItemProps) {
  return (
    <div className="flex justify-between py-2 border-b last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value ?? '-'}</span>
    </div>
  );
}

export function KeyStatistics({ summary }: KeyStatisticsProps) {
  const formatPrice = (price?: number) => {
    if (price === undefined) return undefined;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: summary.currency || 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price);
  };

  const formatNumber = (num?: number, decimals = 2) => {
    if (num === undefined) return undefined;
    return num.toFixed(decimals);
  };

  const formatLargeNumber = (num?: number) => {
    if (num === undefined) return undefined;
    return new Intl.NumberFormat('en-US', {
      notation: 'compact',
      maximumFractionDigits: 2,
    }).format(num);
  };

  const formatPercent = (percent?: number) => {
    if (percent === undefined) return undefined;
    return `${(percent * 100).toFixed(2)}%`;
  };

  const fiftyTwoWeekRange =
    summary.fiftyTwoWeekLow && summary.fiftyTwoWeekHigh
      ? `${formatPrice(summary.fiftyTwoWeekLow)} - ${formatPrice(summary.fiftyTwoWeekHigh)}`
      : undefined;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Key Statistics</CardTitle>
      </CardHeader>
      <CardContent className="grid md:grid-cols-2 gap-x-8">
        <div>
          <StatItem
            label="Previous Close"
            value={formatPrice(summary.regularMarketPreviousClose)}
          />
          <StatItem label="Open" value={formatPrice(summary.regularMarketOpen)} />
          <StatItem
            label="Day Range"
            value={
              summary.regularMarketDayLow && summary.regularMarketDayHigh
                ? `${formatPrice(summary.regularMarketDayLow)} - ${formatPrice(summary.regularMarketDayHigh)}`
                : undefined
            }
          />
          <StatItem label="52 Week Range" value={fiftyTwoWeekRange} />
          <StatItem label="Volume" value={formatLargeNumber(summary.regularMarketVolume)} />
          <StatItem label="Avg. Volume" value={formatLargeNumber(summary.averageVolume)} />
        </div>
        <div>
          <StatItem label="Market Cap" value={formatLargeNumber(summary.marketCap)} />
          <StatItem label="P/E Ratio (TTM)" value={formatNumber(summary.trailingPE)} />
          <StatItem label="P/E Ratio (Forward)" value={formatNumber(summary.forwardPE)} />
          <StatItem label="Price/Book" value={formatNumber(summary.priceToBook)} />
          <StatItem label="Dividend Yield" value={formatPercent(summary.dividendYield)} />
          <StatItem label="Beta (5Y)" value={formatNumber(summary.beta)} />
        </div>
      </CardContent>
    </Card>
  );
}
