import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../init';
import { Prisma } from '@/generated/prisma/client';

export const drawingRouter = createTRPCRouter({
  // Drawing CRUD
  getAll: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.drawing.findMany({
      where: { userId: ctx.userId },
      select: {
        id: true,
        name: true,
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
    .input(z.object({ name: z.string().min(1).max(255) }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.drawing.create({
        data: {
          name: input.name,
          userId: ctx.userId,
          elements: [] as Prisma.InputJsonValue,
          appState: Prisma.JsonNull,
        },
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
});
