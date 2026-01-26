'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
  Cell,
} from 'recharts';
import {
  Target,
  TrendingUp,
  TrendingDown,
  Calendar,
  Clock,
  Zap,
  Award,
  AlertTriangle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { trpc } from '@/trpc/client';
import { TargetSettingsDialog } from './target-settings-dialog';
import { usePersistedState } from '@/hooks/use-persisted-state';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCurrencyCompact(value: number): string {
  if (value >= 1000) {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
      notation: 'compact',
    }).format(value);
  }
  return formatCurrency(value);
}

export function TargetTracking() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = usePersistedState(
    'finance.targets.selectedYear',
    currentYear
  );

  const { data: analytics, isLoading } = trpc.revenue.targets.analytics.useQuery({
    year: selectedYear,
  });

  const { data: targets } = trpc.revenue.targets.list.useQuery();

  const availableYears = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Revenue Target
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!analytics) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Revenue Goals
            </CardTitle>
            <div className="flex items-center gap-2">
              <Select
                value={selectedYear.toString()}
                onValueChange={(v) => setSelectedYear(parseInt(v))}
              >
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableYears.map((y) => (
                    <SelectItem key={y} value={y.toString()}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <TargetSettingsDialog year={selectedYear} onYearChange={setSelectedYear} />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground flex flex-col items-center justify-center py-12 text-center">
            <Target className="mb-4 h-12 w-12 opacity-50" />
            <p className="text-lg font-medium">No target set for {selectedYear}</p>
            <p className="mt-1 text-sm">
              Set an annual revenue target to track your progress and get insights.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Target Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Revenue Goals {selectedYear}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Select
                value={selectedYear.toString()}
                onValueChange={(v) => setSelectedYear(parseInt(v))}
              >
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableYears.map((y) => (
                    <SelectItem key={y} value={y.toString()}>
                      {y}
                      {targets?.some((t) => t.year === y) && ' *'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <TargetSettingsDialog year={selectedYear} onYearChange={setSelectedYear} />
            </div>
          </div>
          {analytics.notes && (
            <p className="text-muted-foreground mt-1 text-sm">{analytics.notes}</p>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Main Progress */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-bold">{formatCurrency(analytics.totalRevenue)}</p>
                <p className="text-muted-foreground text-sm">
                  of {formatCurrency(analytics.target)} target
                </p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold">{analytics.progressPercent.toFixed(1)}%</p>
                <Badge variant={analytics.isOnPace ? 'default' : 'secondary'}>
                  {analytics.isOnPace ? (
                    <>
                      <TrendingUp className="mr-1 h-3 w-3" />
                      On Pace
                    </>
                  ) : (
                    <>
                      <TrendingDown className="mr-1 h-3 w-3" />
                      Behind Pace
                    </>
                  )}
                </Badge>
              </div>
            </div>
            <Progress value={Math.min(analytics.progressPercent, 100)} className="h-4" />
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {formatCurrency(analytics.remainingTarget)} remaining
              </span>
              {analytics.isCurrentYear && (
                <span className="text-muted-foreground">
                  {analytics.remainingMonths} months left
                </span>
              )}
            </div>
          </div>

          {/* Pacing Indicator */}
          {analytics.isCurrentYear && (
            <div
              className={`flex items-center gap-3 rounded-lg border p-4 ${analytics.isOnPace ? 'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950' : 'border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950'}`}
            >
              {analytics.isOnPace ? (
                <TrendingUp className="h-8 w-8 text-green-600 dark:text-green-400" />
              ) : (
                <AlertTriangle className="h-8 w-8 text-orange-600 dark:text-orange-400" />
              )}
              <div>
                <p className="font-medium">
                  {analytics.isOnPace ? 'Ahead of schedule!' : 'Behind schedule'}
                </p>
                <p className="text-muted-foreground text-sm">
                  Expected: {formatCurrency(analytics.expectedRevenue)} | Actual:{' '}
                  {formatCurrency(analytics.totalRevenue)} |{' '}
                  {analytics.paceVariance >= 0 ? '+' : ''}
                  {formatCurrency(analytics.paceVariance)}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Key Metrics Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Required Monthly Average */}
        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="bg-primary/10 rounded-full p-3">
              <Calendar className="text-primary h-5 w-5" />
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Required Monthly Avg</p>
              <p className="text-xl font-semibold">
                {formatCurrencyCompact(analytics.requiredMonthlyAverage)}
              </p>
              <p className="text-muted-foreground text-xs">
                (was {formatCurrencyCompact(analytics.originalMonthlyTarget)})
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Weekly Required */}
        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="bg-secondary rounded-full p-3">
              <Clock className="text-secondary-foreground h-5 w-5" />
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Weekly Required</p>
              <p className="text-xl font-semibold">
                {formatCurrencyCompact(analytics.weeklyRequired)}
              </p>
              <p className="text-muted-foreground text-xs">
                {analytics.daysRemaining} days remaining
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Projected Year-End */}
        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <div
              className={`rounded-full p-3 ${analytics.willMeetTarget ? 'bg-green-100 dark:bg-green-900' : 'bg-orange-100 dark:bg-orange-900'}`}
            >
              <Zap
                className={`h-5 w-5 ${analytics.willMeetTarget ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'}`}
              />
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Projected Year-End</p>
              <p className="text-xl font-semibold">
                {formatCurrencyCompact(analytics.projectedYearEnd)}
              </p>
              <p
                className={`text-xs ${analytics.willMeetTarget ? 'text-green-600' : 'text-orange-600'}`}
              >
                {analytics.projectedVsTarget >= 0 ? '+' : ''}
                {formatCurrencyCompact(analytics.projectedVsTarget)} vs target
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Monthly Average Actual */}
        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="bg-muted rounded-full p-3">
              <Award className="text-muted-foreground h-5 w-5" />
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Avg Monthly Revenue</p>
              <p className="text-xl font-semibold">
                {formatCurrencyCompact(analytics.monthlyAverageActual)}
              </p>
              {analytics.bestMonth && (
                <p className="text-muted-foreground text-xs">
                  Best: {analytics.bestMonth.month} (
                  {formatCurrencyCompact(analytics.bestMonth.revenue)})
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Monthly Target vs Actual */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Monthly Performance vs Target</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.monthlyBreakdown}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="monthName" tick={{ fontSize: 12 }} />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => `€${(value / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    formatter={(value, name) => [
                      formatCurrency(value as number),
                      name === 'actual' ? 'Actual' : 'Target',
                    ]}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px',
                    }}
                  />
                  <Legend />
                  <ReferenceLine
                    y={analytics.originalMonthlyTarget}
                    stroke="#6b7280"
                    strokeDasharray="5 5"
                    label={{
                      value: 'Target',
                      position: 'right',
                      fontSize: 10,
                      fill: '#6b7280',
                    }}
                  />
                  <Bar dataKey="actual" name="Actual" radius={[4, 4, 0, 0]}>
                    {analytics.monthlyBreakdown.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={
                          entry.isFuture
                            ? '#e5e7eb'
                            : entry.isAchieved
                              ? '#10b981'
                              : entry.isCurrent
                                ? '#3b82f6'
                                : '#f59e0b'
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded bg-green-500" />
                <span>Met target</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded bg-orange-500" />
                <span>Below target</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded bg-blue-500" />
                <span>Current month</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded bg-gray-200" />
                <span>Future</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quarterly Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quarterly Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            {analytics.quarterlyBreakdown.map((quarter) => (
              <div
                key={quarter.quarter}
                className={`rounded-lg border p-4 ${quarter.isFuture ? 'opacity-50' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{quarter.quarter}</span>
                  <Badge
                    variant={
                      quarter.isFuture ? 'outline' : quarter.variance >= 0 ? 'default' : 'secondary'
                    }
                  >
                    {quarter.isFuture ? 'Upcoming' : quarter.variance >= 0 ? 'On Track' : 'Behind'}
                  </Badge>
                </div>
                <div className="mt-3">
                  <p className="text-2xl font-bold">{formatCurrencyCompact(quarter.actual)}</p>
                  <p className="text-muted-foreground text-sm">
                    Target: {formatCurrencyCompact(quarter.target)}
                  </p>
                  <Progress value={Math.min(quarter.progressPercent, 100)} className="mt-2 h-2" />
                  <p className="text-muted-foreground mt-1 text-xs">
                    {quarter.progressPercent.toFixed(0)}% complete
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
