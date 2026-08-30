import type { Filters, Genre, Title, TitleKind } from './types';
import { AXES, type RangeKey } from '../config/filters';

const BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:3000';
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

/** `count=exact` over a query. Throws on a non-2xx. */
export async function fetchCount(query: string, signal?: AbortSignal): Promise<number> {
  const res = await fetch(`${BASE}/title_full?${query}`, {
    method: 'HEAD',
    headers: { Prefer: 'count=exact' },
    signal,
  });
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
): Promise<Title[]> {
  const r = Math.random();
  // a leading `&` from an empty filter string is harmless, so no special case for "no filters"
  const get = async (extra: string): Promise<Title[]> => {
    const res = await fetch(`${BASE}/title_full?${query}&${extra}`, { signal });
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

  return shuffle(rows).map((row) => ({ ...row, plot: null, posterUrl: null }));
}
