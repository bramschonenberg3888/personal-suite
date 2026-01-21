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
import { NotionSettingsDialog } from './notion-settings-dialog';
import { KpiCards } from './kpi-cards';
import { InteractiveMetricsChart } from './interactive-metrics-chart';
import { ClientBreakdown } from './client-breakdown';

interface DateRange {
  from?: Date;
  to?: Date;
}

export function RevenueDashboard() {
  const [dateRange, setDateRange] = useState<DateRange>({});
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [clientsOpen, setClientsOpen] = useState(false);

  const utils = trpc.useUtils();
  const { data: connection, isLoading: connectionLoading } = trpc.revenue.connection.get.useQuery();

  const { data: filterOptions } = trpc.revenue.entries.filterOptions.useQuery(undefined, {
    enabled: !!connection,
  });

  const { data: kpiData, isLoading: kpisLoading } = trpc.revenue.entries.kpis.useQuery(
    {
      startDate: dateRange.from,
      endDate: dateRange.to,
      clients: selectedClients.length > 0 ? selectedClients : undefined,
    },
    { enabled: !!connection }
  );

  const syncMutation = trpc.revenue.sync.useMutation({
    onSuccess: () => {
      utils.revenue.entries.invalidate();
      utils.revenue.connection.invalidate();
    },
  });

  const handleSync = () => {
    syncMutation.mutate();
  };

  const clearFilters = () => {
    setDateRange({});
    setSelectedClients([]);
  };

  const hasFilters = dateRange.from || dateRange.to || selectedClients.length > 0;

  const toggleClient = (client: string) => {
    setSelectedClients((prev) =>
      prev.includes(client) ? prev.filter((c) => c !== client) : [...prev, client]
    );
  };

  // No connection configured
  if (!connectionLoading && !connection) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="bg-muted rounded-full p-4">
          <Database className="text-muted-foreground h-8 w-8" />
        </div>
        <h2 className="mt-4 text-xl font-semibold">Connect Your Notion Database</h2>
        <p className="text-muted-foreground mt-2 max-w-sm text-center">
          To get started, connect your Notion time tracking database to sync your revenue data.
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
          <h1 className="text-2xl font-semibold">Revenue Dashboard</h1>
          {connection?.lastSyncAt && (
            <p className="text-muted-foreground mt-1 text-sm">
              Last synced:{' '}
              {new Intl.DateTimeFormat('nl-NL', {
                dateStyle: 'medium',
                timeStyle: 'short',
              }).format(new Date(connection.lastSyncAt))}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <NotionSettingsDialog />
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

            {filterOptions && filterOptions.clients.length > 0 && (
              <div>
                <label className="mb-1 block text-sm font-medium">Clients</label>
                <Popover open={clientsOpen} onOpenChange={setClientsOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-48 justify-start">
                      {selectedClients.length > 0 ? (
                        <span className="truncate">{selectedClients.length} selected</span>
                      ) : (
                        <span className="text-muted-foreground">All clients</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-48 p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search clients..." />
                      <CommandList>
                        <CommandEmpty>No clients found.</CommandEmpty>
                        <CommandGroup>
                          {filterOptions.clients.map((client) => (
                            <CommandItem key={client} onSelect={() => toggleClient(client)}>
                              <div className="flex items-center gap-2">
                                <div
                                  className={`flex h-4 w-4 items-center justify-center rounded border ${selectedClients.includes(client) ? 'border-primary bg-primary text-primary-foreground' : 'border-muted'}`}
                                >
                                  {selectedClients.includes(client) && (
                                    <Check className="h-3 w-3" />
                                  )}
                                </div>
                                <span className="truncate">{client}</span>
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
      {selectedClients.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedClients.map((client) => (
            <Badge key={client} variant="secondary" className="gap-1">
              {client}
              <X className="h-3 w-3 cursor-pointer" onClick={() => toggleClient(client)} />
            </Badge>
          ))}
        </div>
      )}

      {/* KPI Cards */}
      <KpiCards data={kpiData} isLoading={kpisLoading} />

      {/* Charts */}
      <InteractiveMetricsChart
        startDate={dateRange.from}
        endDate={dateRange.to}
        clients={selectedClients.length > 0 ? selectedClients : undefined}
      />

      {/* Client Breakdown */}
      <ClientBreakdown
        startDate={dateRange.from}
        endDate={dateRange.to}
        clients={selectedClients.length > 0 ? selectedClients : undefined}
      />
    </div>
  );
}
