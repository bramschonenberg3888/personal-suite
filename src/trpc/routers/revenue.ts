import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../init';
import { validateNotionConnection, fetchAllTimeEntries } from '@/lib/api/notion';
import { Prisma } from '@/generated/prisma/client';

export const revenueRouter = createTRPCRouter({
  // Connection management
  connection: createTRPCRouter({
    get: protectedProcedure.query(async ({ ctx }) => {
      return ctx.db.notionConnection.findUnique({
        where: { userId: ctx.userId },
      });
    }),

    save: protectedProcedure
      .input(z.object({ databaseId: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        return ctx.db.notionConnection.upsert({
          where: { userId: ctx.userId },
          create: {
            userId: ctx.userId,
            databaseId: input.databaseId,
          },
          update: {
            databaseId: input.databaseId,
          },
        });
      }),

    validate: protectedProcedure
      .input(z.object({ databaseId: z.string().min(1) }))
      .query(async ({ input }) => {
        return validateNotionConnection(input.databaseId);
      }),
  }),

  // Sync from Notion
  sync: protectedProcedure.mutation(async ({ ctx }) => {
    const connection = await ctx.db.notionConnection.findUnique({
      where: { userId: ctx.userId },
    });

    if (!connection) {
      throw new Error('No Notion connection configured. Please set up your database ID first.');
    }

    const entries = await fetchAllTimeEntries(connection.databaseId);

    // Upsert all entries
    for (const entry of entries) {
      await ctx.db.revenueEntry.upsert({
        where: { notionPageId: entry.id },
        create: {
          notionPageId: entry.id,
          userId: ctx.userId,
          description: entry.description,
          kilometers: entry.kilometers,
          minutes: entry.minutes,
          hours: entry.hours,
          billable: entry.billable,
          startTime: entry.startTime,
          endTime: entry.endTime,
          breakMinutes: entry.breakMinutes,
          client: entry.client,
          type: entry.type,
          rate: entry.rate,
          revenue: entry.revenue,
          taxReservation: entry.taxReservation,
          netIncome: entry.netIncome,
          year: entry.year,
          quarter: entry.quarter,
          month: entry.month,
          monthNumber: entry.monthNumber,
          week: entry.week,
        },
        update: {
          description: entry.description,
          kilometers: entry.kilometers,
          minutes: entry.minutes,
          hours: entry.hours,
          billable: entry.billable,
          startTime: entry.startTime,
          endTime: entry.endTime,
          breakMinutes: entry.breakMinutes,
          client: entry.client,
          type: entry.type,
          rate: entry.rate,
          revenue: entry.revenue,
          taxReservation: entry.taxReservation,
          netIncome: entry.netIncome,
          year: entry.year,
          quarter: entry.quarter,
          month: entry.month,
          monthNumber: entry.monthNumber,
          week: entry.week,
          syncedAt: new Date(),
        },
      });
    }

    // Update last sync timestamp
    await ctx.db.notionConnection.update({
      where: { userId: ctx.userId },
      data: { lastSyncAt: new Date() },
    });

    return { synced: entries.length };
  }),

  // Entry queries
  entries: createTRPCRouter({
    list: protectedProcedure
      .input(
        z
          .object({
            startDate: z.date().optional(),
            endDate: z.date().optional(),
            clients: z.array(z.string()).optional(),
            types: z.array(z.string()).optional(),
            billable: z.boolean().optional(),
            limit: z.number().min(1).max(1000).optional(),
          })
          .optional()
      )
      .query(async ({ ctx, input }) => {
        const where: Prisma.RevenueEntryWhereInput = {
          userId: ctx.userId,
        };

        if (input?.startDate || input?.endDate) {
          where.startTime = {};
          if (input.startDate) where.startTime.gte = input.startDate;
          if (input.endDate) where.startTime.lte = input.endDate;
        }

        if (input?.clients && input.clients.length > 0) {
          where.client = { in: input.clients };
        }

        if (input?.types && input.types.length > 0) {
          where.type = { in: input.types };
        }

        if (input?.billable !== undefined) {
          where.billable = input.billable;
        }

        return ctx.db.revenueEntry.findMany({
          where,
          orderBy: { startTime: 'desc' },
          take: input?.limit,
        });
      }),

    kpis: protectedProcedure
      .input(
        z
          .object({
            startDate: z.date().optional(),
            endDate: z.date().optional(),
            clients: z.array(z.string()).optional(),
            types: z.array(z.string()).optional(),
          })
          .optional()
      )
      .query(async ({ ctx, input }) => {
        const where: Prisma.RevenueEntryWhereInput = {
          userId: ctx.userId,
        };

        if (input?.startDate || input?.endDate) {
          where.startTime = {};
          if (input.startDate) where.startTime.gte = input.startDate;
          if (input.endDate) where.startTime.lte = input.endDate;
        }

        if (input?.clients && input.clients.length > 0) {
          where.client = { in: input.clients };
        }

        if (input?.types && input.types.length > 0) {
          where.type = { in: input.types };
        }

        const entries = await ctx.db.revenueEntry.findMany({ where });

        const totalRevenue = entries.reduce((sum, e) => sum + (e.revenue ?? 0), 0);
        const totalNetIncome = entries.reduce((sum, e) => sum + (e.netIncome ?? 0), 0);
        const totalHours = entries.reduce((sum, e) => sum + (e.hours ?? 0), 0);
        const totalKilometers = entries.reduce((sum, e) => sum + (e.kilometers ?? 0), 0);
        const billableEntries = entries.filter((e) => e.billable);
        const billableHours = billableEntries.reduce((sum, e) => sum + (e.hours ?? 0), 0);
        const avgHourlyRate = billableHours > 0 ? totalRevenue / billableHours : 0;

        return {
          totalRevenue,
          totalNetIncome,
          totalHours,
          billableHours,
          totalKilometers,
          avgHourlyRate,
          entryCount: entries.length,
        };
      }),

    byPeriod: protectedProcedure
      .input(
        z.object({
          groupBy: z.enum(['month', 'quarter', 'year']),
          startDate: z.date().optional(),
          endDate: z.date().optional(),
          clients: z.array(z.string()).optional(),
          types: z.array(z.string()).optional(),
          billable: z.boolean().optional(),
        })
      )
      .query(async ({ ctx, input }) => {
        const where: Prisma.RevenueEntryWhereInput = {
          userId: ctx.userId,
        };

        if (input.startDate || input.endDate) {
          where.startTime = {};
          if (input.startDate) where.startTime.gte = input.startDate;
          if (input.endDate) where.startTime.lte = input.endDate;
        }

        if (input.clients && input.clients.length > 0) {
          where.client = { in: input.clients };
        }

        if (input.types && input.types.length > 0) {
          where.type = { in: input.types };
        }

        if (input.billable !== undefined) {
          where.billable = input.billable;
        }

        const entries = await ctx.db.revenueEntry.findMany({
          where,
          orderBy: [{ year: 'asc' }, { monthNumber: 'asc' }],
        });

        // Group entries by period
        const grouped = new Map<string, { revenue: number; netIncome: number; hours: number }>();

        for (const entry of entries) {
          let key: string;
          switch (input.groupBy) {
            case 'month':
              key = entry.year && entry.month ? `${entry.year}-${entry.month}` : 'Unknown';
              break;
            case 'quarter':
              key = entry.year && entry.quarter ? `${entry.year} ${entry.quarter}` : 'Unknown';
              break;
            case 'year':
              key = entry.year?.toString() ?? 'Unknown';
              break;
          }

          const current = grouped.get(key) ?? { revenue: 0, netIncome: 0, hours: 0 };
          current.revenue += entry.revenue ?? 0;
          current.netIncome += entry.netIncome ?? 0;
          current.hours += entry.hours ?? 0;
          grouped.set(key, current);
        }

        return Array.from(grouped.entries())
          .map(([period, data]) => ({
            period,
            ...data,
          }))
          .filter((d) => d.period !== 'Unknown');
      }),

    byClient: protectedProcedure
      .input(
        z
          .object({
            startDate: z.date().optional(),
            endDate: z.date().optional(),
            clients: z.array(z.string()).optional(),
            types: z.array(z.string()).optional(),
          })
          .optional()
      )
      .query(async ({ ctx, input }) => {
        const where: Prisma.RevenueEntryWhereInput = {
          userId: ctx.userId,
          client: { not: null },
        };

        if (input?.startDate || input?.endDate) {
          where.startTime = {};
          if (input.startDate) where.startTime.gte = input.startDate;
          if (input.endDate) where.startTime.lte = input.endDate;
        }

        if (input?.clients && input.clients.length > 0) {
          where.client = { in: input.clients };
        }

        if (input?.types && input.types.length > 0) {
          where.type = { in: input.types };
        }

        const entries = await ctx.db.revenueEntry.findMany({ where });

        const grouped = new Map<string, { revenue: number; hours: number }>();

        for (const entry of entries) {
          const client = entry.client ?? 'Unknown';
          const current = grouped.get(client) ?? { revenue: 0, hours: 0 };
          current.revenue += entry.revenue ?? 0;
          current.hours += entry.hours ?? 0;
          grouped.set(client, current);
        }

        return Array.from(grouped.entries())
          .map(([client, data]) => ({
            client,
            ...data,
          }))
          .sort((a, b) => b.revenue - a.revenue);
      }),

    byType: protectedProcedure
      .input(
        z
          .object({
            startDate: z.date().optional(),
            endDate: z.date().optional(),
            clients: z.array(z.string()).optional(),
          })
          .optional()
      )
      .query(async ({ ctx, input }) => {
        const where: Prisma.RevenueEntryWhereInput = {
          userId: ctx.userId,
          type: { not: null },
        };

        if (input?.startDate || input?.endDate) {
          where.startTime = {};
          if (input.startDate) where.startTime.gte = input.startDate;
          if (input.endDate) where.startTime.lte = input.endDate;
        }

        if (input?.clients && input.clients.length > 0) {
          where.client = { in: input.clients };
        }

        const entries = await ctx.db.revenueEntry.findMany({ where });

        const grouped = new Map<string, { revenue: number; hours: number }>();

        for (const entry of entries) {
          const type = entry.type ?? 'Unknown';
          const current = grouped.get(type) ?? { revenue: 0, hours: 0 };
          current.revenue += entry.revenue ?? 0;
          current.hours += entry.hours ?? 0;
          grouped.set(type, current);
        }

        return Array.from(grouped.entries())
          .map(([type, data]) => ({
            type,
            ...data,
          }))
          .sort((a, b) => b.revenue - a.revenue);
      }),

    filterOptions: protectedProcedure.query(async ({ ctx }) => {
      const entries = await ctx.db.revenueEntry.findMany({
        where: { userId: ctx.userId },
        select: { client: true, type: true },
      });

      const clients = [...new Set(entries.map((e) => e.client).filter(Boolean))] as string[];
      const types = [...new Set(entries.map((e) => e.type).filter(Boolean))] as string[];

      return { clients: clients.sort(), types: types.sort() };
    }),
  }),
});
