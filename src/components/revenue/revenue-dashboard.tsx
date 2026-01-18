'use client';

import { useState } from 'react';
import { RefreshCw, Loader2, AlertCircle, Database } from 'lucide-react';
import {
  Card,
  Grid,
  Title,
  Text,
  Flex,
  DateRangePicker,
  type DateRangePickerValue,
  MultiSelect,
  MultiSelectItem,
} from '@tremor/react';
import { Button } from '@/components/ui/button';
import { trpc } from '@/trpc/client';
import { NotionSettingsDialog } from './notion-settings-dialog';
import { KpiCards } from './kpi-cards';
import { RevenueChart } from './revenue-chart';
import { ClientBreakdown } from './client-breakdown';
import { TypeBreakdown } from './type-breakdown';
import { RevenueTable } from './revenue-table';

export function RevenueDashboard() {
  const [dateRange, setDateRange] = useState<DateRangePickerValue>({});
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);

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
      types: selectedTypes.length > 0 ? selectedTypes : undefined,
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
    setSelectedTypes([]);
  };

  const hasFilters =
    dateRange.from || dateRange.to || selectedClients.length > 0 || selectedTypes.length > 0;

  // No connection configured
  if (!connectionLoading && !connection) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="rounded-full bg-muted p-4">
          <Database className="h-8 w-8 text-muted-foreground" />
        </div>
        <Title className="mt-4">Connect Your Notion Database</Title>
        <Text className="mt-2 max-w-sm text-center">
          To get started, connect your Notion time tracking database to sync your revenue data.
        </Text>
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
      <Flex justifyContent="between" alignItems="center">
        <div>
          <Title>Revenue Dashboard</Title>
          {connection?.lastSyncAt && (
            <Text className="mt-1">
              Last synced:{' '}
              {new Intl.DateTimeFormat('nl-NL', {
                dateStyle: 'medium',
                timeStyle: 'short',
              }).format(new Date(connection.lastSyncAt))}
            </Text>
          )}
        </div>
        <Flex className="gap-2">
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
        </Flex>
      </Flex>

      {/* Sync error */}
      {syncMutation.error && (
        <Card className="border-red-200 bg-red-50">
          <Flex className="gap-2">
            <AlertCircle className="h-5 w-5 text-red-500" />
            <Text className="text-red-700">{syncMutation.error.message}</Text>
          </Flex>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <Flex justifyContent="between" alignItems="end" className="flex-wrap gap-4">
          <Flex className="flex-wrap gap-4">
            <div className="w-64">
              <Text className="mb-1 text-sm font-medium">Date Range</Text>
              <DateRangePicker
                value={dateRange}
                onValueChange={setDateRange}
                selectPlaceholder="All time"
                enableClear
              />
            </div>
            {filterOptions && filterOptions.clients.length > 0 && (
              <div className="w-48">
                <Text className="mb-1 text-sm font-medium">Clients</Text>
                <MultiSelect
                  value={selectedClients}
                  onValueChange={setSelectedClients}
                  placeholder="All clients"
                >
                  {filterOptions.clients.map((client) => (
                    <MultiSelectItem key={client} value={client}>
                      {client}
                    </MultiSelectItem>
                  ))}
                </MultiSelect>
              </div>
            )}
            {filterOptions && filterOptions.types.length > 0 && (
              <div className="w-48">
                <Text className="mb-1 text-sm font-medium">Types</Text>
                <MultiSelect
                  value={selectedTypes}
                  onValueChange={setSelectedTypes}
                  placeholder="All types"
                >
                  {filterOptions.types.map((type) => (
                    <MultiSelectItem key={type} value={type}>
                      {type}
                    </MultiSelectItem>
                  ))}
                </MultiSelect>
              </div>
            )}
          </Flex>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Clear filters
            </Button>
          )}
        </Flex>
      </Card>

      {/* KPI Cards */}
      <KpiCards data={kpiData} isLoading={kpisLoading} />

      {/* Charts */}
      <RevenueChart
        startDate={dateRange.from}
        endDate={dateRange.to}
        clients={selectedClients.length > 0 ? selectedClients : undefined}
        types={selectedTypes.length > 0 ? selectedTypes : undefined}
      />

      <Grid numItemsSm={1} numItemsLg={2} className="gap-6">
        <ClientBreakdown
          startDate={dateRange.from}
          endDate={dateRange.to}
          types={selectedTypes.length > 0 ? selectedTypes : undefined}
        />
        <TypeBreakdown
          startDate={dateRange.from}
          endDate={dateRange.to}
          clients={selectedClients.length > 0 ? selectedClients : undefined}
        />
      </Grid>

      {/* Data Table */}
      <RevenueTable
        startDate={dateRange.from}
        endDate={dateRange.to}
        clients={selectedClients.length > 0 ? selectedClients : undefined}
        types={selectedTypes.length > 0 ? selectedTypes : undefined}
      />
    </div>
  );
}
