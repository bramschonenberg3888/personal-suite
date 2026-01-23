'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { trpc } from '@/trpc/client';
import { TrendingDown, Package, History, PiggyBank } from 'lucide-react';

export function DashboardWidgets() {
  const { data, isLoading } = trpc.shopper.stats.getOverview.useQuery();

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
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!data) return null;

  const widgets = [
    {
      title: 'Tracked Products',
      value: data.totalTracked.toString(),
      icon: Package,
      description: 'Products being monitored',
    },
    {
      title: 'Price Drops',
      value: data.priceDropsThisWeek.toString(),
      icon: TrendingDown,
      description: 'Dropped this week',
      highlight: data.priceDropsThisWeek > 0,
    },
    {
      title: 'At Historical Low',
      value: data.productsAtHistoricalLow.toString(),
      icon: History,
      description: 'Best time to buy',
      highlight: data.productsAtHistoricalLow > 0,
    },
    {
      title: 'Potential Savings',
      value: formatPrice(data.potentialSavings),
      icon: PiggyBank,
      description: 'If prices hit targets',
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {widgets.map((widget) => (
        <Card key={widget.title} className={widget.highlight ? 'border-green-500' : ''}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{widget.title}</CardTitle>
            <widget.icon
              className={`h-4 w-4 ${widget.highlight ? 'text-green-600' : 'text-muted-foreground'}`}
            />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${widget.highlight ? 'text-green-600' : ''}`}>
              {widget.value}
            </div>
            <p className="text-xs text-muted-foreground">{widget.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
