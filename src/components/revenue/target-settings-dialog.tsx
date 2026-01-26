'use client';

import { useState } from 'react';
import { Settings, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { trpc } from '@/trpc/client';

interface TargetSettingsDialogProps {
  year: number;
  onYearChange: (_year: number) => void;
}

export function TargetSettingsDialog({ year, onYearChange }: TargetSettingsDialogProps) {
  const [open, setOpen] = useState(false);
  const [targetValue, setTargetValue] = useState('');
  const [notes, setNotes] = useState('');
  const [formInitialized, setFormInitialized] = useState(false);

  const utils = trpc.useUtils();
  const { data: target, isFetched } = trpc.revenue.targets.get.useQuery(
    { year },
    { enabled: open }
  );
  const { data: targets } = trpc.revenue.targets.list.useQuery();

  const upsertMutation = trpc.revenue.targets.upsert.useMutation({
    onSuccess: () => {
      utils.revenue.targets.invalidate();
      setFormInitialized(false);
      setOpen(false);
    },
  });

  const deleteMutation = trpc.revenue.targets.delete.useMutation({
    onSuccess: () => {
      utils.revenue.targets.invalidate();
      setFormInitialized(false);
      setOpen(false);
    },
  });

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      // Reset form state when closing
      setFormInitialized(false);
      setTargetValue('');
      setNotes('');
    }
  };

  // Initialize form when data is fetched (only once per open)
  if (open && isFetched && !formInitialized) {
    setFormInitialized(true);
    setTargetValue(target?.targetValue.toString() ?? '');
    setNotes(target?.notes ?? '');
  }

  const handleSave = () => {
    const value = parseFloat(targetValue);
    if (isNaN(value) || value < 0) return;

    upsertMutation.mutate({
      year,
      targetValue: value,
      notes: notes || undefined,
    });
  };

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this target?')) {
      deleteMutation.mutate({ year });
    }
  };

  const currentYear = new Date().getFullYear();
  const availableYears = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  const formatCurrency = (value: string) => {
    const num = parseFloat(value);
    if (isNaN(num)) return '';
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
    }).format(num);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings className="mr-2 h-4 w-4" />
          Set Target
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Revenue Target Settings</DialogTitle>
          <DialogDescription>Set your annual revenue target for goal tracking.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="year">Year</Label>
            <Select value={year.toString()} onValueChange={(v) => onYearChange(parseInt(v))}>
              <SelectTrigger>
                <SelectValue placeholder="Select year" />
              </SelectTrigger>
              <SelectContent>
                {availableYears.map((y) => (
                  <SelectItem key={y} value={y.toString()}>
                    {y}
                    {targets?.some((t) => t.year === y) && ' (has target)'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="target">Annual Revenue Target</Label>
            <Input
              id="target"
              type="number"
              placeholder="e.g., 100000"
              value={targetValue}
              onChange={(e) => setTargetValue(e.target.value)}
            />
            {targetValue && (
              <p className="text-muted-foreground text-sm">{formatCurrency(targetValue)}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Input
              id="notes"
              placeholder="e.g., Based on 40 billable hours/week @ €62.50/hr"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter className="flex justify-between">
          <div>
            {target && (
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Delete'}
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={upsertMutation.isPending || !targetValue}>
              {upsertMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
