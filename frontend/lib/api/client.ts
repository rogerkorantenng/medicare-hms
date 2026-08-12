import { cookies } from 'next/headers';

/**
 * The HTTP client for the FastAPI backend.
 *
 * The session token lives in an httpOnly cookie, so it is never readable
 * from JavaScript in the browser — only this server-side module attaches
 * it. That keeps the JWT out of reach of any script running on the page.
 */

export const SESSION_COOKIE = 'medicare_session';

export function apiBase(): string {
  const base = process.env.API_URL;
  if (!base) throw new Error('API_URL is not set.');
  return base.replace(/\/$/, '');
}

/** Maps the API's error shape onto something a screen can show. */
export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

type Options = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | undefined | null>;
  token?: string;
};

export async function call<T>(path: string, options: Options = {}): Promise<T> {
  const { method = 'GET', body, query } = options;

  const url = new URL(`${apiBase()}/api${path}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
  }

  const token = options.token ?? cookies().get(SESSION_COOKIE)?.value;

  const response = await fetch(url, {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    // Clinical data is never cached — a stale queue is a safety problem.
    cache: 'no-store',
  });

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  const parsed = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const detail =
      typeof parsed?.detail === 'string'
        ? parsed.detail
        : Array.isArray(parsed?.detail)
          ? parsed.detail.map((d: { msg?: string }) => d.msg).filter(Boolean).join('; ')
          : 'That did not work.';
    throw new ApiError(response.status, detail);
  }

  return parsed as T;
}
