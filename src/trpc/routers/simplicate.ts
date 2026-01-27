import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { createTRPCRouter, protectedProcedure } from '../init';
import { createSimplicateClient, transformToSimplicateHours } from '@/lib/api/simplicate';

export const simplicateRouter = createTRPCRouter({
  // Connection management
  connection: createTRPCRouter({
    get: protectedProcedure.query(async ({ ctx }) => {
      return ctx.db.simplicateConnection.findUnique({
        where: { userId: ctx.userId },
      });
    }),

    save: protectedProcedure
      .input(
        z.object({
          subdomain: z.string().min(1),
          apiKey: z.string().optional(),
          apiSecret: z.string().optional(),
          employeeId: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        return ctx.db.simplicateConnection.upsert({
          where: { userId: ctx.userId },
          create: {
            userId: ctx.userId,
            subdomain: input.subdomain,
            apiKey: input.apiKey,
            apiSecret: input.apiSecret,
            employeeId: input.employeeId,
          },
          update: {
            subdomain: input.subdomain,
            apiKey: input.apiKey,
            apiSecret: input.apiSecret,
            employeeId: input.employeeId,
          },
        });
      }),

    test: protectedProcedure.query(async ({ ctx }) => {
      const connection = await ctx.db.simplicateConnection.findUnique({
        where: { userId: ctx.userId },
      });

      if (!connection?.apiKey || !connection?.apiSecret) {
        return { success: false, error: 'API credentials not configured' };
      }

      const client = createSimplicateClient({
        subdomain: connection.subdomain,
        apiKey: connection.apiKey,
        apiSecret: connection.apiSecret,
      });

      return client.testConnection();
    }),
  }),

  // Simplicate data fetching
  projects: createTRPCRouter({
    list: protectedProcedure.query(async ({ ctx }) => {
      const connection = await ctx.db.simplicateConnection.findUnique({
        where: { userId: ctx.userId },
      });

      if (!connection?.apiKey || !connection?.apiSecret) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Simplicate connection not configured',
        });
      }

      const client = createSimplicateClient({
        subdomain: connection.subdomain,
        apiKey: connection.apiKey,
        apiSecret: connection.apiSecret,
      });

      const projects = await client.getProjects();

      // Return simplified project list for mapping UI
      return projects.map((p) => ({
        id: p.id,
        name: p.name,
        projectNumber: p.project_number,
        organization: p.organization?.name,
        status: p.project_status?.label,
      }));
    }),
  }),

  hourTypes: createTRPCRouter({
    list: protectedProcedure.query(async ({ ctx }) => {
      const connection = await ctx.db.simplicateConnection.findUnique({
        where: { userId: ctx.userId },
      });

      if (!connection?.apiKey || !connection?.apiSecret) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Simplicate connection not configured',
        });
      }

      const client = createSimplicateClient({
        subdomain: connection.subdomain,
        apiKey: connection.apiKey,
        apiSecret: connection.apiSecret,
      });

      const hourTypes = await client.getHourTypes();

      // Return only active (not blocked) hour types
      return hourTypes
        .filter((h) => !h.blocked)
        .map((h) => ({
          id: h.id,
          label: h.label,
          tariff: h.tariff,
        }));
    }),
  }),

  employees: createTRPCRouter({
    list: protectedProcedure.query(async ({ ctx }) => {
      const connection = await ctx.db.simplicateConnection.findUnique({
        where: { userId: ctx.userId },
      });

      if (!connection?.apiKey || !connection?.apiSecret) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Simplicate connection not configured',
        });
      }

      const client = createSimplicateClient({
        subdomain: connection.subdomain,
        apiKey: connection.apiKey,
        apiSecret: connection.apiSecret,
      });

      const employees = await client.getEmployees();

      return employees.map((e) => ({
        id: e.id,
        name: e.name,
        function: e.function,
      }));
    }),
  }),

  // Mapping management
  mappings: createTRPCRouter({
    list: protectedProcedure
      .input(
        z
          .object({
            mappingType: z.enum(['project', 'hourtype']).optional(),
          })
          .optional()
      )
      .query(async ({ ctx, input }) => {
        const where: { userId: string; mappingType?: string } = {
          userId: ctx.userId,
        };

        if (input?.mappingType) {
          where.mappingType = input.mappingType;
        }

        return ctx.db.simplicateMapping.findMany({
          where,
          orderBy: { notionValue: 'asc' },
        });
      }),

    upsert: protectedProcedure
      .input(
        z.object({
          notionValue: z.string().min(1),
          simplicateId: z.string().min(1),
          mappingType: z.enum(['project', 'hourtype']),
        })
      )
      .mutation(async ({ ctx, input }) => {
        return ctx.db.simplicateMapping.upsert({
          where: {
            userId_notionValue_mappingType: {
              userId: ctx.userId,
              notionValue: input.notionValue,
              mappingType: input.mappingType,
            },
          },
          create: {
            userId: ctx.userId,
            notionValue: input.notionValue,
            simplicateId: input.simplicateId,
            mappingType: input.mappingType,
          },
          update: {
            simplicateId: input.simplicateId,
          },
        });
      }),

    delete: protectedProcedure
      .input(
        z.object({
          notionValue: z.string().min(1),
          mappingType: z.enum(['project', 'hourtype']),
        })
      )
      .mutation(async ({ ctx, input }) => {
        return ctx.db.simplicateMapping.delete({
          where: {
            userId_notionValue_mappingType: {
              userId: ctx.userId,
              notionValue: input.notionValue,
              mappingType: input.mappingType,
            },
          },
        });
      }),
  }),

  // Push entries to Simplicate
  push: protectedProcedure
    .input(
      z.object({
        entryIds: z.array(z.string()).min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Get connection
      const connection = await ctx.db.simplicateConnection.findUnique({
        where: { userId: ctx.userId },
      });

      if (!connection?.apiKey || !connection?.apiSecret) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Simplicate connection not configured',
        });
      }

      if (!connection.employeeId) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Employee ID not configured in Simplicate settings',
        });
      }

      // Get mappings
      const mappings = await ctx.db.simplicateMapping.findMany({
        where: { userId: ctx.userId },
      });

      const projectMappings = new Map<string, string>();
      const hourTypeMappings = new Map<string, string>();

      for (const mapping of mappings) {
        if (mapping.mappingType === 'project') {
          projectMappings.set(mapping.notionValue, mapping.simplicateId);
        } else if (mapping.mappingType === 'hourtype') {
          hourTypeMappings.set(mapping.notionValue, mapping.simplicateId);
        }
      }

      // Get entries to push
      const entries = await ctx.db.revenueEntry.findMany({
        where: {
          id: { in: input.entryIds },
          userId: ctx.userId,
        },
      });

      if (entries.length === 0) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'No entries found' });
      }

      // Create Simplicate client
      const client = createSimplicateClient({
        subdomain: connection.subdomain,
        apiKey: connection.apiKey,
        apiSecret: connection.apiSecret,
      });

      const results: {
        entryId: string;
        success: boolean;
        simplicateId?: string;
        error?: string;
      }[] = [];

      for (const entry of entries) {
        // Skip already synced entries
        if (entry.simplicateHoursId) {
          results.push({
            entryId: entry.id,
            success: true,
            simplicateId: entry.simplicateHoursId,
            error: 'Already synced',
          });
          continue;
        }

        // Validate entry has required fields
        if (!entry.hours || !entry.startTime) {
          results.push({
            entryId: entry.id,
            success: false,
            error: 'Entry missing hours or start time',
          });
          continue;
        }

        // Find project mapping
        const projectId = entry.client ? projectMappings.get(entry.client) : undefined;

        if (!projectId) {
          results.push({
            entryId: entry.id,
            success: false,
            error: `No project mapping found for client: ${entry.client ?? 'unknown'}`,
          });
          continue;
        }

        // Find hour type mapping
        const hourTypeId = entry.type ? hourTypeMappings.get(entry.type) : undefined;

        if (!hourTypeId) {
          results.push({
            entryId: entry.id,
            success: false,
            error: `No hour type mapping found for type: ${entry.type ?? 'unknown'}`,
          });
          continue;
        }

        try {
          // Transform and push to Simplicate
          const simplicateEntry = transformToSimplicateHours(
            {
              hours: entry.hours,
              startTime: entry.startTime,
              description: entry.description,
              billable: entry.billable,
            },
            {
              employeeId: connection.employeeId,
              projectId,
              hourTypeId,
            }
          );

          const simplicateId = await client.postHours(simplicateEntry);

          // Update entry with Simplicate ID
          await ctx.db.revenueEntry.update({
            where: { id: entry.id },
            data: {
              simplicateHoursId: simplicateId,
              simplicateSyncedAt: new Date(),
              simplicateStatus: 'synced',
            },
          });

          results.push({
            entryId: entry.id,
            success: true,
            simplicateId,
          });
        } catch (error) {
          // Mark as failed
          await ctx.db.revenueEntry.update({
            where: { id: entry.id },
            data: {
              simplicateStatus: 'failed',
            },
          });

          results.push({
            entryId: entry.id,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }

        // Rate limiting: wait 1 second between requests
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      const successCount = results.filter((r) => r.success).length;
      const failCount = results.filter((r) => !r.success).length;

      return {
        results,
        summary: {
          total: entries.length,
          success: successCount,
          failed: failCount,
        },
      };
    }),

  // Get sync status for entries
  syncStatus: protectedProcedure
    .input(
      z.object({
        entryIds: z.array(z.string()),
      })
    )
    .query(async ({ ctx, input }) => {
      const entries = await ctx.db.revenueEntry.findMany({
        where: {
          id: { in: input.entryIds },
          userId: ctx.userId,
        },
        select: {
          id: true,
          simplicateHoursId: true,
          simplicateSyncedAt: true,
          simplicateStatus: true,
        },
      });

      return entries.map((e) => ({
        entryId: e.id,
        synced: !!e.simplicateHoursId,
        syncedAt: e.simplicateSyncedAt,
        status: e.simplicateStatus,
      }));
    }),
});
