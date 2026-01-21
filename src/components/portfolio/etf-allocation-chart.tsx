'use client';

import { ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import type { AllocationItem } from '@/lib/api/justetf';

interface ETFAllocationChartProps {
  data: AllocationItem[];
  title: string;
  color?: string;
  maxItems?: number;
  isin?: string; // For linking to JustETF for full details
}

// Color palette for bars
const COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--primary) / 0.9)',
  'hsl(var(--primary) / 0.8)',
  'hsl(var(--primary) / 0.7)',
  'hsl(var(--primary) / 0.6)',
  'hsl(var(--primary) / 0.5)',
  'hsl(var(--primary) / 0.4)',
  'hsl(var(--primary) / 0.3)',
  'hsl(var(--muted-foreground) / 0.5)',
  'hsl(var(--muted-foreground) / 0.4)',
];

export function ETFAllocationChart({ data, title, maxItems = 10, isin }: ETFAllocationChartProps) {
  if (!data || data.length === 0) {
    return null;
  }

  // Sort by weight descending and limit items
  const sortedData = [...data].sort((a, b) => b.weight - a.weight).slice(0, maxItems);

  // Check if data has an "Other" category (indicating limited data from source)
  const hasOther = data.some((item) => item.name === 'Other');

  // If we have remaining items, group them as "Other"
  if (data.length > maxItems) {
    const otherWeight = data.slice(maxItems).reduce((sum, item) => sum + item.weight, 0);
    if (otherWeight > 0) {
      sortedData.push({ name: 'Other', weight: otherWeight });
    }
  }

  const chartData = sortedData.map((item) => ({
    name: item.name.length > 20 ? item.name.substring(0, 20) + '...' : item.name,
    fullName: item.name,
    weight: item.weight,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={Math.max(200, chartData.length * 36)}>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <XAxis
              type="number"
              domain={[0, 'dataMax']}
              tickFormatter={(value) => `${value.toFixed(0)}%`}
              tick={{ fill: 'currentColor' }}
              className="text-xs"
            />
            <YAxis
              type="category"
              dataKey="name"
              width={120}
              tick={{ fill: 'currentColor' }}
              className="text-xs"
            />
            <Tooltip
              formatter={(value: number | undefined) => [
                value !== undefined ? `${value.toFixed(2)}%` : '-',
                'Weight',
              ]}
              labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName || ''}
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '6px',
              }}
            />
            <Bar dataKey="weight" radius={[0, 4, 4, 0]}>
              {chartData.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        {data.length > maxItems && (
          <p className="text-sm text-muted-foreground mt-2 text-center">
            Showing top {maxItems} of {data.length} categories
          </p>
        )}

        {hasOther && isin && (
          <a
            href={`https://www.justetf.com/en/etf-profile.html?isin=${isin}#holdings`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1 text-sm text-muted-foreground hover:text-primary mt-3"
          >
            View full breakdown on JustETF
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </CardContent>
    </Card>
  );
}
