import { useCallback, useState } from 'react';
import { StatusBar } from 'expo-status-bar';

import { fetchCandidates, fetchTitle } from './src/api/client';
import type { Candidates, Filters, Title } from './src/api/types';
import { THIS_YEAR } from './src/config/filters';
import { Board } from './src/screens/Board';

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
  const [filters, setFiltersState] = useState<Filters>(INITIAL);
  const [candidates, setCandidates] = useState<Candidates | null>(null);
  const [title, setTitle] = useState<Title | null>(null);

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
    const id = pool.ids[Math.floor(Math.random() * pool.ids.length)];
    if (!id) return;
    setTitle(await fetchTitle(id));
    setFiltersState((f) => ({ ...f, excludeIds: [...f.excludeIds, id] }));
  }, [candidates, filters]);

  return (
    <>
      <StatusBar hidden />
      <Board
        filters={filters}
        setFilters={setFilters}
        candidates={candidates}
        onPrefetch={prefetch}
        onRoll={roll}
      />
    </>
  );
}
