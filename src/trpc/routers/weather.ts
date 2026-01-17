import { z } from 'zod';
import { createTRPCRouter, baseProcedure, protectedProcedure } from '../init';
import * as openMeteo from '@/lib/api/open-meteo';

export const weatherRouter = createTRPCRouter({
  // Location management
  location: createTRPCRouter({
    get: protectedProcedure.query(async ({ ctx }) => {
      return ctx.db.userLocation.findUnique({
        where: { userId: ctx.userId },
      });
    }),

    set: protectedProcedure
      .input(
        z.object({
          city: z.string().min(1),
          country: z.string().min(1),
          lat: z.number(),
          lon: z.number(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        return ctx.db.userLocation.upsert({
          where: { userId: ctx.userId },
          create: {
            userId: ctx.userId,
            city: input.city,
            country: input.country,
            lat: input.lat,
            lon: input.lon,
          },
          update: {
            city: input.city,
            country: input.country,
            lat: input.lat,
            lon: input.lon,
          },
        });
      }),

    search: baseProcedure.input(z.object({ query: z.string().min(2) })).query(async ({ input }) => {
      return openMeteo.searchLocations(input.query);
    }),
  }),

  // Weather data
  getCurrent: protectedProcedure.query(async ({ ctx }) => {
    const location = await ctx.db.userLocation.findUnique({
      where: { userId: ctx.userId },
    });

    if (!location) {
      return null;
    }

    const weather = await openMeteo.getCurrentWeather(location.lat, location.lon);

    if (!weather) {
      return null;
    }

    const weatherInfo = openMeteo.WEATHER_CODES[weather.weatherCode] || {
      description: 'Unknown',
      icon: 'cloud',
    };

    return {
      ...weather,
      description: weatherInfo.description,
      icon: weatherInfo.icon,
      location: {
        city: location.city,
        country: location.country,
      },
    };
  }),

  getDailyForecast: protectedProcedure
    .input(z.object({ days: z.number().min(1).max(14).default(7) }))
    .query(async ({ ctx, input }) => {
      const location = await ctx.db.userLocation.findUnique({
        where: { userId: ctx.userId },
      });

      if (!location) {
        return [];
      }

      const forecast = await openMeteo.getDailyForecast(location.lat, location.lon, input.days);

      return forecast.map((day) => ({
        ...day,
        weatherInfo: openMeteo.WEATHER_CODES[day.weatherCode] || {
          description: 'Unknown',
          icon: 'cloud',
        },
      }));
    }),

  getHourlyForecast: protectedProcedure
    .input(z.object({ hours: z.number().min(1).max(48).default(24) }))
    .query(async ({ ctx, input }) => {
      const location = await ctx.db.userLocation.findUnique({
        where: { userId: ctx.userId },
      });

      if (!location) {
        return [];
      }

      const forecast = await openMeteo.getHourlyForecast(location.lat, location.lon, input.hours);

      return forecast.map((hour) => ({
        ...hour,
        weatherInfo: openMeteo.WEATHER_CODES[hour.weatherCode] || {
          description: 'Unknown',
          icon: 'cloud',
        },
      }));
    }),
});
