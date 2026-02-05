'use client';

import { trpc } from '@/trpc/client';
import { Button } from '@/components/ui/button';
import { ButtonGroup } from '@/components/ui/button-group';
import { Skeleton } from '@/components/ui/skeleton';
import { Store, Check } from 'lucide-react';

interface SupermarketFilterProps {
  className?: string;
}

export function SupermarketFilter({ className }: SupermarketFilterProps) {
  const utils = trpc.useUtils();

  const { data: preferences, isLoading } = trpc.shopper.supermarket.getUserPreferences.useQuery();

  const togglePreference = trpc.shopper.supermarket.togglePreference.useMutation({
    onSuccess: () => {
      utils.shopper.supermarket.getUserPreferences.invalidate();
      utils.shopper.search.all.invalidate();
    },
  });

  if (isLoading) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Store className="h-4 w-4 text-muted-foreground" />
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-8 w-24" />
      </div>
    );
  }

  if (!preferences || preferences.length === 0) {
    return null;
  }

  const enabledCount = preferences.filter((p) => p.enabled).length;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Store className="h-4 w-4 text-muted-foreground" />
      <span className="text-sm text-muted-foreground">Search in:</span>
      <ButtonGroup aria-label="Supermarket selection">
        {preferences.map((supermarket) => (
          <Button
            key={supermarket.id}
            variant={supermarket.enabled ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              // Don't allow disabling all supermarkets
              if (supermarket.enabled && enabledCount <= 1) {
                return;
              }
              togglePreference.mutate({ supermarketId: supermarket.id });
            }}
            disabled={togglePreference.isPending}
            className="gap-1"
          >
            {supermarket.enabled && <Check className="h-3 w-3" />}
            {supermarket.name}
          </Button>
        ))}
      </ButtonGroup>
    </div>
  );
}
