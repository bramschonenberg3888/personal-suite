import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { createTRPCRouter, protectedProcedure } from '../init';
import { Prisma } from '@/generated/prisma/client';

export const drawingRouter = createTRPCRouter({
  // Drawing CRUD
  getAll: protectedProcedure
    .input(z.object({ folderId: z.string().nullable().optional() }).optional())
    .query(async ({ ctx, input }) => {
      return ctx.db.drawing.findMany({
        where: {
          userId: ctx.userId,
          ...(input?.folderId !== undefined && { folderId: input.folderId }),
        },
        select: {
          id: true,
          name: true,
          folderId: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: 'desc' },
      });
    }),

  getById: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    const drawing = await ctx.db.drawing.findFirst({
      where: {
        id: input.id,
        userId: ctx.userId,
      },
      include: {
        files: true,
      },
    });

    if (!drawing) {
      throw new Error('Drawing not found');
    }

    return drawing;
  }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
        folderId: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // If folderId provided, verify ownership
      if (input.folderId) {
        const folder = await ctx.db.drawingFolder.findFirst({
          where: { id: input.folderId, userId: ctx.userId },
        });
        if (!folder) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Folder not found' });
        }
      }

      return ctx.db.drawing.create({
        data: {
          name: input.name,
          userId: ctx.userId,
          folderId: input.folderId ?? null,
          elements: [] as Prisma.InputJsonValue,
          appState: Prisma.JsonNull,
        },
      });
    }),

  moveToFolder: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        folderId: z.string().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify drawing ownership
      const drawing = await ctx.db.drawing.findFirst({
        where: { id: input.id, userId: ctx.userId },
      });

      if (!drawing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Drawing not found' });
      }

      // If folderId provided, verify folder ownership
      if (input.folderId) {
        const folder = await ctx.db.drawingFolder.findFirst({
          where: { id: input.folderId, userId: ctx.userId },
        });
        if (!folder) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Folder not found' });
        }
      }

      return ctx.db.drawing.update({
        where: { id: input.id },
        data: { folderId: input.folderId },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(255).optional(),
        elements: z.array(z.unknown()).optional(),
        appState: z.unknown().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      // Verify ownership
      const drawing = await ctx.db.drawing.findFirst({
        where: { id, userId: ctx.userId },
      });

      if (!drawing) {
        throw new Error('Drawing not found');
      }

      return ctx.db.drawing.update({
        where: { id },
        data: {
          ...(data.name && { name: data.name }),
          ...(data.elements && {
            elements: data.elements as Prisma.InputJsonValue,
          }),
          ...(data.appState !== undefined && {
            appState: data.appState as Prisma.InputJsonValue,
          }),
        },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
      const drawing = await ctx.db.drawing.findFirst({
        where: { id: input.id, userId: ctx.userId },
      });

      if (!drawing) {
        throw new Error('Drawing not found');
      }

      return ctx.db.drawing.delete({
        where: { id: input.id },
      });
    }),

  // File management for binary data (images)
  saveFiles: protectedProcedure
    .input(
      z.object({
        drawingId: z.string(),
        files: z.array(
          z.object({
            fileId: z.string(),
            mimeType: z.string(),
            dataUrl: z.string(),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
      const drawing = await ctx.db.drawing.findFirst({
        where: { id: input.drawingId, userId: ctx.userId },
      });

      if (!drawing) {
        throw new Error('Drawing not found');
      }

      // Upsert files
      const operations = input.files.map((file) =>
        ctx.db.drawingFile.upsert({
          where: {
            drawingId_fileId: {
              drawingId: input.drawingId,
              fileId: file.fileId,
            },
          },
          create: {
            drawingId: input.drawingId,
            fileId: file.fileId,
            mimeType: file.mimeType,
            dataUrl: file.dataUrl,
          },
          update: {
            mimeType: file.mimeType,
            dataUrl: file.dataUrl,
          },
        })
      );

      await ctx.db.$transaction(operations);
      return { success: true };
    }),

  // Library management
  library: createTRPCRouter({
    getAll: protectedProcedure.query(async ({ ctx }) => {
      return ctx.db.excalidrawLibrary.findMany({
        where: { userId: ctx.userId },
        orderBy: { updatedAt: 'desc' },
      });
    }),

    getById: protectedProcedure
      .input(z.object({ id: z.string() }))
      .query(async ({ ctx, input }) => {
        const library = await ctx.db.excalidrawLibrary.findFirst({
          where: { id: input.id, userId: ctx.userId },
        });

        if (!library) {
          throw new Error('Library not found');
        }

        return library;
      }),

    create: protectedProcedure
      .input(z.object({ name: z.string().min(1).max(255) }))
      .mutation(async ({ ctx, input }) => {
        return ctx.db.excalidrawLibrary.create({
          data: {
            name: input.name,
            userId: ctx.userId,
            items: [] as Prisma.InputJsonValue,
          },
        });
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.string(),
          name: z.string().min(1).max(255).optional(),
          items: z.array(z.unknown()).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;

        const library = await ctx.db.excalidrawLibrary.findFirst({
          where: { id, userId: ctx.userId },
        });

        if (!library) {
          throw new Error('Library not found');
        }

        return ctx.db.excalidrawLibrary.update({
          where: { id },
          data: {
            ...(data.name && { name: data.name }),
            ...(data.items && { items: data.items as Prisma.InputJsonValue }),
          },
        });
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const library = await ctx.db.excalidrawLibrary.findFirst({
          where: { id: input.id, userId: ctx.userId },
        });

        if (!library) {
          throw new Error('Library not found');
        }

        return ctx.db.excalidrawLibrary.delete({
          where: { id: input.id },
        });
      }),
  }),

  // Folder management
  folder: createTRPCRouter({
    getAll: protectedProcedure.query(async ({ ctx }) => {
      return ctx.db.drawingFolder.findMany({
        where: { userId: ctx.userId },
        select: {
          id: true,
          name: true,
          parentId: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { name: 'asc' },
      });
    }),

    getContents: protectedProcedure
      .input(z.object({ folderId: z.string().nullable() }))
      .query(async ({ ctx, input }) => {
        const [folders, drawings] = await Promise.all([
          ctx.db.drawingFolder.findMany({
            where: {
              userId: ctx.userId,
              parentId: input.folderId,
            },
            select: {
              id: true,
              name: true,
              parentId: true,
              createdAt: true,
              updatedAt: true,
            },
            orderBy: { name: 'asc' },
          }),
          ctx.db.drawing.findMany({
            where: {
              userId: ctx.userId,
              folderId: input.folderId,
            },
            select: {
              id: true,
              name: true,
              folderId: true,
              createdAt: true,
              updatedAt: true,
            },
            orderBy: { updatedAt: 'desc' },
          }),
        ]);

        return { folders, drawings };
      }),

    getPath: protectedProcedure
      .input(z.object({ folderId: z.string() }))
      .query(async ({ ctx, input }) => {
        const path: { id: string; name: string }[] = [];
        let currentId: string | null = input.folderId;

        while (currentId) {
          const folder: { id: string; name: string; parentId: string | null } | null =
            await ctx.db.drawingFolder.findFirst({
              where: { id: currentId, userId: ctx.userId },
              select: { id: true, name: true, parentId: true },
            });

          if (!folder) break;

          path.unshift({ id: folder.id, name: folder.name });
          currentId = folder.parentId;
        }

        return path;
      }),

    create: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1).max(255),
          parentId: z.string().nullable().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        // If parentId provided, verify ownership
        if (input.parentId) {
          const parent = await ctx.db.drawingFolder.findFirst({
            where: { id: input.parentId, userId: ctx.userId },
          });
          if (!parent) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Parent folder not found' });
          }
        }

        return ctx.db.drawingFolder.create({
          data: {
            name: input.name,
            userId: ctx.userId,
            parentId: input.parentId ?? null,
          },
        });
      }),

    rename: protectedProcedure
      .input(
        z.object({
          id: z.string(),
          name: z.string().min(1).max(255),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const folder = await ctx.db.drawingFolder.findFirst({
          where: { id: input.id, userId: ctx.userId },
        });

        if (!folder) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Folder not found' });
        }

        return ctx.db.drawingFolder.update({
          where: { id: input.id },
          data: { name: input.name },
        });
      }),

    move: protectedProcedure
      .input(
        z.object({
          id: z.string(),
          parentId: z.string().nullable(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const folder = await ctx.db.drawingFolder.findFirst({
          where: { id: input.id, userId: ctx.userId },
        });

        if (!folder) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Folder not found' });
        }

        // Cannot move folder to itself
        if (input.parentId === input.id) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Cannot move folder into itself',
          });
        }

        // If moving to a parent, verify ownership and check for circular reference
        if (input.parentId) {
          const targetParent = await ctx.db.drawingFolder.findFirst({
            where: { id: input.parentId, userId: ctx.userId },
          });

          if (!targetParent) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Target folder not found' });
          }

          // Check for circular reference: traverse up from target to ensure we don't hit the folder being moved
          let checkId: string | null = input.parentId;
          while (checkId) {
            if (checkId === input.id) {
              throw new TRPCError({
                code: 'BAD_REQUEST',
                message: 'Cannot move folder into its own descendant',
              });
            }
            const checkFolder: { parentId: string | null } | null =
              await ctx.db.drawingFolder.findFirst({
                where: { id: checkId, userId: ctx.userId },
                select: { parentId: true },
              });
            checkId = checkFolder?.parentId ?? null;
          }
        }

        return ctx.db.drawingFolder.update({
          where: { id: input.id },
          data: { parentId: input.parentId },
        });
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const folder = await ctx.db.drawingFolder.findFirst({
          where: { id: input.id, userId: ctx.userId },
        });

        if (!folder) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Folder not found' });
        }

        // Cascading delete handles subfolders; drawings move to root (SetNull)
        return ctx.db.drawingFolder.delete({
          where: { id: input.id },
        });
      }),
  }),
});
