import { z } from 'zod';
import { TRPCError } from '@trpc/server';
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
            revenueDatabaseId: input.databaseId,
          },
          update: {
            revenueDatabaseId: input.databaseId,
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

    if (!connection?.revenueDatabaseId) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'No Notion connection configured. Please set up your database ID first.',
      });
    }

    const entries = await fetchAllTimeEntries(connection.revenueDatabaseId);

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
          invoiceNumber: entry.invoiceNumber,
          invoiceDate: entry.invoiceDate,
          invoiceStatus: entry.invoiceStatus,
          clientType: entry.clientType,
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
          invoiceNumber: entry.invoiceNumber,
          invoiceDate: entry.invoiceDate,
          invoiceStatus: entry.invoiceStatus,
          clientType: entry.clientType,
          syncedAt: new Date(),
        },
      });
    }

    // Update last sync timestamp
    await ctx.db.notionConnection.update({
      where: { userId: ctx.userId },
      data: { revenueLastSyncAt: new Date() },
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
          groupBy: z.enum(['week', 'month', 'quarter', 'year']),
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
          orderBy: [{ year: 'asc' }, { monthNumber: 'asc' }, { week: 'asc' }],
        });

        // Group entries by period
        const grouped = new Map<string, { revenue: number; netIncome: number; hours: number }>();

        for (const entry of entries) {
          let key: string;
          switch (input.groupBy) {
            case 'week':
              key =
                entry.year && entry.week
                  ? `${entry.year}-W${String(entry.week).padStart(2, '0')}`
                  : 'Unknown';
              break;
            case 'month':
              key =
                entry.year && entry.month
                  ? `${entry.year}-${entry.month.toLowerCase()}`
                  : 'Unknown';
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

    byInvoice: protectedProcedure
      .input(
        z
          .object({
            startDate: z.date().optional(),
            endDate: z.date().optional(),
            statuses: z.array(z.string()).optional(),
            clientTypes: z.array(z.string()).optional(),
          })
          .optional()
      )
      .query(async ({ ctx, input }) => {
        const where: Prisma.RevenueEntryWhereInput = {
          userId: ctx.userId,
          invoiceNumber: { not: null },
        };

        if (input?.startDate || input?.endDate) {
          where.invoiceDate = {};
          if (input.startDate) where.invoiceDate.gte = input.startDate;
          if (input.endDate) where.invoiceDate.lte = input.endDate;
        }

        if (input?.statuses && input.statuses.length > 0) {
          where.invoiceStatus = { in: input.statuses };
        }

        if (input?.clientTypes && input.clientTypes.length > 0) {
          where.clientType = { in: input.clientTypes };
        }

        const entries = await ctx.db.revenueEntry.findMany({ where });

        // Group entries by invoice number
        const grouped = new Map<
          string,
          {
            revenue: number;
            taxReservation: number;
            clientType: string | null;
            invoiceStatus: string | null;
            invoiceDate: Date | null;
            entryCount: number;
          }
        >();

        for (const entry of entries) {
          const invoiceNumber = entry.invoiceNumber!;
          const current = grouped.get(invoiceNumber) ?? {
            revenue: 0,
            taxReservation: 0,
            clientType: entry.clientType,
            invoiceStatus: entry.invoiceStatus,
            invoiceDate: entry.invoiceDate,
            entryCount: 0,
          };
          current.revenue += entry.revenue ?? 0;
          current.taxReservation += entry.taxReservation ?? 0;
          current.entryCount += 1;
          grouped.set(invoiceNumber, current);
        }

        return Array.from(grouped.entries())
          .map(([invoiceNumber, data]) => ({
            invoiceNumber,
            ...data,
          }))
          .sort((a, b) => {
            // Sort by invoice date descending (newest first)
            if (a.invoiceDate && b.invoiceDate) {
              return b.invoiceDate.getTime() - a.invoiceDate.getTime();
            }
            if (a.invoiceDate) return -1;
            if (b.invoiceDate) return 1;
            return 0;
          });
      }),

    invoiceFilterOptions: protectedProcedure.query(async ({ ctx }) => {
      const entries = await ctx.db.revenueEntry.findMany({
        where: { userId: ctx.userId, invoiceNumber: { not: null } },
        select: { invoiceStatus: true, clientType: true },
      });

      const statuses = [
        ...new Set(entries.map((e) => e.invoiceStatus).filter(Boolean)),
      ] as string[];
      const clientTypes = [
        ...new Set(entries.map((e) => e.clientType).filter(Boolean)),
      ] as string[];

      return { statuses: statuses.sort(), clientTypes: clientTypes.sort() };
    }),
  }),

  // Target management
  targets: createTRPCRouter({
    get: protectedProcedure.input(z.object({ year: z.number() })).query(async ({ ctx, input }) => {
      return ctx.db.revenueTarget.findUnique({
        where: {
          userId_year: {
            userId: ctx.userId,
            year: input.year,
          },
        },
      });
    }),

    list: protectedProcedure.query(async ({ ctx }) => {
      return ctx.db.revenueTarget.findMany({
        where: { userId: ctx.userId },
        orderBy: { year: 'desc' },
      });
    }),

    upsert: protectedProcedure
      .input(
        z.object({
          year: z.number(),
          targetValue: z.number().min(0),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        return ctx.db.revenueTarget.upsert({
          where: {
            userId_year: {
              userId: ctx.userId,
              year: input.year,
            },
          },
          create: {
            userId: ctx.userId,
            year: input.year,
            targetValue: input.targetValue,
            notes: input.notes,
          },
          update: {
            targetValue: input.targetValue,
            notes: input.notes,
          },
        });
      }),

    delete: protectedProcedure
      .input(z.object({ year: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return ctx.db.revenueTarget.delete({
          where: {
            userId_year: {
              userId: ctx.userId,
              year: input.year,
            },
          },
        });
      }),

    // Get comprehensive target analytics for a year
    analytics: protectedProcedure
      .input(z.object({ year: z.number() }))
      .query(async ({ ctx, input }) => {
        const [target, entries] = await Promise.all([
          ctx.db.revenueTarget.findUnique({
            where: {
              userId_year: {
                userId: ctx.userId,
                year: input.year,
              },
            },
          }),
          ctx.db.revenueEntry.findMany({
            where: {
              userId: ctx.userId,
              year: input.year,
            },
          }),
        ]);

        if (!target) {
          return null;
        }

        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1; // 1-indexed
        const isCurrentYear = input.year === currentYear;

        // Calculate total revenue achieved
        const totalRevenue = entries.reduce((sum, e) => sum + (e.revenue ?? 0), 0);

        // Calculate revenue by month
        const monthlyRevenue = new Map<number, number>();
        for (const entry of entries) {
          if (entry.monthNumber) {
            const current = monthlyRevenue.get(entry.monthNumber) ?? 0;
            monthlyRevenue.set(entry.monthNumber, current + (entry.revenue ?? 0));
          }
        }

        // Progress calculations
        const progressPercent = (totalRevenue / target.targetValue) * 100;
        const remainingTarget = Math.max(0, target.targetValue - totalRevenue);

        // Time-based calculations
        const totalMonths = 12;
        const elapsedMonths = isCurrentYear ? currentMonth : 12;
        const remainingMonths = isCurrentYear ? 12 - currentMonth : 0;

        // Fractional month calculation for accurate pacing
        const daysInCurrentMonth = new Date(currentYear, currentMonth, 0).getDate();
        const currentDayOfMonth = now.getDate();
        const fractionalCurrentMonth = currentDayOfMonth / daysInCurrentMonth;
        const fractionalElapsedMonths = isCurrentYear
          ? currentMonth - 1 + fractionalCurrentMonth
          : 12;

        // Expected revenue at this point (linear distribution, fractional)
        const expectedRevenue = (target.targetValue / totalMonths) * fractionalElapsedMonths;
        const paceVariance = totalRevenue - expectedRevenue;
        const isOnPace = paceVariance >= 0;

        // Dynamic monthly target (adjusts based on progress)
        const requiredMonthlyAverage = remainingMonths > 0 ? remainingTarget / remainingMonths : 0;

        // Original monthly target (static)
        const originalMonthlyTarget = target.targetValue / totalMonths;

        // Projected year-end revenue based on current pace (fractional)
        const monthlyAverageActual =
          fractionalElapsedMonths > 0 ? totalRevenue / fractionalElapsedMonths : 0;
        const projectedYearEnd = monthlyAverageActual * totalMonths;

        // Monthly breakdown with targets vs actuals
        const monthlyBreakdown = Array.from({ length: 12 }, (_, i) => {
          const month = i + 1;
          const actual = monthlyRevenue.get(month) ?? 0;

          // Calculate cumulative values
          let cumulativeActual = 0;
          for (let m = 1; m <= month; m++) {
            cumulativeActual += monthlyRevenue.get(m) ?? 0;
          }
          const cumulativeTarget = originalMonthlyTarget * month;

          // Calculate dynamic target for remaining months
          let dynamicTarget = originalMonthlyTarget;
          if (isCurrentYear && month > currentMonth) {
            // Future months get adjusted target based on remaining revenue
            dynamicTarget = requiredMonthlyAverage;
          }

          return {
            month,
            monthName: [
              'Jan',
              'Feb',
              'Mar',
              'Apr',
              'May',
              'Jun',
              'Jul',
              'Aug',
              'Sep',
              'Oct',
              'Nov',
              'Dec',
            ][i],
            actual,
            target: originalMonthlyTarget,
            dynamicTarget,
            cumulativeActual,
            cumulativeTarget,
            variance: actual - originalMonthlyTarget,
            isAchieved: actual >= originalMonthlyTarget,
            isFuture: isCurrentYear && month > currentMonth,
            isCurrent: isCurrentYear && month === currentMonth,
          };
        });

        // Quarterly breakdown
        const quarterlyBreakdown = [1, 2, 3, 4].map((quarter) => {
          const startMonth = (quarter - 1) * 3 + 1;
          const endMonth = quarter * 3;
          let actual = 0;
          for (let m = startMonth; m <= endMonth; m++) {
            actual += monthlyRevenue.get(m) ?? 0;
          }
          const quarterTarget = target.targetValue / 4;

          return {
            quarter: `Q${quarter}`,
            actual,
            target: quarterTarget,
            variance: actual - quarterTarget,
            progressPercent: (actual / quarterTarget) * 100,
            isFuture: isCurrentYear && startMonth > currentMonth,
          };
        });

        // Calculate best/worst months
        const monthsWithRevenue = monthlyBreakdown.filter((m) => m.actual > 0);
        const bestMonth =
          monthsWithRevenue.length > 0
            ? monthsWithRevenue.reduce((best, m) => (m.actual > best.actual ? m : best))
            : null;
        const worstMonth =
          monthsWithRevenue.length > 0
            ? monthsWithRevenue.reduce((worst, m) => (m.actual < worst.actual ? m : worst))
            : null;

        // Days remaining in the year
        const endOfYear = new Date(input.year, 11, 31);
        const daysRemaining = isCurrentYear
          ? Math.ceil((endOfYear.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
          : 0;

        // Daily required revenue
        const dailyRequired = daysRemaining > 0 ? remainingTarget / daysRemaining : 0;

        // Weekly required revenue
        const weeksRemaining = Math.ceil(daysRemaining / 7);
        const weeklyRequired = weeksRemaining > 0 ? remainingTarget / weeksRemaining : 0;

        // Current month focus (only meaningful for current year)
        const currentMonthRevenue = monthlyRevenue.get(currentMonth) ?? 0;
        const cumulativeTargetThroughMonth = originalMonthlyTarget * currentMonth;
        const neededThisMonth = Math.max(0, cumulativeTargetThroughMonth - totalRevenue);
        const daysRemainingInMonth = daysInCurrentMonth - currentDayOfMonth;
        const monthNames = [
          'January',
          'February',
          'March',
          'April',
          'May',
          'June',
          'July',
          'August',
          'September',
          'October',
          'November',
          'December',
        ];

        return {
          target: target.targetValue,
          notes: target.notes,
          year: input.year,

          // Progress
          totalRevenue,
          progressPercent,
          remainingTarget,

          // Time context
          isCurrentYear,
          elapsedMonths,
          fractionalElapsedMonths,
          remainingMonths,
          daysRemaining,

          // Pacing
          expectedRevenue,
          paceVariance,
          isOnPace,
          pacePercent: expectedRevenue > 0 ? (totalRevenue / expectedRevenue) * 100 : 0,

          // Dynamic targets
          originalMonthlyTarget,
          requiredMonthlyAverage,
          dailyRequired,
          weeklyRequired,

          // Projections
          projectedYearEnd,
          projectedVsTarget: projectedYearEnd - target.targetValue,
          willMeetTarget: projectedYearEnd >= target.targetValue,

          // Averages
          monthlyAverageActual,

          // Breakdowns
          monthlyBreakdown,
          quarterlyBreakdown,

          // Highlights
          bestMonth: bestMonth ? { month: bestMonth.monthName, revenue: bestMonth.actual } : null,
          worstMonth: worstMonth
            ? { month: worstMonth.monthName, revenue: worstMonth.actual }
            : null,

          // Current month focus
          currentMonthFocus: isCurrentYear
            ? {
                monthName: monthNames[currentMonth - 1],
                monthNumber: currentMonth,
                revenueThisMonth: currentMonthRevenue,
                monthlyTarget: originalMonthlyTarget,
                cumulativeTargetThroughMonth,
                cumulativeActualRevenue: totalRevenue,
                neededThisMonth,
                daysElapsedInMonth: currentDayOfMonth,
                daysRemainingInMonth,
                daysInMonth: daysInCurrentMonth,
                monthProgressPercent: (currentDayOfMonth / daysInCurrentMonth) * 100,
              }
            : null,
        };
      }),
  }),
});
