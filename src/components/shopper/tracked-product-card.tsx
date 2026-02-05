'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ButtonGroup } from '@/components/ui/button-group';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Trash2,
  Bell,
  BellOff,
  TrendingDown,
  TrendingUp,
  GitCompare,
  Star,
  History,
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { PriceChart } from './price-chart';
import { CategorySelect } from './category-select';
import { FindAtOtherStoreDialog } from './find-at-other-store-dialog';
import { getUnitPriceDisplay } from '@/lib/utils/unit-price';
import { calculatePriceStats, formatPercentageChange } from '@/lib/utils/price-analytics';

interface TrackedProductCardProps {
  trackedProduct: {
    id: string;
    targetPrice: number | null;
    alertOnSale: boolean;
    isFavorite: boolean;
    userCategory: string | null;
    comparisonGroupId?: string | null;
    comparisonGroup?: {
      id: string;
      name: string | null;
    } | null;
    product: {
      id: string;
      name: string;
      imageUrl: string | null;
      currentPrice: number;
      unit: string | null;
      bonusMechanism: string | null;
      bonusPrice: number | null;
      bonusEndDate: Date | string | null;
      supermarket: {
        name: string;
      };
      priceHistory: Array<{
        price: number;
        recordedAt: Date | string;
      }>;
    };
  };
  onUntrack: (_id: string) => void;
  onSetTargetPrice: (_id: string, _price: number | null) => void;
  onToggleFavorite: (_id: string) => void;
  onAddToComparison?: (_trackedProductId: string) => void;
  onTrackFromOtherStore?: (_product: {
    externalId: string;
    name: string;
    category?: string;
    imageUrl?: string;
    currentPrice: number;
    unit?: string;
    supermarket: 'Albert Heijn' | 'Jumbo';
  }) => void;
  isRemoving?: boolean;
  isTracking?: boolean;
}

