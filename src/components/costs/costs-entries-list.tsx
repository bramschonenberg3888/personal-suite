'use client';

import { useState, useMemo, useCallback } from 'react';
import { ChevronDown, ChevronUp, ChevronRight, Receipt, Loader2 } from 'lucide-react';
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

interface CostsEntriesListProps {
  startDate?: Date;
  endDate?: Date;
  vatSections?: string[];
}

export function CostsEntriesList({ startDate, endDate, vatSections }: CostsEntriesListProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const { data: entries, isLoading } = trpc.costs.entries.list.useQuery({
    startDate,
    endDate,
    vatSections,
  });

  // Group entries by year (newest first)
  type Entry = NonNullable<typeof entries>[number];
  const entriesByYear = useMemo(() => {
    if (!entries) return new Map<number, Entry[]>();
    const grouped = new Map<number, Entry[]>();
    for (const entry of entries) {
      const year =
        entry.year ?? (entry.invoiceDate ? new Date(entry.invoiceDate).getFullYear() : 0);
      const group = grouped.get(year);
      if (group) {
        group.push(entry);
      } else {
        grouped.set(year, [entry]);
      }
    }
    // Sort by year descending
    return new Map([...grouped.entries()].sort((a, b) => b[0] - a[0]));
  }, [entries]);

  const [collapsedYears, setCollapsedYears] = useState<Set<number>>(new Set());

  // Most recent year for default expansion
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

  const getYearTotals = useCallback((yearEntries: Entry[]) => {
    const totalExclVat = yearEntries.reduce((sum, e) => sum + (e.amountExclVat ?? 0), 0);
    const totalVat = yearEntries.reduce((sum, e) => sum + (e.vat ?? 0), 0);
    return { totalExclVat, totalVat, totalInclVat: totalExclVat + totalVat };
  }, []);

  const formatDate = (date: Date | null) => {
    if (!date) return '-';
    return format(new Date(date), 'dd MMM yyyy');
  };

  const formatCurrency = (amount: number | null) => {
    if (amount === null || amount === undefined) return '-';
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
              <Receipt className="h-5 w-5" />
              Cost Entries
            </CardTitle>
            <Badge variant="secondary">{entries.length} entries</Badge>
          </div>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="icon">
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>
        </CardHeader>

        <CollapsibleContent>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>VAT Section</TableHead>
                    <TableHead className="text-right">Excl. VAT</TableHead>
                    <TableHead className="text-right">VAT</TableHead>
                    <TableHead className="text-right">Incl. VAT</TableHead>
                  </TableRow>
                </TableHeader>
                {[...entriesByYear.entries()].map(([year, yearEntries]) => {
                  // Most recent year expanded by default, others collapsed unless toggled
                  const isCollapsed =
                    year === mostRecentYear ? collapsedYears.has(year) : !collapsedYears.has(year);
                  const totals = getYearTotals(yearEntries);

                  return (
                    <TableBody key={year}>
                      <TableRow
                        className="bg-muted/50 hover:bg-muted cursor-pointer"
                        onClick={() => toggleYearCollapse(year)}
                      >
                        <TableCell colSpan={7}>
                          <div className="flex items-center justify-between">
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
                            </div>
                            <div className="text-muted-foreground flex gap-6 text-sm">
                              <span>Excl: {formatCurrency(totals.totalExclVat)}</span>
                              <span>VAT: {formatCurrency(totals.totalVat)}</span>
                              <span className="font-medium text-foreground">
                                Total: {formatCurrency(totals.totalInclVat)}
                              </span>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                      {!isCollapsed &&
                        yearEntries.map((entry) => (
                          <TableRow key={entry.id}>
                            <TableCell className="whitespace-nowrap">
                              {formatDate(entry.invoiceDate)}
                            </TableCell>
                            <TableCell className="max-w-xs truncate font-medium">
                              {entry.name ?? (
                                <span className="text-muted-foreground italic">No name</span>
                              )}
                            </TableCell>
                            <TableCell className="max-w-xs truncate">
                              {entry.description ?? '-'}
                            </TableCell>
                            <TableCell>
                              {entry.vatSection ? (
                                <Badge variant="outline">{entry.vatSection}</Badge>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(entry.amountExclVat)}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(entry.vat)}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {formatCurrency((entry.amountExclVat ?? 0) + (entry.vat ?? 0))}
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  );
                })}
              </Table>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
