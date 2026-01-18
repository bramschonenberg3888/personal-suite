import { createTRPCRouter, baseProcedure } from '../init';
import { z } from 'zod';
import { portfolioRouter } from './portfolio';
import { drawingRouter } from './drawing';
import { shopperRouter } from './shopper';
import { weatherRouter } from './weather';

export const appRouter = createTRPCRouter({
  hello: baseProcedure.input(z.object({ name: z.string() }).optional()).query(({ input }) => ({
    greeting: `Hello ${input?.name ?? 'World'}!`,
  })),

  portfolio: portfolioRouter,
  drawing: drawingRouter,
  shopper: shopperRouter,
  weather: weatherRouter,
});

export type AppRouter = typeof appRouter;
