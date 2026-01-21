'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface KpiData {
  totalCosts: number;
  totalVat: number;
  totalInclVat: number;
  avgCostPerEntry: number;
  entryCount: number;
}

interface CostsKpiCardsProps {
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

export function CostsKpiCards({ data, isLoading }: CostsKpiCardsProps) {
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

  const kpis = [
    {
      title: 'Total Costs',
      metric: formatCurrency(data.totalCosts),
      subtext: `${data.entryCount} entries`,
    },
    {
      title: 'Total VAT',
      metric: formatCurrency(data.totalVat),
      subtext: 'Deductible VAT',
    },
    {
      title: 'Total incl. VAT',
      metric: formatCurrency(data.totalInclVat),
      subtext: 'Costs including VAT',
    },
    {
      title: 'Avg. per Entry',
      metric: formatCurrency(data.avgCostPerEntry),
      subtext: 'Average cost excl. VAT',
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
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
