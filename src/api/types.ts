/**
 * Shapes match what what-watch-postgre serves and the IMDb columns it is
 * built on (tconst, primaryTitle, titleType, startYear, runtimeMinutes,
 * averageRating, numVotes, genres).
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
  /** 0–AXES.votes.max (edge = unbounded), linear axis */
  votes: [number, number];
  genres: Partial<Record<Genre, GenreState>>;
};

export type Title = {
  tconst: string;
  primaryTitle: string;
  titleType: string;
  startYear: number;
  runtimeMinutes: number | null;
  averageRating: number;
  numVotes: number;
  /** The corpus has 27 genres, six more than the board's 21 — render whatever it sends. */
  genres: string[];
  /** TMDB enrichment — null when the title is absent from TMDB */
  plot: string | null;
  posterUrl: string | null;
  /** The Plex deep link, null when the title is not on Plex — no link, no button. */
  plexUrl: string | null;
};
