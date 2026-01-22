'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Trash2, Bell, BellOff, TrendingDown, TrendingUp, GitCompare } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface TrackedProductCardProps {
  trackedProduct: {
    id: string;
    targetPrice: number | null;
    alertOnSale: boolean;
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
  onAddToComparison?: (_trackedProductId: string) => void;
  isRemoving?: boolean;
}

export function TrackedProductCard({
  trackedProduct,
  onUntrack,
  onSetTargetPrice,
  onAddToComparison,
  isRemoving,
}: TrackedProductCardProps) {
  const [targetPriceInput, setTargetPriceInput] = useState(
    trackedProduct.targetPrice?.toString() || ''
  );
  const [popoverOpen, setPopoverOpen] = useState(false);

  const { product } = trackedProduct;
  const priceHistory = product.priceHistory || [];

  // Calculate price trend
  const previousPrice = priceHistory[1]?.price;
  const priceDiff = previousPrice ? product.currentPrice - previousPrice : 0;
  const isLower = priceDiff < 0;
  const isBelowTarget =
    trackedProduct.targetPrice !== null && product.currentPrice <= trackedProduct.targetPrice;

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
              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded bg-muted">
                <Image src={product.imageUrl} alt="" fill className="object-contain" unoptimized />
              </div>
            )}
            <div>
              <CardTitle className="text-base line-clamp-1">{product.name}</CardTitle>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Badge variant="outline" className="text-xs">
                  {product.supermarket.name}
                </Badge>
                {product.unit && (
                  <span className="text-xs text-muted-foreground">{product.unit}</span>
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
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onUntrack(trackedProduct.id)}
            disabled={isRemoving}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold">{formatPrice(product.currentPrice)}</span>
              {priceDiff !== 0 && (
                <span
                  className={`flex items-center text-sm ${
                    isLower ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {isLower ? (
                    <TrendingDown className="h-4 w-4" />
                  ) : (
                    <TrendingUp className="h-4 w-4" />
                  )}
                  {formatPrice(Math.abs(priceDiff))}
                </span>
              )}
            </div>
            {isBelowTarget && (
              <Badge variant="default" className="mt-2 bg-green-600">
                Below target!
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2">
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
                  <div className="flex gap-2">
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
                  </div>
                </div>
              </PopoverContent>
            </Popover>
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
