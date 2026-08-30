import { useCallback, useEffect, useRef } from 'react';
import { BackHandler, Pressable, StyleSheet, Text, useTVEventHandler, View } from 'react-native';

import type { Axis } from '../config/filters';
import { nudge } from '../lib/range';
import { colors, layout, mono, s } from '../theme';

export type Editing = null | 0 | 1;

/**
 * The four looks a handle can have. `editing` and focus decide exactly one of
 * them, so the handle takes the answer rather than three booleans to re-derive.
 */
type HandleMode = 'rest' | 'lit' | 'dim' | 'live';

const handleMode = (side: 0 | 1, editing: Editing, focused: boolean): HandleMode =>
  editing === side ? 'live' : editing !== null ? 'dim' : focused ? 'lit' : 'rest';

/** Android KeyEvent actions, as forwarded by useTVEventHandler. */
const ACTION_DOWN = 0;
const ACTION_UP = 1;

/** Dead zone after the first step, so a tap stays exactly one notch. */
const REPEAT_DELAY_MS = 380;
/** Constant repeat interval once the dead zone has passed — no acceleration. */
const REPEAT_TICK_MS = 100;

type Props = {
  axis: Axis;
  value: [number, number];
  onChange: (v: [number, number]) => void;
  testID: string;
  /** The row below is seven columns wide; pin the hop to column 1. */
  nextFocusDown?: View | null;
  /**
   * Board needs this node to wire the rows above and below back to the slider.
   * Must be referentially stable — a fresh callback each render makes React
   * detach and reattach the ref forever. A useState setter qualifies.
   */
  registerNode?: (node: View | null) => void;
  /** The node registerNode handed up. Pointing every direction at it is the trap. */
  selfNode?: View | null;
  /**
   * Controlled rather than local: only one slider on the board may be armed at
   * a time. A bare touch or pointer-mode IR remote can activate a different
   * control directly, bypassing the D-pad focus trap below entirely — if this
   * component owned "armed" as its own state, that other control's press
   * would land while this one still thought it had the keys, and both would
   * answer left/right at once. The parent is the one place that already knows
   * about every slider on the board, so it is the one place that can enforce
   * "at most one" and close this slider out when something else wins.
   */
  editing: Editing;
  onEditingChange: (editing: Editing) => void;
  /** True exactly when this slider was the most recently pressed control board-wide. */
  hasTVPreferredFocus?: boolean;
};

const PAD_H = s(14);
const HANDLE_W = s(124);
const INNER_W = layout.contentWidth - PAD_H * 2;
/** Space a handle's own left edge can occupy, so it reaches both track ends flush. */
const TRAVEL = INNER_W - HANDLE_W;

/**
 * A dual-range slider that is ONE focus cell.
 *
 * A remote has no pointer, so the control has to answer one question before
 * anything else: when the user presses right, does focus move or does the value
 * change? Inferring it always guesses wrong, so OK walks through it instead —
 * lower end, upper end, done — and the whole slider is a single target, whatever
 * its handles are doing. That keeps every row's cell count fixed, which is what
 * lets someone count presses to a target.
 *
 * While the sequence is live all four nextFocus* props point at the slider
 * itself, so every direction is inert and the native focus engine cannot move
 * focus away. The key presses still reach JS through useTVEventHandler — that
 * emitter is fed from the activity's key dispatch, not from focus — so we get
 * the input without the focus leaking.
 *
 * That is the same "point at self" trick GridRow uses for row edges. A
 * TVFocusGuideView with trapFocus* would be the documented way, but wrapping the
 * slider in one made it unfocusable: with neither `destinations` nor
 * `autoFocus`, the guide passes tvFocusable={undefined} and the native container
 * blocks focus reaching its children.
 *
 * Values apply as they move; there is no draft to commit. A filter is not
 * destructive and every range has an "Any" band one press below it.
 */
