import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, useTVEventHandler, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { T } from './T';

import type { Axis } from '../config/filters';
import { driver, isWholeAxis, nudge } from '../lib/range';
import { colors, layout, mono, monoBold, s } from '../theme';

/**
 * The four looks a handle can have. `driving` and focus decide exactly one of
 * them, so the handle takes the answer rather than three booleans to re-derive.
 */
type HandleMode = 'rest' | 'lit' | 'dim' | 'live';

const handleMode = (side: 0 | 1, mark: 0 | 1, driving: boolean, focused: boolean): HandleMode =>
  driving ? (side === mark ? 'live' : 'dim') : focused ? 'lit' : 'rest';

/** How loudly a handle's chevrons speak: the driven end is bright, a focused
 *  row previews its amber end dimly, and nothing else wears arrows. */
type ChevronTone = 'none' | 'dim' | 'bright';

const chevronTone = (side: 0 | 1, mark: 0 | 1, driving: boolean, focused: boolean): ChevronTone =>
  driving ? (side === mark ? 'bright' : 'none') : focused && side === mark ? 'dim' : 'none';

/** Android KeyEvent actions, as forwarded by useTVEventHandler. */
const ACTION_DOWN = 0;
const ACTION_UP = 1;

/**
 * Hold-repeat cadence. The tick starts at the pace a tap-press rhythm has and
 * shortens with every notch, easing to the floor: short hops keep the familiar
 * pace, long traverses accelerate the way native D-pad UIs do. 0.87 lands on
 * the floor by the ninth tick — a touch over half a second of holding.
 */
const REPEAT_TICK_START_MS = 100;
const REPEAT_TICK_FLOOR_MS = 35;
const REPEAT_TICK_DECAY = 0.87;

/**
 * D-pad left/right, plain or long. What useTVEventHandler delivers on Android
 * is fixed by ReactAndroidHWInputDeviceHelper.java: the initial ACTION_DOWN
 * and the OS repeat stream are never forwarded (enableKeyDownEvents is off by
 * default and native-only), so a *held* key surfaces as exactly one
 * `longRight`/`longLeft` DOWN roughly 300 ms in, then the UP. The interval
 * below re-expands that single signal into a repeat stream.
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
  /**
   * True while this slider is the one holding the board's arrows. A focused
   * slider is ALREADY its adjusting state — the arrows need no arm press — so
   * this is not a mode the user enters, it is the race guard: a bare touch or
   * a pointer-mode IR remote can activate a different control directly by
   * coordinate without Android ever moving its view focus there, and whichever
   * control fires next needs one shared place (the board's closeEdit) that
   * closes out the slider that thought it still had the keys. Controlled here
   * rather than owned locally because the parent is the one place that already
   * knows about every slider on the board, so it is the one place that can
   * enforce "at most one".
   */
  driving: boolean;
  onDrivingChange: (driving: boolean) => void;
  /** True exactly when this slider was the most recently pressed control board-wide. */
  hasTVPreferredFocus?: boolean;
};

const PAD_H = s(14);
const HANDLE_W = s(124);
const INNER_W = layout.contentWidth - PAD_H * 2;
/** Space a handle's own left edge can occupy, so it reaches both track ends flush. */
const TRAVEL = INNER_W - HANDLE_W;

/**
 * A dual-range slider that is ONE focus cell — and whose focused state is
 * already its adjusting state.
 *
 * A remote has no pointer, so the control has to answer one question before
 * anything else: when the user presses right, does focus move or does the value
 * change? On this row the question answers itself: the slider spans the whole
 * content width, so horizontal has nothing to navigate to — left and right are
 * free to be the value. The focused row always shows one amber end (drawn
 * chevrons, never typed arrows), the arrows drive that end immediately, and OK
 * moves the amber mark to the other end — the genre chips' own idiom of one
 * cell whose OK cycles its internal state. Up and down are navigation at all
 * times: values apply as they move, there is nothing to commit, so leaving the
 * row IS leaving the slider. No walk, no trap, no Back.
 *
 * The amber mark is sticky per axis and survives focus leaves, so coming back
 * to a slider resumes the end you were tuning. A direction the amber end
 * cannot take — a wall of its axis, or its partner one step away — hands the
 * step, and the mark, to the other end (driver()). That handoff happens only
 * at a press's first notch: a hold picks its end once and bonks visibly at
 * walls rather than ever silently moving both ends.
 *
 * The key presses reach JS through useTVEventHandler — that emitter is fed
 * from the activity's key dispatch, not from focus — so the component answers
 * only while it holds view focus AND has not been stood down by the board
 * (see `driving`). That is the same "point at self" trick GridRow uses for row
 * edges, inverted: here no direction is ever pinned to self, because no
 * direction is ever trapped. A TVFocusGuideView with trapFocus* would be the
 * documented way to trap, but wrapping the slider in one made it unfocusable:
 * with neither `destinations` nor `autoFocus`, the guide passes
 * tvFocusable={undefined} and the native container blocks focus reaching its
 * children — one more reason nothing here traps.
 */
