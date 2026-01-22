'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Plus } from 'lucide-react';

interface ComparisonGroup {
  id: string;
  name: string | null;
  products: Array<{
    product: {
      name: string;
      supermarket: {
        name: string;
      };
    };
  }>;
}

interface AddToComparisonDialogProps {
  open: boolean;
  onOpenChange: (_open: boolean) => void;
  productName: string;
  existingGroups: ComparisonGroup[];
  onCreateNew: (_name?: string) => void;
  onAddToExisting: (_groupId: string) => void;
  isLoading?: boolean;
}

export function AddToComparisonDialog({
  open,
  onOpenChange,
  productName,
  existingGroups,
  onCreateNew,
  onAddToExisting,
  isLoading,
}: AddToComparisonDialogProps) {
  const [mode, setMode] = useState<'new' | 'existing'>('new');
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(
    existingGroups[0]?.id || null
  );

  const handleSubmit = () => {
    if (mode === 'new') {
      onCreateNew(newGroupName || undefined);
    } else if (selectedGroupId) {
      onAddToExisting(selectedGroupId);
    }
  };

  // Reset state when dialog opens
  const handleOpenChange = (open: boolean) => {
    if (open) {
      setMode(existingGroups.length > 0 ? 'existing' : 'new');
      setNewGroupName('');
      setSelectedGroupId(existingGroups[0]?.id || null);
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add to Comparison</DialogTitle>
          <DialogDescription>
            Compare &quot;{productName}&quot; with products from other stores.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {existingGroups.length > 0 && (
            <RadioGroup
              value={mode}
              onValueChange={(v: string) => setMode(v as 'new' | 'existing')}
              className="space-y-3"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="existing" id="existing" />
                <Label htmlFor="existing">Add to existing comparison</Label>
              </div>

              {mode === 'existing' && (
                <div className="ml-6 space-y-2">
                  {existingGroups.map((group) => (
                    <div
                      key={group.id}
                      className={`cursor-pointer rounded-lg border p-3 transition-colors ${
                        selectedGroupId === group.id
                          ? 'border-primary bg-primary/5'
                          : 'hover:border-muted-foreground/50'
                      }`}
                      onClick={() => setSelectedGroupId(group.id)}
                    >
                      <p className="font-medium text-sm">
                        {group.name ||
                          group.products
                            .map((p) => p.product.name)
                            .join(' vs ')
                            .substring(0, 40)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {group.products.map((p) => p.product.supermarket.name).join(', ')}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center space-x-2">
                <RadioGroupItem value="new" id="new" />
                <Label htmlFor="new">Create new comparison</Label>
              </div>
            </RadioGroup>
          )}

          {(mode === 'new' || existingGroups.length === 0) && (
            <div className="space-y-2">
              <Label htmlFor="groupName">Group name (optional)</Label>
              <Input
                id="groupName"
                placeholder="e.g., Milk 1L"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Leave empty to auto-generate from product names
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isLoading || (mode === 'existing' && !selectedGroupId)}
          >
            <Plus className="mr-2 h-4 w-4" />
            {mode === 'new' ? 'Create Comparison' : 'Add to Comparison'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
