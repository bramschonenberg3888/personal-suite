'use client';

import { Card, Metric, Text, Flex, ProgressBar, Grid } from '@tremor/react';

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
      <Grid numItemsSm={2} numItemsLg={4} className="gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <div className="h-4 w-24 rounded bg-gray-200" />
            <div className="mt-2 h-8 w-32 rounded bg-gray-200" />
          </Card>
        ))}
      </Grid>
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
    <Grid numItemsSm={2} numItemsLg={4} className="gap-4">
      {kpis.map((kpi) => (
        <Card key={kpi.title}>
          <Text>{kpi.title}</Text>
          <Metric className="mt-1">{kpi.metric}</Metric>
          {kpi.progress !== undefined ? (
            <Flex className="mt-2">
              <Text className="text-tremor-default">{kpi.subtext}</Text>
            </Flex>
          ) : (
            <Text className="text-tremor-default mt-2">{kpi.subtext}</Text>
          )}
          {kpi.progress !== undefined && <ProgressBar value={kpi.progress} className="mt-2" />}
        </Card>
      ))}
    </Grid>
  );
}
