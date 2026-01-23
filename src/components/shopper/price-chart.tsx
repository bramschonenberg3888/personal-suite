'use client';

import { useState } from 'react';
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, LineChart, TrendingDown } from 'lucide-react';
import { trpc } from '@/trpc/client';
import { cn } from '@/lib/utils';
import { formatPercentageChange } from '@/lib/utils/price-analytics';

interface PriceChartProps {
  productId: string;
  productName: string;
  targetPrice?: number | null;
}

type Period = '7d' | '30d' | '90d' | 'all';

const periodLabels: Record<Period, string> = {
  '7d': '7 Days',
  '30d': '30 Days',
  '90d': '90 Days',
  all: 'All Time',
};

export function PriceChart({ productId, productName, targetPrice }: PriceChartProps) {
  const [period, setPeriod] = useState<Period>('30d');
  const [open, setOpen] = useState(false);

  const { data, isLoading } = trpc.shopper.stats.getPriceHistory.useQuery(
    { productId, period },
    { enabled: open }
  );

  const chartData =
    data?.history.map((item) => ({
      date: item.recordedAt,
      price: item.price,
      formattedDate: new Date(item.recordedAt).toLocaleDateString('nl-NL', {
        month: 'short',
        day: 'numeric',
        ...(period === 'all' || period === '90d' ? { year: '2-digit' } : {}),
      }),
    })) || [];

  const formatPrice = (value: number) => {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const stats = data?.stats;
  const isPositive = stats && stats.percentageChange <= 0;
  const strokeColor = isPositive ? '#16a34a' : '#dc2626';

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" title="View price history">
          <LineChart className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="line-clamp-1">{productName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Period selector */}
          <div className="flex gap-1">
            {(Object.keys(periodLabels) as Period[]).map((p) => (
              <Button
                key={p}
                variant={period === p ? 'default' : 'ghost'}
                size="sm"
                className={cn('h-7 px-3', period === p && 'pointer-events-none')}
                onClick={() => setPeriod(p)}
              >
                {periodLabels[p]}
              </Button>
            ))}
          </div>

          {/* Stats badges */}
          {stats && (
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">Min: {formatPrice(stats.min)}</Badge>
              <Badge variant="outline">Max: {formatPrice(stats.max)}</Badge>
              <Badge variant="outline">Avg: {formatPrice(stats.avg)}</Badge>
              <Badge variant={stats.percentageChange <= 0 ? 'default' : 'destructive'}>
                {formatPercentageChange(stats.percentageChange)}
              </Badge>
              {stats.isAtHistoricalLow && stats.lowestInDays !== null && stats.lowestInDays > 0 && (
                <Badge className="bg-green-600">
                  <TrendingDown className="h-3 w-3 mr-1" />
                  Lowest in {stats.lowestInDays} days
                </Badge>
              )}
            </div>
          )}

          {/* Chart */}
          {isLoading ? (
            <div className="flex items-center justify-center h-[300px]">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : chartData.length === 0 ? (
            <div className="flex items-center justify-center h-[300px] text-muted-foreground">
              No price history available
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id={`gradient-${productId}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={strokeColor} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={strokeColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="formattedDate"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                  interval="preserveStartEnd"
                  minTickGap={30}
                />
                <YAxis
                  domain={['auto', 'auto']}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                  tickFormatter={(value: number) => formatPrice(value)}
                  width={70}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const item = payload[0].payload;
                      return (
                        <div className="bg-popover border rounded-lg shadow-lg p-3">
                          <p className="text-sm text-muted-foreground">{item.formattedDate}</p>
                          <p className="text-lg font-semibold">{formatPrice(item.price)}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                {targetPrice && (
                  <ReferenceLine
                    y={targetPrice}
                    stroke="#f59e0b"
                    strokeDasharray="5 5"
                    label={{
                      value: `Target: ${formatPrice(targetPrice)}`,
                      fill: '#f59e0b',
                      fontSize: 12,
                      position: 'right',
                    }}
                  />
                )}
                <Area
                  type="monotone"
                  dataKey="price"
                  stroke={strokeColor}
                  strokeWidth={2}
                  fill={`url(#gradient-${productId})`}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}

          {/* Current price */}
          {data && (
            <div className="text-center">
              <span className="text-sm text-muted-foreground">Current price: </span>
              <span className="text-lg font-bold">{formatPrice(data.currentPrice)}</span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
