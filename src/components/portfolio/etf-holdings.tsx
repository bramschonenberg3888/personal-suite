'use client';

import Link from 'next/link';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { ETFHolding } from '@/lib/api/justetf';

interface ETFHoldingsProps {
  holdings: ETFHolding[];
  totalHoldings?: number;
  maxItems?: number;
}

function formatMarketCap(value?: number): string {
  if (!value) return '-';
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  return `$${value.toLocaleString()}`;
}

function formatPrice(price?: number, currency?: string): string {
  if (!price) return '-';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price);
}

export function ETFHoldings({ holdings, totalHoldings, maxItems = 10 }: ETFHoldingsProps) {
  if (!holdings || holdings.length === 0) {
    return null;
  }

  const displayHoldings = holdings.slice(0, maxItems);
  const totalWeight = displayHoldings.reduce((sum, h) => sum + h.weight, 0);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Top Holdings</CardTitle>
        {totalHoldings && (
          <Badge variant="secondary" className="font-normal">
            {totalHoldings.toLocaleString()} total holdings
          </Badge>
        )}
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]">#</TableHead>
                <TableHead className="min-w-[180px]">Name</TableHead>
                <TableHead className="w-[80px]">Symbol</TableHead>
                <TableHead className="text-right w-[80px]">Weight</TableHead>
                <TableHead className="text-right w-[100px]">Price</TableHead>
                <TableHead className="text-right w-[90px]">Change</TableHead>
                <TableHead className="text-right w-[100px]">Market Cap</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayHoldings.map((holding, index) => (
                <TableRow key={`${holding.name}-${index}`}>
                  <TableCell className="font-medium text-muted-foreground">{index + 1}</TableCell>
                  <TableCell>
                    <div className="font-medium">{holding.name}</div>
                  </TableCell>
                  <TableCell>
                    {holding.symbol ? (
                      <Link
                        href={`/portfolio/${encodeURIComponent(holding.symbol)}`}
                        className="text-primary hover:underline font-mono text-sm"
                      >
                        {holding.symbol}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {holding.weight.toFixed(2)}%
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {formatPrice(holding.price, holding.currency)}
                  </TableCell>
                  <TableCell className="text-right">
                    {holding.priceChange !== undefined ? (
                      <span
                        className={`inline-flex items-center gap-1 font-medium ${
                          holding.priceChange >= 0
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}
                      >
                        {holding.priceChange >= 0 ? (
                          <TrendingUp className="h-3 w-3" />
                        ) : (
                          <TrendingDown className="h-3 w-3" />
                        )}
                        {holding.priceChange >= 0 ? '+' : ''}
                        {holding.priceChange.toFixed(2)}%
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {formatMarketCap(holding.marketCap)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="mt-4 pt-4 border-t flex justify-between text-sm">
          <span className="text-muted-foreground">
            Top {displayHoldings.length} holdings
            {totalHoldings ? ` of ${totalHoldings.toLocaleString()}` : ''}:
          </span>
          <span className="font-medium">{totalWeight.toFixed(2)}%</span>
        </div>
      </CardContent>
    </Card>
  );
}
