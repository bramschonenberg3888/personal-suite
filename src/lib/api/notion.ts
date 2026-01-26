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
  'IB reservering ': 'taxReservation',
  'Netto inkomen': 'netIncome',
  Jaar: 'year',
  Kwartaal: 'quarter',
  Maand: 'month',
  Week: 'week',
  'Factuur-nr': 'invoiceNumber',
  Factuurdatum: 'invoiceDate',
  'Facturatie-status': 'invoiceStatus',
  'Type klant': 'clientType',
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
  invoiceNumber: string | null;
  invoiceDate: Date | null;
  invoiceStatus: string | null;
  clientType: string | null;
}

function getNotionClient(): Client {
  if (!env.NOTION_API_KEY) {
    throw new Error('NOTION_API_KEY is not configured');
  }
  return new Client({ auth: env.NOTION_API_KEY });
}

interface ExtractedValue {
  value: string | number | boolean | Date | null;
  relationIds?: string[];
}

function extractPropertyValue(property: PageObjectResponse['properties'][string]): ExtractedValue {
  switch (property.type) {
    case 'title':
      return { value: property.title.map((t) => t.plain_text).join('') || null };
    case 'rich_text':
      return { value: property.rich_text.map((t) => t.plain_text).join('') || null };
    case 'number':
      return { value: property.number };
    case 'checkbox':
      return { value: property.checkbox };
    case 'date':
      return { value: property.date?.start ? new Date(property.date.start) : null };
    case 'select':
      return { value: property.select?.name || null };
    case 'status':
      return { value: property.status?.name || null };
    case 'relation': {
      // Return the first relation's page ID; we'll resolve names later
      const relationIds = property.relation.map((r) => r.id);
      return { value: null, relationIds };
    }
    case 'formula':
      if (property.formula.type === 'number') {
        return { value: property.formula.number };
      }
      if (property.formula.type === 'string') {
        return { value: property.formula.string };
      }
      if (property.formula.type === 'boolean') {
        return { value: property.formula.boolean };
      }
      if (property.formula.type === 'date') {
        return {
          value: property.formula.date?.start ? new Date(property.formula.date.start) : null,
        };
      }
      return { value: null };
    default:
      return { value: null };
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

interface ParsedEntry {
  entry: TimeEntry;
  clientRelationIds?: string[];
}

function parseTimeEntry(page: PageObjectResponse): ParsedEntry {
  const props = page.properties;

  // Build a map of internal names to values
  const values: Record<string, string | number | boolean | Date | null> = {};
  let clientRelationIds: string[] | undefined;

  for (const [dutchName, internalName] of Object.entries(PROPERTY_MAP)) {
    const prop = props[dutchName];
    if (prop) {
      const extracted = extractPropertyValue(prop);
      values[internalName] = extracted.value;
      // Track relation IDs for client field
      if (internalName === 'client' && extracted.relationIds?.length) {
        clientRelationIds = extracted.relationIds;
      }
    }
  }

  const month = values.month as string | null;

  return {
    entry: {
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
      invoiceNumber: (values.invoiceNumber as string) || null,
      invoiceDate: (values.invoiceDate as Date) || null,
      invoiceStatus: (values.invoiceStatus as string) || null,
      clientType: (values.clientType as string) || null,
    },
    clientRelationIds,
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

async function resolvePageTitles(notion: Client, pageIds: string[]): Promise<Map<string, string>> {
  const titleMap = new Map<string, string>();

  // Fetch pages in parallel (batch of 10 to avoid rate limits)
  const batchSize = 10;
  for (let i = 0; i < pageIds.length; i += batchSize) {
    const batch = pageIds.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map(async (pageId) => {
        try {
          const page = await notion.pages.retrieve({ page_id: pageId });
          if (isFullPage(page)) {
            // Get the title property (could be 'Name', 'Title', or the first title property)
            for (const [, prop] of Object.entries(page.properties)) {
              if (prop.type === 'title') {
                const title = prop.title.map((t) => t.plain_text).join('');
                return { id: pageId, title: title || null };
              }
            }
          }
          return { id: pageId, title: null };
        } catch (error) {
          // Log error for debugging - the integration might not have access to this page
          console.warn(
            `[Notion] Failed to resolve page title for ${pageId}:`,
            error instanceof Error ? error.message : 'Unknown error'
          );
          return { id: pageId, title: null };
        }
      })
    );
    for (const { id, title } of results) {
      if (title) {
        titleMap.set(id, title);
      }
    }
  }

  return titleMap;
}

export async function fetchAllTimeEntries(databaseId: string): Promise<TimeEntry[]> {
  const notion = getNotionClient();
  const parsedEntries: ParsedEntry[] = [];

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
        parsedEntries.push(parseTimeEntry(page));
      }
    }

    hasMore = response.has_more;
    cursor = response.next_cursor ?? undefined;
  }

  // Collect all unique client page IDs that need resolution
  const clientPageIds = new Set<string>();
  let entriesWithClientRelations = 0;
  for (const parsed of parsedEntries) {
    if (parsed.clientRelationIds?.length) {
      entriesWithClientRelations++;
      for (const id of parsed.clientRelationIds) {
        clientPageIds.add(id);
      }
    }
  }

  console.log(
    `[Notion Sync] Found ${parsedEntries.length} entries, ${entriesWithClientRelations} have client relations, ${clientPageIds.size} unique client pages to resolve`
  );

  // Resolve client names if there are any relation IDs
  let clientNameMap = new Map<string, string>();
  if (clientPageIds.size > 0) {
    clientNameMap = await resolvePageTitles(notion, Array.from(clientPageIds));
    console.log(`[Notion Sync] Successfully resolved ${clientNameMap.size} client names`);
  }

  // Build final entries with resolved client names
  let resolvedClients = 0;
  const result = parsedEntries.map((parsed) => {
    const entry = parsed.entry;
    if (parsed.clientRelationIds?.length && !entry.client) {
      // Use the first relation's resolved name
      const firstName = parsed.clientRelationIds
        .map((id) => clientNameMap.get(id))
        .find((name) => name);
      if (firstName) {
        entry.client = firstName;
        resolvedClients++;
      }
    }
    return entry;
  });

  console.log(`[Notion Sync] Assigned client names to ${resolvedClients} entries`);

  return result;
}
