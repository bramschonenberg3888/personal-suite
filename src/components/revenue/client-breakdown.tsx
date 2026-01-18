'use client';

import { Card, Title, DonutChart, List, ListItem, Flex, Text, Bold } from '@tremor/react';
import { trpc } from '@/trpc/client';

interface ClientBreakdownProps {
  startDate?: Date;
  endDate?: Date;
  types?: string[];
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value);
}

const COLORS = [
  'blue',
  'cyan',
  'indigo',
  'violet',
  'fuchsia',
  'rose',
  'amber',
  'emerald',
  'teal',
  'lime',
] as const;

export function ClientBreakdown({ startDate, endDate, types }: ClientBreakdownProps) {
  const { data, isLoading } = trpc.revenue.entries.byClient.useQuery({
    startDate,
    endDate,
    types,
  });

  const chartData = (data ?? []).map((item, index) => ({
    name: item.client,
    value: item.revenue,
    hours: item.hours,
    color: COLORS[index % COLORS.length],
  }));

  const total = chartData.reduce((sum, item) => sum + item.value, 0);

  return (
    <Card>
      <Title>Revenue by Client</Title>

      {isLoading ? (
        <div className="mt-4 h-60 animate-pulse rounded bg-gray-200" />
      ) : chartData.length === 0 ? (
        <div className="mt-4 flex h-60 items-center justify-center text-gray-500">
          No client data available
        </div>
      ) : (
        <>
          <DonutChart
            className="mt-4 h-48"
            data={chartData}
            category="value"
            index="name"
            valueFormatter={formatCurrency}
            colors={chartData.map((d) => d.color)}
            showAnimation
          />
          <List className="mt-4">
            {chartData.slice(0, 5).map((item) => (
              <ListItem key={item.name}>
                <Flex justifyContent="start" className="gap-2 truncate">
                  <span
                    className={`h-3 w-3 rounded-full bg-${item.color}-500 flex-shrink-0`}
                    aria-hidden
                  />
                  <Text className="truncate">{item.name}</Text>
                </Flex>
                <Flex justifyContent="end" className="gap-4">
                  <Text>{((item.value / total) * 100).toFixed(0)}%</Text>
                  <Bold>{formatCurrency(item.value)}</Bold>
                </Flex>
              </ListItem>
            ))}
          </List>
        </>
      )}
    </Card>
  );
}
