'use client';

import { useState, useMemo } from 'react';
import { RefreshCw, Loader2, AlertCircle, Database, X, Check } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { trpc } from '@/trpc/client';
import { CostsKpiCards } from './costs-kpi-cards';
import { CostsChart } from './costs-chart';
import { CostsSectionBreakdown } from './costs-section-breakdown';
import { CostsEntriesList } from './costs-entries-list';
import { usePersistedState } from '@/hooks/use-persisted-state';
import {
  startOfYear,
  endOfYear,
  startOfQuarter,
  endOfQuarter,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  getWeek,
  getYear,
  getQuarter,
  getMonth,
} from 'date-fns';

interface DateRange {
  from?: Date;
  to?: Date;
}

export function CostsDashboard() {
  const [dateRange, setDateRange] = useState<DateRange>({});
  const [selectedSections, setSelectedSections] = usePersistedState<string[]>(
    'finance.costs.selectedSections',
    []
  );
  const [sectionsOpen, setSectionsOpen] = useState(false);
  const [selectedYear, setSelectedYear] = usePersistedState('finance.costs.selectedYear', 'all');
  const [selectedQuarter, setSelectedQuarter] = usePersistedState(
    'finance.costs.selectedQuarter',
    'all'
  );
  const [selectedMonth, setSelectedMonth] = usePersistedState('finance.costs.selectedMonth', 'all');
  const [selectedWeek, setSelectedWeek] = usePersistedState('finance.costs.selectedWeek', 'all');

  const utils = trpc.useUtils();
  const { data: connection, isLoading: connectionLoading } = trpc.costs.connection.get.useQuery();

  const { data: filterOptions } = trpc.costs.entries.filterOptions.useQuery(undefined, {
    enabled: !!connection?.costsDatabaseId,
  });

  // Fetch all entries to derive date filter options
  const { data: allEntries } = trpc.costs.entries.list.useQuery(undefined, {
    enabled: !!connection?.costsDatabaseId,
  });

  // Derive available years, quarters, months, weeks from entries
  const periodFilters = useMemo(() => {
    if (!allEntries) return { years: [], quarters: [], months: [], weeks: [] };

    const years = new Set<number>();
    const quarters = new Set<string>();
    const months = new Set<number>();
    const weeks = new Set<number>();

    for (const entry of allEntries) {
      if (entry.invoiceDate) {
        const date = new Date(entry.invoiceDate);
        years.add(getYear(date));
        quarters.add(`Q${getQuarter(date)}`);
        months.add(getMonth(date) + 1);
        weeks.add(getWeek(date, { weekStartsOn: 1 }));
      }
    }

    return {
      years: Array.from(years).sort((a, b) => b - a),
      quarters: ['Q1', 'Q2', 'Q3', 'Q4'].filter((q) => quarters.has(q)),
      months: Array.from(months).sort((a, b) => a - b),
      weeks: Array.from(weeks).sort((a, b) => a - b),
    };
  }, [allEntries]);

  // Compute effective date range based on period selections
  const effectiveDateRange = useMemo(() => {
    // If manual date range is set, use that
    if (dateRange.from || dateRange.to) {
      return dateRange;
    }

    // Otherwise compute from period selections
    const now = new Date();
    let from: Date | undefined;
    let to: Date | undefined;

    if (selectedYear !== 'all') {
      const year = parseInt(selectedYear);
      from = startOfYear(new Date(year, 0, 1));
      to = endOfYear(new Date(year, 0, 1));

      if (selectedQuarter !== 'all') {
        const quarter = parseInt(selectedQuarter.replace('Q', ''));
        const quarterMonth = (quarter - 1) * 3;
        from = startOfQuarter(new Date(year, quarterMonth, 1));
        to = endOfQuarter(new Date(year, quarterMonth, 1));
      }

      if (selectedMonth !== 'all') {
        const month = parseInt(selectedMonth) - 1;
        from = startOfMonth(new Date(year, month, 1));
        to = endOfMonth(new Date(year, month, 1));
      }

      if (selectedWeek !== 'all') {
        const week = parseInt(selectedWeek);
        const firstDayOfYear = new Date(year, 0, 1);
        const daysOffset = (week - 1) * 7;
        const weekDate = new Date(firstDayOfYear);
        weekDate.setDate(firstDayOfYear.getDate() + daysOffset);
        from = startOfWeek(weekDate, { weekStartsOn: 1 });
        to = endOfWeek(weekDate, { weekStartsOn: 1 });
      }
    } else if (selectedWeek !== 'all') {
      const year = now.getFullYear();
      const week = parseInt(selectedWeek);
      const firstDayOfYear = new Date(year, 0, 1);
      const daysOffset = (week - 1) * 7;
      const weekDate = new Date(firstDayOfYear);
      weekDate.setDate(firstDayOfYear.getDate() + daysOffset);
      from = startOfWeek(weekDate, { weekStartsOn: 1 });
      to = endOfWeek(weekDate, { weekStartsOn: 1 });
    }

    return { from, to };
  }, [dateRange, selectedYear, selectedQuarter, selectedMonth, selectedWeek]);

  const { data: kpiData, isLoading: kpisLoading } = trpc.costs.entries.kpis.useQuery(
    {
      startDate: effectiveDateRange.from,
      endDate: effectiveDateRange.to,
      vatSections: selectedSections.length > 0 ? selectedSections : undefined,
    },
    { enabled: !!connection?.costsDatabaseId }
  );

  const syncMutation = trpc.costs.sync.useMutation({
    onSuccess: () => {
      utils.costs.entries.invalidate();
      utils.costs.connection.invalidate();
    },
  });

  const handleSync = () => {
    syncMutation.mutate();
  };

  const clearFilters = () => {
    setDateRange({});
    setSelectedSections([]);
    setSelectedYear('all');
    setSelectedQuarter('all');
    setSelectedMonth('all');
    setSelectedWeek('all');
  };

  const hasFilters =
    dateRange.from ||
    dateRange.to ||
    selectedSections.length > 0 ||
    selectedYear !== 'all' ||
    selectedQuarter !== 'all' ||
    selectedMonth !== 'all' ||
    selectedWeek !== 'all';

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

  const toggleSection = (section: string) => {
    setSelectedSections((prev) =>
      prev.includes(section) ? prev.filter((s) => s !== section) : [...prev, section]
    );
  };

  // No connection configured
  if (!connectionLoading && !connection?.costsDatabaseId) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="bg-muted rounded-full p-4">
          <Database className="text-muted-foreground h-8 w-8" />
        </div>
        <h2 className="mt-4 text-xl font-semibold">Connect Your Notion Costs Database</h2>
        <p className="text-muted-foreground mt-2 max-w-sm text-center">
          To get started, connect your Notion costs database in the Settings tab.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Costs Overview</h2>
          {connection?.costsLastSyncAt && (
            <p className="text-muted-foreground mt-1 text-sm">
              Last synced:{' '}
              {new Intl.DateTimeFormat('nl-NL', {
                dateStyle: 'medium',
                timeStyle: 'short',
              }).format(new Date(connection.costsLastSyncAt))}
            </p>
          )}
        </div>
        <div className="flex gap-2">
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
                  {periodFilters.years.map((year) => (
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
                  {periodFilters.quarters.map((q) => (
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
                  {periodFilters.months.map((m) => (
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
                  {periodFilters.weeks.map((w) => (
                    <SelectItem key={w} value={w.toString()}>
                      Week {w}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {filterOptions && filterOptions.vatSections.length > 0 && (
              <div>
                <label className="mb-1 block text-sm font-medium">VAT Section</label>
                <Popover open={sectionsOpen} onOpenChange={setSectionsOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-48 justify-start">
                      {selectedSections.length > 0 ? (
                        <span className="truncate">{selectedSections.length} selected</span>
                      ) : (
                        <span className="text-muted-foreground">All sections</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-48 p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search sections..." />
                      <CommandList>
                        <CommandEmpty>No sections found.</CommandEmpty>
                        <CommandGroup>
                          {filterOptions.vatSections.map((section) => (
                            <CommandItem key={section} onSelect={() => toggleSection(section)}>
                              <div className="flex items-center gap-2">
                                <div
                                  className={`flex h-4 w-4 items-center justify-center rounded border ${selectedSections.includes(section) ? 'border-primary bg-primary text-primary-foreground' : 'border-muted'}`}
                                >
                                  {selectedSections.includes(section) && (
                                    <Check className="h-3 w-3" />
                                  )}
                                </div>
                                <span className="truncate">{section}</span>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            )}

            <div>
              <label className="mb-1 block text-sm font-medium">From</label>
              <Input
                type="date"
                className="w-40"
                value={dateRange.from?.toISOString().split('T')[0] ?? ''}
                onChange={(e) =>
                  setDateRange((prev) => ({
                    ...prev,
                    from: e.target.value ? new Date(e.target.value) : undefined,
                  }))
                }
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">To</label>
              <Input
                type="date"
                className="w-40"
                value={dateRange.to?.toISOString().split('T')[0] ?? ''}
                onChange={(e) =>
                  setDateRange((prev) => ({
                    ...prev,
                    to: e.target.value ? new Date(e.target.value) : undefined,
                  }))
                }
              />
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

      {/* Selected filters */}
      {selectedSections.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedSections.map((section) => (
            <Badge key={section} variant="secondary" className="gap-1">
              {section}
              <X className="h-3 w-3 cursor-pointer" onClick={() => toggleSection(section)} />
            </Badge>
          ))}
        </div>
      )}

      {/* KPI Cards */}
      <CostsKpiCards data={kpiData} isLoading={kpisLoading} />

      {/* Charts */}
      <CostsChart
        startDate={effectiveDateRange.from}
        endDate={effectiveDateRange.to}
        vatSections={selectedSections.length > 0 ? selectedSections : undefined}
      />

      {/* Section Breakdown */}
      <CostsSectionBreakdown startDate={effectiveDateRange.from} endDate={effectiveDateRange.to} />

      {/* Entries List */}
      <CostsEntriesList
        startDate={effectiveDateRange.from}
        endDate={effectiveDateRange.to}
        vatSections={selectedSections.length > 0 ? selectedSections : undefined}
      />
    </div>
  );
}
