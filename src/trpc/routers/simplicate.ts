import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { createTRPCRouter, protectedProcedure } from '../init';
import { createSimplicateClient, transformToSimplicateHours } from '@/lib/api/simplicate';

export const simplicateRouter = createTRPCRouter({
  // Connection management
  connection: createTRPCRouter({
    get: protectedProcedure.query(async ({ ctx }) => {
      const connection = await ctx.db.simplicateConnection.findUnique({
        where: { userId: ctx.userId },
      });
      if (!connection) return null;
      const { apiKey, apiSecret, ...safe } = connection;
      return { ...safe, isConfigured: !!apiKey && !!apiSecret };
    }),

    save: protectedProcedure
      .input(
        z.object({
          subdomain: z.string().min(1),
          apiKey: z.string().optional(),
          apiSecret: z.string().optional(),
          hoursTypeId: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        // Auto-resolve employee ID from Simplicate
        let employeeId: string | undefined;
        if (input.apiKey && input.apiSecret) {
          try {
            const client = createSimplicateClient({
              subdomain: input.subdomain,
              apiKey: input.apiKey,
              apiSecret: input.apiSecret,
            });
            const employees = await client.getEmployees();
            const match = employees.find((e) => e.name === 'Bram Schonenberg');
            employeeId = match?.id;
          } catch {
            // If fetching fails, keep existing employeeId
            const existing = await ctx.db.simplicateConnection.findUnique({
              where: { userId: ctx.userId },
              select: { employeeId: true },
            });
            employeeId = existing?.employeeId ?? undefined;
          }
        }

        return ctx.db.simplicateConnection.upsert({
          where: { userId: ctx.userId },
          create: {
            userId: ctx.userId,
            subdomain: input.subdomain,
            apiKey: input.apiKey,
            apiSecret: input.apiSecret,
            employeeId,
            hoursTypeId: input.hoursTypeId,
          },
          update: {
            subdomain: input.subdomain,
            apiKey: input.apiKey,
            apiSecret: input.apiSecret,
            employeeId,
            hoursTypeId: input.hoursTypeId,
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

  services: createTRPCRouter({
    list: protectedProcedure
      .input(
        z.object({
          projectId: z.string().min(1),
        })
      )
      .query(async ({ ctx, input }) => {
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

        const services = await client.getProjectServices(input.projectId);

        return services.map((s) => ({
          id: s.id,
          name: s.name,
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
          simplicateServiceId: z.string().optional(),
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
            simplicateServiceId: input.simplicateServiceId,
            mappingType: input.mappingType,
          },
          update: {
            simplicateId: input.simplicateId,
            simplicateServiceId: input.simplicateServiceId,
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

      if (!connection.hoursTypeId) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Hours type not configured in Simplicate settings',
        });
      }

      // Get project mappings
      const mappings = await ctx.db.simplicateMapping.findMany({
        where: { userId: ctx.userId, mappingType: 'project' },
      });

      const projectMappings = new Map<string, { projectId: string; serviceId: string | null }>();

      for (const mapping of mappings) {
        projectMappings.set(mapping.notionValue, {
          projectId: mapping.simplicateId,
          serviceId: mapping.simplicateServiceId,
        });
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
        const projectMapping = entry.client ? projectMappings.get(entry.client) : undefined;

        if (!projectMapping) {
          results.push({
            entryId: entry.id,
            success: false,
            error: `No project mapping found for client: ${entry.client ?? 'unknown'}`,
          });
          continue;
        }

        try {
          // Push hours entry
          const simplicateEntry = transformToSimplicateHours(
            {
              hours: entry.hours,
              startTime: entry.startTime,
              description: entry.description,
              billable: entry.billable,
            },
            {
              employeeId: connection.employeeId,
              projectId: projectMapping.projectId,
              projectServiceId: projectMapping.serviceId ?? undefined,
              hourTypeId: connection.hoursTypeId,
            }
          );

          const simplicateId = await client.postHours(simplicateEntry);

          // Push mileage if the entry has kilometers
          if (entry.kilometers && entry.kilometers > 0) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
            await client.postMileage({
              employee_id: connection.employeeId,
              project_id: projectMapping.projectId,
              projectservice_id: projectMapping.serviceId ?? undefined,
              mileage: entry.kilometers,
              start_date: entry.startTime.toISOString().split('T')[0],
              note: entry.description ?? undefined,
              related_hours_id: simplicateId,
            });
          }

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
