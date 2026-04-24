import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { createTRPCRouter, protectedProcedure } from '../init';
import { parseInvoice, parsedInvoiceSchema } from '@/lib/api/claude';
import { createCostEntryInNotion } from '@/lib/api/notion-costs';

const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'] as const;
const MAX_BASE64_SIZE = 7 * 1024 * 1024; // ~7MB base64 for ~5MB file

export const invoiceUploadRouter = createTRPCRouter({
  parse: protectedProcedure
    .input(
      z.object({
        base64: z.string().max(MAX_BASE64_SIZE, 'File too large (max 5MB)'),
        fileName: z.string(),
        mimeType: z.enum(ALLOWED_MIME_TYPES, {
          errorMap: () => ({ message: 'Unsupported file type. Use PDF, JPG, PNG, or WebP.' }),
        }),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const parsed = await parseInvoice(input.base64, input.mimeType);
        return parsed;
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message:
            error instanceof Error ? error.message : 'Failed to parse invoice. Please try again.',
        });
      }
    }),

  confirm: protectedProcedure
    .input(
      z.object({
        name: parsedInvoiceSchema.shape.name,
        amountExclVat: parsedInvoiceSchema.shape.amountExclVat,
        vat: parsedInvoiceSchema.shape.vat,
        invoiceDate: parsedInvoiceSchema.shape.invoiceDate,
        description: parsedInvoiceSchema.shape.description,
        vatRemarks: parsedInvoiceSchema.shape.vatRemarks,
        vatSection: parsedInvoiceSchema.shape.vatSection,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const connection = await ctx.db.notionConnection.findUnique({
        where: { userId: ctx.userId },
      });

      if (!connection?.costsDatabaseId) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'No Notion costs database configured.',
        });
      }

      // Create in Notion
      const notionPageId = await createCostEntryInNotion(connection.costsDatabaseId, {
        name: input.name,
        amountExclVat: input.amountExclVat,
        vat: input.vat,
        invoiceDate: input.invoiceDate,
        description: input.description ?? undefined,
        vatRemarks: input.vatRemarks ?? undefined,
        vatSection: input.vatSection ?? undefined,
      });

      // Create local CostEntry for immediate display
      const date = new Date(input.invoiceDate);
      const quarter = `Q${Math.ceil((date.getMonth() + 1) / 3)}`;

      await ctx.db.costEntry.create({
        data: {
          notionPageId,
          userId: ctx.userId,
          name: input.name,
          amountExclVat: input.amountExclVat,
          vat: input.vat,
          invoiceDate: date,
          year: date.getFullYear(),
          quarter,
          description: input.description,
          vatRemarks: input.vatRemarks,
          vatSection: input.vatSection,
        },
      });

      return { notionPageId };
    }),
});
