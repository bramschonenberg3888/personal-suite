'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
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

const COLORS = ['#3b82f6', '#06b6d4', '#6366f1', '#8b5cf6', '#d946ef', '#f43f5e'];

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
      <CardHeader>
        <CardTitle>Revenue by Type</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex h-40 items-center justify-center text-gray-500">
            No type data available
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={chartData.length * 40 + 20}>
              <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 20 }}>
                <XAxis type="number" tickFormatter={formatCurrency} hide />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={100}
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  formatter={(value) => formatCurrency(value as number)}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px',
                  }}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {chartData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-4 flex items-center justify-between border-t pt-4">
              <span className="font-semibold">Total</span>
              <span className="font-semibold">{formatCurrency(total)}</span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
