import { useCallback, useEffect, useMemo, useState } from 'react';
import { BackHandler } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { fetchCandidates, fetchTitle } from './src/api/client';
import type { Candidates, Filters, Title } from './src/api/types';
import { THIS_YEAR } from './src/config/filters';
import { Board } from './src/screens/Board';
import { Verdict } from './src/screens/Verdict';

/**
 * Two screens and no deep links do not earn a router — this useState is the
 * whole navigation.
 */
const INITIAL: Filters = {
  kinds: ['movie', 'series'],
  rating: [5, 10],
  year: [1965, THIS_YEAR],
  votes: [5000, 1_000_000],
  genres: {},
  excludeIds: [],
};

export default function App() {
  // the candidate list is every matching tconst — hundreds of thousands once the
  // real query lands — and excludeIds grows with every roll, so membership is a
  // Set rather than a linear scan per id

  const [filters, setFiltersState] = useState<Filters>(INITIAL);
  const [candidates, setCandidates] = useState<Candidates | null>(null);
  const [title, setTitle] = useState<Title | null>(null);
  const seen = useMemo(() => new Set(filters.excludeIds), [filters.excludeIds]);

  // any filter change invalidates the candidate list, which is what drops the
  // dock back to the free estimate
  const setFilters = useCallback((next: Filters) => {
    setFiltersState(next);
    setCandidates(null);
  }, []);

  const prefetch = useCallback(async () => {
    if (candidates) return;
    setCandidates(await fetchCandidates(filters));
  }, [candidates, filters]);

  const roll = useCallback(async () => {
    const pool = candidates ?? (await fetchCandidates(filters));
    setCandidates(pool);
    // a roll never repeats a title within a session
    const unseen = pool.filter((id) => !seen.has(id));
    const id = unseen[Math.floor(Math.random() * unseen.length)];
    if (!id) return;
    setTitle(await fetchTitle(id));
    setFiltersState((f) => ({ ...f, excludeIds: [...f.excludeIds, id] }));
  }, [candidates, filters, seen]);

  // coming back from a verdict, focus belongs on Roll — that is where you left
  // from, and it is one press from both rolling again and editing filters
  const [returned, setReturned] = useState(false);
  const toBoard = useCallback(() => {
    setTitle(null);
    setReturned(true);
  }, []);

  // back returns to the board, and on the board it exits without a confirmation
  // prompt, which is what the Android TV guidance asks for
  useEffect(() => {
    if (!title) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      toBoard();
      return true;
    });
    return () => sub.remove();
  }, [title, toBoard]);

  const remaining = candidates
    ? candidates.filter((id) => !seen.has(id)).length
    : 0;

  return (
    <>
      <StatusBar hidden />
      {title ? (
        <Verdict
          title={title}
          filters={filters}
          remaining={remaining}
          onRollAgain={roll}
          onBack={toBoard}
        />
      ) : (
        <Board
          filters={filters}
          setFilters={setFilters}
          candidates={candidates}
          onPrefetch={prefetch}
          onRoll={roll}
          focusRoll={returned}
        />
      )}
    </>
  );
}
