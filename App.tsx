import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { buildQuery, fetchBatch, fetchCount, withShown } from './src/api/client';
import type { Filters, Title } from './src/api/types';
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
};

const COUNT_DEBOUNCE_MS = 250;
/** The server answers a batch in ~3 ms; four seconds is 1000x headroom. */
const ROLL_TIMEOUT_MS = 4000;

export default function App() {
  const [filters, setFiltersState] = useState<Filters>(INITIAL);
  // session state, not a filter: it survives filter changes so a roll never
  // repeats, and it is read through a ref so the count debounce below does not
  // re-fire on every roll to learn a number the roll already knows
  const [shown, setShown] = useState<string[]>([]);
  const shownRef = useRef(shown);
  shownRef.current = shown;

  const [corpus, setCorpus] = useState<number | null>(null);
  const [count, setCount] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  const [queue, setQueue] = useState<Title[]>([]);
  const [title, setTitle] = useState<Title | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    fetchCount('').then(setCorpus).catch(() => {});
  }, []);

  // one count per "I'm done fiddling": keyed on the filter set alone, so a
  // held slider does not fire a request per tick and a roll does not fire one
  // to relearn a number it already knows via the decrement below
  useEffect(() => {
    const query = buildQuery(filters);
    setPending(true);
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetchCount(withShown(query, shownRef.current), controller.signal)
        .then((n) => {
          setCount(n);
          setPending(false);
        })
        .catch((e) => {
          if (e.name === 'AbortError') return;
          setNotice('Could not reach the server');
          setPending(false);
        });
    }, COUNT_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [filters]);

  const setFilters = useCallback((next: Filters) => {
    setFiltersState(next);
    setQueue([]);
  }, []);

  // Two UP presses can land before the re-render swaps in the verdict screen,
  // and both would pop the same queue: same title twice, count drained by two.
  // Remotes bounce, so the second press inside a roll is ignored.
  const rolling = useRef(false);

  const roll = useCallback(async () => {
    if (rolling.current) return;
    rolling.current = true;
    // a dead server must end in the notice, not in a button that feels broken —
    // OkHttp would bound it at ~10 s, and ten seconds of silence reads as broken
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ROLL_TIMEOUT_MS);
    try {
      let pool = queue;
      if (pool.length === 0) {
        try {
          pool = await fetchBatch(withShown(buildQuery(filters), shownRef.current), 20, controller.signal);
        } catch {
          setNotice('Could not reach the server');
          setTitle(null);
          return;
        }
        if (pool.length === 0) {
          setNotice('Seen them all — widen a range');
          setTitle(null);
          return;
        }
      }
      const [next, ...rest] = pool;
      setQueue(rest);
      setTitle(next);
      setShown((s) => [...s, next.tconst]);
      setCount((c) => (c === null ? c : c - 1));
      setNotice(null);
    } finally {
      clearTimeout(timer);
      rolling.current = false;
    }
  }, [queue, filters]);

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

  return (
    <>
      <StatusBar hidden />
      {title ? (
        <Verdict
          title={title}
          filters={filters}
          remaining={count ?? 0}
          onRollAgain={roll}
          onBack={toBoard}
        />
      ) : (
        <Board
          filters={filters}
          setFilters={setFilters}
          count={count}
          pending={pending}
          corpus={corpus}
          notice={notice}
          onRoll={roll}
          focusRoll={returned}
        />
      )}
    </>
  );
}