export function RangeSlider({
  axis,
  value,
  onChange,
  testID,
  nextFocusDown,
  registerNode,
  selfNode,
  editing,
  onEditingChange,
  hasTVPreferredFocus,
}: Props) {
  // the key handler and the repeat timer both fire outside React's render, so
  // they read the live value and edit state from refs rather than stale closures.
  // While armed, this ref is the source of truth, advanced synchronously inside
  // move() itself — not resynced from the `value` prop until editing ends. A
  // repeat tick fires every REPEAT_TICK_MS; a round trip through onChange ->
  // App state -> re-render can take longer than that under load, and syncing
  // from the (by-then-stale) prop on every render made each tick nudge from
  // the same starting point as the last, so holding moved once and stalled.
  const editingRef = useRef<Editing>(editing);
  editingRef.current = editing;
  const valueRef = useRef(value);
  if (editing === null) valueRef.current = value;
  const repeat = useRef<{ dir: -1 | 1; stop: () => void } | null>(null);

  const stopRepeat = useCallback(() => {
    repeat.current?.stop();
    repeat.current = null;
  }, []);

  const move = useCallback(
    (dir: -1 | 1) => {
      const side = editingRef.current;
      if (side === null) return;
      const next = nudge(axis, valueRef.current, side, dir);
      valueRef.current = next;
      onChange(next);
    },
    [axis, onChange],
  );

  const startRepeat = useCallback(
    (dir: -1 | 1) => {
      // Android autorepeats ACTION_DOWN while a key is held; the repeat is
      // ours, so a resend for a direction already running is ignored
      if (repeat.current?.dir === dir) return;
      stopRepeat();

      move(dir); // a tap is exactly one notch
      let interval: ReturnType<typeof setInterval> | undefined;
      const delay = setTimeout(() => {
        interval = setInterval(() => move(dir), REPEAT_TICK_MS);
      }, REPEAT_DELAY_MS);

      repeat.current = {
        dir,
        stop: () => {
          clearTimeout(delay);
          if (interval) clearInterval(interval);
        },
      };
    },
    [move, stopRepeat],
  );

  useTVEventHandler(
    useCallback(
      (evt: { eventType: string; eventKeyAction?: number }) => {
        if (editingRef.current === null) return;
        const dir = evt.eventType === 'right' ? 1 : evt.eventType === 'left' ? -1 : 0;
        if (!dir) return;

        if (evt.eventKeyAction === ACTION_DOWN) {
          startRepeat(dir as -1 | 1);
          return;
        }
        if (evt.eventKeyAction === ACTION_UP) {
          // A press that never delivered ACTION_DOWN still has to move the
          // value once. Synthetic keyevents — adb, and therefore every
          // automated check — arrive as ACTION_UP only, so without this the
          // slider is inert under automation while working by hand.
          if (!repeat.current) move(dir as -1 | 1);
          stopRepeat();
        }
      },
      [move, startRepeat, stopRepeat],
    ),
  );

  // leaving the sequence by any door — back, or focus moving away because an
  // IR remote (no reliable D-pad trap) or a touch landed on something else —
  // exits the same way: values already applied live, so there is nothing to
  // commit, just the edit chrome to close
  const exitEditing = useCallback(() => {
    stopRepeat();
    onEditingChange(null);
  }, [stopRepeat, onEditingChange]);

  useEffect(() => {
    if (editing === null) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      exitEditing();
      return true;
    });
    return () => sub.remove();
  }, [editing, exitEditing]);

  useEffect(() => stopRepeat, [stopRepeat]);

  /** null -> lower -> upper -> null */
  const step = () => {
    stopRepeat();
    onEditingChange(editing === null ? 0 : editing === 0 ? 1 : null);
  };

  const [lo, hi] = value;
  // handle position is itself the pill's left edge, mapped over the space the
  // pill can actually occupy (TRAVEL), so it moves the instant the value
  // leaves the axis floor instead of sitting dead until it clears half a
  // handle-width — the old xLo * INNER_W - HANDLE_W / 2 formula clamped that
  // gap away from zero and left the pill visibly detached from the track's
  // own zero point.
  const xLo = axis.pos(lo) * TRAVEL;
  const xHi = axis.pos(hi) * TRAVEL;
  const { loLeft, hiLeft } = handlePositions(xLo, xHi);
  const trapped = editing !== null;
  const self = selfNode ?? null;

  return (
    <Pressable
        ref={registerNode}
        testID={testID}
        accessibilityRole="button"
        // the handles are not focusable and have no other machine-readable
        // identity, so the values ride the label
        accessibilityLabel={`${axis.label} ${axis.fmt(lo)} to ${axis.fmt(hi)}`}
        onPress={step}
        onBlur={exitEditing}
        hasTVPreferredFocus={hasTVPreferredFocus}
        nextFocusUp={trapped ? self : undefined}
        nextFocusDown={trapped ? self : nextFocusDown}
        nextFocusLeft={trapped ? self : undefined}
        nextFocusRight={trapped ? self : undefined}
        style={({ focused }) => [
          styles.slider,
          focused && !trapped && styles.sliderFocused,
          trapped && styles.sliderArmed,
        ]}
      >
        {({ focused }) => (
          <>
            <View style={styles.track}>
              <View
                style={[
                  styles.fill,
                  // the fill spans between the handles' own centres, so it lines
                  // up with the pills rather than the raw (unclamped) value line
                  { left: loLeft + HANDLE_W / 2, width: Math.max(0, hiLeft - loLeft) },
                  focused && styles.fillFocused,
                  trapped && styles.fillArmed,
                ]}
              />
            </View>
            <Handle text={axis.fmt(lo)} left={loLeft} mode={handleMode(0, editing, focused)} />
            <Handle text={axis.fmt(hi)} left={hiLeft} mode={handleMode(1, editing, focused)} />
          </>
        )}
    </Pressable>
  );
}

