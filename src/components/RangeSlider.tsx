import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Pressable, StyleSheet, Text, useTVEventHandler, View } from 'react-native';

import type { Axis } from '../config/filters';
import { nudge } from '../lib/range';
import { RAMP, stepMultiplier } from '../lib/ramp';
import { colors, layout, mono, s } from '../theme';

type Editing = null | 0 | 1;

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
};

const PAD_H = s(14);
const HANDLE_W = s(104);
const INNER_W = layout.contentWidth - PAD_H * 2;

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
}: Props) {
  const [editing, setEditing] = useState<Editing>(null);
  // the key handler and the ramp timer both fire outside React's render, so they
  // read the live value and edit state from refs rather than stale closures
  const valueRef = useRef(value);
  valueRef.current = value;
  const editingRef = useRef<Editing>(editing);
  editingRef.current = editing;
  const ramp = useRef<{ dir: -1 | 1; stop: () => void } | null>(null);

  const stopRamp = useCallback(() => {
    ramp.current?.stop();
    ramp.current = null;
  }, []);

  const move = useCallback(
    (dir: -1 | 1, mult: number) => {
      const side = editingRef.current;
      if (side === null) return;
      onChange(nudge(axis, valueRef.current, side, dir, mult));
    },
    [axis, onChange],
  );

  const startRamp = useCallback(
    (dir: -1 | 1) => {
      // Android autorepeats ACTION_DOWN while a key is held; the ramp is ours,
      // so a repeat for a direction already running is ignored
      if (ramp.current?.dir === dir) return;
      stopRamp();

      move(dir, 1); // a tap is exactly one notch
      const startedAt = Date.now();
      let interval: ReturnType<typeof setInterval> | undefined;
      const delay = setTimeout(() => {
        interval = setInterval(
          () => move(dir, stepMultiplier(Date.now() - startedAt)),
          RAMP.tickMs,
        );
      }, RAMP.firstDelayMs);

      ramp.current = {
        dir,
        stop: () => {
          clearTimeout(delay);
          if (interval) clearInterval(interval);
        },
      };
    },
    [move, stopRamp],
  );

  useTVEventHandler(
    useCallback(
      (evt: { eventType: string; eventKeyAction?: number }) => {
        if (editingRef.current === null) return;
        const dir = evt.eventType === 'right' ? 1 : evt.eventType === 'left' ? -1 : 0;
        if (!dir) return;

        if (evt.eventKeyAction === ACTION_DOWN) {
          startRamp(dir as -1 | 1);
          return;
        }
        if (evt.eventKeyAction === ACTION_UP) {
          // A press that never delivered ACTION_DOWN still has to move the
          // value once. Synthetic keyevents — adb, and therefore every
          // automated check — arrive as ACTION_UP only, so without this the
          // slider is inert under automation while working by hand.
          if (!ramp.current) move(dir as -1 | 1, 1);
          stopRamp();
        }
      },
      [move, startRamp, stopRamp],
    ),
  );

  // back leaves the sequence rather than the screen
  useEffect(() => {
    if (editing === null) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      stopRamp();
      setEditing(null);
      return true;
    });
    return () => sub.remove();
  }, [editing, stopRamp]);

  useEffect(() => stopRamp, [stopRamp]);

  /** null -> lower -> upper -> null */
  const step = () => {
    stopRamp();
    setEditing((e) => (e === null ? 0 : e === 0 ? 1 : null));
  };

  const [lo, hi] = value;
  const xLo = axis.pos(lo) * INNER_W;
  const xHi = axis.pos(hi) * INNER_W;
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
                  { left: xLo, width: Math.max(0, xHi - xLo) },
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
  const max = INNER_W - HANDLE_W;
  const clamp = (v: number) => Math.min(max, Math.max(0, v));
  let loLeft = clamp(xLo - HANDLE_W / 2);
  let hiLeft = clamp(xHi - HANDLE_W / 2);
  if (hiLeft - loLeft < HANDLE_W) {
    const mid = (xLo + xHi) / 2;
    loLeft = Math.min(Math.max(0, mid - HANDLE_W), INNER_W - HANDLE_W * 2);
    hiLeft = loLeft + HANDLE_W;
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
  handleText: mono(21, { fontWeight: '700', color: colors.chalk }),
  handleTextLive: { color: colors.onSodium },
  arrow: mono(18, { fontWeight: '700', color: colors.onSodium }),
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
