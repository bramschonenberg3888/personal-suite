import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../init';
import { validateCostsConnection, fetchAllCostEntries } from '@/lib/api/notion-costs';
import { Prisma } from '@/generated/prisma/client';

export const costsRouter = createTRPCRouter({
  // Connection management
  connection: createTRPCRouter({
    get: protectedProcedure.query(async ({ ctx }) => {
      const connection = await ctx.db.notionConnection.findUnique({
        where: { userId: ctx.userId },
      });
      return connection
        ? {
            costsDatabaseId: connection.costsDatabaseId,
            costsLastSyncAt: connection.costsLastSyncAt,
          }
        : null;
    }),

    save: protectedProcedure
      .input(z.object({ databaseId: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        return ctx.db.notionConnection.upsert({
          where: { userId: ctx.userId },
          create: {
            userId: ctx.userId,
            costsDatabaseId: input.databaseId,
          },
          update: {
            costsDatabaseId: input.databaseId,
          },
        });
      }),

    validate: protectedProcedure
      .input(z.object({ databaseId: z.string().min(1) }))
      .query(async ({ input }) => {
        return validateCostsConnection(input.databaseId);
      }),
  }),

  // Sync from Notion
  sync: protectedProcedure.mutation(async ({ ctx }) => {
    const connection = await ctx.db.notionConnection.findUnique({
      where: { userId: ctx.userId },
    });

    if (!connection?.costsDatabaseId) {
      throw new Error('No Notion costs database configured. Please set up your database ID first.');
    }

    const entries = await fetchAllCostEntries(connection.costsDatabaseId);

    // Upsert all entries
    for (const entry of entries) {
      await ctx.db.costEntry.upsert({
        where: { notionPageId: entry.id },
        create: {
          notionPageId: entry.id,
          userId: ctx.userId,
          name: entry.name,
          vat: entry.vat,
          amountExclVat: entry.amountExclVat,
          invoiceDate: entry.invoiceDate,
          year: entry.year,
          quarter: entry.quarter,
          description: entry.description,
          vatRemarks: entry.vatRemarks,
          vatSection: entry.vatSection,
        },
        update: {
          name: entry.name,
          vat: entry.vat,
          amountExclVat: entry.amountExclVat,
          invoiceDate: entry.invoiceDate,
          year: entry.year,
          quarter: entry.quarter,
          description: entry.description,
          vatRemarks: entry.vatRemarks,
          vatSection: entry.vatSection,
          syncedAt: new Date(),
        },
      });
    }

    // Update last sync timestamp
    await ctx.db.notionConnection.update({
      where: { userId: ctx.userId },
      data: { costsLastSyncAt: new Date() },
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
            vatSections: z.array(z.string()).optional(),
            years: z.array(z.number()).optional(),
            limit: z.number().min(1).max(1000).optional(),
          })
          .optional()
      )
      .query(async ({ ctx, input }) => {
        const where: Prisma.CostEntryWhereInput = {
          userId: ctx.userId,
        };

        if (input?.startDate || input?.endDate) {
          where.invoiceDate = {};
          if (input.startDate) where.invoiceDate.gte = input.startDate;
          if (input.endDate) where.invoiceDate.lte = input.endDate;
        }

        if (input?.vatSections && input.vatSections.length > 0) {
          where.vatSection = { in: input.vatSections };
        }

        if (input?.years && input.years.length > 0) {
          where.year = { in: input.years };
        }

        return ctx.db.costEntry.findMany({
          where,
          orderBy: { invoiceDate: 'desc' },
          take: input?.limit,
        });
      }),

    kpis: protectedProcedure
      .input(
        z
          .object({
            startDate: z.date().optional(),
            endDate: z.date().optional(),
            vatSections: z.array(z.string()).optional(),
            years: z.array(z.number()).optional(),
          })
          .optional()
      )
      .query(async ({ ctx, input }) => {
        const where: Prisma.CostEntryWhereInput = {
          userId: ctx.userId,
        };

        if (input?.startDate || input?.endDate) {
          where.invoiceDate = {};
          if (input.startDate) where.invoiceDate.gte = input.startDate;
          if (input.endDate) where.invoiceDate.lte = input.endDate;
        }

        if (input?.vatSections && input.vatSections.length > 0) {
          where.vatSection = { in: input.vatSections };
        }

        if (input?.years && input.years.length > 0) {
          where.year = { in: input.years };
        }

        const entries = await ctx.db.costEntry.findMany({ where });

        const totalCosts = entries.reduce((sum, e) => sum + (e.amountExclVat ?? 0), 0);
        const totalVat = entries.reduce((sum, e) => sum + (e.vat ?? 0), 0);
        const totalInclVat = totalCosts + totalVat;
        const avgCostPerEntry = entries.length > 0 ? totalCosts / entries.length : 0;

        return {
          totalCosts,
          totalVat,
          totalInclVat,
          avgCostPerEntry,
          entryCount: entries.length,
        };
      }),

    byPeriod: protectedProcedure
      .input(
        z.object({
          groupBy: z.enum(['month', 'quarter', 'year']),
          startDate: z.date().optional(),
          endDate: z.date().optional(),
          vatSections: z.array(z.string()).optional(),
          years: z.array(z.number()).optional(),
        })
      )
      .query(async ({ ctx, input }) => {
        const where: Prisma.CostEntryWhereInput = {
          userId: ctx.userId,
        };

        if (input.startDate || input.endDate) {
          where.invoiceDate = {};
          if (input.startDate) where.invoiceDate.gte = input.startDate;
          if (input.endDate) where.invoiceDate.lte = input.endDate;
        }

        if (input.vatSections && input.vatSections.length > 0) {
          where.vatSection = { in: input.vatSections };
        }

        if (input.years && input.years.length > 0) {
          where.year = { in: input.years };
        }

        const entries = await ctx.db.costEntry.findMany({
          where,
          orderBy: [{ year: 'asc' }, { invoiceDate: 'asc' }],
        });

        // Group entries by period
        const grouped = new Map<string, { costs: number; vat: number }>();

        for (const entry of entries) {
          let key: string;
          switch (input.groupBy) {
            case 'month':
              if (entry.invoiceDate) {
                const date = new Date(entry.invoiceDate);
                const monthName = date.toLocaleString('nl-NL', { month: 'long' });
                key = `${date.getFullYear()}-${monthName}`;
              } else {
                key = 'Unknown';
              }
              break;
            case 'quarter':
              key = entry.year && entry.quarter ? `${entry.year} ${entry.quarter}` : 'Unknown';
              break;
            case 'year':
              key = entry.year?.toString() ?? 'Unknown';
              break;
          }

          const current = grouped.get(key) ?? { costs: 0, vat: 0 };
          current.costs += entry.amountExclVat ?? 0;
          current.vat += entry.vat ?? 0;
          grouped.set(key, current);
        }

        return Array.from(grouped.entries())
          .map(([period, data]) => ({
            period,
            ...data,
          }))
          .filter((d) => d.period !== 'Unknown');
      }),

    bySection: protectedProcedure
      .input(
        z
          .object({
            startDate: z.date().optional(),
            endDate: z.date().optional(),
            years: z.array(z.number()).optional(),
          })
          .optional()
      )
      .query(async ({ ctx, input }) => {
        const where: Prisma.CostEntryWhereInput = {
          userId: ctx.userId,
          vatSection: { not: null },
        };

        if (input?.startDate || input?.endDate) {
          where.invoiceDate = {};
          if (input.startDate) where.invoiceDate.gte = input.startDate;
          if (input.endDate) where.invoiceDate.lte = input.endDate;
        }

        if (input?.years && input.years.length > 0) {
          where.year = { in: input.years };
        }

        const entries = await ctx.db.costEntry.findMany({ where });

        const grouped = new Map<string, { costs: number; vat: number }>();

        for (const entry of entries) {
          const section = entry.vatSection ?? 'Unknown';
          const current = grouped.get(section) ?? { costs: 0, vat: 0 };
          current.costs += entry.amountExclVat ?? 0;
          current.vat += entry.vat ?? 0;
          grouped.set(section, current);
        }

        return Array.from(grouped.entries())
          .map(([section, data]) => ({
            section,
            ...data,
          }))
          .sort((a, b) => b.costs - a.costs);
      }),

    filterOptions: protectedProcedure.query(async ({ ctx }) => {
      const entries = await ctx.db.costEntry.findMany({
        where: { userId: ctx.userId },
        select: { vatSection: true, year: true },
      });

      const vatSections = [
        ...new Set(entries.map((e) => e.vatSection).filter(Boolean)),
      ] as string[];
      const years = [...new Set(entries.map((e) => e.year).filter(Boolean))] as number[];

      return {
        vatSections: vatSections.sort(),
        years: years.sort((a, b) => b - a),
      };
    }),
  }),
});
