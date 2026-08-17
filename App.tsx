import { useState } from 'react';
import { StatusBar } from 'expo-status-bar';

import type { Filters } from './src/api/types';
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
  const [filters, setFilters] = useState<Filters>(INITIAL);

  return (
    <>
      <StatusBar hidden />
      <Board filters={filters} setFilters={setFilters} />
    </>
  );
}
