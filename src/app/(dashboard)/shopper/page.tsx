'use client';

import { useEffect } from 'react';
import { trpc } from '@/trpc/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { ProductSearch } from '@/components/shopper/product-search';
import { TrackedProductCard } from '@/components/shopper/tracked-product-card';
import { RefreshCw, Bell, ShoppingCart } from 'lucide-react';

export default function ShopperPage() {
  const utils = trpc.useUtils();

  // Seed supermarkets on first load
  const seedMutation = trpc.shopper.supermarket.seed.useMutation();

  useEffect(() => {
    seedMutation.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data: trackedProducts, isLoading: trackedLoading } =
    trpc.shopper.tracked.getAll.useQuery();

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
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {trackedProducts.map((tracked) => (
                <TrackedProductCard
                  key={tracked.id}
                  trackedProduct={tracked}
                  onUntrack={(id) => untrackProduct.mutate({ id })}
                  onSetTargetPrice={(id, price) =>
                    setTargetPrice.mutate({ id, targetPrice: price })
                  }
                  isRemoving={untrackProduct.isPending}
                />
              ))}
            </div>
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

        <TabsContent value="search" className="mt-4">
          <ProductSearch onTrack={handleTrack} isTracking={trackProduct.isPending} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