/** Keep both pills inside the track and off each other when the range is narrow. */
function handlePositions(xLo: number, xHi: number) {
  const clamp = (v: number) => Math.min(TRAVEL, Math.max(0, v));
  let loLeft = clamp(xLo);
  let hiLeft = clamp(xHi);
  if (hiLeft - loLeft < HANDLE_W) {
    const mid = clamp((xLo + xHi) / 2);
    loLeft = clamp(mid - HANDLE_W / 2);
    hiLeft = clamp(loLeft + HANDLE_W);
    loLeft = hiLeft - HANDLE_W;
  }
  return { loLeft, hiLeft };
}

function Handle({ text, left, mode }: { text: string; left: number; mode: HandleMode }) {
  const live = mode === 'live';

  return (
    <View style={[styles.handle, { left: left + PAD_H }, handleState[mode]]}>
      {live ? <Text style={styles.arrow}>◀</Text> : null}
      <Text style={[styles.handleText, live && styles.handleTextLive]}>{text}</Text>
      {live ? <Text style={styles.arrow}>▶</Text> : null}
    </View>
  );
}

const HEIGHT = s(56);
const HANDLE_H = s(46);

const styles = StyleSheet.create({
  // no stroke: a ring around a 56 x 1700px element reads as an alert, not as
  // focus, so the slat lights up instead
  slider: {
    height: HEIGHT,
    width: layout.contentWidth,
    borderRadius: layout.radius,
    backgroundColor: 'rgba(255,255,255,0.022)',
  },
  sliderFocused: { backgroundColor: 'rgba(255,176,46,0.17)' },
  sliderArmed: { backgroundColor: 'rgba(255,176,46,0.32)' },

  track: {
    position: 'absolute',
    left: PAD_H,
    right: PAD_H,
    top: (HEIGHT - s(6)) / 2,
    height: s(6),
    borderRadius: s(3),
    backgroundColor: colors.boardLo,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.slatHi,
  },
  fill: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    borderRadius: s(3),
    backgroundColor: colors.sodium,
    opacity: 0.45,
  },
  fillFocused: { opacity: 0.75 },
  fillArmed: { opacity: 1 },

  handle: {
    position: 'absolute',
    top: (HEIGHT - HANDLE_H) / 2,
    width: HANDLE_W,
    height: HANDLE_H,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: s(8),
    borderRadius: layout.radius,
    backgroundColor: colors.slatHi,
  },
  handleText: mono(26, { fontWeight: '700', color: colors.chalk }),
  handleTextLive: { color: colors.onSodium },
  arrow: mono(22, { fontWeight: '700', color: colors.onSodium }),
});

const handleState = StyleSheet.create({
  rest: {},
  /** the slider has focus but no sequence is running */
  lit: { backgroundColor: colors.slatLit },
  /** the other end, while a sequence is running */
  dim: { opacity: 0.4 },
  /** this end is the one the arrows are moving */
  live: { backgroundColor: colors.sodium },
});
