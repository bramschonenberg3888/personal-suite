'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Trash2,
  Pencil,
  X,
  Check,
  TrendingDown,
  TrendingUp,
  Minus,
  LayoutGrid,
  List,
} from 'lucide-react';
import { getUnitPriceDisplay, parseUnitString, calculateUnitPrice } from '@/lib/utils/unit-price';

interface ComparisonProduct {
  id: string;
  targetPrice: number | null;
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
}

interface ComparisonGroupCardProps {
  group: {
    id: string;
    name: string | null;
    products: ComparisonProduct[];
  };
  onUpdateName: (_groupId: string, _name: string | null) => void;
  onRemoveProduct: (_trackedProductId: string) => void;
  onDeleteGroup: (_groupId: string) => void;
  isUpdating?: boolean;
}

export function ComparisonGroupCard({
  group,
  onUpdateName,
  onRemoveProduct,
  onDeleteGroup,
  isUpdating,
}: ComparisonGroupCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [nameInput, setNameInput] = useState(group.name || '');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR',
    }).format(price);
  };

  // Guard against empty products array
  if (group.products.length === 0) {
    return null;
  }

  // Find the cheapest product (by absolute price)
  const cheapestProduct = group.products.reduce((min, p) =>
    p.product.currentPrice < min.product.currentPrice ? p : min
  );

  // Find best value (by unit price)
  const productsWithUnitPrice = group.products.map((p) => {
    const parsed = parseUnitString(p.product.unit);
    const unitPrice = calculateUnitPrice(p.product.currentPrice, parsed);
    return { ...p, unitPrice, unitType: parsed?.type };
  });

  const productsWithValidUnitPrice = productsWithUnitPrice.filter((p) => p.unitPrice !== null);
  const bestValueProduct =
    productsWithValidUnitPrice.length > 0
      ? productsWithValidUnitPrice.reduce((min, p) => (p.unitPrice! < min.unitPrice! ? p : min))
      : null;

  const handleSaveName = () => {
    onUpdateName(group.id, nameInput || null);
    setIsEditing(false);
  };

  // Generate a default name from products if no name is set
  const displayName =
    group.name ||
    group.products
      .map((p) => p.product.name)
      .join(' vs ')
      .substring(0, 50) +
      (group.products.map((p) => p.product.name).join(' vs ').length > 50 ? '...' : '');

  // Calculate savings
  const maxPrice = Math.max(...group.products.map((p) => p.product.currentPrice));
  const savings = maxPrice - cheapestProduct.product.currentPrice;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          {isEditing ? (
            <div className="flex items-center gap-2 flex-1 mr-2">
              <Input
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="Group name..."
                className="h-8"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveName();
                  if (e.key === 'Escape') setIsEditing(false);
                }}
                autoFocus
              />
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleSaveName}>
                <Check className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setIsEditing(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <CardTitle className="text-base line-clamp-1">{displayName}</CardTitle>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setIsEditing(true)}
              >
                <Pencil className="h-3 w-3" />
              </Button>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'cards' | 'table')}>
              <TabsList className="h-8">
                <TabsTrigger value="cards" className="h-6 px-2">
                  <LayoutGrid className="h-3 w-3" />
                </TabsTrigger>
                <TabsTrigger value="table" className="h-6 px-2">
                  <List className="h-3 w-3" />
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={() => onDeleteGroup(group.id)}
              disabled={isUpdating}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {savings > 0 && group.products.length > 1 && (
          <p className="text-sm text-green-600 mt-2">
            Save {formatPrice(savings)} by choosing {cheapestProduct.product.supermarket.name}
          </p>
        )}
      </CardHeader>
      <CardContent>
        {viewMode === 'cards' ? (
          <div
            className="grid gap-4"
            style={{ gridTemplateColumns: `repeat(${group.products.length}, 1fr)` }}
          >
            {group.products.map((tracked) => {
              const { product } = tracked;
              const isCheapest = tracked.id === cheapestProduct.id && group.products.length > 1;
              const isBestValue =
                bestValueProduct && tracked.id === bestValueProduct.id && group.products.length > 1;
              const priceDiff = product.currentPrice - cheapestProduct.product.currentPrice;
              const priceHistory = product.priceHistory || [];
              const previousPrice = priceHistory[1]?.price;
              const historyPriceDiff = previousPrice ? product.currentPrice - previousPrice : 0;
              const unitPriceDisplay = getUnitPriceDisplay(product.currentPrice, product.unit);

              return (
                <div
                  key={tracked.id}
                  className={`relative rounded-lg border p-3 ${isCheapest ? 'border-green-500 bg-green-50 dark:bg-green-950/30' : ''}`}
                >
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1 h-6 w-6"
                    onClick={() => onRemoveProduct(tracked.id)}
                  >
                    <X className="h-3 w-3" />
                  </Button>

                  <div className="flex flex-col items-center text-center">
                    {product.imageUrl && (
                      <div className="relative h-16 w-16 mb-2 overflow-hidden rounded bg-muted">
                        <Image
                          src={product.imageUrl}
                          alt=""
                          fill
                          className="object-contain"
                          unoptimized
                        />
                      </div>
                    )}

                    <Badge variant="outline" className="text-xs mb-2">
                      {product.supermarket.name}
                    </Badge>

                    <p className="text-sm font-medium line-clamp-2 mb-1">{product.name}</p>

                    {product.unit && (
                      <p className="text-xs text-muted-foreground mb-1">{product.unit}</p>
                    )}

                    {unitPriceDisplay && (
                      <p className="text-xs text-muted-foreground mb-2">{unitPriceDisplay}</p>
                    )}

                    <div className="flex items-center gap-1">
                      <span
                        className={`text-xl font-bold ${isCheapest ? 'text-green-600 dark:text-green-400' : ''}`}
                      >
                        {formatPrice(product.currentPrice)}
                      </span>
                      {historyPriceDiff !== 0 && (
                        <span
                          className={`flex items-center text-xs ${
                            historyPriceDiff < 0 ? 'text-green-600' : 'text-red-600'
                          }`}
                        >
                          {historyPriceDiff < 0 ? (
                            <TrendingDown className="h-3 w-3" />
                          ) : (
                            <TrendingUp className="h-3 w-3" />
                          )}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-1 mt-2 justify-center">
                      {isCheapest && <Badge className="bg-green-600">Cheapest</Badge>}
                      {isBestValue && !isCheapest && <Badge variant="secondary">Best Value</Badge>}
                      {!isCheapest && priceDiff > 0 && (
                        <p className="text-xs text-muted-foreground">
                          +{formatPrice(priceDiff)} more
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {group.products.length === 1 && (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-3 text-center">
                <Minus className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">Add another product to compare</p>
              </div>
            )}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Store</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">Unit Price</TableHead>
                <TableHead className="text-right">Difference</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {group.products.map((tracked) => {
                const { product } = tracked;
                const isCheapest = tracked.id === cheapestProduct.id && group.products.length > 1;
                const isBestValue =
                  bestValueProduct &&
                  tracked.id === bestValueProduct.id &&
                  group.products.length > 1;
                const priceDiff = product.currentPrice - cheapestProduct.product.currentPrice;
                const unitPriceDisplay = getUnitPriceDisplay(product.currentPrice, product.unit);

                return (
                  <TableRow
                    key={tracked.id}
                    className={isCheapest ? 'bg-green-50 dark:bg-green-950/30' : ''}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {product.imageUrl && (
                          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded bg-muted">
                            <Image
                              src={product.imageUrl}
                              alt=""
                              fill
                              className="object-contain"
                              unoptimized
                            />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-medium line-clamp-1">{product.name}</p>
                          {product.unit && (
                            <p className="text-xs text-muted-foreground">{product.unit}</p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {product.supermarket.name}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={isCheapest ? 'font-bold text-green-600' : 'font-medium'}>
                        {formatPrice(product.currentPrice)}
                      </span>
                      {isCheapest && <Badge className="ml-2 bg-green-600">Cheapest</Badge>}
                    </TableCell>
                    <TableCell className="text-right">
                      {unitPriceDisplay && (
                        <span className={isBestValue ? 'font-bold text-green-600' : ''}>
                          {unitPriceDisplay}
                        </span>
                      )}
                      {isBestValue && !isCheapest && (
                        <Badge variant="secondary" className="ml-2">
                          Best Value
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {priceDiff > 0 ? (
                        <span className="text-muted-foreground">+{formatPrice(priceDiff)}</span>
                      ) : priceDiff === 0 ? (
                        <span className="text-green-600">—</span>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => onRemoveProduct(tracked.id)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
