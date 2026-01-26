'use client';

import { useState } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { trpc } from '@/trpc/client';
import { CostsSettingsDialog } from './costs-settings-dialog';
import { CostsKpiCards } from './costs-kpi-cards';
import { CostsChart } from './costs-chart';
import { CostsSectionBreakdown } from './costs-section-breakdown';
import { usePersistedState } from '@/hooks/use-persisted-state';

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

  const utils = trpc.useUtils();
  const { data: connection, isLoading: connectionLoading } = trpc.costs.connection.get.useQuery();

  const { data: filterOptions } = trpc.costs.entries.filterOptions.useQuery(undefined, {
    enabled: !!connection?.costsDatabaseId,
  });

  const { data: kpiData, isLoading: kpisLoading } = trpc.costs.entries.kpis.useQuery(
    {
      startDate: dateRange.from,
      endDate: dateRange.to,
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
  };

  const hasFilters = dateRange.from || dateRange.to || selectedSections.length > 0;

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
          To get started, connect your Notion costs database to sync your expense data.
        </p>
        <div className="mt-6">
          <CostsSettingsDialog
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
          <CostsSettingsDialog />
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
        startDate={dateRange.from}
        endDate={dateRange.to}
        vatSections={selectedSections.length > 0 ? selectedSections : undefined}
      />

      {/* Section Breakdown */}
      <CostsSectionBreakdown startDate={dateRange.from} endDate={dateRange.to} />
    </div>
  );
}
