import { Client, isFullDatabase, isFullPage } from '@notionhq/client';
import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints';
import { env } from '@/env';

// Dutch property names → internal field names mapping
const COSTS_PROPERTY_MAP = {
  Naam: 'name',
  BTW: 'vat',
  'Bedrag excl. BTW': 'amountExclVat',
  'Datum factuur': 'invoiceDate',
  Jaar: 'year',
  Kwartaal: 'quarter',
  Omschrijving: 'description',
  'Opmerkingen BTW aangifte': 'vatRemarks',
  'Sectie BTW aangifte': 'vatSection',
} as const;

export interface CostEntry {
  id: string;
  name: string;
  vat: number | null;
  amountExclVat: number | null;
  invoiceDate: Date | null;
  year: number | null;
  quarter: string | null;
  description: string | null;
  vatRemarks: string | null;
  vatSection: string | null;
}

function getNotionClient(): Client {
  if (!env.NOTION_API_KEY) {
    throw new Error('NOTION_API_KEY is not configured');
  }
  return new Client({ auth: env.NOTION_API_KEY });
}

function extractPropertyValue(
  property: PageObjectResponse['properties'][string]
): string | number | boolean | Date | null {
  switch (property.type) {
    case 'title':
      return property.title.map((t) => t.plain_text).join('') || null;
    case 'rich_text':
      return property.rich_text.map((t) => t.plain_text).join('') || null;
    case 'number':
      return property.number;
    case 'checkbox':
      return property.checkbox;
    case 'date':
      return property.date?.start ? new Date(property.date.start) : null;
    case 'select':
      return property.select?.name || null;
    case 'formula':
      if (property.formula.type === 'number') {
        return property.formula.number;
      }
      if (property.formula.type === 'string') {
        return property.formula.string;
      }
      if (property.formula.type === 'boolean') {
        return property.formula.boolean;
      }
      if (property.formula.type === 'date') {
        return property.formula.date?.start ? new Date(property.formula.date.start) : null;
      }
      return null;
    default:
      return null;
  }
}

function parseCostEntry(page: PageObjectResponse): CostEntry {
  const props = page.properties;

  // Build a map of internal names to values
  const values: Record<string, string | number | boolean | Date | null> = {};

  for (const [dutchName, internalName] of Object.entries(COSTS_PROPERTY_MAP)) {
    const prop = props[dutchName];
    if (prop) {
      values[internalName] = extractPropertyValue(prop);
    }
  }

  // Convert quarter to string if it's a number
  const quarterValue = values.quarter;
  const quarterString =
    quarterValue !== null && quarterValue !== undefined
      ? typeof quarterValue === 'number'
        ? `Q${quarterValue}`
        : String(quarterValue)
      : null;

  return {
    id: page.id,
    name: (values.name as string) || 'Unnamed',
    vat: (values.vat as number) ?? null,
    amountExclVat: (values.amountExclVat as number) ?? null,
    invoiceDate: (values.invoiceDate as Date) || null,
    year: (values.year as number) ?? null,
    quarter: quarterString,
    description: (values.description as string) || null,
    vatRemarks: (values.vatRemarks as string) || null,
    vatSection: (values.vatSection as string) || null,
  };
}

export async function validateCostsConnection(databaseId: string): Promise<{
  valid: boolean;
  error?: string;
  properties?: string[];
}> {
  try {
    const notion = getNotionClient();
    const database = await notion.databases.retrieve({ database_id: databaseId });

    // Check which expected properties exist
    if (!isFullDatabase(database)) {
      return {
        valid: false,
        error: 'Unable to access database properties. Make sure you have the correct permissions.',
      };
    }

    const existingProps = Object.keys(database.properties);
    const expectedProps = Object.keys(COSTS_PROPERTY_MAP);
    const foundProps = expectedProps.filter((prop) => existingProps.includes(prop));

    return {
      valid: true,
      properties: foundProps,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      valid: false,
      error: message.includes('Could not find database')
        ? 'Database not found. Make sure you shared the database with your integration.'
        : message,
    };
  }
}

export async function fetchAllCostEntries(databaseId: string): Promise<CostEntry[]> {
  const notion = getNotionClient();
  const entries: CostEntry[] = [];

  let hasMore = true;
  let cursor: string | undefined;

  while (hasMore) {
    const response = await notion.databases.query({
      database_id: databaseId,
      start_cursor: cursor,
      page_size: 100,
      sorts: [
        {
          property: 'Datum factuur',
          direction: 'descending',
        },
      ],
    });

    for (const page of response.results) {
      if (isFullPage(page)) {
        entries.push(parseCostEntry(page));
      }
    }

    hasMore = response.has_more;
    cursor = response.next_cursor ?? undefined;
  }

  return entries;
}
