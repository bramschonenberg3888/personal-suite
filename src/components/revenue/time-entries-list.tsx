'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  Upload,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  X,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { trpc } from '@/trpc/client';
import { format, getWeek } from 'date-fns';
import { usePersistedState } from '@/hooks/use-persisted-state';

export function TimeEntriesList() {
  const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set());
  const [isExpanded, setIsExpanded] = useState(true);

  const [selectedYear, setSelectedYear] = usePersistedState(
    'finance.simplicate.selectedYear',
    'all'
  );
  const [selectedQuarter, setSelectedQuarter] = usePersistedState(
    'finance.simplicate.selectedQuarter',
    'all'
  );
  const [selectedMonth, setSelectedMonth] = usePersistedState(
    'finance.simplicate.selectedMonth',
    'all'
  );
  const [selectedWeek, setSelectedWeek] = usePersistedState(
    'finance.simplicate.selectedWeek',
    'all'
  );
  const [selectedClient, setSelectedClient] = usePersistedState(
    'finance.simplicate.selectedClient',
    'all'
  );
  const [selectedType, setSelectedType] = usePersistedState(
    'finance.simplicate.selectedType',
    'all'
  );
  const [selectedSyncStatus, setSelectedSyncStatus] = usePersistedState(
    'finance.simplicate.selectedSyncStatus',
    'all'
  );

  const utils = trpc.useUtils();

  // Fetch all entries (filtering done client-side for responsiveness)
  const { data: entries, isLoading } = trpc.revenue.entries.list.useQuery({});

  const { data: filterOptions } = trpc.revenue.entries.filterOptions.useQuery();

  // Check Simplicate connection
  const { data: simplicateConnection } = trpc.simplicate.connection.get.useQuery();

  // Push mutation
  const pushMutation = trpc.simplicate.push.useMutation({
    onSuccess: () => {
      utils.revenue.entries.invalidate();
      setSelectedEntries(new Set());
    },
  });

  const getSyncStatus = useCallback((e: NonNullable<typeof entries>[number]) => {
    if (e.simplicateHoursId) return 'synced';
    if (e.simplicateStatus === 'failed') return 'failed';
    const isComplete =
      e.type === 'Kilometers'
        ? (e.kilometers ?? 0) > 0 && !!e.startTime && !!e.client
        : !!e.hours && !!e.startTime && !!e.client;
    return isComplete ? 'ready' : 'incomplete';
  }, []);

  // Derive available filter values from all entries
  const dateFilters = useMemo(() => {
    if (!entries) return { years: [], quarters: [] as string[], months: [], weeks: [] };

    const years = new Set<number>();
    const quarters = new Set<string>();
    const months = new Set<number>();
    const weeks = new Set<number>();

    for (const entry of entries) {
      if (entry.startTime) {
        const date = new Date(entry.startTime);
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
  }, [entries]);

  // Filter entries client-side
  const filteredEntries = useMemo(() => {
    if (!entries) return [];

    return entries.filter((entry) => {
      if (entry.startTime) {
        const date = new Date(entry.startTime);
        const year = date.getFullYear();
        const quarter = `Q${Math.ceil((date.getMonth() + 1) / 3)}`;
        const month = date.getMonth() + 1;
        const week = getWeek(date, { weekStartsOn: 1 });

        if (selectedYear !== 'all' && year !== parseInt(selectedYear)) return false;
        if (selectedQuarter !== 'all' && quarter !== selectedQuarter) return false;
        if (selectedMonth !== 'all' && month !== parseInt(selectedMonth)) return false;
        if (selectedWeek !== 'all' && week !== parseInt(selectedWeek)) return false;
      } else if (
        selectedYear !== 'all' ||
        selectedQuarter !== 'all' ||
        selectedMonth !== 'all' ||
        selectedWeek !== 'all'
      ) {
        return false;
      }

      if (selectedClient !== 'all' && entry.client !== selectedClient) return false;
      if (selectedType !== 'all' && entry.type !== selectedType) return false;
      if (selectedSyncStatus !== 'all' && getSyncStatus(entry) !== selectedSyncStatus) return false;

      return true;
    });
  }, [
    entries,
    selectedYear,
    selectedQuarter,
    selectedMonth,
    selectedWeek,
    selectedClient,
    selectedType,
    selectedSyncStatus,
    getSyncStatus,
  ]);

  // Filter entries that can be pushed (complete and not already synced)
  const pushableEntries = useMemo(() => {
    return filteredEntries.filter((e) => {
      if (e.simplicateHoursId) return false;
      if (!e.startTime || !e.client) return false;
      if (e.type === 'Kilometers') return (e.kilometers ?? 0) > 0;
      return !!e.hours;
    });
  }, [filteredEntries]);

  // Group entries by sync status
  const entriesByStatus = useMemo(() => {
    const synced = filteredEntries.filter((e) => e.simplicateHoursId);
    const failed = filteredEntries.filter(
      (e) => e.simplicateStatus === 'failed' && !e.simplicateHoursId
    );
    const isEntryComplete = (e: (typeof filteredEntries)[number]) => {
      if (e.type === 'Kilometers') return (e.kilometers ?? 0) > 0 && !!e.startTime && !!e.client;
      return !!e.hours && !!e.startTime && !!e.client;
    };
    const incomplete = filteredEntries.filter((e) => !e.simplicateHoursId && !isEntryComplete(e));
    const pending = filteredEntries.filter(
      (e) => !e.simplicateHoursId && e.simplicateStatus !== 'failed' && isEntryComplete(e)
    );

    return { synced, pending, failed, incomplete };
  }, [filteredEntries]);

  // Group entries by year (newest first)
  type Entry = NonNullable<typeof entries>[number];
  const entriesByYear = useMemo(() => {
    const grouped = new Map<number, Entry[]>();
    for (const entry of filteredEntries) {
      const year = entry.year ?? (entry.startTime ? new Date(entry.startTime).getFullYear() : 0);
      const group = grouped.get(year);
      if (group) {
        group.push(entry);
      } else {
        grouped.set(year, [entry]);
      }
    }
    // Sort by year descending
    return new Map([...grouped.entries()].sort((a, b) => b[0] - a[0]));
  }, [filteredEntries]);

  const [collapsedYears, setCollapsedYears] = useState<Set<number>>(new Set());

  // On first render with data, collapse all years except the most recent
  const mostRecentYear = useMemo(() => {
    const years = [...entriesByYear.keys()];
    return years.length > 0 ? years[0] : null;
  }, [entriesByYear]);

  const toggleYearCollapse = useCallback((year: number) => {
    setCollapsedYears((prev) => {
      const next = new Set(prev);
      if (next.has(year)) {
        next.delete(year);
      } else {
        next.add(year);
      }
      return next;
    });
  }, []);

  const isConnected = !!simplicateConnection?.isConfigured;
  const hasEmployeeId = !!simplicateConnection?.employeeId;

  const toggleEntry = (entryId: string) => {
    setSelectedEntries((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(entryId)) {
        newSet.delete(entryId);
      } else {
        newSet.add(entryId);
      }
      return newSet;
    });
  };

  const toggleAll = () => {
    if (selectedEntries.size === pushableEntries.length) {
      setSelectedEntries(new Set());
    } else {
      setSelectedEntries(new Set(pushableEntries.map((e) => e.id)));
    }
  };

  const handlePush = () => {
    if (selectedEntries.size === 0) return;
    pushMutation.mutate({ entryIds: Array.from(selectedEntries) });
  };

  const formatDate = (date: Date | null) => {
    if (!date) return '-';
    return format(new Date(date), 'dd MMM yyyy');
  };

  const formatHours = (hours: number | null) => {
    if (!hours) return '-';
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  };

  const getYearStatusCounts = useCallback((yearEntries: NonNullable<typeof entries>) => {
    const synced = yearEntries.filter((e) => e.simplicateHoursId).length;
    const failed = yearEntries.filter(
      (e) => e.simplicateStatus === 'failed' && !e.simplicateHoursId
    ).length;
    const isEntryComplete = (e: (typeof yearEntries)[number]) => {
      if (e.type === 'Kilometers') return (e.kilometers ?? 0) > 0 && !!e.startTime && !!e.client;
      return !!e.hours && !!e.startTime && !!e.client;
    };
    const ready = yearEntries.filter(
      (e) => !e.simplicateHoursId && e.simplicateStatus !== 'failed' && isEntryComplete(e)
    ).length;
    return { synced, ready, failed };
  }, []);

  const formatCurrency = (amount: number | null) => {
    if (!amount) return '-';
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
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

  const clearFilters = () => {
    setSelectedYear('all');
    setSelectedQuarter('all');
    setSelectedMonth('all');
    setSelectedWeek('all');
    setSelectedClient('all');
    setSelectedType('all');
    setSelectedSyncStatus('all');
  };

  const hasFilters =
    selectedYear !== 'all' ||
    selectedQuarter !== 'all' ||
    selectedMonth !== 'all' ||
    selectedWeek !== 'all' ||
    selectedClient !== 'all' ||
    selectedType !== 'all' ||
    selectedSyncStatus !== 'all';

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (!entries || entries.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
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

            {filterOptions && filterOptions.clients.length > 0 && (
              <div>
                <label className="mb-1 block text-sm font-medium">Client</label>
                <Select value={selectedClient} onValueChange={setSelectedClient}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    {filterOptions.clients.map((client) => (
                      <SelectItem key={client} value={client}>
                        {client}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {filterOptions && filterOptions.types.length > 0 && (
              <div>
                <label className="mb-1 block text-sm font-medium">Type</label>
                <Select value={selectedType} onValueChange={setSelectedType}>
                  <SelectTrigger className="w-36">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    {filterOptions.types.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <label className="mb-1 block text-sm font-medium">Sync Status</label>
              <Select value={selectedSyncStatus} onValueChange={setSelectedSyncStatus}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="synced">Synced</SelectItem>
                  <SelectItem value="ready">Ready</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="incomplete">Incomplete</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="mr-1 h-4 w-4" />
              Clear filters
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-4">
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Time Entries
              </CardTitle>
              <div className="flex gap-2">
                {entriesByStatus.synced.length > 0 && (
                  <Badge variant="secondary" className="gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    {entriesByStatus.synced.length} synced
                  </Badge>
                )}
                {entriesByStatus.pending.length > 0 && (
                  <Badge variant="outline" className="gap-1">
                    {entriesByStatus.pending.length} ready
                  </Badge>
                )}
                {entriesByStatus.failed.length > 0 && (
                  <Badge variant="destructive" className="gap-1">
                    <XCircle className="h-3 w-3" />
                    {entriesByStatus.failed.length} failed
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isConnected && hasEmployeeId && selectedEntries.size > 0 && (
                <Button onClick={handlePush} disabled={pushMutation.isPending} size="sm">
                  {pushMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Pushing...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Push {selectedEntries.size} to Simplicate
                    </>
                  )}
                </Button>
              )}
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="icon">
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
            </div>
          </CardHeader>

          <CollapsibleContent>
            <CardContent>
              {/* Push error message */}
              {pushMutation.error && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950">
                  <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
                    <XCircle className="h-5 w-5" />
                    <span>{pushMutation.error.message}</span>
                  </div>
                </div>
              )}

              {/* Push result message */}
              {pushMutation.data && (
                <div className="mb-4 rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    {pushMutation.data.summary.failed === 0 ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-yellow-500" />
                    )}
                    <span>
                      Pushed {pushMutation.data.summary.success} of{' '}
                      {pushMutation.data.summary.total} entries
                      {pushMutation.data.summary.failed > 0 &&
                        ` (${pushMutation.data.summary.failed} failed)`}
                    </span>
                  </div>
                  {pushMutation.data.results.some((r) => !r.success && r.error) && (
                    <div className="text-muted-foreground mt-2 text-sm">
                      {pushMutation.data.results
                        .filter((r) => !r.success && r.error)
                        .map((r, i) => (
                          <div key={i}>• {r.error}</div>
                        ))}
                    </div>
                  )}
                </div>
              )}

              {/* Warning if not connected */}
              {!isConnected && (
                <div className="mb-4 rounded-lg border border-yellow-200 bg-yellow-50 p-3 dark:border-yellow-900 dark:bg-yellow-950">
                  <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-400">
                    <AlertTriangle className="h-5 w-5" />
                    <span>Connect to Simplicate in the Settings tab to push time entries.</span>
                  </div>
                </div>
              )}

              {/* Entries table grouped by year */}
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {isConnected && hasEmployeeId && (
                        <TableHead className="w-12">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border"
                            checked={
                              pushableEntries.length > 0 &&
                              selectedEntries.size === pushableEntries.length
                            }
                            onChange={toggleAll}
                            disabled={pushableEntries.length === 0}
                          />
                        </TableHead>
                      )}
                      <TableHead>Date</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Hours</TableHead>
                      <TableHead className="text-right">Km</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                      <TableHead className="w-36">Simplicate Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  {[...entriesByYear.entries()].map(([year, yearEntries]) => {
                    // Most recent year expanded by default, others collapsed unless toggled
                    const isCollapsed =
                      year === mostRecentYear
                        ? collapsedYears.has(year)
                        : !collapsedYears.has(year);
                    const colSpan = isConnected && hasEmployeeId ? 9 : 8;
                    const statusCounts = getYearStatusCounts(yearEntries);

                    return (
                      <TableBody key={year}>
                        <TableRow
                          className="bg-muted/50 cursor-pointer hover:bg-muted"
                          onClick={() => toggleYearCollapse(year)}
                        >
                          <TableCell colSpan={colSpan}>
                            <div className="flex items-center gap-3">
                              {isCollapsed ? (
                                <ChevronRight className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                              <span className="font-semibold">{year === 0 ? 'Unknown' : year}</span>
                              <span className="text-muted-foreground text-sm">
                                {yearEntries.length}{' '}
                                {yearEntries.length === 1 ? 'entry' : 'entries'}
                              </span>
                              <div className="flex gap-2">
                                {statusCounts.synced > 0 && (
                                  <Badge variant="secondary" className="gap-1">
                                    <CheckCircle2 className="h-3 w-3" />
                                    {statusCounts.synced} synced
                                  </Badge>
                                )}
                                {statusCounts.ready > 0 && (
                                  <Badge variant="outline" className="gap-1">
                                    {statusCounts.ready} ready
                                  </Badge>
                                )}
                                {statusCounts.failed > 0 && (
                                  <Badge variant="destructive" className="gap-1">
                                    <XCircle className="h-3 w-3" />
                                    {statusCounts.failed} failed
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                        {!isCollapsed &&
                          yearEntries.map((entry) => {
                            const isSynced = !!entry.simplicateHoursId;
                            const isFailed = entry.simplicateStatus === 'failed' && !isSynced;
                            const isIncomplete =
                              entry.type === 'Kilometers'
                                ? (entry.kilometers ?? 0) <= 0 || !entry.startTime || !entry.client
                                : !entry.hours || !entry.startTime || !entry.client;
                            const canPush = !isSynced && !isIncomplete;

                            return (
                              <TableRow key={entry.id}>
                                {isConnected && hasEmployeeId && (
                                  <TableCell>
                                    <input
                                      type="checkbox"
                                      className="h-4 w-4 rounded border"
                                      checked={selectedEntries.has(entry.id)}
                                      onChange={() => toggleEntry(entry.id)}
                                      disabled={!canPush}
                                    />
                                  </TableCell>
                                )}
                                <TableCell className="whitespace-nowrap">
                                  {formatDate(entry.startTime)}
                                </TableCell>
                                <TableCell>
                                  {entry.client ?? (
                                    <span className="text-muted-foreground italic">No client</span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {entry.type ?? (
                                    <span className="text-muted-foreground italic">No type</span>
                                  )}
                                </TableCell>
                                <TableCell className="max-w-xs truncate">
                                  {entry.description}
                                </TableCell>
                                <TableCell className="text-right">
                                  {formatHours(entry.hours)}
                                </TableCell>
                                <TableCell className="text-right">
                                  {entry.kilometers ? `${entry.kilometers} km` : '-'}
                                </TableCell>
                                <TableCell className="text-right">
                                  {formatCurrency(entry.revenue)}
                                </TableCell>
                                <TableCell>
                                  {isSynced && (
                                    <Badge
                                      variant="secondary"
                                      className="gap-1 bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400"
                                    >
                                      <CheckCircle2 className="h-3 w-3" />
                                      Synced
                                    </Badge>
                                  )}
                                  {isFailed && (
                                    <Badge variant="destructive" className="gap-1">
                                      <XCircle className="h-3 w-3" />
                                      Failed
                                    </Badge>
                                  )}
                                  {isIncomplete && !isSynced && !isFailed && (
                                    <Badge
                                      variant="outline"
                                      className="text-muted-foreground gap-1"
                                    >
                                      Incomplete
                                    </Badge>
                                  )}
                                  {canPush && !isFailed && (
                                    <Badge
                                      variant="outline"
                                      className="border-primary text-primary gap-1"
                                    >
                                      Ready
                                    </Badge>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                      </TableBody>
                    );
                  })}
                </Table>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    </div>
  );
}
