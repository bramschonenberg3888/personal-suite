'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, Loader2 } from 'lucide-react';
import { trpc } from '@/trpc/client';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface AddSecurityDialogProps {
  watchlistId: string;
  onAdd: () => void;
}

export function AddSecurityDialog({ watchlistId, onAdd }: AddSecurityDialogProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  const { data: results, isLoading } = trpc.portfolio.prices.search.useQuery(
    { query: debouncedQuery },
    { enabled: debouncedQuery.length > 0 }
  );

  const addItem = trpc.portfolio.watchlist.addItem.useMutation({
    onSuccess: () => {
      onAdd();
      setOpen(false);
      setQuery('');
      setDebouncedQuery('');
    },
  });

  const handleSearch = (value: string) => {
    setQuery(value);
    // Simple debounce
    setTimeout(() => {
      setDebouncedQuery(value);
    }, 300);
  };

  const handleSelect = (item: { symbol: string; shortname: string; exchange: string }) => {
    addItem.mutate({
      watchlistId,
      isin: item.symbol, // Using symbol as ISIN placeholder
      symbol: item.symbol,
      name: item.shortname,
      exchange: item.exchange,
      currency: 'USD', // Default, will be updated from quote
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Add Security
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Security to Watchlist</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search stocks, ETFs..."
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-10"
              autoFocus
            />
          </div>

          <ScrollArea className="h-[300px]">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : results && results.length > 0 ? (
              <div className="space-y-1">
                {results.map((result) => (
                  <button
                    key={result.symbol}
                    className={cn(
                      'w-full flex items-center justify-between px-3 py-2 rounded-md text-left',
                      'hover:bg-accent transition-colors',
                      addItem.isPending && 'opacity-50 pointer-events-none'
                    )}
                    onClick={() => handleSelect(result)}
                    disabled={addItem.isPending}
                  >
                    <div>
                      <div className="font-medium">{result.symbol}</div>
                      <div className="text-sm text-muted-foreground line-clamp-1">
                        {result.shortname}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {result.exchDisp || result.exchange}
                    </div>
                  </button>
                ))}
              </div>
            ) : query.length > 0 && !isLoading ? (
              <div className="py-8 text-center text-muted-foreground">No results found</div>
            ) : (
              <div className="py-8 text-center text-muted-foreground">Start typing to search</div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
