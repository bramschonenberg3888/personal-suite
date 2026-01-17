'use client';

import Link from 'next/link';
import { trpc } from '@/trpc/client';
import { StockCard } from './stock-card';
import { AddSecurityDialog } from './add-security-dialog';
import { NewsCard } from './news-card';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LogIn } from 'lucide-react';

export function PortfolioView() {
  const utils = trpc.useUtils();

  const {
    data: items,
    isLoading: itemsLoading,
    error: itemsError,
  } = trpc.portfolio.items.getAll.useQuery(undefined, {
    retry: false,
  });

  const symbols = items?.map((item) => item.symbol) ?? [];

  const { data: quotes } = trpc.portfolio.prices.getBySymbols.useQuery(
    { symbols },
    { enabled: symbols.length > 0, refetchInterval: 30000 }
  );

  const { data: news, isLoading: newsLoading } = trpc.portfolio.news.getBySymbols.useQuery(
    { symbols: symbols.slice(0, 5) },
    { enabled: symbols.length > 0 }
  );

  const removeItem = trpc.portfolio.items.remove.useMutation({
    onSuccess: () => {
      utils.portfolio.items.getAll.invalidate();
    },
  });

  // Show login prompt if not authenticated
  if (itemsError?.data?.code === 'UNAUTHORIZED') {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <LogIn className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Sign in to view your portfolio</h2>
          <p className="text-muted-foreground mb-6">
            You need to be logged in to save and view your securities.
          </p>
          <Button asChild>
            <Link href="/login">Sign In</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (itemsLoading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-end">
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      </div>
    );
  }

  const quoteMap = new Map(quotes?.map((q) => [q.symbol, q]));

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <AddSecurityDialog onAdd={() => utils.portfolio.items.getAll.invalidate()} />
      </div>

      {!items || items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">You haven&apos;t added any securities yet.</p>
            <p className="text-sm text-muted-foreground">
              Click &quot;Add Security&quot; to search by name or ISIN.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((item) => (
            <StockCard
              key={item.id}
              item={item}
              quote={quoteMap.get(item.symbol)}
              onRemove={(itemId) => removeItem.mutate({ id: itemId })}
              isRemoving={removeItem.isPending}
            />
          ))}
        </div>
      )}

      {symbols.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Related News</CardTitle>
          </CardHeader>
          <CardContent>
            {newsLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-24" />
                ))}
              </div>
            ) : news && news.length > 0 ? (
              <div className="space-y-4">
                {news.map((item) => (
                  <NewsCard key={item.uuid} news={item} />
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">No news available</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
