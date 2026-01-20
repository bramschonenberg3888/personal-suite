'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { trpc } from '@/trpc/client';

interface ClientBreakdownProps {
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

const COLORS = [
  '#3b82f6',
  '#06b6d4',
  '#6366f1',
  '#8b5cf6',
  '#d946ef',
  '#f43f5e',
  '#f59e0b',
  '#10b981',
  '#14b8a6',
  '#84cc16',
];

export function ClientBreakdown({ startDate, endDate, clients, types }: ClientBreakdownProps) {
  const { data, isLoading } = trpc.revenue.entries.byClient.useQuery({
    startDate,
    endDate,
    clients,
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
      <CardHeader>
        <CardTitle>Revenue by Client</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-60 w-full" />
        ) : chartData.length === 0 ? (
          <div className="flex h-60 items-center justify-center text-gray-500">
            No client data available
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={192}>
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => formatCurrency(value as number)}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <ul className="mt-4 space-y-2">
              {chartData.slice(0, 5).map((item) => (
                <li key={item.name} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 truncate">
                    <span
                      className="h-3 w-3 flex-shrink-0 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="truncate">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-muted-foreground">
                      {((item.value / total) * 100).toFixed(0)}%
                    </span>
                    <span className="font-semibold">{formatCurrency(item.value)}</span>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}
