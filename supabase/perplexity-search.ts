// Perplexity AI Search Helper Functions
// Implements Perplexity Search API with date filters and domain control

export interface PerplexitySearchOptions {
  query: string;
  max_results?: number;

  // Date filters - must be in format "M/D/YYYY" (e.g., "3/1/2025")
  search_after_date?: string;
  search_before_date?: string;

  // Last updated filters - must be in format "MM/DD/YYYY" (e.g., "07/01/2025")
  last_updated_after_filter?: string;
  last_updated_before_filter?: string;

  // Recency filter - predefined time periods
  search_recency_filter?: "day" | "week" | "month" | "year";

  // Domain filter - include (allowlist) or exclude (denylist with "-" prefix)
  // Maximum 20 domains
  search_domain_filter?: string[];

  // Language filter
  search_language_filter?: string[];
}

export interface PerplexitySearchResult {
  title: string;
  url: string;
  snippet: string;
  date?: string;
  source?: string;
}

export interface PerplexitySearchResponse {
  success: boolean;
  results?: PerplexitySearchResult[];
  answer?: string;
  error?: string;
}

/**
 * Validates date format for Perplexity API
 * Format must be "M/D/YYYY" or "MM/DD/YYYY"
 */
export function validateDateFormat(dateString: string): boolean {
  const pattern = /^(0?[1-9]|1[0-2])\/(0?[1-9]|[12]\d|3[01])\/\d{4}$/;
  return pattern.test(dateString);
}

/**
 * Searches using Perplexity API with advanced filters
 *
 * @param options Search options including query, date filters, and domain filters
 * @returns Search results with answer and sources
 */
export async function searchWithPerplexity(
  options: PerplexitySearchOptions
): Promise<PerplexitySearchResponse> {
  try {
    const apiKey = Deno.env.get('perplexity_API_KEY');

    if (!apiKey) {
      return {
        success: false,
        error: 'PERPLEXITY_API_KEY not configured in Edge Secrets',
      };
    }

    // Validate date formats if provided
    if (options.search_after_date && !validateDateFormat(options.search_after_date)) {
      return {
        success: false,
        error: `Invalid search_after_date format: ${options.search_after_date}. Must be "M/D/YYYY"`,
      };
    }

    if (options.search_before_date && !validateDateFormat(options.search_before_date)) {
      return {
        success: false,
        error: `Invalid search_before_date format: ${options.search_before_date}. Must be "M/D/YYYY"`,
      };
    }

    if (options.last_updated_after_filter && !validateDateFormat(options.last_updated_after_filter)) {
      return {
        success: false,
        error: `Invalid last_updated_after_filter format: ${options.last_updated_after_filter}. Must be "MM/DD/YYYY"`,
      };
    }

    if (options.last_updated_before_filter && !validateDateFormat(options.last_updated_before_filter)) {
      return {
        success: false,
        error: `Invalid last_updated_before_filter format: ${options.last_updated_before_filter}. Must be "MM/DD/YYYY"`,
      };
    }

    // Validate domain filter (max 20 domains)
    if (options.search_domain_filter && options.search_domain_filter.length > 20) {
      return {
        success: false,
        error: 'Maximum 20 domains allowed in search_domain_filter',
      };
    }

    // Build request body
    const requestBody: any = {
      query: options.query,
      max_results: options.max_results || 10,
    };

    // Add optional filters
    if (options.search_after_date) {
      requestBody.search_after_date = options.search_after_date;
    }

    if (options.search_before_date) {
      requestBody.search_before_date = options.search_before_date;
    }

    if (options.last_updated_after_filter) {
      requestBody.last_updated_after_filter = options.last_updated_after_filter;
    }

    if (options.last_updated_before_filter) {
      requestBody.last_updated_before_filter = options.last_updated_before_filter;
    }

    if (options.search_recency_filter) {
      requestBody.search_recency_filter = options.search_recency_filter;
    }

    if (options.search_domain_filter && options.search_domain_filter.length > 0) {
      requestBody.search_domain_filter = options.search_domain_filter;
    }

    if (options.search_language_filter && options.search_language_filter.length > 0) {
      requestBody.search_language_filter = options.search_language_filter;
    }

    // Make API request
    const response = await fetch('https://api.perplexity.ai/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `Perplexity API error: ${response.status} - ${errorText}`,
      };
    }

    const data = await response.json();

    // Parse response
    return {
      success: true,
      answer: data.answer || '',
      results: data.results || [],
    };
  } catch (error) {
    console.error('Perplexity search error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Searches LinkedIn for a specific person with recency filter
 *
 * @param personName Name of the person to search for
 * @param recencyFilter Time period for search results (default: "month")
 * @returns Search results about the person from LinkedIn
 */
export async function searchLinkedInProfile(
  personName: string,
  recencyFilter: "day" | "week" | "month" | "year" = "month"
): Promise<PerplexitySearchResponse> {
  return searchWithPerplexity({
    query: `${personName} LinkedIn profile recent activity updates`,
    max_results: 10,
    search_recency_filter: recencyFilter,
    search_domain_filter: ["linkedin.com"],
  });
}

/**
 * Gets a summary of recent activities for a person from LinkedIn
 *
 * @param personName Name of the person
 * @param days Number of days to look back (default: 30)
 * @returns Summary of the person's recent LinkedIn activities
 */
export async function getLinkedInRecentActivity(
  personName: string,
  days: number = 30
): Promise<PerplexitySearchResponse> {
  // Calculate date range
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  // Format dates as M/D/YYYY
  const formatDate = (date: Date): string => {
    return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
  };

  const recencyFilter = days <= 1 ? "day" :
                       days <= 7 ? "week" :
                       days <= 30 ? "month" : "year";

  return searchWithPerplexity({
    query: `${personName} LinkedIn recent posts activity updates news`,
    max_results: 15,
    search_recency_filter: recencyFilter,
    search_domain_filter: ["linkedin.com"],
  });
}

/**
 * Researches a client using multiple sources
 *
 * @param clientName Name of the client/company
 * @param includeLinkedIn Whether to include LinkedIn in search
 * @param recencyFilter Time period for results
 * @returns Comprehensive research results about the client
 */
export async function researchClient(
  clientName: string,
  includeLinkedIn: boolean = true,
  recencyFilter: "day" | "week" | "month" | "year" = "month"
): Promise<PerplexitySearchResponse> {
  const domains = includeLinkedIn
    ? ["linkedin.com", "crunchbase.com", "bloomberg.com", "reuters.com"]
    : ["crunchbase.com", "bloomberg.com", "reuters.com"];

  return searchWithPerplexity({
    query: `${clientName} company news updates recent developments`,
    max_results: 20,
    search_recency_filter: recencyFilter,
    search_domain_filter: domains,
  });
}
