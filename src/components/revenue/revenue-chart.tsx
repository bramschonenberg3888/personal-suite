'use client';

import { Card, Title, AreaChart, TabGroup, TabList, Tab } from '@tremor/react';
import { useState } from 'react';
import { trpc } from '@/trpc/client';

interface RevenueChartProps {
  startDate?: Date;
  endDate?: Date;
  clients?: string[];
  types?: string[];
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value);
}

export function RevenueChart({ startDate, endDate, clients, types }: RevenueChartProps) {
  const [groupBy, setGroupBy] = useState<'month' | 'quarter' | 'year'>('month');

  const { data, isLoading } = trpc.revenue.entries.byPeriod.useQuery({
    groupBy,
    startDate,
    endDate,
    clients,
    types,
  });

  const chartData = (data ?? []).map((item) => ({
    period: item.period,
    Revenue: item.revenue,
    'Net Income': item.netIncome,
    Hours: item.hours,
  }));

  return (
    <Card>
      <div className="flex items-center justify-between">
        <Title>Revenue Over Time</Title>
        <TabGroup
          index={['month', 'quarter', 'year'].indexOf(groupBy)}
          onIndexChange={(idx) =>
            setGroupBy(['month', 'quarter', 'year'][idx] as 'month' | 'quarter' | 'year')
          }
        >
          <TabList variant="solid" className="w-fit">
            <Tab>Month</Tab>
            <Tab>Quarter</Tab>
            <Tab>Year</Tab>
          </TabList>
        </TabGroup>
      </div>

      {isLoading ? (
        <div className="mt-4 h-72 animate-pulse rounded bg-gray-200" />
      ) : chartData.length === 0 ? (
        <div className="mt-4 flex h-72 items-center justify-center text-gray-500">
          No data available for the selected period
        </div>
      ) : (
        <AreaChart
          className="mt-4 h-72"
          data={chartData}
          index="period"
          categories={['Revenue', 'Net Income']}
          colors={['blue', 'emerald']}
          valueFormatter={formatCurrency}
          showLegend
          showGridLines={false}
          showAnimation
        />
      )}
    </Card>
  );
}
