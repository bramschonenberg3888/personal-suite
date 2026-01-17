import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../init';
import { getQuotes, searchSecurities, getHistoricalData, getNews } from '@/lib/api/yahoo-finance';

export const portfolioRouter = createTRPCRouter({
  // Watchlist management
  watchlist: createTRPCRouter({
    getAll: protectedProcedure.query(async ({ ctx }) => {
      return ctx.db.watchlist.findMany({
        where: { userId: ctx.userId },
        include: {
          items: {
            orderBy: { createdAt: 'desc' },
          },
        },
        orderBy: { createdAt: 'asc' },
      });
    }),

    create: protectedProcedure
      .input(z.object({ name: z.string().min(1).max(100) }))
      .mutation(async ({ ctx, input }) => {
        return ctx.db.watchlist.create({
          data: {
            name: input.name,
            userId: ctx.userId,
          },
          include: {
            items: true,
          },
        });
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        return ctx.db.watchlist.delete({
          where: {
            id: input.id,
            userId: ctx.userId,
          },
        });
      }),

    addItem: protectedProcedure
      .input(
        z.object({
          watchlistId: z.string(),
          isin: z.string(),
          symbol: z.string(),
          name: z.string(),
          exchange: z.string(),
          currency: z.string(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        // Verify the watchlist belongs to the user
        const watchlist = await ctx.db.watchlist.findFirst({
          where: {
            id: input.watchlistId,
            userId: ctx.userId,
          },
        });

        if (!watchlist) {
          throw new Error('Watchlist not found');
        }

        return ctx.db.watchlistItem.create({
          data: {
            watchlistId: input.watchlistId,
            isin: input.isin,
            symbol: input.symbol,
            name: input.name,
            exchange: input.exchange,
            currency: input.currency,
          },
        });
      }),

    removeItem: protectedProcedure
      .input(z.object({ itemId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        // Verify the item belongs to a watchlist owned by the user
        const item = await ctx.db.watchlistItem.findFirst({
          where: { id: input.itemId },
          include: { watchlist: true },
        });

        if (!item || item.watchlist.userId !== ctx.userId) {
          throw new Error('Item not found');
        }

        return ctx.db.watchlistItem.delete({
          where: { id: input.itemId },
        });
      }),
  }),

  // Price data
  prices: createTRPCRouter({
    getBySymbols: protectedProcedure
      .input(z.object({ symbols: z.array(z.string()) }))
      .query(async ({ input }) => {
        if (input.symbols.length === 0) return [];
        return getQuotes(input.symbols);
      }),

    search: protectedProcedure
      .input(z.object({ query: z.string().min(1) }))
      .query(async ({ input }) => {
        return searchSecurities(input.query);
      }),

    getHistory: protectedProcedure
      .input(
        z.object({
          symbol: z.string(),
          days: z.number().min(1).max(365).default(30),
        })
      )
      .query(async ({ input }) => {
        const period1 = new Date();
        period1.setDate(period1.getDate() - input.days);
        return getHistoricalData(input.symbol, period1);
      }),
  }),

  // News
  news: createTRPCRouter({
    getBySymbols: protectedProcedure
      .input(z.object({ symbols: z.array(z.string()) }))
      .query(async ({ input }) => {
        if (input.symbols.length === 0) return [];
        return getNews(input.symbols);
      }),
  }),
});