export function RangeSlider({
  axis,
  value,
  onChange,
  testID,
  nextFocusDown,
  nextFocusUp,
  registerNode,
  driving,
  onDrivingChange,
  hasTVPreferredFocus,
}: Props) {
  // the key handler and the repeat timer both fire outside React's render, so
  // they read the live value, the amber mark and the guard state from refs
  // rather than stale closures. While driving, this ref is the source of truth,
  // advanced synchronously inside move() itself — not resynced from the `value`
  // prop until driving ends. A tick fires at the hold's (shortening) pace; a
  // round trip through onChange -> App state -> re-render can take longer than
  // that under load, and syncing from the (by-then-stale) prop on every render
  // made each tick nudge from the same starting point as the last, so
  // holding moved once and stalled.
  const valueRef = useRef(value);
  if (!driving) valueRef.current = value;

  /** Which end wears the chevrons — the end the arrows will drive. */
  const [mark, setMark] = useState<0 | 1>(0);
  const markRef = useRef<0 | 1>(0);

  const repeat = useRef<{ dir: -1 | 1; stop: () => void } | null>(null);

  const focusRef = useRef(false);
  // set when the board stands this slider down while it still holds view focus
  // (a coordinate press landed on another control): its arrows go inert until
  // focus genuinely leaves and returns, or the slider itself is pressed again
  const stolenRef = useRef(false);
  const drivingRef = useRef(driving);
  drivingRef.current = driving;
  useEffect(() => {
    // the board closed this slider out while view focus never left it: that is
    // a steal. (A focus-driven exit runs through onBlur first, which clears
    // focusRef, so a benign close reads as no-op here.)
    if (!driving && focusRef.current) stolenRef.current = true;
  }, [driving]);

  const stopRepeat = useCallback(() => {
    repeat.current?.stop();
    repeat.current = null;
  }, []);

  const move = useCallback(
    (side: 0 | 1, dir: -1 | 1) => {
      const next = nudge(axis, valueRef.current, side, dir);
      valueRef.current = next;
      onChange(next);
    },
    [axis, onChange],
  );

  /** Rule: a direction the amber end cannot take goes to the other end, and
   *  the mark moves with it. Both ends blocked → the mark stands, nothing
   *  moves. */
  const settleMark = useCallback(
    (dir: -1 | 1): 0 | 1 => {
      const next = driver(axis, valueRef.current, markRef.current, dir);
      if (next !== markRef.current) {
        markRef.current = next;
        setMark(next);
      }
      return next;
    },
    [axis],
  );

  /** Claim the board's arrows. From a D-pad press this is a formality (view
   *  focus is already here); from a coordinate tap on the slider it is the
   *  touch path arming the row — and the board's focusedKey sync then flips
   *  hasTVPreferredFocus, whose false->true transition genuinely calls
   *  requestFocus (ReactViewManager.kt), so the tapped slider really takes
   *  view focus and its arrows with it. */
  const engage = useCallback(() => {
    stolenRef.current = false;
    if (!drivingRef.current) onDrivingChange(true);
  }, [onDrivingChange]);

  // A held key arrives as ONE long* DOWN (the helper collapses the OS repeat
  // stream), so the ticks here are the repeat stream. The signal is already
  // ~300 ms into the hold when it lands — the dead zone before repeats is the
  // OS's own long-press delay — so ticking starts immediately. The stream
  // ramps: each tick books the next at the decayed pace, down to the floor.
  // A resend for a direction already running is ignored. The hold's end is
  // chosen once, at the first notch; ticks never re-run the handoff.
  const startRepeat = useCallback(
    (side: 0 | 1, dir: -1 | 1) => {
      if (repeat.current?.dir === dir) return;

      move(side, dir); // the hold's first notch

      // self-scheduling timeout rather than an interval, because the gap to
      // the next notch shrinks as the hold wears on
      let ticks = 0;
      let timer: ReturnType<typeof setTimeout> | null = null;
      const book = (ms: number) => {
        timer = setTimeout(() => {
          move(side, dir);
          ticks += 1;
          book(Math.max(REPEAT_TICK_FLOOR_MS, REPEAT_TICK_START_MS * REPEAT_TICK_DECAY ** ticks));
        }, ms);
      };
      book(REPEAT_TICK_START_MS);

      repeat.current = {
        dir,
        stop: () => {
          if (timer) clearTimeout(timer);
        },
      };
    },
    [move],
  );

  useTVEventHandler(
    useCallback(
      (evt: { eventType: string; eventKeyAction?: number }) => {
        if (!focusRef.current || stolenRef.current) return;
        const dir = dirOf(evt.eventType);
        if (!dir) return;

        if (evt.eventKeyAction === ACTION_DOWN) {
          // only ever the single long* DOWN of a held key
          engage();
          startRepeat(settleMark(dir), dir);
          return;
        }
        if (evt.eventKeyAction === ACTION_UP) {
          // a press whose down never reached JS — every tap, and every adb
          // check — still moves the value exactly once; a held key's UP only
          // stops the stream, its notch already landed on the DOWN
          if (!repeat.current) {
            engage();
            move(settleMark(dir), dir);
          }
          stopRepeat();
        }
      },
      [engage, move, settleMark, startRepeat, stopRepeat],
    ),
  );

  // leaving the row by any door — up/down to the rows either side, or focus
  // moving because an IR remote or a touch landed on something else — closes
  // the same way: values already applied live, so there is nothing to commit,
  // just the guard to hand back and the repeat to stop
  const onBlur = useCallback(() => {
    focusRef.current = false;
    stopRepeat();
    if (drivingRef.current) onDrivingChange(false);
  }, [stopRepeat, onDrivingChange]);

  const onFocus = useCallback(() => {
    focusRef.current = true;
    stolenRef.current = false;
  }, []);

  useEffect(() => stopRepeat, [stopRepeat]);

  /** OK moves the amber mark to the other end without moving a value — and
   *  claims the arrows, so the touch path's tap lands the row armed. */
  const swap = useCallback(() => {
    stopRepeat();
    engage();
    const next: 0 | 1 = markRef.current === 0 ? 1 : 0;
    markRef.current = next;
    setMark(next);
  }, [stopRepeat, engage]);

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

  return (
    <Pressable
        ref={registerNode}
        testID={testID}
        accessibilityRole="button"
        // the handles are not focusable and have no other machine-readable
        // identity, so the values and the amber end ride the label
        accessibilityLabel={`${axis.label} ${axis.fmt(lo)} to ${axis.fmt(hi)}, ${mark === 0 ? 'lower' : 'upper'} end live`}
        onPress={swap}
        onFocus={onFocus}
        onBlur={onBlur}
        hasTVPreferredFocus={hasTVPreferredFocus}
        nextFocusUp={nextFocusUp}
        nextFocusDown={nextFocusDown}
        style={({ focused }) => [
          styles.slider,
          focused && !driving && styles.sliderFocused,
          driving && styles.sliderArmed,
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
                  whole && !focused && !driving && styles.fillWhole,
                  focused && styles.fillFocused,
                  driving && styles.fillArmed,
                ]}
              />
            </View>
            <Handle
              text={axis.fmt(lo)}
              left={loLeft}
              mode={handleMode(0, mark, driving, focused)}
              chevron={chevronTone(0, mark, driving, focused)}
            />
            <Handle
              text={axis.fmt(hi)}
              left={hiLeft}
              mode={handleMode(1, mark, driving, focused)}
              chevron={chevronTone(1, mark, driving, focused)}
            />
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
function Chevron({ dir, dim }: { dir: -1 | 1; dim?: boolean }) {
  const size = s(11);
  return (
    <Svg width={size} height={size} viewBox="0 0 10 10">
      <Path
        d={dir === -1 ? 'M6.5 1.5 L3 5 L6.5 8.5' : 'M3.5 1.5 L7 5 L3.5 8.5'}
        stroke={dim ? colors.sodiumDim : colors.onSodium}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

function Handle({
  text,
  left,
  mode,
  chevron,
}: {
  text: string;
  left: number;
  mode: HandleMode;
  chevron: ChevronTone;
}) {
  const live = mode === 'live';

  return (
    <View style={[styles.handle, { left: left + PAD_H }, handleState[mode]]}>
      {chevron !== 'none' ? <Chevron dir={-1} dim={chevron === 'dim'} /> : null}
      <T style={[styles.handleText, live && styles.handleTextLive]}>{text}</T>
      {chevron !== 'none' ? <Chevron dir={1} dim={chevron === 'dim'} /> : null}
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
  /** the slider has focus; the amber end reads from its dim chevrons */
  lit: { backgroundColor: colors.slatLit },
  /** the other end, while the arrows are driving */
  dim: { opacity: 0.4 },
  /** this end is the one the arrows are moving */
  live: { backgroundColor: colors.sodium },
});
