'use client';

import { useState, useMemo } from 'react';
import {
  Upload,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { format } from 'date-fns';

interface TimeEntriesListProps {
  startDate?: Date;
  endDate?: Date;
  clients?: string[];
}

export function TimeEntriesList({ startDate, endDate, clients }: TimeEntriesListProps) {
  const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set());
  const [isExpanded, setIsExpanded] = useState(true);

  const utils = trpc.useUtils();

  // Fetch entries based on current filters
  const { data: entries, isLoading } = trpc.revenue.entries.list.useQuery({
    startDate,
    endDate,
    clients,
  });

  // Check Simplicate connection
  const { data: simplicateConnection } = trpc.simplicate.connection.get.useQuery();

  // Push mutation
  const pushMutation = trpc.simplicate.push.useMutation({
    onSuccess: () => {
      utils.revenue.entries.invalidate();
      setSelectedEntries(new Set());
    },
  });

  // Filter entries that can be pushed (complete and not already synced)
  const pushableEntries = useMemo(() => {
    if (!entries) return [];
    return entries.filter((e) => {
      if (e.simplicateHoursId) return false;
      if (!e.startTime || !e.client) return false;
      if (e.type === 'Kilometers') return (e.kilometers ?? 0) > 0;
      return !!e.hours;
    });
  }, [entries]);

  // Group entries by sync status
  const entriesByStatus = useMemo(() => {
    if (!entries) return { synced: [], pending: [], failed: [], incomplete: [] };

    const synced = entries.filter((e) => e.simplicateHoursId);
    const failed = entries.filter((e) => e.simplicateStatus === 'failed' && !e.simplicateHoursId);
    const isEntryComplete = (e: (typeof entries)[number]) => {
      if (e.type === 'Kilometers') return (e.kilometers ?? 0) > 0 && !!e.startTime && !!e.client;
      return !!e.hours && !!e.startTime && !!e.client;
    };
    const incomplete = entries.filter((e) => !e.simplicateHoursId && !isEntryComplete(e));
    const pending = entries.filter(
      (e) => !e.simplicateHoursId && e.simplicateStatus !== 'failed' && isEntryComplete(e)
    );

    return { synced, pending, failed, incomplete };
  }, [entries]);

  const isConnected = !!simplicateConnection?.apiKey && !!simplicateConnection?.apiSecret;
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

  const formatCurrency = (amount: number | null) => {
    if (!amount) return '-';
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

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
                    Pushed {pushMutation.data.summary.success} of {pushMutation.data.summary.total}{' '}
                    entries
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

            {/* Entries table */}
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
                <TableBody>
                  {entries.map((entry) => {
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
                        <TableCell className="max-w-xs truncate">{entry.description}</TableCell>
                        <TableCell className="text-right">{formatHours(entry.hours)}</TableCell>
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
                            <Badge variant="outline" className="text-muted-foreground gap-1">
                              Incomplete
                            </Badge>
                          )}
                          {canPush && !isFailed && (
                            <Badge variant="outline" className="border-primary text-primary gap-1">
                              Ready
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
