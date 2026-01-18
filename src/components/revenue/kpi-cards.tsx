'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface KpiData {
  totalRevenue: number;
  totalNetIncome: number;
  totalHours: number;
  billableHours: number;
  totalKilometers: number;
  avgHourlyRate: number;
  entryCount: number;
}

interface KpiCardsProps {
  data: KpiData | undefined;
  isLoading: boolean;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNumber(value: number, decimals = 1): string {
  return new Intl.NumberFormat('nl-NL', {
    maximumFractionDigits: decimals,
  }).format(value);
}

export function KpiCards({ data, isLoading }: KpiCardsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="mt-2 h-8 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const billableRatio = data.totalHours > 0 ? (data.billableHours / data.totalHours) * 100 : 0;

  const kpis = [
    {
      title: 'Total Revenue',
      metric: formatCurrency(data.totalRevenue),
      subtext: `${data.entryCount} entries`,
    },
    {
      title: 'Net Income',
      metric: formatCurrency(data.totalNetIncome),
      subtext: `After tax reservation`,
    },
    {
      title: 'Hours Worked',
      metric: formatNumber(data.totalHours),
      subtext: `${formatNumber(data.billableHours)} billable (${formatNumber(billableRatio, 0)}%)`,
      progress: billableRatio,
    },
    {
      title: 'Avg. Hourly Rate',
      metric: formatCurrency(data.avgHourlyRate),
      subtext: `${formatNumber(data.totalKilometers, 0)} km traveled`,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {kpis.map((kpi) => (
        <Card key={kpi.title}>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-sm">{kpi.title}</p>
            <p className="mt-1 text-3xl font-semibold tracking-tight">{kpi.metric}</p>
            <p className="text-muted-foreground mt-2 text-sm">{kpi.subtext}</p>
            {kpi.progress !== undefined && (
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-200">
                <div
                  className="h-full rounded-full bg-blue-500 transition-all"
                  style={{ width: `${kpi.progress}%` }}
                />
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
