'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Sun,
  Cloud,
  CloudRain,
  CloudLightning,
  CloudFog,
  CloudDrizzle,
  CloudSun,
  Snowflake,
  Droplets,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface DailyForecast {
  date: string;
  temperatureMax: number;
  temperatureMin: number;
  precipitationSum: number;
  precipitationProbabilityMax: number;
  weatherCode: number;
  sunrise: string;
  sunset: string;
  windSpeedMax: number;
  weatherInfo: {
    description: string;
    icon: string;
  };
}

interface ForecastGridProps {
  forecast: DailyForecast[];
}

const ICON_MAP: Record<string, typeof Sun> = {
  sun: Sun,
  cloud: Cloud,
  'cloud-sun': CloudSun,
  'cloud-rain': CloudRain,
  'cloud-drizzle': CloudDrizzle,
  'cloud-fog': CloudFog,
  'cloud-lightning': CloudLightning,
  snowflake: Snowflake,
};

export function ForecastGrid({ forecast }: ForecastGridProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>7-Day Forecast</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-7">
          {forecast.map((day, index) => {
            const WeatherIcon = ICON_MAP[day.weatherInfo.icon] || Cloud;
            const date = parseISO(day.date);
            const isToday = index === 0;

            return (
              <div
                key={day.date}
                className={`flex flex-col items-center rounded-lg p-3 ${
                  isToday ? 'bg-primary/10' : 'bg-muted/50'
                }`}
              >
                <div className="text-sm font-medium">{isToday ? 'Today' : format(date, 'EEE')}</div>
                <div className="text-xs text-muted-foreground">{format(date, 'MMM d')}</div>

                <WeatherIcon className="my-3 h-8 w-8 text-primary" />

                <div className="text-sm font-medium">{Math.round(day.temperatureMax)}°</div>
                <div className="text-xs text-muted-foreground">
                  {Math.round(day.temperatureMin)}°
                </div>

                {day.precipitationProbabilityMax > 0 && (
                  <div className="mt-2 flex items-center gap-1 text-xs text-blue-600">
                    <Droplets className="h-3 w-3" />
                    {day.precipitationProbabilityMax}%
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
