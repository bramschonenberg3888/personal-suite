/**
 * Simplicate API Client
 * Documentation: https://developer.simplicate.com/
 * Base URL: https://{subdomain}.simplicate.nl/api/v2
 */

export interface SimplicateCredentials {
  subdomain: string;
  apiKey: string;
  apiSecret: string;
}

export interface SimplicateProject {
  id: string;
  name: string;
  project_number: string;
  organization?: {
    id: string;
    name: string;
  };
  project_status?: {
    id: string;
    label: string;
  };
}

export interface SimplicateHourType {
  id: string;
  label: string;
  tariff?: number;
  blocked: boolean;
}

export interface SimplicateEmployee {
  id: string;
  person_id: string;
  name: string;
  function?: string;
}

export interface SimplicateHoursEntry {
  employee_id: string;
  project_id: string;
  projectservice_id?: string;
  type_id: string;
  hours: number;
  start_date: string; // ISO date format: YYYY-MM-DD
  note?: string;
  billable?: boolean;
}

export interface SimplicateHoursResponse {
  data: {
    id: string;
  };
}

interface SimplicateApiError {
  errors?: Array<{ message: string }>;
  message?: string;
}

class SimplicateClient {
  private credentials: SimplicateCredentials;

  constructor(credentials: SimplicateCredentials) {
    this.credentials = credentials;
  }

  private get baseUrl(): string {
    return `https://${this.credentials.subdomain}.simplicate.nl/api/v2`;
  }

  private get headers(): HeadersInit {
    return {
      'Authentication-Key': this.credentials.apiKey,
      'Authentication-Secret': this.credentials.apiSecret,
      'Content-Type': 'application/json',
    };
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        ...this.headers,
        ...options.headers,
      },
    });

    if (!response.ok) {
      let errorMessage = `Simplicate API error: ${response.status} ${response.statusText}`;

      try {
        const errorBody = (await response.json()) as SimplicateApiError;
        if (errorBody.errors && errorBody.errors.length > 0) {
          errorMessage = errorBody.errors.map((e) => e.message).join(', ');
        } else if (errorBody.message) {
          errorMessage = errorBody.message;
        }
      } catch {
        // Ignore JSON parse errors
      }

      throw new Error(errorMessage);
    }

    return response.json() as Promise<T>;
  }

  /**
   * Test the connection by fetching the authenticated employee
   */
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      await this.request<{ data: SimplicateEmployee[] }>('/hrm/employee?limit=1');
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get all employees
   */
  async getEmployees(): Promise<SimplicateEmployee[]> {
    const response = await this.request<{ data: SimplicateEmployee[] }>('/hrm/employee');
    return response.data;
  }

  /**
   * Get a specific employee by ID
   */
  async getEmployee(employeeId: string): Promise<SimplicateEmployee | null> {
    try {
      const response = await this.request<{ data: SimplicateEmployee }>(
        `/hrm/employee/${employeeId}`
      );
      return response.data;
    } catch {
      return null;
    }
  }

  /**
   * Get all projects
   */
  async getProjects(): Promise<SimplicateProject[]> {
    const response = await this.request<{ data: SimplicateProject[] }>('/projects/project');
    return response.data;
  }

  /**
   * Get all hour types
   */
  async getHourTypes(): Promise<SimplicateHourType[]> {
    const response = await this.request<{ data: SimplicateHourType[] }>('/hours/hourstype');
    return response.data;
  }

  /**
   * Post hours to Simplicate
   */
  async postHours(entry: SimplicateHoursEntry): Promise<string> {
    const response = await this.request<SimplicateHoursResponse>('/hours/hours', {
      method: 'POST',
      body: JSON.stringify(entry),
    });
    return response.data.id;
  }

  /**
   * Post multiple hours entries (with rate limiting consideration)
   * Simplicate has a 60 requests/minute rate limit
   */
  async postHoursBatch(
    entries: SimplicateHoursEntry[],
    onProgress?: (_completed: number, _total: number) => void
  ): Promise<{ id: string; index: number }[]> {
    const results: { id: string; index: number }[] = [];

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const id = await this.postHours(entry);
      results.push({ id, index: i });

      if (onProgress) {
        onProgress(i + 1, entries.length);
      }

      // Add a small delay to respect rate limits (60 req/min = 1 req/sec)
      if (i < entries.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    return results;
  }
}

/**
 * Create a Simplicate client instance
 */
export function createSimplicateClient(credentials: SimplicateCredentials): SimplicateClient {
  if (!credentials.apiKey || !credentials.apiSecret) {
    throw new Error('Simplicate API key and secret are required');
  }
  return new SimplicateClient(credentials);
}

/**
 * Transform a revenue entry to Simplicate hours format
 */
export function transformToSimplicateHours(
  entry: {
    hours: number | null;
    startTime: Date | null;
    description: string | null;
    billable: boolean;
  },
  mapping: {
    employeeId: string;
    projectId: string;
    hourTypeId: string;
  }
): SimplicateHoursEntry {
  if (!entry.hours || !entry.startTime) {
    throw new Error('Entry must have hours and startTime');
  }

  return {
    employee_id: mapping.employeeId,
    project_id: mapping.projectId,
    type_id: mapping.hourTypeId,
    hours: entry.hours,
    start_date: entry.startTime.toISOString().split('T')[0],
    note: entry.description ?? undefined,
    billable: entry.billable,
  };
}
