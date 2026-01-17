'use client';

import { useState } from 'react';
import { trpc } from '@/trpc/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { MapPin, Search, Loader2, Check } from 'lucide-react';

interface LocationPickerProps {
  currentLocation?: {
    city: string;
    country: string;
  } | null;
  onLocationSet: () => void;
}

export function LocationPicker({ currentLocation, onLocationSet }: LocationPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  const { data: results, isLoading } = trpc.weather.location.search.useQuery(
    { query: debouncedQuery },
    { enabled: debouncedQuery.length >= 2 }
  );

  const setLocation = trpc.weather.location.set.useMutation({
    onSuccess: () => {
      onLocationSet();
      setOpen(false);
      setQuery('');
      setDebouncedQuery('');
    },
  });

  const handleSearch = (value: string) => {
    setQuery(value);
    setTimeout(() => {
      if (value.length >= 2) {
        setDebouncedQuery(value);
      }
    }, 300);
  };

  const handleSelect = (location: {
    name: string;
    country: string;
    latitude: number;
    longitude: number;
    admin1?: string;
  }) => {
    setLocation.mutate({
      city: location.admin1 ? `${location.name}, ${location.admin1}` : location.name,
      country: location.country,
      lat: location.latitude,
      lon: location.longitude,
    });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="justify-start">
          <MapPin className="mr-2 h-4 w-4" />
          {currentLocation ? `${currentLocation.city}, ${currentLocation.country}` : 'Set location'}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <Command>
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <Input
              placeholder="Search cities..."
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
              className="border-0 focus-visible:ring-0"
            />
          </div>
          <CommandList>
            {isLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <CommandEmpty>No cities found.</CommandEmpty>
                <CommandGroup>
                  {results?.map((location) => (
                    <CommandItem
                      key={location.id}
                      onSelect={() => handleSelect(location)}
                      disabled={setLocation.isPending}
                    >
                      <div className="flex items-center gap-2">
                        {setLocation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Check className="h-4 w-4 opacity-0" />
                        )}
                        <div>
                          <div className="font-medium">
                            {location.name}
                            {location.admin1 && `, ${location.admin1}`}
                          </div>
                          <div className="text-xs text-muted-foreground">{location.country}</div>
                        </div>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
