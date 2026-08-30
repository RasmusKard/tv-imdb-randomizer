import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { buildQuery, fetchBatch, fetchCount, setUnauthorizedHandler, withShown } from './src/api/client';
import { loadSession, saveSession, clearSession, type Session } from './src/api/auth';
import type { Filters, Title } from './src/api/types';
import { THIS_YEAR } from './src/config/filters';
import { Board } from './src/screens/Board';
import { Verdict } from './src/screens/Verdict';
import { Account } from './src/screens/Account';
import { Import } from './src/screens/Import';

/**
 * Three screens, no deep links, and the verdict overlaying whichever of them
 * is up — this useState is the whole navigation.
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
  const [screen, setScreen] = useState<'board' | 'account' | 'import'>('board');

  // the account. The token rides every title query: the server excludes this
  // user's watched titles from the corpus when it sees a valid Bearer, so an
  // authenticated roll cannot serve something they have already seen.
  const [session, setSessionState] = useState<Session | null>(null);
  const sessionRef = useRef(session);
  sessionRef.current = session;

  useEffect(() => {
    loadSession().then(setSessionState);
  }, []);

  const setSession = useCallback((s: Session | null) => {
    setSessionState(s);
    if (s) saveSession(s);
    else clearSession();
  }, []);

  // a token the server rejects means the stored session is dead: forget it and
  // say so — the board falls back to the anonymous corpus, the notice points at
  // the account screen. Fires once per dead token however many requests were
  // in flight with it.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setSession(null);
      setNotice('Session expired — sign in again');
    });
    return () => setUnauthorizedHandler(null);
  }, [setSession]);

  // bumped after an import: everything the server counts changes behind a
  // token the client already holds, so both counters must be refetched
  const [importedAt, setImportedAt] = useState(0);
  const onImported = useCallback(() => setImportedAt((n) => n + 1), []);

  // session state, not a filter: it survives filter changes so a roll never
  // repeats, and it is read through a ref so the count debounce below does not
  // re-fire on every roll to learn a number the roll already knows
  const [shown, setShown] = useState<string[]>([]);
  const shownRef = useRef(shown);
  shownRef.current = shown;

  // read through a ref inside roll, so a roll that resolves after the filters
  // changed can tell and drop its stale result
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  const [corpus, setCorpus] = useState<number | null>(null);
  const [count, setCount] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  const [queue, setQueue] = useState<Title[]>([]);
  const [title, setTitle] = useState<Title | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    fetchCount('', undefined, sessionRef.current?.token).then(setCorpus).catch(() => {});
  }, [session?.token, importedAt]);

  // one count per "I'm done fiddling": keyed on the filter set alone, so a
  // held slider does not fire a request per tick and a roll does not fire one
  // to relearn a number it already knows via the decrement below
  useEffect(() => {
    const query = buildQuery(filters);
    setPending(true);
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetchCount(withShown(query, shownRef.current), controller.signal, sessionRef.current?.token)
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
  }, [filters, session?.token, importedAt]);

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
          pool = await fetchBatch(
            withShown(buildQuery(filters), shownRef.current),
            20,
            controller.signal,
            sessionRef.current?.token,
          );
        } catch {
          setNotice('Could not reach the server');
          setTitle(null);
          return;
        }
        // the filters changed while the batch was in flight: setFilters already
        // emptied the queue, so landing this pick would both contradict the new
        // filters on the verdict's receipt and re-poison the queue with up to 19
        // more old-filter titles. The press belongs to a board that no longer
        // exists — drop it and let the next roll fetch under the new filters.
        if (filtersRef.current !== filters) return;
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

  const openAccount = useCallback(() => {
    setScreen('account');
    setReturned(false);
  }, []);
  const toBoardFromScreen = useCallback(() => {
    setScreen('board');
    setReturned(true);
  }, []);
  const openImport = useCallback(() => {
    // the import pushes into the signed-in account, so there is nothing to
    // show without one — the account screen is the way in
    if (sessionRef.current) setScreen('import');
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
      ) : screen === 'account' ? (
        <Account session={session} onSession={setSession} onImport={openImport} onBack={toBoardFromScreen} />
      ) : screen === 'import' && session ? (
        <Import session={session} onBack={toBoardFromScreen} onImported={onImported} />
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
          accountLabel={session ? session.email : 'Sign in'}
          onOpenAccount={openAccount}
        />
      )}
    </>
  );
}
