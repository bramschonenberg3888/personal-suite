'use client';

import { useState, useMemo } from 'react';
import { trpc } from '@/trpc/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Loader2 } from 'lucide-react';

const VAT_RATE = 0.21;

const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'] as const;

const QUARTER_LABELS: Record<string, string> = {
  Q1: 'Q1 (jan–mrt)',
  Q2: 'Q2 (apr–jun)',
  Q3: 'Q3 (jul–sep)',
  Q4: 'Q4 (okt–dec)',
};

function formatEur(amount: number) {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(amount);
}

export function BtwDashboard() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(String(currentYear));

  const { data: revenueData, isLoading: revenueLoading } =
    trpc.revenue.entries.btwByQuarter.useQuery();
  const { data: costsData, isLoading: costsLoading } = trpc.costs.entries.btwByQuarter.useQuery();

  const isLoading = revenueLoading || costsLoading;

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    revenueData?.data.forEach((d) => years.add(d.year));
    costsData?.forEach((d) => years.add(d.year));
    if (years.size === 0) years.add(currentYear);
    return [...years].sort((a, b) => b - a);
  }, [revenueData, costsData, currentYear]);

  const year = parseInt(selectedYear);

  const quarterData = useMemo(() => {
    const revenueByQ = new Map<string, number>();
    revenueData?.data
      .filter((d) => d.year === year)
      .forEach((d) => revenueByQ.set(d.quarter, d.revenue));

    const costsByQ = new Map<
      string,
      { regularVat: number; section4aAmount: number; section4aVat: number }
    >();
    costsData
      ?.filter((d) => d.year === year)
      .forEach((d) =>
        costsByQ.set(d.quarter, {
          regularVat: d.regularVat,
          section4aAmount: d.section4aAmount,
          section4aVat: d.section4aVat,
        })
      );

    return QUARTERS.map((q) => {
      const revenueExclVat = revenueByQ.get(q) ?? 0;
      const btw1a = revenueExclVat * VAT_RATE;
      const revenueInclVat = revenueExclVat + btw1a;
      const c = costsByQ.get(q);
      const regularVat = c?.regularVat ?? 0;
      const section4aVat = c?.section4aVat ?? 0;
      // Voorbelasting 5b = regular costs BTW + 4a self-assessed BTW
      const voorbelasting5b = regularVat + section4aVat;
      // Te betalen = (1a + 4a) - 5b = btw1a + section4aVat - (regularVat + section4aVat) = btw1a - regularVat
      const teBetalen = btw1a - regularVat;

      return {
        q,
        label: QUARTER_LABELS[q],
        revenueExclVat,
        btw1a,
        revenueInclVat,
        section4aVat,
        voorbelasting5b,
        teBetalen,
      };
    });
  }, [revenueData, costsData, year]);

  const totals = useMemo(
    () =>
      quarterData.reduce(
        (acc, q) => ({
          revenueExclVat: acc.revenueExclVat + q.revenueExclVat,
          btw1a: acc.btw1a + q.btw1a,
          revenueInclVat: acc.revenueInclVat + q.revenueInclVat,
          section4aVat: acc.section4aVat + q.section4aVat,
          voorbelasting5b: acc.voorbelasting5b + q.voorbelasting5b,
          teBetalen: acc.teBetalen + q.teBetalen,
        }),
        {
          revenueExclVat: 0,
          btw1a: 0,
          revenueInclVat: 0,
          section4aVat: 0,
          voorbelasting5b: 0,
          teBetalen: 0,
        }
      ),
    [quarterData]
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">BTW Aangifte</h2>
          <p className="text-muted-foreground text-sm">
            Overzicht per kwartaal op basis van factuurdatum
          </p>
        </div>
        <Select value={selectedYear} onValueChange={setSelectedYear}>
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {availableYears.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
              Omzet incl. BTW
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{formatEur(totals.revenueInclVat)}</p>
            <p className="text-muted-foreground mt-1 text-xs">
              excl. BTW: {formatEur(totals.revenueExclVat)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
              BTW omzet (1a)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{formatEur(totals.btw1a)}</p>
            <p className="text-muted-foreground mt-1 text-xs">
              {totals.section4aVat > 0 && `+ 4a: ${formatEur(totals.section4aVat)}`}
              {totals.section4aVat === 0 && 'Af te dragen aan Belastingdienst'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
              Voorbelasting (5b)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{formatEur(totals.voorbelasting5b)}</p>
            <p className="text-muted-foreground mt-1 text-xs">
              {totals.section4aVat > 0
                ? `incl. 4a: ${formatEur(totals.section4aVat)}`
                : 'BTW op kosten (terug te vorderen)'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
              Netto te betalen
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{formatEur(totals.teBetalen)}</p>
            <p className="text-muted-foreground mt-1 text-xs">
              {totals.teBetalen < 0 ? 'BTW teruggaaf' : 'BTW afdragen'}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Kwartaaloverzicht {year}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kwartaal</TableHead>
                <TableHead className="text-right">Omzet excl. BTW</TableHead>
                <TableHead className="text-right">BTW 1a</TableHead>
                <TableHead className="text-right">Omzet incl. BTW</TableHead>
                <TableHead className="text-right">BTW 4a</TableHead>
                <TableHead className="text-right">Voorbelasting (5b)</TableHead>
                <TableHead className="text-right">Te betalen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quarterData.map(
                ({
                  q,
                  label,
                  revenueExclVat,
                  btw1a,
                  revenueInclVat,
                  section4aVat,
                  voorbelasting5b,
                  teBetalen,
                }) => (
                  <TableRow key={q}>
                    <TableCell className="font-medium">{label}</TableCell>
                    <TableCell className="text-right">{formatEur(revenueExclVat)}</TableCell>
                    <TableCell className="text-right">{formatEur(btw1a)}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatEur(revenueInclVat)}
                    </TableCell>
                    <TableCell className="text-right">{formatEur(section4aVat)}</TableCell>
                    <TableCell className="text-right">{formatEur(voorbelasting5b)}</TableCell>
                    <TableCell className="text-right font-medium">{formatEur(teBetalen)}</TableCell>
                  </TableRow>
                )
              )}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell>Totaal {year}</TableCell>
                <TableCell className="text-right">{formatEur(totals.revenueExclVat)}</TableCell>
                <TableCell className="text-right">{formatEur(totals.btw1a)}</TableCell>
                <TableCell className="text-right">{formatEur(totals.revenueInclVat)}</TableCell>
                <TableCell className="text-right">{formatEur(totals.section4aVat)}</TableCell>
                <TableCell className="text-right">{formatEur(totals.voorbelasting5b)}</TableCell>
                <TableCell className="text-right">{formatEur(totals.teBetalen)}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
