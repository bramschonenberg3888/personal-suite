'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Plus, Trash2 } from 'lucide-react';
import { trpc } from '@/trpc/client';
import { StockCard } from './stock-card';
import { AddSecurityDialog } from './add-security-dialog';
import { NewsCard } from './news-card';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function WatchlistView() {
  const [newWatchlistName, setNewWatchlistName] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [activeWatchlist, setActiveWatchlist] = useState<string | null>(null);

  const utils = trpc.useUtils();

  const { data: watchlists, isLoading: watchlistsLoading } =
    trpc.portfolio.watchlist.getAll.useQuery();

  // Get all symbols from the active watchlist for price fetching
  const activeWatchlistData = watchlists?.find((w) => w.id === activeWatchlist);
  const symbols = activeWatchlistData?.items.map((item) => item.symbol) ?? [];

  const { data: quotes } = trpc.portfolio.prices.getBySymbols.useQuery(
    { symbols },
    { enabled: symbols.length > 0, refetchInterval: 30000 }
  );

  const { data: news, isLoading: newsLoading } = trpc.portfolio.news.getBySymbols.useQuery(
    { symbols: symbols.slice(0, 5) },
    { enabled: symbols.length > 0 }
  );

  const createWatchlist = trpc.portfolio.watchlist.create.useMutation({
    onSuccess: (newWatchlist) => {
      utils.portfolio.watchlist.getAll.invalidate();
      setActiveWatchlist(newWatchlist.id);
      setNewWatchlistName('');
      setCreateDialogOpen(false);
    },
  });

  const deleteWatchlist = trpc.portfolio.watchlist.delete.useMutation({
    onSuccess: () => {
      utils.portfolio.watchlist.getAll.invalidate();
      setActiveWatchlist(null);
    },
  });

  const removeItem = trpc.portfolio.watchlist.removeItem.useMutation({
    onSuccess: () => {
      utils.portfolio.watchlist.getAll.invalidate();
    },
  });

  // Set default active watchlist
  if (!activeWatchlist && watchlists && watchlists.length > 0) {
    setActiveWatchlist(watchlists[0].id);
  }

  if (watchlistsLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      </div>
    );
  }

  const quoteMap = new Map(quotes?.map((q) => [q.symbol, q]));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Tabs
          value={activeWatchlist ?? undefined}
          onValueChange={setActiveWatchlist}
          className="flex-1"
        >
          <div className="flex items-center gap-4">
            <TabsList>
              {watchlists?.map((watchlist) => (
                <TabsTrigger key={watchlist.id} value={watchlist.id}>
                  {watchlist.name}
                </TabsTrigger>
              ))}
            </TabsList>

            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Plus className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Watchlist</DialogTitle>
                </DialogHeader>
                <Input
                  placeholder="Watchlist name"
                  value={newWatchlistName}
                  onChange={(e) => setNewWatchlistName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newWatchlistName.trim()) {
                      createWatchlist.mutate({ name: newWatchlistName.trim() });
                    }
                  }}
                />
                <DialogFooter>
                  <Button
                    onClick={() => createWatchlist.mutate({ name: newWatchlistName.trim() })}
                    disabled={!newWatchlistName.trim() || createWatchlist.isPending}
                  >
                    Create
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {watchlists?.map((watchlist) => (
            <TabsContent key={watchlist.id} value={watchlist.id}>
              <div className="flex items-center justify-between mb-4">
                <AddSecurityDialog
                  watchlistId={watchlist.id}
                  onAdd={() => utils.portfolio.watchlist.getAll.invalidate()}
                />
                {watchlists.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteWatchlist.mutate({ id: watchlist.id })}
                    disabled={deleteWatchlist.isPending}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Watchlist
                  </Button>
                )}
              </div>

              {watchlist.items.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    No securities in this watchlist. Add some to get started.
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {watchlist.items.map((item) => (
                    <StockCard
                      key={item.id}
                      item={item}
                      quote={quoteMap.get(item.symbol)}
                      onRemove={(itemId) => removeItem.mutate({ itemId })}
                      isRemoving={removeItem.isPending}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>

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

      {!watchlists || watchlists.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground mb-4">You don&#39;t have any watchlists yet.</p>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Watchlist
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
