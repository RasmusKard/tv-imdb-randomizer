import type { Filters, Genre, Title, TitleKind } from './types';
import { BASE, authHeaders } from './base';
import { AXES, type RangeKey } from '../config/filters';

const SERIES = 'tvSeries,tvMiniSeries';
const COLUMN: Record<RangeKey, string> = {
  rating: 'averageRating',
  year: 'startYear',
  votes: 'numVotes',
};

/** The web app's mapping: movie/tvMovie/tvSpecial are "Movies", the rest are "TV shows". */
export function kindOf(titleType: string): TitleKind {
  return titleType === 'tvSeries' || titleType === 'tvMiniSeries' ? 'series' : 'movie';
}

/**
 * The filter portion of the query string — no `limit`, no `order`, no `tconst`.
 * Shown ids are not a filter; `withShown` appends them.
 *
 * A bound sitting on the edge of its axis is omitted, never serialized: sending
 * `numVotes=lte.1000000` would silently drop every title above a million votes.
 */
export function buildQuery(f: Filters): string {
  const parts: string[] = [];

  if (f.kinds.length === 1) {
    parts.push(f.kinds[0] === 'series' ? `titleType=in.(${SERIES})` : `titleType=not.in.(${SERIES})`);
  }

  for (const key of Object.keys(COLUMN) as RangeKey[]) {
    const [lo, hi] = f[key];
    const axis = AXES[key];
    const column = COLUMN[key];
    if (lo > axis.min) parts.push(`${column}=gte.${lo}`);
    if (hi < axis.max) parts.push(`${column}=lte.${hi}`);
  }

  const entries = Object.entries(f.genres) as [Genre, 'include' | 'exclude'][];
  const included = entries.filter(([, s]) => s === 'include').map(([g]) => g);
  const excluded = entries.filter(([, s]) => s === 'exclude').map(([g]) => g);
  if (included.length) parts.push(`genres=ov.%7B${included.join(',')}%7D`);
  if (excluded.length) parts.push(`genres=not.ov.%7B${excluded.join(',')}%7D`);

  return parts.join('&');
}

/** Appends the shown-id exclusion, or returns the query untouched when there is none. */
export function withShown(query: string, shown: string[]): string {
  if (!shown.length) return query;
  const excl = `tconst=not.in.(${shown.join(',')})`;
  return query ? `${query}&${excl}` : excl;
}

/**
 * A GET/HEAD with the token attached — and one retry without it on a 401.
 *
 * The server excludes the user's watched titles when the Bearer is valid, but
 * a token it cannot verify (expired, secret rotated, garbage) is not anonymous:
 * PostgREST answers 401 PGRST301 for every request. A stale stored token must
 * degrade to the anonymous corpus, never brick the board.
 *
 * The dead token is reported once — the board fires count, corpus and batch in
 * quick succession, all carrying the same doomed token, and each would re-raise
 * the notice. A re-login issues a new token, which is reported afresh if it
 * dies too.
 */
let unauthorizedHandler: (() => void) | null = null;
let lastDeadToken: string | null = null;

/** Called at most once per distinct dead token, before the anonymous retry. */
export function setUnauthorizedHandler(fn: (() => void) | null): void {
  unauthorizedHandler = fn;
}

async function authedFetch(url: string, init: RequestInit, token?: string): Promise<Response> {
  if (!token) return fetch(url, init);
  const res = await fetch(url, { ...init, headers: { ...init.headers, ...authHeaders(token) } });
  if (res.status !== 401) return res;
  if (token !== lastDeadToken) {
    lastDeadToken = token;
    unauthorizedHandler?.();
  }
  return fetch(url, init);
}

/**
 * `count=exact` over a query. Throws on a non-2xx. A token rides along so the
 * count is the user's own corpus — the server drops their watched titles.
 */
export async function fetchCount(
  query: string,
  signal?: AbortSignal,
  token?: string,
): Promise<number> {
  const res = await authedFetch(
    `${BASE}/title_full?${query}`,
    { method: 'HEAD', headers: { Prefer: 'count=exact' }, signal },
    token,
  );
  if (!res.ok) throw new Error(`count fetch failed: ${res.status}`);
  const range = res.headers.get('content-range') ?? '';
  return Number(range.split('/')[1] ?? 0);
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * A circular window of `size` titles: a random `r`, then everything above it,
 * wrapping to the bottom when the window runs past the top.
 *
 * The operator pair is `gt` for the window and `lte` for the wrap — never
 * `gte`/`lt`, which overlap at `rnd == r` and let the wrap hand back a row the
 * first page already returned.
 */
export async function fetchBatch(
  query: string,
  size = 20,
  signal?: AbortSignal,
  token?: string,
): Promise<Title[]> {
  const r = Math.random();
  // a leading `&` from an empty filter string is harmless, so no special case for "no filters"
  const get = async (extra: string): Promise<Title[]> => {
    const res = await authedFetch(`${BASE}/title_full?${query}&${extra}`, { signal }, token);
    if (!res.ok) throw new Error(`batch fetch failed: ${res.status}`);
    // a 200 that is not rows — an error body, a proxy's HTML-as-JSON — must not
    // flow on as Titles, or the verdict renders a tconst of undefined
    const rows = await res.json();
    if (!Array.isArray(rows)) throw new Error('batch: server answered, not with rows');
    return rows;
  };

  let rows: Title[] = await get(`rnd=gt.${r}&order=rnd&limit=${size}`);
  if (rows.length < size) {
    rows = rows.concat(await get(`rnd=lte.${r}&order=rnd&limit=${size - rows.length}`));
  }

  // the enrichment columns ride along now that the server serves them; a
  // missing value arrives as undefined (JSON null no, absent column yes), so
  // each is normalized to the null the Title type promises
  return shuffle(rows).map((row) => ({
    ...row,
    plot: row.plot ?? null,
    posterUrl: row.posterUrl ?? null,
    plexUrl: row.plexUrl ?? null,
  }));
}