export function TrackedProductCard({
  trackedProduct,
  onUntrack,
  onSetTargetPrice,
  onToggleFavorite,
  onAddToComparison,
  onTrackFromOtherStore,
  isRemoving,
  isTracking,
}: TrackedProductCardProps) {
  const [targetPriceInput, setTargetPriceInput] = useState(
    trackedProduct.targetPrice?.toString() || ''
  );
  const [popoverOpen, setPopoverOpen] = useState(false);

  const { product } = trackedProduct;
  const priceHistory = product.priceHistory || [];

  // Calculate price statistics
  const stats = calculatePriceStats(priceHistory, product.currentPrice);
  const previousPrice = priceHistory[1]?.price;
  const priceDiff = previousPrice ? product.currentPrice - previousPrice : 0;
  const isLower = priceDiff < 0;
  const isBelowTarget =
    trackedProduct.targetPrice !== null && product.currentPrice <= trackedProduct.targetPrice;

  // Unit price calculation
  const unitPriceDisplay = getUnitPriceDisplay(product.currentPrice, product.unit, product.name);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR',
    }).format(price);
  };

  const handleSetTargetPrice = () => {
    const price = parseFloat(targetPriceInput);
    if (!isNaN(price) && price > 0) {
      onSetTargetPrice(trackedProduct.id, price);
    } else if (targetPriceInput === '') {
      onSetTargetPrice(trackedProduct.id, null);
    }
    setPopoverOpen(false);
  };

  return (
    <Card className={isBelowTarget ? 'ring-2 ring-green-500' : ''}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {product.imageUrl && (
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded bg-muted">
                <Image src={product.imageUrl} alt="" fill className="object-contain" unoptimized />
              </div>
            )}
            <div className="min-w-0">
              <CardTitle className="text-base line-clamp-2">{product.name}</CardTitle>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Badge variant="outline" className="text-xs">
                  {product.supermarket.name}
                </Badge>
                {product.unit && (
                  <span className="text-xs text-muted-foreground">{product.unit}</span>
                )}
                {trackedProduct.userCategory && (
                  <Badge variant="secondary" className="text-xs">
                    {trackedProduct.userCategory}
                  </Badge>
                )}
                {trackedProduct.comparisonGroup && (
                  <Badge variant="secondary" className="text-xs">
                    <GitCompare className="h-3 w-3 mr-1" />
                    Comparing
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <ButtonGroup aria-label="Product actions">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onToggleFavorite(trackedProduct.id)}
            >
              <Star
                className={`h-4 w-4 ${trackedProduct.isFavorite ? 'fill-yellow-400 text-yellow-400' : ''}`}
              />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onUntrack(trackedProduct.id)}
              disabled={isRemoving}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </ButtonGroup>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-2xl font-bold">{formatPrice(product.currentPrice)}</span>
              {priceDiff !== 0 && (
                <Badge
                  variant={isLower ? 'default' : 'destructive'}
                  className={isLower ? 'bg-green-600' : ''}
                >
                  {isLower ? (
                    <TrendingDown className="h-3 w-3 mr-1" />
                  ) : (
                    <TrendingUp className="h-3 w-3 mr-1" />
                  )}
                  {formatPercentageChange((priceDiff / (product.currentPrice - priceDiff)) * 100)}
                </Badge>
              )}
            </div>
            {unitPriceDisplay && (
              <p className="text-sm text-muted-foreground">{unitPriceDisplay}</p>
            )}
            {product.bonusMechanism && product.bonusPrice != null && (
              <div className="bg-primary/10 rounded-md p-2 mt-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="default">{product.bonusMechanism}</Badge>
                  {product.bonusEndDate && (
                    <span className="text-xs text-muted-foreground">
                      t/m{' '}
                      {new Date(product.bonusEndDate).toLocaleDateString('nl-NL', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </span>
                  )}
                </div>
                <p className="text-sm font-semibold text-primary mt-1">
                  {formatPrice(product.bonusPrice)}/stuk (effectieve prijs)
                </p>
              </div>
            )}
            <div className="flex flex-wrap gap-1 mt-2">
              {isBelowTarget && (
                <Badge variant="default" className="bg-green-600">
                  Below target!
                </Badge>
              )}
              {stats.isAtHistoricalLow && priceHistory.length > 1 && (
                <Badge className="bg-green-600">
                  <History className="h-3 w-3 mr-1" />
                  Historical Low!
                </Badge>
              )}
              {stats.lowestInDays !== null && stats.lowestInDays > 7 && (
                <Badge variant="secondary">Lowest in {stats.lowestInDays} days</Badge>
              )}
            </div>
          </div>

          <div className="flex shrink-0 flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              <PriceChart
                productId={product.id}
                productName={product.name}
                targetPrice={trackedProduct.targetPrice}
              />

              {onTrackFromOtherStore && (
                <FindAtOtherStoreDialog
                  productName={product.name}
                  currentStore={product.supermarket.name}
                  onTrack={onTrackFromOtherStore}
                  isTracking={isTracking}
                />
              )}

              {onAddToComparison && !trackedProduct.comparisonGroup && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onAddToComparison(trackedProduct.id)}
                  title="Compare prices"
                >
                  <GitCompare className="h-4 w-4" />
                </Button>
              )}

              <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
                    {trackedProduct.targetPrice ? (
                      <>
                        <Bell className="h-4 w-4 mr-2" />
                        {formatPrice(trackedProduct.targetPrice)}
                      </>
                    ) : (
                      <>
                        <BellOff className="h-4 w-4 mr-2" />
                        Set alert
                      </>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Target Price</label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="e.g., 2.50"
                      value={targetPriceInput}
                      onChange={(e) => setTargetPriceInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSetTargetPrice();
                      }}
                    />
                    <ButtonGroup aria-label="Target price actions">
                      <Button size="sm" className="flex-1" onClick={handleSetTargetPrice}>
                        Save
                      </Button>
                      {trackedProduct.targetPrice && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setTargetPriceInput('');
                            onSetTargetPrice(trackedProduct.id, null);
                            setPopoverOpen(false);
                          }}
                        >
                          Clear
                        </Button>
                      )}
                    </ButtonGroup>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <CategorySelect
              trackedProductId={trackedProduct.id}
              currentCategory={trackedProduct.userCategory}
            />
          </div>
        </div>

        {priceHistory.length > 1 && (
          <div className="mt-4">
            <div className="text-xs text-muted-foreground mb-1">
              Price history (last {priceHistory.length} records)
            </div>
            <div className="flex items-end gap-1 h-12">
              {priceHistory
                .slice()
                .reverse()
                .map((record, i) => {
                  const maxPrice = Math.max(...priceHistory.map((p) => p.price));
                  const minPrice = Math.min(...priceHistory.map((p) => p.price));
                  const range = maxPrice - minPrice || 1;
                  const height = ((record.price - minPrice) / range) * 100 || 50;

                  return (
                    <div
                      key={i}
                      className="flex-1 bg-primary/20 rounded-t"
                      style={{ height: `${Math.max(height, 10)}%` }}
                      title={`${formatPrice(record.price)} on ${new Date(
                        record.recordedAt
                      ).toLocaleDateString()}`}
                    />
                  );
                })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
