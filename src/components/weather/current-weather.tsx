'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Sun,
  Moon,
  Cloud,
  CloudRain,
  CloudLightning,
  CloudFog,
  CloudDrizzle,
  CloudSun,
  Snowflake,
  Wind,
  Droplets,
  Thermometer,
} from 'lucide-react';

interface CurrentWeatherProps {
  weather: {
    temperature: number;
    humidity: number;
    apparentTemperature: number;
    isDay: boolean;
    precipitation: number;
    weatherCode: number;
    windSpeed: number;
    windDirection: number;
    description: string;
    icon: string;
    location: {
      city: string;
      country: string;
    };
  };
}

const ICON_MAP: Record<string, typeof Sun> = {
  sun: Sun,
  moon: Moon,
  cloud: Cloud,
  'cloud-sun': CloudSun,
  'cloud-rain': CloudRain,
  'cloud-drizzle': CloudDrizzle,
  'cloud-fog': CloudFog,
  'cloud-lightning': CloudLightning,
  snowflake: Snowflake,
};

function getWindDirection(degrees: number): string {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(degrees / 45) % 8;
  return directions[index];
}

export function CurrentWeather({ weather }: CurrentWeatherProps) {
  const WeatherIcon = ICON_MAP[weather.isDay ? weather.icon : 'moon'] || Cloud;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between">
          <span>Current Weather</span>
          <span className="text-sm font-normal text-muted-foreground">
            {weather.location.city}, {weather.location.country}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-4">
            <WeatherIcon className="h-16 w-16 text-primary" />
            <div>
              <div className="text-5xl font-bold">{Math.round(weather.temperature)}°</div>
              <div className="text-muted-foreground">{weather.description}</div>
            </div>
          </div>

          <div className="flex-1 grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <Thermometer className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-sm text-muted-foreground">Feels like</div>
                <div className="font-medium">{Math.round(weather.apparentTemperature)}°C</div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Droplets className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-sm text-muted-foreground">Humidity</div>
                <div className="font-medium">{weather.humidity}%</div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Wind className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-sm text-muted-foreground">Wind</div>
                <div className="font-medium">
                  {Math.round(weather.windSpeed)} km/h {getWindDirection(weather.windDirection)}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <CloudRain className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-sm text-muted-foreground">Precipitation</div>
                <div className="font-medium">{weather.precipitation} mm</div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
