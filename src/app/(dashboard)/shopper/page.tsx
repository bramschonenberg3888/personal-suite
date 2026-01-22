'use client';

import { useEffect, useState, useMemo } from 'react';
import { trpc } from '@/trpc/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ProductSearch } from '@/components/shopper/product-search';
import { TrackedProductCard } from '@/components/shopper/tracked-product-card';
import { SupermarketFilter } from '@/components/shopper/supermarket-filter';
import { ComparisonGroupCard } from '@/components/shopper/comparison-group-card';
import { AddToComparisonDialog } from '@/components/shopper/add-to-comparison-dialog';
import { RefreshCw, Bell, ShoppingCart, ArrowUpDown, Filter, GitCompare } from 'lucide-react';

type SortOption = 'date' | 'name' | 'price-asc' | 'price-desc' | 'supermarket';
type FilterOption = 'all' | 'Albert Heijn' | 'Jumbo';

export default function ShopperPage() {
  const utils = trpc.useUtils();
  const [sortBy, setSortBy] = useState<SortOption>('date');
  const [filterBy, setFilterBy] = useState<FilterOption>('all');
  const [comparisonDialogOpen, setComparisonDialogOpen] = useState(false);
  const [selectedProductForComparison, setSelectedProductForComparison] = useState<string | null>(
    null
  );

  // Seed supermarkets on first load
  const seedMutation = trpc.shopper.supermarket.seed.useMutation();

  useEffect(() => {
    seedMutation.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data: trackedProducts, isLoading: trackedLoading } =
    trpc.shopper.tracked.getAll.useQuery();

  const { data: comparisonGroups, isLoading: comparisonLoading } =
    trpc.shopper.comparison.getAll.useQuery();

  // Get unique supermarkets from tracked products for filter options
  const availableSupermarkets = useMemo(() => {
    if (!trackedProducts) return [];
    const supermarkets = new Set(trackedProducts.map((t) => t.product.supermarket.name));
    return Array.from(supermarkets);
  }, [trackedProducts]);

  // Filter and sort tracked products
  const sortedAndFilteredProducts = useMemo(() => {
    if (!trackedProducts) return [];

    let filtered = trackedProducts;

    // Apply filter
    if (filterBy !== 'all') {
      filtered = filtered.filter((t) => t.product.supermarket.name === filterBy);
    }

    // Apply sort
    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.product.name.localeCompare(b.product.name);
        case 'price-asc':
          return a.product.currentPrice - b.product.currentPrice;
        case 'price-desc':
          return b.product.currentPrice - a.product.currentPrice;
        case 'supermarket':
          return a.product.supermarket.name.localeCompare(b.product.supermarket.name);
        case 'date':
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });
  }, [trackedProducts, sortBy, filterBy]);

  const { data: alerts } = trpc.shopper.alerts.getActive.useQuery();

  const trackProduct = trpc.shopper.tracked.track.useMutation({
    onSuccess: () => {
      utils.shopper.tracked.getAll.invalidate();
    },
  });

  const untrackProduct = trpc.shopper.tracked.untrack.useMutation({
    onSuccess: () => {
      utils.shopper.tracked.getAll.invalidate();
      utils.shopper.alerts.getActive.invalidate();
    },
  });

  const setTargetPrice = trpc.shopper.tracked.setTargetPrice.useMutation({
    onSuccess: () => {
      utils.shopper.tracked.getAll.invalidate();
      utils.shopper.alerts.getActive.invalidate();
    },
  });

  const refreshPrices = trpc.shopper.refreshPrices.useMutation({
    onSuccess: () => {
      utils.shopper.tracked.getAll.invalidate();
      utils.shopper.alerts.getActive.invalidate();
    },
  });

  const createComparison = trpc.shopper.comparison.create.useMutation({
    onSuccess: () => {
      utils.shopper.comparison.getAll.invalidate();
      utils.shopper.tracked.getAll.invalidate();
      setComparisonDialogOpen(false);
      setSelectedProductForComparison(null);
    },
  });

  const addToComparison = trpc.shopper.comparison.addProduct.useMutation({
    onSuccess: () => {
      utils.shopper.comparison.getAll.invalidate();
      utils.shopper.tracked.getAll.invalidate();
      setComparisonDialogOpen(false);
      setSelectedProductForComparison(null);
    },
  });

  const removeFromComparison = trpc.shopper.comparison.removeProduct.useMutation({
    onSuccess: () => {
      utils.shopper.comparison.getAll.invalidate();
      utils.shopper.tracked.getAll.invalidate();
    },
  });

  const updateComparisonName = trpc.shopper.comparison.updateName.useMutation({
    onSuccess: () => {
      utils.shopper.comparison.getAll.invalidate();
    },
  });

  const deleteComparison = trpc.shopper.comparison.delete.useMutation({
    onSuccess: () => {
      utils.shopper.comparison.getAll.invalidate();
      utils.shopper.tracked.getAll.invalidate();
    },
  });

  const handleTrack = (product: {
    externalId: string;
    name: string;
    category?: string;
    imageUrl?: string;
    currentPrice: number;
    unit?: string;
    supermarket: 'Albert Heijn' | 'Jumbo';
  }) => {
    trackProduct.mutate({
      externalId: product.externalId,
      name: product.name,
      supermarketName: product.supermarket,
      category: product.category,
      imageUrl: product.imageUrl,
      currentPrice: product.currentPrice,
      unit: product.unit,
    });
  };

  const handleOpenComparisonDialog = (trackedProductId: string) => {
    setSelectedProductForComparison(trackedProductId);
    setComparisonDialogOpen(true);
  };

  const handleCreateComparison = (name?: string) => {
    if (selectedProductForComparison) {
      createComparison.mutate({
        trackedProductId: selectedProductForComparison,
        name,
      });
    }
  };

  const handleAddToExistingComparison = (groupId: string) => {
    if (selectedProductForComparison) {
      addToComparison.mutate({
        groupId,
        trackedProductId: selectedProductForComparison,
      });
    }
  };

  const selectedProduct = trackedProducts?.find((t) => t.id === selectedProductForComparison);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Personal Shopper</h1>
          <p className="text-muted-foreground">Track prices at Albert Heijn and Jumbo</p>
        </div>
        <Button
          variant="outline"
          onClick={() => refreshPrices.mutate()}
          disabled={refreshPrices.isPending}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${refreshPrices.isPending ? 'animate-spin' : ''}`} />
          Refresh Prices
        </Button>
      </div>

      {alerts && alerts.length > 0 && (
        <Card className="border-green-500 bg-green-50 dark:bg-green-950">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-300">
              <Bell className="h-5 w-5" />
              Price Alerts ({alerts.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {alerts.map((alert) => (
                <div key={alert.id} className="flex items-center justify-between text-sm">
                  <span>{alert.product.name}</span>
                  <span className="font-medium text-green-700 dark:text-green-300">
                    Now{' '}
                    {new Intl.NumberFormat('nl-NL', {
                      style: 'currency',
                      currency: 'EUR',
                    }).format(alert.product.currentPrice)}{' '}
                    (target:{' '}
                    {new Intl.NumberFormat('nl-NL', {
                      style: 'currency',
                      currency: 'EUR',
                    }).format(alert.targetPrice!)}
                    )
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="tracked">
        <TabsList>
          <TabsTrigger value="tracked">
            <ShoppingCart className="mr-2 h-4 w-4" />
            Tracked ({trackedProducts?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="compare">
            <GitCompare className="mr-2 h-4 w-4" />
            Compare ({comparisonGroups?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="search">Search Products</TabsTrigger>
        </TabsList>

        <TabsContent value="tracked" className="space-y-4 mt-4">
          {trackedLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-48" />
              ))}
            </div>
          ) : trackedProducts && trackedProducts.length > 0 ? (
            <>
              {/* Sort and Filter Controls */}
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                  <Select value={sortBy} onValueChange={(v: string) => setSortBy(v as SortOption)}>
                    <SelectTrigger className="w-[160px]">
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="date">Date Added</SelectItem>
                      <SelectItem value="name">Name</SelectItem>
                      <SelectItem value="price-asc">Price: Low to High</SelectItem>
                      <SelectItem value="price-desc">Price: High to Low</SelectItem>
                      <SelectItem value="supermarket">Supermarket</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {availableSupermarkets.length > 1 && (
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    <Select
                      value={filterBy}
                      onValueChange={(v: string) => setFilterBy(v as FilterOption)}
                    >
                      <SelectTrigger className="w-[160px]">
                        <SelectValue placeholder="Filter by store" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Stores</SelectItem>
                        {availableSupermarkets.map((name) => (
                          <SelectItem key={name} value={name}>
                            {name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {filterBy !== 'all' && (
                  <span className="text-sm text-muted-foreground">
                    Showing {sortedAndFilteredProducts.length} of {trackedProducts.length} products
                  </span>
                )}
              </div>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {sortedAndFilteredProducts.map((tracked) => (
                  <TrackedProductCard
                    key={tracked.id}
                    trackedProduct={tracked}
                    onUntrack={(id) => untrackProduct.mutate({ id })}
                    onSetTargetPrice={(id, price) =>
                      setTargetPrice.mutate({ id, targetPrice: price })
                    }
                    onAddToComparison={handleOpenComparisonDialog}
                    isRemoving={untrackProduct.isPending}
                  />
                ))}
              </div>
            </>
          ) : (
            <Card>
              <CardContent className="py-8 text-center">
                <ShoppingCart className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">
                  You&#39;re not tracking any products yet.
                </p>
                <p className="text-sm text-muted-foreground">
                  Switch to the Search tab to find products to track.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="compare" className="space-y-4 mt-4">
          {comparisonLoading ? (
            <div className="space-y-4">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-48" />
              ))}
            </div>
          ) : comparisonGroups && comparisonGroups.length > 0 ? (
            <div className="space-y-4">
              {comparisonGroups.map((group) => (
                <ComparisonGroupCard
                  key={group.id}
                  group={group}
                  onUpdateName={(groupId, name) => updateComparisonName.mutate({ groupId, name })}
                  onRemoveProduct={(trackedProductId) =>
                    removeFromComparison.mutate({ trackedProductId })
                  }
                  onDeleteGroup={(groupId) => deleteComparison.mutate({ groupId })}
                  isUpdating={
                    updateComparisonName.isPending ||
                    removeFromComparison.isPending ||
                    deleteComparison.isPending
                  }
                />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-8 text-center">
                <GitCompare className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">No price comparisons yet.</p>
                <p className="text-sm text-muted-foreground">
                  Track products from both stores, then click the compare button to see prices side
                  by side.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="search" className="space-y-4 mt-4">
          <SupermarketFilter />
          <ProductSearch onTrack={handleTrack} isTracking={trackProduct.isPending} />
        </TabsContent>
      </Tabs>

      {/* Comparison Dialog */}
      <AddToComparisonDialog
        open={comparisonDialogOpen}
        onOpenChange={setComparisonDialogOpen}
        productName={selectedProduct?.product.name || ''}
        existingGroups={comparisonGroups || []}
        onCreateNew={handleCreateComparison}
        onAddToExisting={handleAddToExistingComparison}
        isLoading={createComparison.isPending || addToComparison.isPending}
      />
    </div>
  );
}
