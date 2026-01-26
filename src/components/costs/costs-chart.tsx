'use client';

import { useMemo } from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { trpc } from '@/trpc/client';
import { usePersistedState } from '@/hooks/use-persisted-state';

interface CostsChartProps {
  startDate?: Date;
  endDate?: Date;
  vatSections?: string[];
}

type ChartType = 'area' | 'bar';
type GroupBy = 'month' | 'quarter' | 'year';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPeriodLabel(period: string): string {
  // Handle month format: "2024-januari" → "Jan '24"
  const monthMatch = period.match(/^(\d{4})-(\w+)$/);
  if (monthMatch) {
    const [, year, month] = monthMatch;
    const monthAbbrev = month.slice(0, 3).charAt(0).toUpperCase() + month.slice(1, 3);
    return `${monthAbbrev} '${year.slice(2)}`;
  }

  // Handle quarter format: "2024 Q1" → "Q1 '24"
  const quarterMatch = period.match(/^(\d{4}) Q(\d)$/);
  if (quarterMatch) {
    const [, year, quarter] = quarterMatch;
    return `Q${quarter} '${year.slice(2)}`;
  }

  // Return as-is for year or unknown formats
  return period;
}

export function CostsChart({ startDate, endDate, vatSections }: CostsChartProps) {
  const [chartType, setChartType] = usePersistedState<ChartType>(
    'finance.costs.chart.chartType',
    'bar'
  );
  const [groupBy, setGroupBy] = usePersistedState<GroupBy>('finance.costs.chart.groupBy', 'month');
  const [showVat, setShowVat] = usePersistedState('finance.costs.chart.showVat', true);

  const { data, isLoading } = trpc.costs.entries.byPeriod.useQuery({
    groupBy,
    startDate,
    endDate,
    vatSections,
  });

  const chartData = useMemo(() => {
    if (!data) return [];
    return data.map((item) => ({
      period: item.period,
      costs: item.costs,
      vat: item.vat,
      total: item.costs + item.vat,
    }));
  }, [data]);

  const renderChart = () => {
    if (isLoading) {
      return <Skeleton className="h-72 w-full" />;
    }

    if (chartData.length === 0) {
      return (
        <div className="text-muted-foreground flex h-72 items-center justify-center">
          No data available for the selected period
        </div>
      );
    }

    const commonProps = {
      data: chartData,
      margin: { top: 10, right: 30, left: 0, bottom: 0 },
    };

    const xAxisProps = {
      dataKey: 'period',
      tick: { fontSize: 12 },
      tickFormatter: formatPeriodLabel,
    };

    const yAxisProps = {
      tick: { fontSize: 12 },
      tickFormatter: (value: number) => formatCurrency(value),
      width: 80,
    };

    const tooltipProps = {
      formatter: (value: number | undefined) => (value !== undefined ? formatCurrency(value) : ''),
      contentStyle: {
        backgroundColor: 'hsl(var(--card))',
        border: '1px solid hsl(var(--border))',
        borderRadius: '6px',
      },
    };

    if (chartType === 'area') {
      return (
        <ResponsiveContainer width="100%" height={288}>
          <AreaChart {...commonProps}>
            <defs>
              <linearGradient id="colorCosts" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorVat" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis {...xAxisProps} />
            <YAxis {...yAxisProps} />
            <Tooltip {...tooltipProps} />
            <Legend />
            <Area
              type="monotone"
              dataKey="costs"
              name="Costs (excl. VAT)"
              stroke="#ef4444"
              fillOpacity={1}
              fill="url(#colorCosts)"
              stackId={showVat ? '1' : undefined}
            />
            {showVat && (
              <Area
                type="monotone"
                dataKey="vat"
                name="VAT"
                stroke="#f97316"
                fillOpacity={1}
                fill="url(#colorVat)"
                stackId="1"
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      );
    }

    return (
      <ResponsiveContainer width="100%" height={288}>
        <BarChart {...commonProps}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis {...xAxisProps} />
          <YAxis {...yAxisProps} />
          <Tooltip {...tooltipProps} />
          <Legend />
          <Bar
            dataKey="costs"
            name="Costs (excl. VAT)"
            fill="#ef4444"
            radius={showVat ? [0, 0, 0, 0] : [4, 4, 0, 0]}
            stackId={showVat ? '1' : undefined}
          />
          {showVat && (
            <Bar dataKey="vat" name="VAT" fill="#f97316" radius={[4, 4, 0, 0]} stackId="1" />
          )}
        </BarChart>
      </ResponsiveContainer>
    );
  };

  return (
    <Card>
      <CardHeader className="space-y-4 pb-2">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <CardTitle>Costs Over Time</CardTitle>
          <Tabs value={groupBy} onValueChange={(v) => setGroupBy(v as GroupBy)}>
            <TabsList>
              <TabsTrigger value="month">Month</TabsTrigger>
              <TabsTrigger value="quarter">Quarter</TabsTrigger>
              <TabsTrigger value="year">Year</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <Tabs value={chartType} onValueChange={(v) => setChartType(v as ChartType)}>
            <TabsList>
              <TabsTrigger value="bar">Bar</TabsTrigger>
              <TabsTrigger value="area">Area</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-2">
            <Switch id="show-vat" checked={showVat} onCheckedChange={setShowVat} />
            <Label htmlFor="show-vat" className="text-sm">
              Show VAT
            </Label>
          </div>
        </div>
      </CardHeader>

      <CardContent>{renderChart()}</CardContent>
    </Card>
  );
}
