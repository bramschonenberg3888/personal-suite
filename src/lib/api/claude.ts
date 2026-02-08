import { generateObject } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import { env } from '@/env';

function getAnthropicClient() {
  return createAnthropic({
    apiKey: env.ANTHROPIC_API_KEY ?? '',
  });
}

export const parsedInvoiceSchema = z.object({
  name: z.string().describe('The vendor or company name on the invoice'),
  amountExclVat: z.number().describe('The total amount excluding VAT (BTW) in euros'),
  vat: z.number().describe('The VAT (BTW) amount in euros'),
  invoiceDate: z.string().describe('The invoice date in ISO 8601 format (YYYY-MM-DD)'),
  description: z
    .string()
    .optional()
    .describe('A brief description of what was purchased or the service rendered'),
  vatRemarks: z
    .string()
    .optional()
    .describe('Any VAT-related remarks, e.g. reverse charge, exempt, or margin scheme'),
  confidence: z
    .number()
    .describe('Overall confidence score between 0 and 1 for the accuracy of the extracted data'),
});

export type ParsedInvoice = z.infer<typeof parsedInvoiceSchema>;

const SUPPORTED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'] as const;

type SupportedMimeType = (typeof SUPPORTED_MIME_TYPES)[number];

function isSupportedMimeType(mimeType: string): mimeType is SupportedMimeType {
  return (SUPPORTED_MIME_TYPES as readonly string[]).includes(mimeType);
}

export async function parseInvoice(fileBase64: string, mimeType: string): Promise<ParsedInvoice> {
  if (!isSupportedMimeType(mimeType)) {
    throw new Error(
      `Unsupported mime type: ${mimeType}. Supported types: ${SUPPORTED_MIME_TYPES.join(', ')}`
    );
  }

  const contentParts =
    mimeType === 'application/pdf'
      ? [
          {
            type: 'file' as const,
            data: fileBase64,
            mediaType: 'application/pdf' as const,
          },
        ]
      : [
          {
            type: 'image' as const,
            image: fileBase64,
            mediaType: mimeType,
          },
        ];

  const result = await generateObject({
    model: getAnthropicClient()('claude-sonnet-4-20250514'),
    schema: parsedInvoiceSchema,
    messages: [
      {
        role: 'system' as const,
        content:
          'You are an expert invoice data extractor for a Dutch business. ' +
          'Extract structured data from the provided invoice document. ' +
          'BTW is the Dutch term for VAT. ' +
          'Amounts should be in euros. ' +
          'For the VAT declaration section, use standard Dutch tax return sections (e.g. "5b Voorbelasting"). ' +
          'If a field is not clearly present in the document, omit it rather than guessing. ' +
          'Set the confidence score based on how clearly the information was present in the document.',
      },
      {
        role: 'user' as const,
        content: [
          { type: 'text' as const, text: 'Extract the invoice data from this document.' },
          ...contentParts,
        ],
      },
    ],
    temperature: 0.1,
  });

  return result.object;
}
