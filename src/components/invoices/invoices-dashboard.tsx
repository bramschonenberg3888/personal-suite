'use client';

import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
  PieChart,
  Pie,
} from 'recharts';
import {
  RefreshCw,
  Loader2,
  AlertCircle,
  Database,
  X,
  FileText,
  Receipt,
  Clock,
  TrendingUp,
  Calculator,
  Users,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { trpc } from '@/trpc/client';
import { NotionSettingsDialog } from '@/components/revenue/notion-settings-dialog';
import { getWeek } from 'date-fns';
import { usePersistedState } from '@/hooks/use-persisted-state';

const VAT_RATE = 0.21;

const STATUS_COLORS: Record<string, string> = {
  betaald: '#10b981', // green - paid
  gefactureerd: '#f59e0b', // amber - invoiced, awaiting payment
  verzonden: '#3b82f6', // blue - sent
  concept: '#6b7280', // gray - draft
  default: '#6b7280',
};

const CHART_COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // purple
  '#06b6d4', // cyan
];

type ChartType = 'bar' | 'line' | 'area';
type ChartGroupBy = 'month' | 'quarter' | 'year';

export function InvoicesDashboard() {
  const [selectedYear, setSelectedYear] = usePersistedState('finance.invoices.selectedYear', 'all');
  const [selectedQuarter, setSelectedQuarter] = usePersistedState(
    'finance.invoices.selectedQuarter',
    'all'
  );
  const [selectedMonth, setSelectedMonth] = usePersistedState(
    'finance.invoices.selectedMonth',
    'all'
  );
  const [selectedWeek, setSelectedWeek] = usePersistedState('finance.invoices.selectedWeek', 'all');
  const [selectedStatus, setSelectedStatus] = usePersistedState(
    'finance.invoices.selectedStatus',
    'all'
  );
  const [selectedClientType, setSelectedClientType] = usePersistedState(
    'finance.invoices.selectedClientType',
    'all'
  );
  const [chartType, setChartType] = usePersistedState<ChartType>(
    'finance.invoices.chartType',
    'bar'
  );
  const [chartGroupBy, setChartGroupBy] = usePersistedState<ChartGroupBy>(
    'finance.invoices.chartGroupBy',
    'month'
  );

  const utils = trpc.useUtils();
  const { data: connection, isLoading: connectionLoading } = trpc.revenue.connection.get.useQuery();

  const { data: filterOptions } = trpc.revenue.entries.invoiceFilterOptions.useQuery(undefined, {
    enabled: !!connection,
  });

  const { data: invoices, isLoading: invoicesLoading } = trpc.revenue.entries.byInvoice.useQuery(
    {
      statuses: selectedStatus !== 'all' ? [selectedStatus] : undefined,
      clientTypes: selectedClientType !== 'all' ? [selectedClientType] : undefined,
    },
    { enabled: !!connection }
  );

  const syncMutation = trpc.revenue.sync.useMutation({
    onSuccess: () => {
      utils.revenue.entries.invalidate();
      utils.revenue.connection.invalidate();
    },
  });

  // Derive available years, quarters, months, weeks from invoice data
  const dateFilters = useMemo(() => {
    if (!invoices) return { years: [], quarters: [], months: [], weeks: [] };

    const years = new Set<number>();
    const quarters = new Set<string>();
    const months = new Set<number>();
    const weeks = new Set<number>();

    for (const inv of invoices) {
      if (inv.invoiceDate) {
        const date = new Date(inv.invoiceDate);
        years.add(date.getFullYear());
        quarters.add(`Q${Math.ceil((date.getMonth() + 1) / 3)}`);
        months.add(date.getMonth() + 1);
        weeks.add(getWeek(date, { weekStartsOn: 1 }));
      }
    }

    return {
      years: Array.from(years).sort((a, b) => b - a),
      quarters: ['Q1', 'Q2', 'Q3', 'Q4'].filter((q) => quarters.has(q)),
      months: Array.from(months).sort((a, b) => a - b),
      weeks: Array.from(weeks).sort((a, b) => a - b),
    };
  }, [invoices]);

  // Filter and sort invoices
  const filteredInvoices = useMemo(() => {
    if (!invoices) return [];

    return invoices
      .filter((inv) => {
        if (!inv.invoiceDate) return selectedYear === 'all';
        const date = new Date(inv.invoiceDate);
        const year = date.getFullYear();
        const quarter = `Q${Math.ceil((date.getMonth() + 1) / 3)}`;
        const month = date.getMonth() + 1;
        const week = getWeek(date, { weekStartsOn: 1 });

        if (selectedYear !== 'all' && year !== parseInt(selectedYear)) return false;
        if (selectedQuarter !== 'all' && quarter !== selectedQuarter) return false;
        if (selectedMonth !== 'all' && month !== parseInt(selectedMonth)) return false;
        if (selectedWeek !== 'all' && week !== parseInt(selectedWeek)) return false;

        return true;
      })
      .sort((a, b) => {
        const dateA = a.invoiceDate ? new Date(a.invoiceDate).getTime() : 0;
        const dateB = b.invoiceDate ? new Date(b.invoiceDate).getTime() : 0;
        if (dateA !== dateB) return dateB - dateA;
        return (b.invoiceNumber ?? '').localeCompare(a.invoiceNumber ?? '');
      });
  }, [invoices, selectedYear, selectedQuarter, selectedMonth, selectedWeek]);

  // Group invoices by year
  const groupedByYear = useMemo(() => {
    const groups = new Map<number, typeof filteredInvoices>();

    for (const inv of filteredInvoices) {
      const year = inv.invoiceDate ? new Date(inv.invoiceDate).getFullYear() : 0;
      const existing = groups.get(year) ?? [];
      existing.push(inv);
      groups.set(year, existing);
    }

    return Array.from(groups.entries()).sort(([a], [b]) => b - a);
  }, [filteredInvoices]);

  // Calculate metrics
  const metrics = useMemo(() => {
    if (!filteredInvoices.length) {
      return {
        totalRevenue: 0,
        paidTotal: 0,
        outstandingTotal: 0,
        invoiceCount: 0,
        avgInvoice: 0,
        totalVat: 0,
        totalIncomeTax: 0,
      };
    }

    const totalRevenue = filteredInvoices.reduce((sum, inv) => sum + inv.revenue, 0);
    const paidTotal = filteredInvoices
      .filter((inv) => inv.invoiceStatus?.toLowerCase() === 'betaald')
      .reduce((sum, inv) => sum + inv.revenue, 0);
    const outstandingTotal = filteredInvoices
      .filter((inv) => inv.invoiceStatus?.toLowerCase() === 'gefactureerd')
      .reduce((sum, inv) => sum + inv.revenue, 0);
    const invoiceCount = filteredInvoices.length;
    const avgInvoice = totalRevenue / invoiceCount;
    const totalVat = totalRevenue * VAT_RATE;
    const totalIncomeTax = filteredInvoices.reduce((sum, inv) => sum + inv.taxReservation, 0);

    return {
      totalRevenue,
      paidTotal,
      outstandingTotal,
      invoiceCount,
      avgInvoice,
      totalVat,
      totalIncomeTax,
    };
  }, [filteredInvoices]);

  // Status breakdown for chart
  const statusBreakdown = useMemo(() => {
    if (!filteredInvoices.length) return [];

    const byStatus = new Map<string, { count: number; revenue: number }>();

    for (const inv of filteredInvoices) {
      const status = inv.invoiceStatus ?? 'Unknown';
      const current = byStatus.get(status) ?? { count: 0, revenue: 0 };
      current.count += 1;
      current.revenue += inv.revenue;
      byStatus.set(status, current);
    }

    return Array.from(byStatus.entries())
      .map(([status, data]) => ({
        name: status,
        value: data.revenue,
        count: data.count,
      }))
      .sort((a, b) => b.value - a.value);
  }, [filteredInvoices]);

  // Client type breakdown for chart
  const clientTypeBreakdown = useMemo(() => {
    if (!filteredInvoices.length) return [];

    const byType = new Map<string, { count: number; revenue: number }>();

    for (const inv of filteredInvoices) {
      const clientType = inv.clientType ?? 'Unknown';
      const current = byType.get(clientType) ?? { count: 0, revenue: 0 };
      current.count += 1;
      current.revenue += inv.revenue;
      byType.set(clientType, current);
    }

    return Array.from(byType.entries())
      .map(([clientType, data]) => ({
        name: clientType,
        value: data.revenue,
        count: data.count,
      }))
      .sort((a, b) => b.value - a.value);
  }, [filteredInvoices]);

  // Period breakdown for chart (with gap filling)
  const periodBreakdown = useMemo(() => {
    if (!filteredInvoices.length) return [];

    const byPeriod = new Map<string, number>();
    let minDate: Date | null = null;
    let maxDate: Date | null = null;

    // Group by period and find date range
    for (const inv of filteredInvoices) {
      if (inv.invoiceDate) {
        const date = new Date(inv.invoiceDate);
        if (!minDate || date < minDate) minDate = date;
        if (!maxDate || date > maxDate) maxDate = date;

        let key: string;
        if (chartGroupBy === 'month') {
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        } else if (chartGroupBy === 'quarter') {
          const quarter = Math.ceil((date.getMonth() + 1) / 3);
          key = `${date.getFullYear()}-Q${quarter}`;
        } else {
          key = `${date.getFullYear()}`;
        }
        byPeriod.set(key, (byPeriod.get(key) ?? 0) + inv.revenue);
      }
    }

    if (!minDate || !maxDate) return [];

    // Generate all periods in range (fill gaps with 0)
    const periods: { period: string; revenue: number }[] = [];

    if (chartGroupBy === 'month') {
      const current = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
      const end = new Date(maxDate.getFullYear(), maxDate.getMonth(), 1);
      while (current <= end) {
        const key = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
        periods.push({ period: key, revenue: byPeriod.get(key) ?? 0 });
        current.setMonth(current.getMonth() + 1);
      }
    } else if (chartGroupBy === 'quarter') {
      const startQ = Math.ceil((minDate.getMonth() + 1) / 3);
      const endQ = Math.ceil((maxDate.getMonth() + 1) / 3);
      let year = minDate.getFullYear();
      let quarter = startQ;
      while (year < maxDate.getFullYear() || (year === maxDate.getFullYear() && quarter <= endQ)) {
        const key = `${year}-Q${quarter}`;
        periods.push({ period: key, revenue: byPeriod.get(key) ?? 0 });
        quarter++;
        if (quarter > 4) {
          quarter = 1;
          year++;
        }
      }
    } else {
      for (let year = minDate.getFullYear(); year <= maxDate.getFullYear(); year++) {
        const key = `${year}`;
        periods.push({ period: key, revenue: byPeriod.get(key) ?? 0 });
      }
    }

    return periods;
  }, [filteredInvoices, chartGroupBy]);

  const handleSync = () => {
    syncMutation.mutate();
  };

  const clearFilters = () => {
    setSelectedYear('all');
    setSelectedQuarter('all');
    setSelectedMonth('all');
    setSelectedWeek('all');
    setSelectedStatus('all');
    setSelectedClientType('all');
  };

  const hasFilters =
    selectedYear !== 'all' ||
    selectedQuarter !== 'all' ||
    selectedMonth !== 'all' ||
    selectedWeek !== 'all' ||
    selectedStatus !== 'all' ||
    selectedClientType !== 'all';

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR',
    }).format(value);
  };

  const formatCurrencyShort = (value: number) => {
    if (value >= 1000) {
      return new Intl.NumberFormat('nl-NL', {
        style: 'currency',
        currency: 'EUR',
        maximumFractionDigits: 0,
      }).format(value);
    }
    return formatCurrency(value);
  };

  const formatDate = (date: Date | null) => {
    if (!date) return '-';
    return new Intl.DateTimeFormat('nl-NL', {
      dateStyle: 'medium',
    }).format(new Date(date));
  };

  const monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];

  // No connection configured
  if (!connectionLoading && !connection?.revenueDatabaseId) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="bg-muted rounded-full p-4">
          <Database className="text-muted-foreground h-8 w-8" />
        </div>
        <h2 className="mt-4 text-xl font-semibold">Connect Your Notion Database</h2>
        <p className="text-muted-foreground mt-2 max-w-sm text-center">
          To view invoices, connect your Notion time tracking database first via the Revenue tab.
        </p>
        <div className="mt-6">
          <NotionSettingsDialog
            trigger={
              <Button size="lg">
                <Database className="mr-2 h-4 w-4" />
                Connect Notion
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Invoice Overview</h2>
          {connection?.revenueLastSyncAt && (
            <p className="text-muted-foreground mt-1 text-sm">
              Last synced:{' '}
              {new Intl.DateTimeFormat('nl-NL', {
                dateStyle: 'medium',
                timeStyle: 'short',
              }).format(new Date(connection.revenueLastSyncAt))}
            </p>
          )}
        </div>
        <Button onClick={handleSync} disabled={syncMutation.isPending}>
          {syncMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Syncing...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Sync Now
            </>
          )}
        </Button>
      </div>

      {/* Sync error */}
      {syncMutation.error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex items-center gap-2 py-3">
            <AlertCircle className="h-5 w-5 text-red-500" />
            <span className="text-red-700">{syncMutation.error.message}</span>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="flex flex-wrap items-end justify-between gap-4 pt-6">
          <div className="flex flex-wrap gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Year</label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-28">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {dateFilters.years.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Quarter</label>
              <Select value={selectedQuarter} onValueChange={setSelectedQuarter}>
                <SelectTrigger className="w-28">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {dateFilters.quarters.map((q) => (
                    <SelectItem key={q} value={q}>
                      {q}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Month</label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {dateFilters.months.map((m) => (
                    <SelectItem key={m} value={m.toString()}>
                      {monthNames[m - 1]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Week</label>
              <Select value={selectedWeek} onValueChange={setSelectedWeek}>
                <SelectTrigger className="w-28">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {dateFilters.weeks.map((w) => (
                    <SelectItem key={w} value={w.toString()}>
                      Week {w}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {filterOptions && filterOptions.statuses.length > 0 && (
              <div>
                <label className="mb-1 block text-sm font-medium">Status</label>
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    {filterOptions.statuses.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {filterOptions && filterOptions.clientTypes.length > 0 && (
              <div>
                <label className="mb-1 block text-sm font-medium">Client Type</label>
                <Select value={selectedClientType} onValueChange={setSelectedClientType}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    {filterOptions.clientTypes.map((ct) => (
                      <SelectItem key={ct} value={ct}>
                        {ct}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="mr-1 h-4 w-4" />
              Clear filters
            </Button>
          )}
        </CardContent>
      </Card>

      {/* KPI Cards */}
      {invoicesLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardContent className="py-4">
                <div className="bg-muted h-16 animate-pulse rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <Card>
            <CardContent className="flex items-center gap-4 py-4">
              <div className="bg-primary/10 rounded-full p-3">
                <TrendingUp className="text-primary h-5 w-5" />
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Total Revenue</p>
                <p className="text-xl font-semibold">{formatCurrencyShort(metrics.totalRevenue)}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center gap-4 py-4">
              <div className="rounded-full bg-green-500/10 p-3">
                <FileText className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Paid</p>
                <p className="text-xl font-semibold">{formatCurrencyShort(metrics.paidTotal)}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center gap-4 py-4">
              <div className="rounded-full bg-orange-500/10 p-3">
                <Clock className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Outstanding</p>
                <p className="text-xl font-semibold">
                  {formatCurrencyShort(metrics.outstandingTotal)}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center gap-4 py-4">
              <div className="bg-muted rounded-full p-3">
                <Receipt className="text-muted-foreground h-5 w-5" />
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Invoices</p>
                <p className="text-xl font-semibold">{metrics.invoiceCount}</p>
                <p className="text-muted-foreground text-xs">
                  Avg: {formatCurrencyShort(metrics.avgInvoice)}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center gap-4 py-4">
              <div className="rounded-full bg-blue-500/10 p-3">
                <Calculator className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Total VAT (21%)</p>
                <p className="text-xl font-semibold">{formatCurrencyShort(metrics.totalVat)}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center gap-4 py-4">
              <div className="rounded-full bg-purple-500/10 p-3">
                <Users className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Income Tax</p>
                <p className="text-xl font-semibold">
                  {formatCurrencyShort(metrics.totalIncomeTax)}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Charts */}
      {!invoicesLoading && filteredInvoices.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Revenue Over Time Chart */}
          {periodBreakdown.length > 0 && (
            <Card className="lg:col-span-2">
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4 space-y-0">
                <CardTitle className="text-base">Revenue Over Time</CardTitle>
                <div className="flex flex-wrap items-center gap-2">
                  <Tabs value={chartType} onValueChange={(v) => setChartType(v as ChartType)}>
                    <TabsList>
                      <TabsTrigger value="bar">Bar</TabsTrigger>
                      <TabsTrigger value="line">Line</TabsTrigger>
                      <TabsTrigger value="area">Area</TabsTrigger>
                    </TabsList>
                  </Tabs>
                  <Tabs
                    value={chartGroupBy}
                    onValueChange={(v) => setChartGroupBy(v as ChartGroupBy)}
                  >
                    <TabsList>
                      <TabsTrigger value="month">Month</TabsTrigger>
                      <TabsTrigger value="quarter">Quarter</TabsTrigger>
                      <TabsTrigger value="year">Year</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    {chartType === 'bar' ? (
                      <BarChart data={periodBreakdown}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis
                          dataKey="period"
                          tick={{ fontSize: 12 }}
                          tickFormatter={(value) => {
                            if (chartGroupBy === 'month') {
                              const [year, month] = value.split('-');
                              return `${monthNames[parseInt(month) - 1]?.slice(0, 3)} '${year.slice(2)}`;
                            } else if (chartGroupBy === 'quarter') {
                              const [year, q] = value.split('-');
                              return `${q} '${year.slice(2)}`;
                            }
                            return value;
                          }}
                        />
                        <YAxis
                          tick={{ fontSize: 12 }}
                          tickFormatter={(value) => `€${(value / 1000).toFixed(0)}k`}
                        />
                        <Tooltip
                          formatter={(value) => [formatCurrency(value as number), 'Revenue']}
                          labelFormatter={(label) => {
                            if (chartGroupBy === 'month') {
                              const [year, month] = String(label).split('-');
                              return `${monthNames[parseInt(month) - 1]} ${year}`;
                            } else if (chartGroupBy === 'quarter') {
                              const [year, q] = String(label).split('-');
                              return `${q} ${year}`;
                            }
                            return label;
                          }}
                          contentStyle={{
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '6px',
                          }}
                        />
                        <Legend />
                        <Bar
                          dataKey="revenue"
                          name="Revenue"
                          fill="#3b82f6"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    ) : chartType === 'line' ? (
                      <LineChart data={periodBreakdown}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis
                          dataKey="period"
                          tick={{ fontSize: 12 }}
                          tickFormatter={(value) => {
                            if (chartGroupBy === 'month') {
                              const [year, month] = value.split('-');
                              return `${monthNames[parseInt(month) - 1]?.slice(0, 3)} '${year.slice(2)}`;
                            } else if (chartGroupBy === 'quarter') {
                              const [year, q] = value.split('-');
                              return `${q} '${year.slice(2)}`;
                            }
                            return value;
                          }}
                        />
                        <YAxis
                          tick={{ fontSize: 12 }}
                          tickFormatter={(value) => `€${(value / 1000).toFixed(0)}k`}
                        />
                        <Tooltip
                          formatter={(value) => [formatCurrency(value as number), 'Revenue']}
                          labelFormatter={(label) => {
                            if (chartGroupBy === 'month') {
                              const [year, month] = String(label).split('-');
                              return `${monthNames[parseInt(month) - 1]} ${year}`;
                            } else if (chartGroupBy === 'quarter') {
                              const [year, q] = String(label).split('-');
                              return `${q} ${year}`;
                            }
                            return label;
                          }}
                          contentStyle={{
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '6px',
                          }}
                        />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="revenue"
                          name="Revenue"
                          stroke="#3b82f6"
                          strokeWidth={2}
                          dot={{ fill: '#3b82f6', strokeWidth: 2 }}
                        />
                      </LineChart>
                    ) : (
                      <AreaChart data={periodBreakdown}>
                        <defs>
                          <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis
                          dataKey="period"
                          tick={{ fontSize: 12 }}
                          tickFormatter={(value) => {
                            if (chartGroupBy === 'month') {
                              const [year, month] = value.split('-');
                              return `${monthNames[parseInt(month) - 1]?.slice(0, 3)} '${year.slice(2)}`;
                            } else if (chartGroupBy === 'quarter') {
                              const [year, q] = value.split('-');
                              return `${q} '${year.slice(2)}`;
                            }
                            return value;
                          }}
                        />
                        <YAxis
                          tick={{ fontSize: 12 }}
                          tickFormatter={(value) => `€${(value / 1000).toFixed(0)}k`}
                        />
                        <Tooltip
                          formatter={(value) => [formatCurrency(value as number), 'Revenue']}
                          labelFormatter={(label) => {
                            if (chartGroupBy === 'month') {
                              const [year, month] = String(label).split('-');
                              return `${monthNames[parseInt(month) - 1]} ${year}`;
                            } else if (chartGroupBy === 'quarter') {
                              const [year, q] = String(label).split('-');
                              return `${q} ${year}`;
                            }
                            return label;
                          }}
                          contentStyle={{
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '6px',
                          }}
                        />
                        <Legend />
                        <Area
                          type="monotone"
                          dataKey="revenue"
                          name="Revenue"
                          stroke="#3b82f6"
                          fillOpacity={1}
                          fill="url(#colorRevenue)"
                        />
                      </AreaChart>
                    )}
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Status Breakdown */}
          {statusBreakdown.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">By Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusBreakdown}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={({ name, percent }) =>
                          `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`
                        }
                        labelLine={false}
                      >
                        {statusBreakdown.map((entry, index) => (
                          <Cell
                            key={entry.name}
                            fill={
                              STATUS_COLORS[entry.name.toLowerCase()] ??
                              CHART_COLORS[index % CHART_COLORS.length]
                            }
                          />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => formatCurrency(value as number)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 space-y-2">
                  {statusBreakdown.map((status, index) => (
                    <div key={status.name} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div
                          className="h-3 w-3 rounded-full"
                          style={{
                            backgroundColor:
                              STATUS_COLORS[status.name.toLowerCase()] ??
                              CHART_COLORS[index % CHART_COLORS.length],
                          }}
                        />
                        <span>{status.name}</span>
                        <span className="text-muted-foreground">({status.count})</span>
                      </div>
                      <span className="font-medium">{formatCurrency(status.value)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Client Type Breakdown */}
          {clientTypeBreakdown.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">By Client Type</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={clientTypeBreakdown} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis
                        type="number"
                        tick={{ fontSize: 12 }}
                        tickFormatter={(value) => `€${(value / 1000).toFixed(0)}k`}
                      />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={80} />
                      <Tooltip
                        formatter={(value) => [formatCurrency(value as number), 'Revenue']}
                      />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                        {clientTypeBreakdown.map((entry, index) => (
                          <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 space-y-2">
                  {clientTypeBreakdown.map((ct, index) => (
                    <div key={ct.name} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                        />
                        <span>{ct.name}</span>
                        <span className="text-muted-foreground">({ct.count})</span>
                      </div>
                      <span className="font-medium">{formatCurrency(ct.value)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Invoice Table grouped by year */}
      {invoicesLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
        </div>
      ) : filteredInvoices.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-muted-foreground text-center">
              No invoices found. Make sure your Notion database has entries with invoice numbers.
            </div>
          </CardContent>
        </Card>
      ) : (
        groupedByYear.map(([year, yearInvoices]) => {
          const yearRevenue = yearInvoices.reduce((sum, inv) => sum + inv.revenue, 0);
          const yearVat = yearRevenue * VAT_RATE;
          const yearIncomeTax = yearInvoices.reduce((sum, inv) => sum + inv.taxReservation, 0);

          return (
            <Card key={year}>
              <CardContent className="pt-6">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
                  <h3 className="text-lg font-semibold">{year || 'No Date'}</h3>
                  <div className="flex flex-wrap items-center gap-6 text-sm">
                    <span className="text-muted-foreground">
                      {yearInvoices.length} invoice{yearInvoices.length !== 1 ? 's' : ''}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <TrendingUp className="text-primary h-4 w-4" />
                      <span className="font-medium">{formatCurrencyShort(yearRevenue)}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Calculator className="h-4 w-4 text-blue-600" />
                      <span className="text-muted-foreground">VAT</span>
                      <span className="font-medium">{formatCurrencyShort(yearVat)}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Users className="h-4 w-4 text-purple-600" />
                      <span className="text-muted-foreground">Tax</span>
                      <span className="font-medium">{formatCurrencyShort(yearIncomeTax)}</span>
                    </div>
                  </div>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Invoice Date</TableHead>
                      <TableHead>Client Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Amount (excl. VAT)</TableHead>
                      <TableHead className="text-right">VAT</TableHead>
                      <TableHead className="text-right">Income Tax</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {yearInvoices.map((invoice) => {
                      const vat = invoice.revenue * VAT_RATE;
                      return (
                        <TableRow key={invoice.invoiceNumber}>
                          <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                          <TableCell>{formatDate(invoice.invoiceDate)}</TableCell>
                          <TableCell>{invoice.clientType ?? '-'}</TableCell>
                          <TableCell>
                            {invoice.invoiceStatus ? (
                              <Badge
                                variant="outline"
                                style={{
                                  borderColor:
                                    STATUS_COLORS[invoice.invoiceStatus.toLowerCase()] ??
                                    STATUS_COLORS.default,
                                  backgroundColor: `${STATUS_COLORS[invoice.invoiceStatus.toLowerCase()] ?? STATUS_COLORS.default}20`,
                                  color:
                                    STATUS_COLORS[invoice.invoiceStatus.toLowerCase()] ??
                                    STATUS_COLORS.default,
                                }}
                              >
                                {invoice.invoiceStatus}
                              </Badge>
                            ) : (
                              '-'
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(invoice.revenue)}
                          </TableCell>
                          <TableCell className="text-right">{formatCurrency(vat)}</TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(invoice.taxReservation)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
