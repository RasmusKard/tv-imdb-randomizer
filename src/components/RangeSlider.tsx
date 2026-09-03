import { useCallback, useEffect, useRef } from 'react';
import { BackHandler, Pressable, StyleSheet, useTVEventHandler, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { T } from './T';

import type { Axis } from '../config/filters';
import { isWholeAxis, nudge } from '../lib/range';
import { colors, layout, mono, monoBold, s } from '../theme';

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

/**
 * D-pad left/right, including the OS repeat stream. On this stack the initial
 * ACTION_DOWN never reaches useTVEventHandler (the focus engine consumes it),
 * so a held key surfaces as repeated `longRight`/`longLeft` events — one per
 * OS repeat — followed by the UP. adb presses arrive as UP alone.
 */
const dirOf = (eventType: string): -1 | 1 | 0 =>
  eventType === 'right' || eventType === 'longRight'
    ? 1
    : eventType === 'left' || eventType === 'longLeft'
      ? -1
      : 0;

type Props = {
  axis: Axis;
  value: [number, number];
  onChange: (v: [number, number]) => void;
  testID: string;
  /** The row below is seven columns wide; pin the hop to column 1. */
  nextFocusDown?: View | null;
  /** The Type row above is two cells wide; pin the hop to column 1, so the
   *  down-then-up round trip is identity instead of geometry's centre guess. */
  nextFocusUp?: View | null;
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
  nextFocusUp,
  registerNode,
  selfNode,
  editing,
  onEditingChange,
  hasTVPreferredFocus,
}: Props) {
  // the key handler fires outside React's render, so it reads the live value
  // and edit state from refs rather than stale closures. While armed, this
  // ref is the source of truth, advanced synchronously inside move() itself —
  // not resynced from the `value` prop until editing ends. The OS repeat
  // stream ticks every ~50 ms; a round trip through onChange -> App state ->
  // re-render can take longer than that under load, and syncing from the
  // (by-then-stale) prop on every render made each tick nudge from the same
  // starting point as the last, so holding moved once and stalled.
  const editingRef = useRef<Editing>(editing);
  editingRef.current = editing;
  const valueRef = useRef(value);
  if (editing === null) valueRef.current = value;
  // whether a DOWN was seen since the last UP: the UP is a press's only
  // guaranteed event, but after a repeat stream it must not add a notch
  const sawDown = useRef(false);

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

  useTVEventHandler(
    useCallback(
      (evt: { eventType: string; eventKeyAction?: number }) => {
        if (editingRef.current === null) return;
        const dir = dirOf(evt.eventType);
        if (!dir) return;

        if (evt.eventKeyAction === ACTION_DOWN) {
          // the OS repeat stream while a key is held: one notch per event —
          // the cadence and the dead zone before it are the OS's own
          sawDown.current = true;
          move(dir);
          return;
        }
        if (evt.eventKeyAction === ACTION_UP) {
          // a press whose down never reached JS — every tap on this stack,
          // and every adb check — still moves the value exactly once
          if (!sawDown.current) move(dir);
          sawDown.current = false;
        }
      },
      [move],
    ),
  );

  // leaving the sequence by any door — back, or focus moving away because an
  // IR remote (no reliable D-pad trap) or a touch landed on something else —
  // exits the same way: values already applied live, so there is nothing to
  // commit, just the edit chrome to close
  const exitEditing = useCallback(() => {
    onEditingChange(null);
  }, [onEditingChange]);

  useEffect(() => {
    if (editing === null) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      exitEditing();
      return true;
    });
    return () => sub.remove();
  }, [editing, exitEditing]);

  /** null -> lower -> upper -> null */
  const step = () => {
    onEditingChange(editing === null ? 0 : editing === 0 ? 1 : null);
  };

  const [lo, hi] = value;
  // an untouched axis is not a choice: the lamp spends on narrowed ranges,
  // and a whole-axis fill at full rest opacity would shout "picked" for "Any"
  const whole = isWholeAxis(axis, value);
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
        nextFocusUp={trapped ? self : nextFocusUp}
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
                  whole && !focused && !trapped && styles.fillWhole,
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

/** The handle's arrows, drawn rather than typed: Unicode glyphs never stand
 * in for an icon system. */
function Chevron({ dir }: { dir: -1 | 1 }) {
  const size = s(11);
  return (
    <Svg width={size} height={size} viewBox="0 0 10 10">
      <Path
        d={dir === -1 ? 'M6.5 1.5 L3 5 L6.5 8.5' : 'M3.5 1.5 L7 5 L3.5 8.5'}
        stroke={colors.onSodium}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

function Handle({ text, left, mode }: { text: string; left: number; mode: HandleMode }) {
  const live = mode === 'live';

  return (
    <View style={[styles.handle, { left: left + PAD_H }, handleState[mode]]}>
      {live ? <Chevron dir={-1} /> : null}
      <T style={[styles.handleText, live && styles.handleTextLive]}>{text}</T>
      {live ? <Chevron dir={1} /> : null}
    </View>
  );
}

const HEIGHT = s(50);
const HANDLE_H = s(44);

const styles = StyleSheet.create({
  // no stroke: a ring around a full-width element this tall reads as an alert,
  // not as focus, so the slat lights up instead
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
  fillWhole: { opacity: 0.22 },

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
  handleText: monoBold(26, { color: colors.chalk }),
  handleTextLive: { color: colors.onSodium },
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
