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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Search, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { trpc } from '@/trpc/client';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface AddSecurityDialogProps {
  onAdd: () => void;
}

// ISIN format validation: 2 letters + 9 alphanumeric + 1 check digit
const ISIN_REGEX = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/;

function isValidIsinFormat(isin: string): boolean {
  return ISIN_REGEX.test(isin.toUpperCase());
}

export function AddSecurityDialog({ onAdd }: AddSecurityDialogProps) {
  const [open, setOpen] = useState(false);
  const [searchMode, setSearchMode] = useState<'name' | 'isin'>('isin');

  // Name search state
  const [nameQuery, setNameQuery] = useState('');
  const [debouncedNameQuery, setDebouncedNameQuery] = useState('');

  // ISIN search state
  const [isinQuery, setIsinQuery] = useState('');
  const [isinSearchEnabled, setIsinSearchEnabled] = useState(false);

  const { data: nameResults, isLoading: isNameSearching } = trpc.portfolio.prices.search.useQuery(
    { query: debouncedNameQuery },
    { enabled: debouncedNameQuery.length > 0 }
  );

  const {
    data: isinResult,
    isLoading: isIsinSearching,
    error: isinError,
  } = trpc.portfolio.prices.lookupIsin.useQuery(
    { isin: isinQuery },
    { enabled: isinSearchEnabled && isValidIsinFormat(isinQuery) }
  );

  const addItem = trpc.portfolio.items.add.useMutation({
    onSuccess: () => {
      onAdd();
      setOpen(false);
      resetState();
    },
  });

  const resetState = () => {
    setNameQuery('');
    setDebouncedNameQuery('');
    setIsinQuery('');
    setIsinSearchEnabled(false);
    setSearchMode('isin');
  };

  const handleNameSearch = (value: string) => {
    setNameQuery(value);
    setTimeout(() => {
      setDebouncedNameQuery(value);
    }, 300);
  };

  const handleIsinChange = (value: string) => {
    const upper = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    setIsinQuery(upper);
    setIsinSearchEnabled(false);
  };

  const handleIsinSearch = () => {
    if (isValidIsinFormat(isinQuery)) {
      setIsinSearchEnabled(true);
    }
  };

  const handleSelectNameResult = (item: {
    symbol: string;
    shortname: string;
    exchange: string;
  }) => {
    addItem.mutate({
      isin: item.symbol, // Using symbol as ISIN placeholder for name search
      symbol: item.symbol,
      name: item.shortname,
      exchange: item.exchange,
      currency: 'USD',
    });
  };

  const handleAddIsinResult = () => {
    if (isinResult) {
      addItem.mutate({
        isin: isinResult.isin,
        symbol: isinResult.symbol,
        name: isinResult.name,
        exchange: isinResult.exchange,
        currency: isinResult.currency,
      });
    }
  };

  const isinIsValid = isValidIsinFormat(isinQuery);

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen) resetState();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Add Security
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Security</DialogTitle>
        </DialogHeader>

        <Tabs value={searchMode} onValueChange={(v) => setSearchMode(v as 'name' | 'isin')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="isin">Search by ISIN</TabsTrigger>
            <TabsTrigger value="name">Search by Name</TabsTrigger>
          </TabsList>

          <TabsContent value="isin" className="space-y-4">
            <div className="space-y-2">
              <div className="relative">
                <Input
                  placeholder="Enter ISIN (e.g., US0378331005)"
                  value={isinQuery}
                  onChange={(e) => handleIsinChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && isinIsValid) {
                      handleIsinSearch();
                    }
                  }}
                  className={cn(
                    'font-mono',
                    isinQuery.length > 0 && !isinIsValid && 'border-amber-500',
                    isinQuery.length === 12 && isinIsValid && 'border-green-500'
                  )}
                  maxLength={12}
                  autoFocus
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="text-xs text-muted-foreground">
                  {isinQuery.length}/12 characters
                  {isinQuery.length > 0 && !isinIsValid && (
                    <span className="ml-2 text-amber-600">
                      Format: 2 letters + 9 alphanumeric + 1 digit
                    </span>
                  )}
                </div>
                <Button
                  size="sm"
                  onClick={handleIsinSearch}
                  disabled={!isinIsValid || isIsinSearching}
                >
                  {isIsinSearching ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                  <span className="ml-2">Lookup</span>
                </Button>
              </div>
            </div>

            <div className="h-[250px]">
              {isIsinSearching ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-muted-foreground">Looking up ISIN...</span>
                </div>
              ) : isinError ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <AlertCircle className="h-8 w-8 text-red-500 mb-2" />
                  <p className="text-sm text-red-600">
                    {isinError.message || 'Failed to lookup ISIN'}
                  </p>
                </div>
              ) : isinResult ? (
                <div className="space-y-4">
                  <div className="rounded-lg border p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                      <span className="font-medium">Security Found</span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Symbol</span>
                        <span className="font-medium">{isinResult.symbol}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Name</span>
                        <span className="font-medium text-right max-w-[200px] truncate">
                          {isinResult.name}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Exchange</span>
                        <span className="font-medium">{isinResult.exchange}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Type</span>
                        <span className="font-medium">{isinResult.securityType}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Currency</span>
                        <span className="font-medium">{isinResult.currency}</span>
                      </div>
                    </div>
                  </div>
                  <Button
                    className="w-full"
                    onClick={handleAddIsinResult}
                    disabled={addItem.isPending}
                  >
                    {addItem.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Plus className="h-4 w-4 mr-2" />
                    )}
                    Add to Portfolio
                  </Button>
                </div>
              ) : isinSearchEnabled ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  No results found for this ISIN
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                  <p>Enter a valid ISIN and click Lookup</p>
                  <p className="text-xs mt-2">Example: US0378331005 (Apple Inc.)</p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="name" className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search stocks, ETFs..."
                value={nameQuery}
                onChange={(e) => handleNameSearch(e.target.value)}
                className="pl-10"
              />
            </div>

            <ScrollArea className="h-[300px]">
              {isNameSearching ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : nameResults && nameResults.length > 0 ? (
                <div className="space-y-1">
                  {nameResults.map((result) => (
                    <button
                      key={result.symbol}
                      className={cn(
                        'w-full flex items-center justify-between px-3 py-2 rounded-md text-left',
                        'hover:bg-accent transition-colors',
                        addItem.isPending && 'opacity-50 pointer-events-none'
                      )}
                      onClick={() => handleSelectNameResult(result)}
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
              ) : nameQuery.length > 0 && !isNameSearching ? (
                <div className="py-8 text-center text-muted-foreground">No results found</div>
              ) : (
                <div className="py-8 text-center text-muted-foreground">Start typing to search</div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
