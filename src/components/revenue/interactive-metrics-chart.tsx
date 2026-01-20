'use client';

import { useState, useMemo } from 'react';
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
  ReferenceArea,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { trpc } from '@/trpc/client';

interface InteractiveMetricsChartProps {
  startDate?: Date;
  endDate?: Date;
  clients?: string[];
  types?: string[];
}

type ChartType = 'area' | 'line' | 'bar';
type Metric = 'revenue' | 'netIncome' | 'hours';
type GroupBy = 'month' | 'quarter' | 'year';
type CompareMode = 'none' | 'yoy' | 'multi';
type MovingAverage = 0 | 3 | 6;

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatHours(value: number): string {
  return `${value.toFixed(1)}h`;
}

function formatValue(value: number, metric: Metric): string {
  return metric === 'hours' ? formatHours(value) : formatCurrency(value);
}

const METRIC_LABELS: Record<Metric, string> = {
  revenue: 'Revenue',
  netIncome: 'Net Income',
  hours: 'Hours',
};

const METRIC_COLORS: Record<Metric, string> = {
  revenue: '#3b82f6',
  netIncome: '#10b981',
  hours: '#8b5cf6',
};

export function InteractiveMetricsChart({
  startDate,
  endDate,
  clients,
  types,
}: InteractiveMetricsChartProps) {
  // Chart configuration state
  const [chartType, setChartType] = useState<ChartType>('area');
  const [metric, setMetric] = useState<Metric>('revenue');
  const [groupBy, setGroupBy] = useState<GroupBy>('month');
  const [cumulative, setCumulative] = useState(false);
  const [billableOnly, setBillableOnly] = useState(false);
  const [movingAverage, setMovingAverage] = useState<MovingAverage>(0);

  // Compare mode
  const [compareMode, setCompareMode] = useState<CompareMode>('none');
  const [secondaryMetric, setSecondaryMetric] = useState<Metric>('hours');

  // Target tracking
  const [targetValue, setTargetValue] = useState<number | null>(null);
  const [targetPeriod, setTargetPeriod] = useState<'year' | 'quarter' | 'month'>('year');

  // Fetch data
  const { data, isLoading } = trpc.revenue.entries.byPeriod.useQuery({
    groupBy,
    startDate,
    endDate,
    clients,
    types,
    billable: billableOnly ? true : undefined,
  });

  // Transform data based on settings
  const chartData = useMemo(() => {
    if (!data) return [];

    let transformed = data.map((item) => ({
      period: item.period,
      revenue: item.revenue,
      netIncome: item.netIncome,
      hours: item.hours,
    }));

    // Apply cumulative if enabled
    if (cumulative) {
      let cumulativeRevenue = 0;
      let cumulativeNetIncome = 0;
      let cumulativeHours = 0;
      transformed = transformed.map((item) => ({
        ...item,
        revenue: (cumulativeRevenue += item.revenue),
        netIncome: (cumulativeNetIncome += item.netIncome),
        hours: (cumulativeHours += item.hours),
      }));
    }

    // Apply moving average if enabled
    if (movingAverage > 0) {
      const window = movingAverage;
      transformed = transformed.map((item, i, arr) => {
        if (i < window - 1) {
          return { ...item, movingAvg: null };
        }
        const slice = arr.slice(i - window + 1, i + 1);
        const avg = slice.reduce((sum, d) => sum + d[metric], 0) / window;
        return { ...item, movingAvg: avg };
      });
    }

    return transformed;
  }, [data, cumulative, movingAverage, metric]);

  // Calculate target progress
  const targetProgress = useMemo(() => {
    if (!targetValue || !chartData.length) return null;

    const total = chartData[chartData.length - 1]?.[metric] ?? 0;
    const currentValue = cumulative ? total : chartData.reduce((sum, d) => sum + d[metric], 0);
    const percentage = Math.min((currentValue / targetValue) * 100, 100);
    const remaining = Math.max(targetValue - currentValue, 0);

    // Calculate elapsed time ratio based on target period
    const now = new Date();
    let elapsedRatio = 1;
    let totalPeriods = 1;
    let currentPeriod = 1;

    if (targetPeriod === 'year') {
      currentPeriod = now.getMonth() + 1;
      totalPeriods = 12;
      elapsedRatio = currentPeriod / totalPeriods;
    } else if (targetPeriod === 'quarter') {
      const quarterMonth = now.getMonth() % 3;
      currentPeriod = quarterMonth + 1;
      totalPeriods = 3;
      elapsedRatio = currentPeriod / totalPeriods;
    } else if (targetPeriod === 'month') {
      currentPeriod = now.getDate();
      totalPeriods = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      elapsedRatio = currentPeriod / totalPeriods;
    }

    const expectedProgress = targetValue * elapsedRatio;
    const status: 'green' | 'yellow' | 'red' =
      currentValue >= expectedProgress * 0.95
        ? 'green'
        : currentValue >= expectedProgress * 0.8
          ? 'yellow'
          : 'red';

    // Calculate daily pace needed
    const remainingDays = Math.max(1, Math.ceil((1 - elapsedRatio) * totalPeriods * 30));
    const dailyPaceNeeded = remaining / remainingDays;

    // Calculate projected value (simple linear projection)
    const avgPerPeriod = currentValue / currentPeriod;
    const projected = avgPerPeriod * totalPeriods;

    return {
      currentValue,
      targetValue,
      percentage,
      remaining,
      status,
      dailyPaceNeeded,
      projected,
      expectedProgress,
    };
  }, [targetValue, targetPeriod, chartData, metric, cumulative]);

  // Primary color based on metric
  const primaryColor = METRIC_COLORS[metric];
  const secondaryColor = METRIC_COLORS[secondaryMetric];

  // Render the appropriate chart type
  const renderChart = () => {
    if (isLoading) {
      return <Skeleton className="h-72 w-full" />;
    }

    if (chartData.length === 0) {
      return (
        <div className="flex h-72 items-center justify-center text-gray-500">
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
      className: 'text-xs',
      tick: { fill: 'currentColor' } as const,
    };

    // Calculate Y-axis domain to include target value if set
    const dataMax = Math.max(...chartData.map((d) => d[metric]));
    const yMax = targetValue ? Math.max(dataMax, targetValue * 1.1) : dataMax;

    const yAxisProps = {
      tickFormatter: (value: number) => formatValue(value, metric),
      className: 'text-xs',
      tick: { fill: 'currentColor' } as const,
      width: 80,
      domain: [0, yMax] as [number, number],
    };

    const tooltipProps = {
      formatter: (value: number | undefined, name: string | undefined) => {
        if (value === undefined) return '';
        const metricKey = (name ?? '').toLowerCase().replace(' ', '') as Metric;
        if (metricKey === 'hours' || name === 'Hours') return formatHours(value);
        return formatCurrency(value);
      },
      contentStyle: {
        backgroundColor: 'hsl(var(--card))',
        border: '1px solid hsl(var(--border))',
        borderRadius: '6px',
      },
    };

    // Common elements for all chart types
    const commonElements = (
      <>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis {...xAxisProps} />
        <YAxis {...yAxisProps} />
        <Tooltip {...tooltipProps} />
        <Legend />
        {targetValue && (
          <>
            <ReferenceLine
              y={targetValue}
              stroke="#ef4444"
              strokeDasharray="5 5"
              label={{
                value: `Target ${formatValue(targetValue, metric)}`,
                fill: '#ef4444',
                position: 'insideTopRight',
                fontSize: 12,
              }}
            />
            <ReferenceArea y1={0} y2={targetValue} fill="#10b981" fillOpacity={0.05} />
          </>
        )}
      </>
    );

    if (chartType === 'area') {
      return (
        <ResponsiveContainer width="100%" height={288}>
          <AreaChart {...commonProps}>
            <defs>
              <linearGradient id="colorPrimary" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={primaryColor} stopOpacity={0.3} />
                <stop offset="95%" stopColor={primaryColor} stopOpacity={0} />
              </linearGradient>
              {compareMode === 'multi' && (
                <linearGradient id="colorSecondary" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={secondaryColor} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={secondaryColor} stopOpacity={0} />
                </linearGradient>
              )}
            </defs>
            {commonElements}
            <Area
              type="monotone"
              dataKey={metric}
              name={METRIC_LABELS[metric]}
              stroke={primaryColor}
              fillOpacity={1}
              fill="url(#colorPrimary)"
            />
            {compareMode === 'multi' && (
              <Area
                type="monotone"
                dataKey={secondaryMetric}
                name={METRIC_LABELS[secondaryMetric]}
                stroke={secondaryColor}
                fillOpacity={1}
                fill="url(#colorSecondary)"
                yAxisId="right"
              />
            )}
            {movingAverage > 0 && (
              <Line
                type="monotone"
                dataKey="movingAvg"
                name={`${movingAverage}-period MA`}
                stroke="#f59e0b"
                strokeWidth={2}
                dot={false}
                strokeDasharray="5 5"
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      );
    }

    if (chartType === 'line') {
      return (
        <ResponsiveContainer width="100%" height={288}>
          <LineChart {...commonProps}>
            {commonElements}
            <Line
              type="monotone"
              dataKey={metric}
              name={METRIC_LABELS[metric]}
              stroke={primaryColor}
              strokeWidth={2}
              dot={{ fill: primaryColor, strokeWidth: 2 }}
            />
            {compareMode === 'multi' && (
              <Line
                type="monotone"
                dataKey={secondaryMetric}
                name={METRIC_LABELS[secondaryMetric]}
                stroke={secondaryColor}
                strokeWidth={2}
                dot={{ fill: secondaryColor, strokeWidth: 2 }}
                yAxisId="right"
              />
            )}
            {movingAverage > 0 && (
              <Line
                type="monotone"
                dataKey="movingAvg"
                name={`${movingAverage}-period MA`}
                stroke="#f59e0b"
                strokeWidth={2}
                dot={false}
                strokeDasharray="5 5"
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      );
    }

    // Bar chart
    return (
      <ResponsiveContainer width="100%" height={288}>
        <BarChart {...commonProps}>
          {commonElements}
          <Bar
            dataKey={metric}
            name={METRIC_LABELS[metric]}
            fill={primaryColor}
            radius={[4, 4, 0, 0]}
          />
          {compareMode === 'multi' && (
            <Bar
              dataKey={secondaryMetric}
              name={METRIC_LABELS[secondaryMetric]}
              fill={secondaryColor}
              radius={[4, 4, 0, 0]}
              yAxisId="right"
            />
          )}
        </BarChart>
      </ResponsiveContainer>
    );
  };

  return (
    <Card>
      <CardHeader className="space-y-4 pb-2">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <CardTitle>Interactive Metrics Chart</CardTitle>
          <Tabs value={groupBy} onValueChange={(v) => setGroupBy(v as GroupBy)}>
            <TabsList>
              <TabsTrigger value="month">Month</TabsTrigger>
              <TabsTrigger value="quarter">Quarter</TabsTrigger>
              <TabsTrigger value="year">Year</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Chart controls row 1 */}
        <div className="flex flex-wrap items-center gap-4">
          <Tabs value={chartType} onValueChange={(v) => setChartType(v as ChartType)}>
            <TabsList>
              <TabsTrigger value="area">Area</TabsTrigger>
              <TabsTrigger value="line">Line</TabsTrigger>
              <TabsTrigger value="bar">Bar</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-2">
            <Label htmlFor="metric-select" className="text-sm">
              Metric:
            </Label>
            <Select value={metric} onValueChange={(v) => setMetric(v as Metric)}>
              <SelectTrigger id="metric-select" className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="revenue">Revenue</SelectItem>
                <SelectItem value="netIncome">Net Income</SelectItem>
                <SelectItem value="hours">Hours</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Chart controls row 2 */}
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2">
            <Switch id="cumulative" checked={cumulative} onCheckedChange={setCumulative} />
            <Label htmlFor="cumulative" className="text-sm">
              Cumulative
            </Label>
          </div>

          <div className="flex items-center gap-2">
            <Switch id="billable" checked={billableOnly} onCheckedChange={setBillableOnly} />
            <Label htmlFor="billable" className="text-sm">
              Billable only
            </Label>
          </div>

          <div className="flex items-center gap-2">
            <Label htmlFor="ma-select" className="text-sm">
              Moving avg:
            </Label>
            <Select
              value={movingAverage.toString()}
              onValueChange={(v) => setMovingAverage(Number(v) as MovingAverage)}
            >
              <SelectTrigger id="ma-select" className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Off</SelectItem>
                <SelectItem value="3">3-period</SelectItem>
                <SelectItem value="6">6-period</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Label htmlFor="compare-select" className="text-sm">
              Compare:
            </Label>
            <Select value={compareMode} onValueChange={(v) => setCompareMode(v as CompareMode)}>
              <SelectTrigger id="compare-select" className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="multi">Multi-metric</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {compareMode === 'multi' && (
            <div className="flex items-center gap-2">
              <Label htmlFor="secondary-metric" className="text-sm">
                Secondary:
              </Label>
              <Select
                value={secondaryMetric}
                onValueChange={(v) => setSecondaryMetric(v as Metric)}
              >
                <SelectTrigger id="secondary-metric" className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(['revenue', 'netIncome', 'hours'] as Metric[])
                    .filter((m) => m !== metric)
                    .map((m) => (
                      <SelectItem key={m} value={m}>
                        {METRIC_LABELS[m]}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Chart */}
        {renderChart()}

        {/* Target tracking section */}
        <div className="space-y-4 border-t pt-4">
          <div className="flex flex-wrap items-center gap-4">
            <Label className="text-sm font-medium">Target:</Label>
            <Input
              type="number"
              placeholder="Enter target value"
              className="w-40"
              value={targetValue ?? ''}
              onChange={(e) => setTargetValue(e.target.value ? Number(e.target.value) : null)}
            />
            <span className="text-sm text-muted-foreground">for</span>
            <Select
              value={targetPeriod}
              onValueChange={(v) => setTargetPeriod(v as 'year' | 'quarter' | 'month')}
            >
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="year">Year</SelectItem>
                <SelectItem value="quarter">Quarter</SelectItem>
                <SelectItem value="month">Month</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Progress card */}
          {targetProgress && (
            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-medium">Target Progress</span>
                <Badge
                  variant={
                    targetProgress.status === 'green'
                      ? 'default'
                      : targetProgress.status === 'yellow'
                        ? 'secondary'
                        : 'destructive'
                  }
                >
                  {targetProgress.status === 'green'
                    ? 'On track'
                    : targetProgress.status === 'yellow'
                      ? 'At risk'
                      : 'Behind'}
                </Badge>
              </div>

              <div className="mb-2 flex items-center justify-between text-sm">
                <span>
                  Current: <strong>{formatValue(targetProgress.currentValue, metric)}</strong>
                </span>
                <span>
                  Target: <strong>{formatValue(targetProgress.targetValue, metric)}</strong>
                </span>
              </div>

              <Progress value={targetProgress.percentage} className="mb-3 h-2" />

              <div className="flex flex-wrap justify-between gap-2 text-sm text-muted-foreground">
                <span>Remaining: {formatValue(targetProgress.remaining, metric)}</span>
                <span>
                  {metric === 'hours' ? 'Daily' : 'Daily'} pace needed:{' '}
                  {formatValue(targetProgress.dailyPaceNeeded, metric)}
                </span>
                <span>Projected: {formatValue(targetProgress.projected, metric)}</span>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
