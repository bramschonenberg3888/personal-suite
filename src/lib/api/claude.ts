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
  vat: z
    .number()
    .describe(
      'The VAT (BTW) amount in euros. Set to 0 for non-EU invoices where no VAT is charged.'
    ),
  invoiceDate: z.string().describe('The invoice date in ISO 8601 format (YYYY-MM-DD)'),
  description: z
    .string()
    .optional()
    .describe('A brief description of what was purchased or the service rendered'),
  vatRemarks: z
    .string()
    .optional()
    .describe('Any VAT-related remarks, e.g. reverse charge, exempt, or margin scheme'),
  vatSection: z
    .string()
    .optional()
    .describe(
      'The Dutch BTW aangifte section. Use "4a" when the supplier is outside the EU (e.g. US/UK companies — no VAT charged but reverse charge applies). Use "5b Voorbelasting" for standard EU purchases with VAT charged. Omit if unclear.'
    ),
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
          'You are an expert invoice data extractor for a Dutch freelancer. ' +
          'Extract structured data from the provided invoice document. ' +
          'BTW is the Dutch term for VAT. ' +
          'Amounts should be in euros. ' +
          'For vatSection: set to "4a" if the supplier is based outside the EU (e.g. US, UK, or other non-EU countries) — these invoices typically have no VAT charged and Dutch reverse-charge rules apply. ' +
          'Set vatSection to "5b Voorbelasting" for standard EU supplier invoices that include VAT. ' +
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
