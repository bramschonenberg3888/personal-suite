'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { trpc } from '@/trpc/client';

interface RevenueTableProps {
  startDate?: Date;
  endDate?: Date;
  clients?: string[];
  types?: string[];
  limit?: number;
}

function formatCurrency(value: number | null): string {
  if (value === null) return '-';
  return new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(date: Date | string | null): string {
  if (!date) return '-';
  return new Intl.DateTimeFormat('nl-NL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(date));
}

function formatHours(hours: number | null): string {
  if (hours === null) return '-';
  return `${hours.toFixed(1)}h`;
}

export function RevenueTable({
  startDate,
  endDate,
  clients,
  types,
  limit = 50,
}: RevenueTableProps) {
  const { data, isLoading } = trpc.revenue.entries.list.useQuery({
    startDate,
    endDate,
    clients,
    types,
    limit,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Time Entries</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : !data || data.length === 0 ? (
          <div className="flex h-40 items-center justify-center text-gray-500">
            No entries found
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-muted-foreground pb-3 text-left font-medium">Date</th>
                  <th className="text-muted-foreground pb-3 text-left font-medium">Description</th>
                  <th className="text-muted-foreground pb-3 text-left font-medium">Client</th>
                  <th className="text-muted-foreground pb-3 text-left font-medium">Type</th>
                  <th className="text-muted-foreground pb-3 text-right font-medium">Hours</th>
                  <th className="text-muted-foreground pb-3 text-right font-medium">Rate</th>
                  <th className="text-muted-foreground pb-3 text-right font-medium">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {data.map((entry) => (
                  <tr key={entry.id} className="border-b last:border-0">
                    <td className="py-3">{formatDate(entry.startTime)}</td>
                    <td className="max-w-xs truncate py-3">{entry.description || '-'}</td>
                    <td className="py-3">
                      {entry.client ? (
                        <Badge variant="secondary">{entry.client}</Badge>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="py-3">
                      {entry.type ? (
                        <Badge variant="outline">{entry.type}</Badge>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="py-3 text-right">{formatHours(entry.hours)}</td>
                    <td className="py-3 text-right">{formatCurrency(entry.rate)}</td>
                    <td className="py-3 text-right font-medium">{formatCurrency(entry.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data && data.length >= limit && (
          <p className="text-muted-foreground mt-4 text-center text-sm">
            Showing first {limit} entries. Use filters to narrow results.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
