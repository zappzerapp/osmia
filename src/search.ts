import { setTimeout as sleep } from "node:timers/promises";
import { DDGS } from "@phukon/duckduckgo-search";

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

interface DuckDuckGoSearchResult {
  title?: string;
  href?: string;
  body?: string;
}

export interface SearchOptions {
  maxResults?: number;
  region?: string;
  timeoutMs?: number;
  maxRetries?: number;
}

export class SearchError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
    public readonly statusCode?: number,
    public readonly retryAfterMs?: number,
    public readonly retryable = true
  ) {
    super(message);
    this.name = "SearchError";
  }
}

const DEFAULT_OPTIONS: Required<Pick<SearchOptions, "maxResults" | "timeoutMs" | "maxRetries">> =
  {
    maxResults: 5,
    timeoutMs: 10000,
    maxRetries: 3,
  };

function inferSearchStatusCode(message: string): number | undefined {
  const statusMatch = message.match(/\b(4\d{2}|5\d{2})\b/);
  if (!statusMatch) {
    return undefined;
  }

  return Number(statusMatch[1]);
}

function isSearchRateLimitMessage(message: string): boolean {
  return /(429|rate.?limit|too many requests|throttl)/i.test(message);
}

function isRetryableSearchStatus(statusCode: number): boolean {
  return statusCode === 408 || statusCode === 425 || statusCode === 429 || statusCode >= 500;
}

function getSearchRetryDelay(error: SearchError, attemptNumber: number): number {
  if (error.retryAfterMs !== undefined) {
    return error.retryAfterMs;
  }

  return Math.min(30_000, 1000 * (2 ** (attemptNumber - 1)));
}

function createTimeout(ms: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new SearchError(`Search timed out after ${ms}ms`, undefined, undefined, undefined, true));
    }, ms);
  });
}

export function formatQuery(
  template: string,
  record: Record<string, unknown>
): string {
  if (!template.trim()) {
    throw new SearchError("Template cannot be empty");
  }

  return template.replace(/\{(\w+)\}/g, (match, key) => {
    if (!(key in record)) {
      return match;
    }

    const value = record[key];
    if (value === null || value === undefined) {
      return "";
    }

    return String(value);
  });
}

export function formatSearchResults(results: SearchResult[]): string {
  if (results.length === 0) {
    return "No web results found.";
  }

  return results
    .map(
      (result, index) =>
        `[${index + 1}] ${result.title}\n${result.url}\n${result.snippet}`
    )
    .join("\n\n");
}

export async function searchWeb(
  query: string,
  options: SearchOptions = {}
): Promise<SearchResult[]> {
  const { maxResults, region, timeoutMs, maxRetries } = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  if (!query.trim()) {
    throw new SearchError("Search query cannot be empty");
  }

  const ddgs = new DDGS({ timeout: timeoutMs });

  for (let attemptNumber = 1; attemptNumber <= maxRetries + 1; attemptNumber += 1) {
    try {
      const searchPromise = ddgs.text({
        keywords: query,
        maxResults,
        ...(region ? { region } : {}),
      });

      const results = await Promise.race<DuckDuckGoSearchResult[]>([
        searchPromise,
        createTimeout(timeoutMs),
      ]);

      return results.map((result) => ({
        title: result.title ?? "Untitled",
        url: result.href ?? "",
        snippet: result.body ?? "",
      }));
    } catch (error) {
      const searchError =
        error instanceof SearchError
          ? error
          : (() => {
              const message = error instanceof Error ? error.message : String(error);
              const statusCode = inferSearchStatusCode(message);
              const retryable = statusCode !== undefined
                ? isRetryableSearchStatus(statusCode)
                : isSearchRateLimitMessage(message);

              return new SearchError(
                `Search failed: ${message}`,
                error,
                statusCode,
                isSearchRateLimitMessage(message) ? Math.min(30_000, 1000 * (2 ** attemptNumber)) : undefined,
                retryable
              );
            })();
      const retriesLeft = maxRetries - (attemptNumber - 1);

      if (!searchError.retryable || retriesLeft <= 0) {
        throw searchError;
      }

      const delayMs = getSearchRetryDelay(searchError, attemptNumber);
      await sleep(delayMs);
    }
  }

  throw new SearchError("Search failed after exhausting retries", undefined, undefined, undefined, false);
}

export async function searchWithTemplate(
  template: string,
  record: Record<string, unknown>,
  options: SearchOptions = {}
): Promise<SearchResult[]> {
  const query = formatQuery(template, record);
  return searchWeb(query, options);
}
