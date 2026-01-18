'use client';

import {
  Card,
  Title,
  Table,
  TableHead,
  TableHeaderCell,
  TableBody,
  TableRow,
  TableCell,
  Badge,
  Text,
} from '@tremor/react';
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
      <Title>Time Entries</Title>

      {isLoading ? (
        <div className="mt-4 space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded bg-gray-200" />
          ))}
        </div>
      ) : !data || data.length === 0 ? (
        <div className="mt-4 flex h-40 items-center justify-center text-gray-500">
          No entries found
        </div>
      ) : (
        <Table className="mt-4">
          <TableHead>
            <TableRow>
              <TableHeaderCell>Date</TableHeaderCell>
              <TableHeaderCell>Description</TableHeaderCell>
              <TableHeaderCell>Client</TableHeaderCell>
              <TableHeaderCell>Type</TableHeaderCell>
              <TableHeaderCell className="text-right">Hours</TableHeaderCell>
              <TableHeaderCell className="text-right">Rate</TableHeaderCell>
              <TableHeaderCell className="text-right">Revenue</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell>
                  <Text>{formatDate(entry.startTime)}</Text>
                </TableCell>
                <TableCell>
                  <Text className="max-w-xs truncate">{entry.description || '-'}</Text>
                </TableCell>
                <TableCell>
                  {entry.client ? (
                    <Badge color="blue">{entry.client}</Badge>
                  ) : (
                    <Text className="text-gray-400">-</Text>
                  )}
                </TableCell>
                <TableCell>
                  {entry.type ? (
                    <Badge color="gray">{entry.type}</Badge>
                  ) : (
                    <Text className="text-gray-400">-</Text>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Text>{formatHours(entry.hours)}</Text>
                </TableCell>
                <TableCell className="text-right">
                  <Text>{formatCurrency(entry.rate)}</Text>
                </TableCell>
                <TableCell className="text-right">
                  <Text className="font-medium">{formatCurrency(entry.revenue)}</Text>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {data && data.length >= limit && (
        <Text className="text-muted-foreground mt-4 text-center text-sm">
          Showing first {limit} entries. Use filters to narrow results.
        </Text>
      )}
    </Card>
  );
}
