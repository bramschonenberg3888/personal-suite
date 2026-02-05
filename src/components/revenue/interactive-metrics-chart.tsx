'use client';

import { useMemo } from 'react';
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
import { Skeleton } from '@/components/ui/skeleton';
import { trpc } from '@/trpc/client';
import { usePersistedState } from '@/hooks/use-persisted-state';

interface InteractiveMetricsChartProps {
  startDate?: Date;
  endDate?: Date;
  clients?: string[];
}

type ChartType = 'area' | 'line' | 'bar';
type Metric = 'revenue' | 'netIncome' | 'hours';
type GroupBy = 'week' | 'month' | 'quarter' | 'year';
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
  const h = Math.floor(value);
  const m = Math.round((value - h) * 60);
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function formatPeriodLabel(period: string): string {
  // Handle month format: "2024-januari" → "Jan '24"
  const monthMatch = period.match(/^(\d{4})-(\w+)$/);
  if (monthMatch) {
    const [, year, month] = monthMatch;
    const monthAbbrev = month.slice(0, 3).charAt(0).toUpperCase() + month.slice(1, 3);
    return `${monthAbbrev} '${year.slice(2)}`;
  }

  // Handle week format: "2024-W01" → "W1 '24"
  const weekMatch = period.match(/^(\d{4})-W(\d{2})$/);
  if (weekMatch) {
    const [, year, week] = weekMatch;
    return `W${parseInt(week)} '${year.slice(2)}`;
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

// Colors for year-over-year comparison
const YEAR_COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16', // lime
];

export function InteractiveMetricsChart({
  startDate,
  endDate,
  clients,
}: InteractiveMetricsChartProps) {
  // Chart configuration state (persisted)
  const [chartType, setChartType] = usePersistedState<ChartType>(
    'finance.revenue.chart.chartType',
    'area'
  );
  const [metric, setMetric] = usePersistedState<Metric>('finance.revenue.chart.metric', 'revenue');
  const [groupBy, setGroupBy] = usePersistedState<GroupBy>(
    'finance.revenue.chart.groupBy',
    'month'
  );
  const [cumulative, setCumulative] = usePersistedState('finance.revenue.chart.cumulative', false);
  const [billableOnly, setBillableOnly] = usePersistedState(
    'finance.revenue.chart.billableOnly',
    false
  );
  const [movingAverage, setMovingAverage] = usePersistedState<MovingAverage>(
    'finance.revenue.chart.movingAverage',
    0
  );

  // Compare mode (persisted)
  const [compareMode, setCompareMode] = usePersistedState<CompareMode>(
    'finance.revenue.chart.compareMode',
    'none'
  );
  const [secondaryMetric, setSecondaryMetric] = usePersistedState<Metric>(
    'finance.revenue.chart.secondaryMetric',
    'hours'
  );

  // Fetch data
  const { data, isLoading } = trpc.revenue.entries.byPeriod.useQuery({
    groupBy,
    startDate,
    endDate,
    clients,
    billable: billableOnly ? true : undefined,
  });

  // Generate all periods for the date range
  const generatePeriods = useMemo(() => {
    if (!startDate || !endDate) return null;

    const periods: string[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (groupBy === 'week') {
      // Generate weeks
      const current = new Date(start);
      // Move to start of week (Monday)
      const day = current.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      current.setDate(current.getDate() + diff);

      while (current <= end) {
        const year = current.getFullYear();
        // ISO week number calculation
        const jan4 = new Date(year, 0, 4);
        const dayOfYear =
          Math.floor((current.getTime() - new Date(year, 0, 1).getTime()) / 86400000) + 1;
        const weekNum = Math.ceil((dayOfYear + jan4.getDay() - 1) / 7);
        periods.push(`${year}-W${String(weekNum).padStart(2, '0')}`);
        current.setDate(current.getDate() + 7);
      }
    } else if (groupBy === 'month') {
      // Generate months
      const current = new Date(start.getFullYear(), start.getMonth(), 1);
      const monthNames = [
        'januari',
        'februari',
        'maart',
        'april',
        'mei',
        'juni',
        'juli',
        'augustus',
        'september',
        'oktober',
        'november',
        'december',
      ];
      while (current <= end) {
        periods.push(`${current.getFullYear()}-${monthNames[current.getMonth()]}`);
        current.setMonth(current.getMonth() + 1);
      }
    } else if (groupBy === 'quarter') {
      // Generate quarters
      const startQuarter = Math.floor(start.getMonth() / 3) + 1;
      const startYear = start.getFullYear();
      const endQuarter = Math.floor(end.getMonth() / 3) + 1;
      const endYear = end.getFullYear();

      let year = startYear;
      let quarter = startQuarter;
      while (year < endYear || (year === endYear && quarter <= endQuarter)) {
        periods.push(`${year} Q${quarter}`);
        quarter++;
        if (quarter > 4) {
          quarter = 1;
          year++;
        }
      }
    } else if (groupBy === 'year') {
      // Generate years
      for (let year = start.getFullYear(); year <= end.getFullYear(); year++) {
        periods.push(year.toString());
      }
    }

    return periods;
  }, [startDate, endDate, groupBy]);

  // Extract year from period string
  const extractYear = (period: string): string | null => {
    // Handle month format: "2024-januari"
    const monthMatch = period.match(/^(\d{4})-\w+$/);
    if (monthMatch) return monthMatch[1];

    // Handle week format: "2024-W01"
    const weekMatch = period.match(/^(\d{4})-W\d{2}$/);
    if (weekMatch) return weekMatch[1];

    // Handle quarter format: "2024 Q1"
    const quarterMatch = period.match(/^(\d{4}) Q\d$/);
    if (quarterMatch) return quarterMatch[1];

    // Handle year format: "2024"
    if (/^\d{4}$/.test(period)) return period;

    return null;
  };

  // Extract period without year for YoY comparison
  const extractPeriodWithoutYear = (period: string): string => {
    // Handle month format: "2024-januari" → "januari"
    const monthMatch = period.match(/^\d{4}-(\w+)$/);
    if (monthMatch) return monthMatch[1];

    // Handle week format: "2024-W01" → "W01"
    const weekMatch = period.match(/^\d{4}-(W\d{2})$/);
    if (weekMatch) return weekMatch[1];

    // Handle quarter format: "2024 Q1" → "Q1"
    const quarterMatch = period.match(/^\d{4} (Q\d)$/);
    if (quarterMatch) return quarterMatch[1];

    return period;
  };

  // Get years present in data
  const yearsInData = useMemo(() => {
    if (!data) return [];
    const years = new Set<string>();
    for (const item of data) {
      const year = extractYear(item.period);
      if (year) years.add(year);
    }
    return Array.from(years).sort();
  }, [data]);

  // Check if YoY mode should be active (enabled and multiple years)
  const isYoyActive = compareMode === 'yoy' && yearsInData.length > 1;

  // Transform data based on settings
  const chartData = useMemo(() => {
    if (!data) return [];

    // Create a map of existing data
    const dataMap = new Map(
      data.map((item) => [
        item.period,
        { revenue: item.revenue, netIncome: item.netIncome, hours: item.hours },
      ])
    );

    // If we have generated periods, use them; otherwise use data as-is
    let transformed: {
      period: string;
      revenue: number;
      netIncome: number;
      hours: number;
      movingAvg?: number | null;
    }[];

    if (generatePeriods && generatePeriods.length > 0) {
      transformed = generatePeriods.map((period) => {
        const existing = dataMap.get(period);
        return {
          period,
          revenue: existing?.revenue ?? 0,
          netIncome: existing?.netIncome ?? 0,
          hours: existing?.hours ?? 0,
        };
      });
    } else {
      transformed = data.map((item) => ({
        period: item.period,
        revenue: item.revenue,
        netIncome: item.netIncome,
        hours: item.hours,
      }));
    }

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
  }, [data, generatePeriods, cumulative, movingAverage, metric]);

  // Transform data for year-over-year comparison
  const yoyChartData = useMemo(() => {
    if (!isYoyActive || !data) return [];

    // Group data by period (without year)
    const periodMap = new Map<string, Record<string, number | string>>();

    for (const item of data) {
      const periodWithoutYear = extractPeriodWithoutYear(item.period);
      const year = extractYear(item.period);
      if (!year) continue;

      if (!periodMap.has(periodWithoutYear)) {
        periodMap.set(periodWithoutYear, { period: periodWithoutYear });
      }

      const entry = periodMap.get(periodWithoutYear)!;
      entry[`${metric}_${year}`] = item[metric];
    }

    // Convert to array and sort by period
    const result = Array.from(periodMap.values());

    // Sort periods logically
    result.sort((a, b) => {
      const periodA = a.period as string;
      const periodB = b.period as string;

      // Week sort: W01 < W02
      const weekMatchA = periodA.match(/^W(\d{2})$/);
      const weekMatchB = periodB.match(/^W(\d{2})$/);
      if (weekMatchA && weekMatchB) {
        return parseInt(weekMatchA[1]) - parseInt(weekMatchB[1]);
      }

      // Quarter sort: Q1 < Q2
      const quarterMatchA = periodA.match(/^Q(\d)$/);
      const quarterMatchB = periodB.match(/^Q(\d)$/);
      if (quarterMatchA && quarterMatchB) {
        return parseInt(quarterMatchA[1]) - parseInt(quarterMatchB[1]);
      }

      // Month sort using Dutch month names
      const monthOrder = [
        'januari',
        'februari',
        'maart',
        'april',
        'mei',
        'juni',
        'juli',
        'augustus',
        'september',
        'oktober',
        'november',
        'december',
      ];
      const monthIndexA = monthOrder.indexOf(periodA.toLowerCase());
      const monthIndexB = monthOrder.indexOf(periodB.toLowerCase());
      if (monthIndexA !== -1 && monthIndexB !== -1) {
        return monthIndexA - monthIndexB;
      }

      return periodA.localeCompare(periodB);
    });

    // Apply cumulative if enabled (per year)
    if (cumulative) {
      const cumulativeSums: Record<string, number> = {};
      return result.map((item) => {
        const newItem = { ...item };
        for (const year of yearsInData) {
          const key = `${metric}_${year}`;
          const value = item[key];
          if (typeof value === 'number') {
            cumulativeSums[key] = (cumulativeSums[key] || 0) + value;
            newItem[key] = cumulativeSums[key];
          }
        }
        return newItem;
      });
    }

    return result;
  }, [isYoyActive, data, metric, yearsInData, cumulative]);

  // Primary color based on metric
  const primaryColor = METRIC_COLORS[metric];
  const secondaryColor = METRIC_COLORS[secondaryMetric];

  // Format period label for YoY mode (without year)
  function formatYoyPeriodLabel(period: string): string {
    // Month names: capitalize first letter
    const monthOrder = [
      'januari',
      'februari',
      'maart',
      'april',
      'mei',
      'juni',
      'juli',
      'augustus',
      'september',
      'oktober',
      'november',
      'december',
    ];
    const monthIndex = monthOrder.indexOf(period.toLowerCase());
    if (monthIndex !== -1) {
      return period.charAt(0).toUpperCase() + period.slice(1, 3);
    }

    // Week: W01 → W1
    const weekMatch = period.match(/^W(\d{2})$/);
    if (weekMatch) {
      return `W${parseInt(weekMatch[1])}`;
    }

    // Quarter: Q1 → Q1
    return period;
  }

  // Render the appropriate chart type
  const renderChart = () => {
    if (isLoading) {
      return <Skeleton className="h-72 w-full" />;
    }

    // Use yoyChartData if YoY mode is active
    const displayData = isYoyActive ? yoyChartData : chartData;

    if (displayData.length === 0) {
      return (
        <div className="text-muted-foreground flex h-72 items-center justify-center">
          No data available for the selected period
        </div>
      );
    }

    const commonProps = {
      data: displayData,
      margin: { top: 10, right: 30, left: 0, bottom: 0 },
    };

    const xAxisProps = {
      dataKey: 'period',
      tick: { fontSize: 12 },
      tickFormatter: isYoyActive ? formatYoyPeriodLabel : formatPeriodLabel,
    };

    const yAxisProps = {
      tick: { fontSize: 12 },
      tickFormatter: (value: number) => formatValue(value, metric),
      width: 80,
    };

    const tooltipProps = {
      formatter: (value: number | undefined, name: string | undefined) => {
        if (value === undefined) return '';
        // In YoY mode, name is like "2024" or "2023"
        if (isYoyActive) {
          return formatValue(value, metric);
        }
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
      </>
    );

    // Render YoY chart with multiple lines per year
    if (isYoyActive) {
      if (chartType === 'area') {
        return (
          <ResponsiveContainer width="100%" height={288}>
            <AreaChart {...commonProps}>
              <defs>
                {yearsInData.map((year, index) => (
                  <linearGradient key={year} id={`colorYear${year}`} x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor={YEAR_COLORS[index % YEAR_COLORS.length]}
                      stopOpacity={0.3}
                    />
                    <stop
                      offset="95%"
                      stopColor={YEAR_COLORS[index % YEAR_COLORS.length]}
                      stopOpacity={0}
                    />
                  </linearGradient>
                ))}
              </defs>
              {commonElements}
              {yearsInData.map((year, index) => (
                <Area
                  key={year}
                  type="monotone"
                  dataKey={`${metric}_${year}`}
                  name={year}
                  stroke={YEAR_COLORS[index % YEAR_COLORS.length]}
                  fillOpacity={1}
                  fill={`url(#colorYear${year})`}
                  connectNulls
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        );
      }

      if (chartType === 'line') {
        return (
          <ResponsiveContainer width="100%" height={288}>
            <LineChart {...commonProps}>
              {commonElements}
              {yearsInData.map((year, index) => (
                <Line
                  key={year}
                  type="monotone"
                  dataKey={`${metric}_${year}`}
                  name={year}
                  stroke={YEAR_COLORS[index % YEAR_COLORS.length]}
                  strokeWidth={2}
                  dot={{ fill: YEAR_COLORS[index % YEAR_COLORS.length], strokeWidth: 2 }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        );
      }

      // Bar chart for YoY
      return (
        <ResponsiveContainer width="100%" height={288}>
          <BarChart {...commonProps}>
            {commonElements}
            {yearsInData.map((year, index) => (
              <Bar
                key={year}
                dataKey={`${metric}_${year}`}
                name={year}
                fill={YEAR_COLORS[index % YEAR_COLORS.length]}
                radius={[4, 4, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      );
    }

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
              <TabsTrigger value="week">Week</TabsTrigger>
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
              <SelectTrigger id="compare-select" className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="yoy">Year over Year</SelectItem>
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

      <CardContent>{renderChart()}</CardContent>
    </Card>
  );
}
