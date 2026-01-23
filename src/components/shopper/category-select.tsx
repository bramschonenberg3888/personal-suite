'use client';

import { useState } from 'react';
import { Check, ChevronsUpDown, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { trpc } from '@/trpc/client';

interface CategorySelectProps {
  trackedProductId: string;
  currentCategory: string | null;
}

export function CategorySelect({ trackedProductId, currentCategory }: CategorySelectProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');

  const utils = trpc.useUtils();
  const { data: categories = [] } = trpc.shopper.categories.getAll.useQuery();

  const setCategory = trpc.shopper.categories.setCategory.useMutation({
    onSuccess: () => {
      utils.shopper.tracked.getAll.invalidate();
      utils.shopper.categories.getAll.invalidate();
      setOpen(false);
    },
  });

  const handleSelect = (category: string | null) => {
    setCategory.mutate({ trackedProductId, category });
  };

  const handleCreateNew = () => {
    if (inputValue.trim()) {
      handleSelect(inputValue.trim());
      setInputValue('');
    }
  };

  const showCreateOption = inputValue.trim() && !categories.includes(inputValue.trim());

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          size="sm"
          className="h-7 justify-between text-xs"
        >
          {currentCategory || 'Category...'}
          <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Search or create..."
            value={inputValue}
            onValueChange={setInputValue}
          />
          <CommandList>
            <CommandEmpty>
              {showCreateOption ? (
                <button
                  className="flex items-center gap-2 w-full px-2 py-1.5 text-sm hover:bg-accent rounded cursor-pointer"
                  onClick={handleCreateNew}
                >
                  <Plus className="h-4 w-4" />
                  Create &quot;{inputValue.trim()}&quot;
                </button>
              ) : (
                'No categories found'
              )}
            </CommandEmpty>
            <CommandGroup>
              {categories.map((category) => (
                <CommandItem
                  key={category}
                  value={category}
                  onSelect={() => handleSelect(category)}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      currentCategory === category ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  {category}
                </CommandItem>
              ))}
            </CommandGroup>
            {currentCategory && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem onSelect={() => handleSelect(null)} className="text-destructive">
                    <X className="mr-2 h-4 w-4" />
                    Remove category
                  </CommandItem>
                </CommandGroup>
              </>
            )}
            {showCreateOption && categories.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem onSelect={handleCreateNew}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create &quot;{inputValue.trim()}&quot;
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
