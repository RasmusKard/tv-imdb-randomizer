/**
 * Shapes match what what-watch-postgre will serve and the IMDb columns it is
 * built on (tconst, primaryTitle, titleType, startYear, runtimeMinutes,
 * averageRating, numVotes, genres). Nothing here is wired to a query yet.
 */

export type TitleKind = 'movie' | 'series';

export type Genre =
  | 'Action' | 'Adventure' | 'Animation' | 'Biography' | 'Comedy' | 'Crime'
  | 'Documentary' | 'Drama' | 'Family' | 'Fantasy' | 'Film-Noir' | 'Game-Show'
  | 'History' | 'Horror' | 'Mystery' | 'Reality-TV' | 'Romance' | 'Sci-Fi'
  | 'Thriller' | 'War' | 'Western';

/** Tri-state: absent means the genre is not filtered on at all. */
export type GenreState = 'include' | 'exclude';

export type Filters = {
  /** At least one; the board refuses to clear the last one. */
  kinds: TitleKind[];
  /** 0–10, step 0.5 */
  rating: [number, number];
  /** 1894–current year, step 1 */
  year: [number, number];
  /** 0–1_000_000, log axis */
  votes: [number, number];
  genres: Partial<Record<Genre, GenreState>>;
  /** tconsts already shown this session, so a roll never repeats */
  excludeIds: string[];
};

export type Title = {
  tconst: string;
  primaryTitle: string;
  titleType: string;
  startYear: number;
  runtimeMinutes: number | null;
  averageRating: number;
  numVotes: number;
  genres: Genre[];
  /** TMDB enrichment — null until that is wired */
  plot: string | null;
  posterUrl: string | null;
};

/**
 * Every tconst matching a filter set. Rolls pick from it locally, as the web app
 * did, so its length is the exact count the dock shows.
 */
export type Candidates = string[];
