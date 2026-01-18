import { Client, isFullDatabase, isFullPage } from '@notionhq/client';
import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints';
import { env } from '@/env';

// Dutch property names → internal field names mapping
const PROPERTY_MAP = {
  Omschrijving: 'description',
  '# km': 'kilometers',
  '# minuten': 'minutes',
  '# uren': 'hours',
  'Declarabel?': 'billable',
  Starttijd: 'startTime',
  Eindtijd: 'endTime',
  'Pauze (min)': 'breakMinutes',
  Klant: 'client',
  Soort: 'type',
  Tarief: 'rate',
  Omzet: 'revenue',
  'IB reservering': 'taxReservation',
  'Netto inkomen': 'netIncome',
  Jaar: 'year',
  Kwartaal: 'quarter',
  Maand: 'month',
  Week: 'week',
} as const;

export interface TimeEntry {
  id: string;
  description: string | null;
  kilometers: number | null;
  minutes: number | null;
  hours: number | null;
  billable: boolean;
  startTime: Date | null;
  endTime: Date | null;
  breakMinutes: number | null;
  client: string | null;
  type: string | null;
  rate: number | null;
  revenue: number | null;
  taxReservation: number | null;
  netIncome: number | null;
  year: number | null;
  quarter: string | null;
  month: string | null;
  monthNumber: number | null;
  week: number | null;
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

function extractMonthNumber(month: string | null): number | null {
  if (!month) return null;

  // Dutch month names
  const dutchMonths: Record<string, number> = {
    januari: 1,
    februari: 2,
    maart: 3,
    april: 4,
    mei: 5,
    juni: 6,
    juli: 7,
    augustus: 8,
    september: 9,
    oktober: 10,
    november: 11,
    december: 12,
  };

  const monthLower = month.toLowerCase();
  return dutchMonths[monthLower] ?? null;
}

function parseTimeEntry(page: PageObjectResponse): TimeEntry {
  const props = page.properties;

  // Build a map of internal names to values
  const values: Record<string, string | number | boolean | Date | null> = {};

  for (const [dutchName, internalName] of Object.entries(PROPERTY_MAP)) {
    const prop = props[dutchName];
    if (prop) {
      values[internalName] = extractPropertyValue(prop);
    }
  }

  const month = values.month as string | null;

  return {
    id: page.id,
    description: (values.description as string) || null,
    kilometers: (values.kilometers as number) ?? null,
    minutes: (values.minutes as number) ?? null,
    hours: (values.hours as number) ?? null,
    billable: (values.billable as boolean) ?? true,
    startTime: (values.startTime as Date) || null,
    endTime: (values.endTime as Date) || null,
    breakMinutes: (values.breakMinutes as number) ?? null,
    client: (values.client as string) || null,
    type: (values.type as string) || null,
    rate: (values.rate as number) ?? null,
    revenue: (values.revenue as number) ?? null,
    taxReservation: (values.taxReservation as number) ?? null,
    netIncome: (values.netIncome as number) ?? null,
    year: (values.year as number) ?? null,
    quarter: (values.quarter as string) || null,
    month,
    monthNumber: extractMonthNumber(month),
    week: (values.week as number) ?? null,
  };
}

export async function validateNotionConnection(databaseId: string): Promise<{
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
    const expectedProps = Object.keys(PROPERTY_MAP);
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

export async function fetchAllTimeEntries(databaseId: string): Promise<TimeEntry[]> {
  const notion = getNotionClient();
  const entries: TimeEntry[] = [];

  let hasMore = true;
  let cursor: string | undefined;

  while (hasMore) {
    const response = await notion.databases.query({
      database_id: databaseId,
      start_cursor: cursor,
      page_size: 100,
      sorts: [
        {
          property: 'Starttijd',
          direction: 'descending',
        },
      ],
    });

    for (const page of response.results) {
      if (isFullPage(page)) {
        entries.push(parseTimeEntry(page));
      }
    }

    hasMore = response.has_more;
    cursor = response.next_cursor ?? undefined;
  }

  return entries;
}
