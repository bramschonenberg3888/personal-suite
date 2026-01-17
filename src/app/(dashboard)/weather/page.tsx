'use client';

import { trpc } from '@/trpc/client';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { LocationPicker } from '@/components/weather/location-picker';
import { CurrentWeather } from '@/components/weather/current-weather';
import { ForecastGrid } from '@/components/weather/forecast-grid';
import { Cloud } from 'lucide-react';

export default function WeatherPage() {
  const utils = trpc.useUtils();

  const { data: location, isLoading: locationLoading } = trpc.weather.location.get.useQuery();

  const { data: currentWeather, isLoading: weatherLoading } = trpc.weather.getCurrent.useQuery(
    undefined,
    {
      enabled: !!location,
      refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
    }
  );

  const { data: forecast, isLoading: forecastLoading } = trpc.weather.getDailyForecast.useQuery(
    { days: 7 },
    {
      enabled: !!location,
      refetchInterval: 30 * 60 * 1000, // Refresh every 30 minutes
    }
  );

  const handleLocationSet = () => {
    utils.weather.location.get.invalidate();
    utils.weather.getCurrent.invalidate();
    utils.weather.getDailyForecast.invalidate();
  };

  const isLoading = locationLoading || weatherLoading || forecastLoading;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Weather</h1>
          <p className="text-muted-foreground">Check the weather forecast for your location</p>
        </div>
        <LocationPicker currentLocation={location} onLocationSet={handleLocationSet} />
      </div>

      {!location && !locationLoading ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Cloud className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">
              No location set. Pick a city to see the weather forecast.
            </p>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <div className="space-y-6">
          <Skeleton className="h-48" />
          <Skeleton className="h-64" />
        </div>
      ) : (
        <div className="space-y-6">
          {currentWeather && <CurrentWeather weather={currentWeather} />}
          {forecast && forecast.length > 0 && <ForecastGrid forecast={forecast} />}
        </div>
      )}
    </div>
  );
}
