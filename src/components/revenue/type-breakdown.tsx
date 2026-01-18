'use client';

import { Card, Title, BarList, Flex, Text, Bold } from '@tremor/react';
import { trpc } from '@/trpc/client';

interface TypeBreakdownProps {
  startDate?: Date;
  endDate?: Date;
  clients?: string[];
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value);
}

export function TypeBreakdown({ startDate, endDate, clients }: TypeBreakdownProps) {
  const { data, isLoading } = trpc.revenue.entries.byType.useQuery({
    startDate,
    endDate,
    clients,
  });

  const chartData = (data ?? []).map((item) => ({
    name: item.type,
    value: item.revenue,
    hours: item.hours,
  }));

  const total = chartData.reduce((sum, item) => sum + item.value, 0);

  return (
    <Card>
      <Title>Revenue by Type</Title>

      {isLoading ? (
        <div className="mt-4 space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-8 animate-pulse rounded bg-gray-200" />
          ))}
        </div>
      ) : chartData.length === 0 ? (
        <div className="mt-4 flex h-40 items-center justify-center text-gray-500">
          No type data available
        </div>
      ) : (
        <>
          <Flex className="mt-4">
            <Text>Type</Text>
            <Text>Revenue</Text>
          </Flex>
          <BarList
            data={chartData}
            className="mt-2"
            valueFormatter={formatCurrency}
            showAnimation
          />
          <Flex className="mt-4 border-t pt-4">
            <Bold>Total</Bold>
            <Bold>{formatCurrency(total)}</Bold>
          </Flex>
        </>
      )}
    </Card>
  );
}
