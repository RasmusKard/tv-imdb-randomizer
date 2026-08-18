import type { Genre, TitleKind } from '../api/types';

export const THIS_YEAR = new Date().getFullYear();

/** The 21 genres the board exposes, in the order they fill the 7x3 grid. */
export const GENRES: Genre[] = [
  'Action', 'Adventure', 'Animation', 'Biography', 'Comedy', 'Crime', 'Documentary',
  'Drama', 'Family', 'Fantasy', 'Film-Noir', 'Game-Show', 'History', 'Horror',
  'Mystery', 'Reality-TV', 'Romance', 'Sci-Fi', 'Thriller', 'War', 'Western',
];

export const KINDS: { value: TitleKind; name: string; sub: string }[] = [
  { value: 'movie', name: 'Movies', sub: 'and TV movies' },
  { value: 'series', name: 'TV shows', sub: 'and miniseries' },
];

export type RangeKey = 'rating' | 'year' | 'votes';

/** A named preset that writes both ends of its slider. Exactly 7 per row. */
type Band = { name: string; sub: string; lo: number; hi: number };

export type Axis = {
  label: string;
  min: number;
  max: number;
  /** Linear step per press, or null for the log-scaled votes axis. */
  step: number | null;
  /** Value -> label shown on a handle. */
  fmt: (v: number) => string;
  /** Value -> 0..1 position along the track. */
  pos: (v: number) => number;
  /** 0..1 position along the track -> value. Only the log axis needs it. */
  unpos?: (p: number) => number;
  bands: Band[];
};

const VOTES_MAX = 1_000_000;
const LOG_MAX = Math.log10(1 + VOTES_MAX);

/**
 * Linear from zero to a million puts every title worth arguing about in the
 * leftmost 3% of the track, so votes ride a log axis.
 */
const fmtVotes = (v: number) =>
  v >= VOTES_MAX ? '1M+'
  : v >= 100_000 ? `${Math.round(v / 1000)}K`
  : v >= 1000 ? `${(v / 1000).toFixed(v < 10_000 ? 1 : 0)}K`
  : String(Math.round(v));

export const AXES: Record<RangeKey, Axis> = {
  rating: {
    label: 'Rating',
    min: 0,
    max: 10,
    step: 0.5,
    fmt: (v) => v.toFixed(1),
    pos: (v) => v / 10,
    bands: [
      { name: 'Any', sub: '0–10', lo: 0, hi: 10 },
      { name: 'Great', sub: '8.0–10', lo: 8, hi: 10 },
      { name: 'Good', sub: '7.0–10', lo: 7, hi: 10 },
      { name: 'Decent', sub: '6.0–10', lo: 6, hi: 10 },
      { name: 'Mixed', sub: '4.0–7.0', lo: 4, hi: 7 },
      { name: 'Rough', sub: '0–5.0', lo: 0, hi: 5 },
      { name: 'Awful', sub: '0–3.0', lo: 0, hi: 3 },
    ],
  },
  year: {
    label: 'Year',
    min: 1894,
    max: THIS_YEAR,
    step: 1,
    fmt: (v) => String(v),
    pos: (v) => (v - 1894) / (THIS_YEAR - 1894),
    bands: [
      { name: 'Any', sub: `1894–${String(THIS_YEAR).slice(2)}`, lo: 1894, hi: THIS_YEAR },
      { name: 'New', sub: `2020–${String(THIS_YEAR).slice(2)}`, lo: 2020, hi: THIS_YEAR },
      { name: '2010s', sub: '2010–19', lo: 2010, hi: 2019 },
      { name: '2000s', sub: '2000–09', lo: 2000, hi: 2009 },
      { name: '1990s', sub: '1990–99', lo: 1990, hi: 1999 },
      { name: '1980s', sub: '1980–89', lo: 1980, hi: 1989 },
      { name: 'Classic', sub: '≤1979', lo: 1894, hi: 1979 },
    ],
  },
  votes: {
    label: 'Votes',
    min: 0,
    max: VOTES_MAX,
    step: null,
    fmt: fmtVotes,
    pos: (v) => Math.log10(1 + v) / LOG_MAX,
    unpos: (p) => Math.pow(10, p * LOG_MAX) - 1,
    bands: [
      { name: 'Any', sub: '0–1M', lo: 0, hi: VOTES_MAX },
      { name: 'Obscure', sub: '≤1K', lo: 0, hi: 1000 },
      { name: 'Deep cut', sub: '1K–5K', lo: 1000, hi: 5000 },
      { name: 'Cult', sub: '5K–25K', lo: 5000, hi: 25_000 },
      { name: 'Solid', sub: '25K–100K', lo: 25_000, hi: 100_000 },
      { name: 'Known', sub: '100K+', lo: 100_000, hi: VOTES_MAX },
      { name: 'Huge', sub: '250K+', lo: 250_000, hi: VOTES_MAX },
    ],
  },
};

export const RANGE_KEYS: RangeKey[] = ['rating', 'year', 'votes'];

const slug = (v: string) => v.toLowerCase().replace(/\s+/g, '-');

/** Stable ids so agent-device can assert which cell has focus. */
export const testId = {
  kind: (k: TitleKind) => `chip-kind-${k}`,
  slider: (k: RangeKey) => `slider-${k}`,
  band: (k: RangeKey, name: string) => `band-${k}-${slug(name)}`,
  genre: (g: Genre) => `chip-genre-${slug(g)}`,
  roll: 'btn-roll',
  rollAgain: 'btn-roll-again',
  imdb: 'btn-imdb',
  receipt: 'btn-receipt',
};

