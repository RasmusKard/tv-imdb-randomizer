import type { Candidates, Filters, Genre, Title, TitleKind } from './types';
import { FIXTURES } from './fixtures';

/**
 * Stubs. The UI is complete against these; wiring what-watch-postgre means
 * replacing the two function bodies and nothing else.
 *
 * They read their arguments far enough to keep the UI honest — a filter set
 * that matches nothing really does come back empty, and a roll really does
 * never repeat — so the empty state and the "N left" counter are reachable
 * without a server.
 */

const LATENCY_MS = 250;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** The web app's mapping: movie/tvMovie/tvSpecial are "Movies", the rest are "TV shows". */
export function kindOf(titleType: string): TitleKind {
  return titleType === 'tvSeries' || titleType === 'tvMiniSeries' ? 'series' : 'movie';
}

/** Does a fixture satisfy the filters? Stands in for the WHERE clause. */
function matches(t: Title, f: Filters): boolean {
  if (!f.kinds.includes(kindOf(t.titleType))) return false;
  if (t.averageRating < f.rating[0] || t.averageRating > f.rating[1]) return false;
  if (t.startYear < f.year[0] || t.startYear > f.year[1]) return false;
  if (t.numVotes < f.votes[0] || t.numVotes > f.votes[1]) return false;

  const entries = Object.entries(f.genres) as [Genre, 'include' | 'exclude'][];
  const included = entries.filter(([, s]) => s === 'include').map(([g]) => g);
  const excluded = entries.filter(([, s]) => s === 'exclude').map(([g]) => g);
  if (excluded.some((g) => t.genres.includes(g))) return false;
  // include is an OR across genres, matching the web app's innerJoin
  if (included.length && !included.some((g) => t.genres.includes(g))) return false;

  return true;
}

/**
 * Candidate ids for a filter set, fetched once per "I'm done fiddling" and
 * rolled from locally.
 *
 * TODO: wire to what-watch-postgre. ids.length is the exact count the dock shows.
 */
export async function fetchCandidates(f: Filters): Promise<Candidates> {
  await sleep(LATENCY_MS);
  const seen = new Set(f.excludeIds);
  const ids = FIXTURES.filter((t) => matches(t, f) && !seen.has(t.tconst)).map((t) => t.tconst);
  return ids;
}

/**
 * One title's detail.
 *
 * TODO: wire to what-watch-postgre, then enrich plot/posterUrl from TMDB.
 */
export async function fetchTitle(tconst: string): Promise<Title> {
  await sleep(LATENCY_MS);
  const hit = FIXTURES.find((t) => t.tconst === tconst);
  if (!hit) throw new Error(`No title for ${tconst}`);
  return hit;
}
