/**
 * DIRECTION CONTRACT — The Projection Booth at Showtime
 *
 * THESIS: what.watch as a projection booth at showtime — the screen is a
 * projected frame, the roll is a thread-up. Refuses poster-carousel streaming
 * chrome.
 * OWN-WORLD: film-black ground; one tungsten amber carries all light;
 * emulsion-white Archivo caps; sprocket-strip frame edges; motion
 * in hard steps, never easing; states as mark patterns, never hue alone.
 * STORY: the viewer tunes filters, presses pick, a leader countdown clears,
 * and tonight's title stands in gate light; leader tape remembers the filters.
 * FIRST VIEWPORT: verdict — sprockets frame top and bottom, meta rules, one giant silver title in warm gate glow,
 * tags, plot, Pick another + IMDb + Plex (when matched), poster right (reel stands in when absent),
 * leader-tape receipt below.
 * FORM: The Projection Booth at Showtime, candidate 5 of 7, seed 15068fbf.
 * FINISH: unreviewed and undocumented is unfinished; this build ends with the
 * finish review, the verdict, DESIGN.md, and every shipping raster carrying
 * its provenance.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, BackHandler, DeviceEventEmitter } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import {
  Archivo_800ExtraBold,
} from '@expo-google-fonts/archivo';
import {
  ChivoMono_400Regular,
  ChivoMono_700Bold,
} from '@expo-google-fonts/chivo-mono';

import { buildQuery, fetchBatch, fetchCount, setUnauthorizedHandler, withShown } from './src/api/client';
import { deviceLogin, fetchWatched, loadSession, saveSession, clearSession, pushWatched, type Session } from './src/api/auth';
import type { Filters, Title } from './src/api/types';
import { AXES, THIS_YEAR } from './src/config/filters';
import { Board } from './src/screens/Board';
import { Verdict } from './src/screens/Verdict';
import { Account } from './src/screens/Account';
import { Import } from './src/screens/Import';
import { Presets } from './src/screens/Presets';
import { checkForUpdate } from './src/update/checker';
import type { UpdateInfo } from './src/update/compare';

// the splash holds until the booth's own faces are in, so the first frame
// anyone sees is already the committed world
SplashScreen.preventAutoHideAsync();

// The QA seam a hold needs: RN's TV helper never forwards the native key
// stream to JS (see RangeSlider), so no remote tooling can hold a D-pad key
// where the slider would see it. qa-slider-hold-ramp instead calls this from
// the debugger to emit the one long* DOWN and the final UP a real held key
// delivers, straight onto the emitter those events arrive on. __DEV__ only.
if (__DEV__) {
  (globalThis as { __tvdHold?: (dir: 'longRight' | 'longLeft', holdMs: number) => void }).__tvdHold =
    (dir, holdMs) => {
      DeviceEventEmitter.emit('onHWKeyEvent', { eventType: dir, eventKeyAction: 0 });
      setTimeout(() => {
        DeviceEventEmitter.emit('onHWKeyEvent', {
          eventType: dir === 'longRight' ? 'right' : 'left',
          eventKeyAction: 1,
        });
      }, holdMs);
    };
}

/**
 * Three screens, no deep links, and the verdict overlaying whichever of them
 * is up — this useState is the whole navigation.
 */
const INITIAL: Filters = {
  kinds: ['movie', 'series'],
  rating: [5, 10],
  year: [1965, THIS_YEAR],
  votes: [5000, AXES.votes.max],
  genres: {},
};

const COUNT_DEBOUNCE_MS = 250;
/** The server answers a batch in ~3 ms; four seconds is 1000x headroom. */
const ROLL_TIMEOUT_MS = 4000;

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    Archivo800: Archivo_800ExtraBold,
    ChivoMono400: ChivoMono_400Regular,
    ChivoMono700: ChivoMono_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      if (fontError) console.warn('fonts failed to load', fontError);
      SplashScreen.hide();
    }
  }, [fontsLoaded, fontError]);

  const [filters, setFiltersState] = useState<Filters>(INITIAL);
  const [screen, setScreen] = useState<'board' | 'account' | 'import' | 'presets'>('board');

  // the account is the device: the stored token is reused, and otherwise the
  // ANDROID_ID signs in invisibly. The token rides every title query, and the
  // seen list below rides every roll: the two halves of "never roll again".
  const [session, setSessionState] = useState<Session | null>(null);
  const sessionRef = useRef(session);
  sessionRef.current = session;

  useEffect(() => {
    loadSession()
      .then((s) => s ?? deviceLogin())
      // setSession, not the raw setter: the token must land in AsyncStorage,
      // or every cold start mints its own identity and the watched list
      // orphans under yesterday's throwaway account
      .then(setSession)
      .catch(() => {}); // no account yet — the board reads the anonymous corpus
  }, []);

  const setSession = useCallback((s: Session | null) => {
    setSessionState(s);
    if (s) saveSession(s);
    else clearSession();
  }, []);

  // the seen list, kept client-side as well: the server's watched exclusion
  // on title_full has proven untrustworthy (a fresh device token and a
  // just-pushed title still leaked through it), so the roll filters against
  // this set itself. Refilled on every sign-in, watched mark and import.
  const [watchedIds, setWatchedIds] = useState<Set<string>>(new Set());
  const watchedRef = useRef(watchedIds);
  watchedRef.current = watchedIds;
  useEffect(() => {
    if (!session) return;
    fetchWatched(session.token)
      .then((ids) => setWatchedIds(new Set(ids)))
      .catch(() => {}); // an unreadable list must not blank the board
  }, [session]);

  // a token the server rejects means the stored session is dead: forget it and
  // sign in again as the same device — the board reads anonymous meanwhile.
  // Fires once per dead token however many requests were in flight with it.
  // The queue is dropped with the dead token: whatever it fetched anonymously
  // predates the watched list and could serve seen titles for rolls to come.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setSession(null);
      setQueue([]);
      deviceLogin()
        .then(setSession)
        .catch(() => setNotice('device sign-in failed — titles already watched may roll again'));
    });
    return () => setUnauthorizedHandler(null);
  }, [setSession]);

  // the daily OTA check, gated to once a day inside the checker. Silent both
  // ways: what it finds lights the board lamp and the install card, nothing
  // ever steals focus. The manual check on the board is the same finder with
  // an answer owed on the notice line.
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  useEffect(() => {
    checkForUpdate()
      .then(setUpdate)
      .catch(() => {});
  }, []);

  const [checking, setChecking] = useState(false);
  const checkUpdates = useCallback(async () => {
    if (checking) return;
    setChecking(true);
    setNotice(null);
    try {
      const found = await checkForUpdate({ force: true });
      setUpdate(found);
      setNotice(found ? `version ${found.versionName} is ready` : 'up to date');
    } catch (e) {
      setNotice((e as { message?: string }).message ?? 'couldn\u2019t check — try again');
    } finally {
      setChecking(false);
    }
  }, [checking]);

  // bumped after an import: everything the server counts changes behind a
  // token the client already holds, so both counters must be refetched — and
  // the roll queue must go, too: it was fetched before the import, so its
  // titles predate the watched list and several of them are already seen
  const [importedAt, setImportedAt] = useState(0);
  const onImported = useCallback(() => {
    setQueue([]);
    setImportedAt((n) => n + 1);
  }, []);

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

  const [count, setCount] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  const [queue, setQueue] = useState<Title[]>([]);
  const [title, setTitle] = useState<Title | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // a notice that only re-renders is silent to TalkBack: announce it instead
  useEffect(() => {
    if (notice) AccessibilityInfo.announceForAccessibility(notice);
  }, [notice]);

  // the spoken form of the flaps: a settled count is exact, an in-flight one
  // is approximate, and the change itself is the announcement — otherwise the
  // counter is the one fact in the app a screen reader watches mutely
  useEffect(() => {
    if (count !== null && !pending) {
      AccessibilityInfo.announceForAccessibility(`${count} titles left`);
    }
  }, [count, pending]);

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
          setNotice('no answer — try again');
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
  // Remotes bounce, so the second press inside a roll is ignored. `picking` is
  // the same fact as state, so the button can say why presses are being eaten.
  const rolling = useRef(false);
  const [picking, setPicking] = useState(false);

  const roll = useCallback(async () => {
    if (rolling.current) return;
    rolling.current = true;
    setPicking(true);
    // a dead server must end in the notice, not in a button that feels broken —
    // OkHttp would bound it at ~10 s, and ten seconds of silence reads as broken
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ROLL_TIMEOUT_MS);
    try {
      // the queue and any fresh batch both pass the seen-filter: the server's
      // watched exclusion on title_full cannot be trusted, so the roll
      // enforces its own copy of the watched list
      let pool = queue.filter((t) => !watchedRef.current.has(t.tconst));
      if (pool.length === 0) {
        try {
          pool = (
            await fetchBatch(
              withShown(buildQuery(filters), shownRef.current),
              20,
              controller.signal,
              sessionRef.current?.token,
            )
          ).filter((t) => !watchedRef.current.has(t.tconst));
        } catch {
          setNotice('no answer — try again');
          // the fetch had nothing to show; the title you were reading still
          // does. Stay on the verdict — the notice waits on the board
          return;
        }
        // the filters changed while the batch was in flight: setFilters already
        // emptied the queue, so landing this pick would both contradict the new
        // filters on the verdict's receipt and re-poison the queue with up to 19
        // more old-filter titles. The press belongs to a board that no longer
        // exists — drop it and let the next roll fetch under the new filters.
        if (filtersRef.current !== filters) return;
        if (pool.length === 0) {
          setNotice('seen them all — widen a range');
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
      setPicking(false);
      clearTimeout(timer);
      rolling.current = false;
    }
  }, [queue, filters]);

  // the verdict's own way onto the watched list: same effect as a roll (the
  // title can never roll again), but the title stays on screen — the button
  // answers, the count quietly drops by one
  const markWatched = useCallback(async (tconst: string) => {
    const token = sessionRef.current?.token;
    if (!token) {
      setNotice('no session yet — try again');
      throw new Error('no session');
    }
    try {
      await pushWatched(token, [tconst]);
    } catch {
      setNotice('could not add — try again');
      throw new Error('watched push failed');
    }
    // the set leads the server list: the next rolls must not serve this title
    // even if the watched refetch or the server's own exclusion lags
    setWatchedIds((prev) => {
      const next = new Set(prev);
      next.add(tconst);
      return next;
    });
    setShown((s) => (s.includes(tconst) ? s : [...s, tconst]));
    setCount((c) => (c === null || c === 0 ? c : c - 1));
    setNotice('added to your list — it never rolls again');
  }, []);

  // coming back from a verdict, focus belongs on the pick button — that is where you left
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
  // loading a preset is a setFilters plus the way home: the board repaints,
  // the pick button takes focus, and the shown list rides along untouched
  const loadPreset = useCallback(
    (preset: Filters) => {
      setFilters(preset);
      setScreen('board');
      setReturned(true);
    },
    [setFilters],
  );

  const openPresets = useCallback(() => {
    setScreen('presets');
    setReturned(false);
  }, []);

  const openImport = useCallback(() => {
    // the import pushes into the device's watched list, so it waits for the token
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

  // the splash still covers the screen while fonts land
  if (!fontsLoaded && !fontError) return null;

  return (
    <>
      <StatusBar hidden />
      {title ? (
        <Verdict
          title={title}
          filters={filters}
          remaining={count ?? 0}
          notice={notice}
          onRollAgain={roll}
          onWatched={markWatched}
          onBack={toBoard}
        />
      ) : screen === 'account' ? (
        <Account session={session} onImport={openImport} onBack={toBoardFromScreen} />
      ) : screen === 'presets' ? (
        <Presets filters={filters} onLoad={loadPreset} onBack={toBoardFromScreen} />
      ) : screen === 'import' && session ? (
        <Import session={session} onBack={toBoardFromScreen} onImported={onImported} />
      ) : (
        <Board
          filters={filters}
          setFilters={setFilters}
          count={count}
          pending={pending}
          picking={picking}
          onRoll={roll}
          focusRoll={returned}
          onOpenAccount={openAccount}
          update={update}
          onCheckUpdates={checkUpdates}
          checking={checking}
          notice={notice}
          onReset={() => setFilters({ ...INITIAL })}
          onOpenPresets={openPresets}
        />
      )}
    </>
  );
}
