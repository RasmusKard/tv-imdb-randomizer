import { useEffect, useState } from 'react';
import { Image, Linking, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import type { Filters, GenreState, Title } from '../api/types';
import { kindOf } from '../api/client';
import { AXES, RANGE_KEYS, testId } from '../config/filters';
import { isWholeAxis } from '../lib/range';
import { useReduceMotion } from '../lib/motion';
import { ActionButton } from '../components/ActionButton';
import { T } from '../components/T';
import { groupThousands } from '../lib/format';
import { colors, displayHeavy, layout, mono, monoBold, s, screen, text } from '../theme';

type Props = {
  title: Title;
  filters: Filters;
  /** How many titles are still unseen for these filters. */
  remaining: number;
  onRollAgain: () => void;
  onBack: () => void;
};

/** Each leader countdown step is a hard cut — no Animated, no easing. */
const THREAD_STEP_MS = 240;

/**
 * One answer, and the way back.
 *
 * The screen is a projected frame: sprocket strips along its edges, one warm
 * gate light under the title. The arrival is
 * a three-step leader countdown in hard cuts, skipped whole under
 * reduce-motion — and Pick another is pre-focused so the lazy path is a single
 * button, pressed repeatedly. The one-sheet on the right and the plot carry
 * the TMDB credit under them. The leader tape along the bottom keeps the
 * filters present without putting them back on screen, and doubles as the way
 * back to the board.
 */
export function Verdict({ title, filters, remaining, onRollAgain, onBack }: Props) {
  const isSeries = kindOf(title.titleType) === 'series';
  const kindLabel = isSeries ? 'Series' : 'Movie';
  const reduceMotion = useReduceMotion();
  // the receipt's UP lands here, so up-then-down from "Pick another" is identity
  const [pickNode, setPickNode] = useState<View | null>(null);
  // captured once per title, so the plex open below cannot race a "Pick another"
  const plexUrl = title.plexUrl;

  // the thread-up: 3 → 2 → 1 → the feature. Zero means the print is running.
  const [thread, setThread] = useState(3);
  useEffect(() => {
    if (reduceMotion) {
      setThread(0);
      return;
    }
    if (thread === 0) return;
    const t = setTimeout(() => setThread(thread - 1), THREAD_STEP_MS);
    return () => clearTimeout(t);
  }, [thread, reduceMotion]);

  // the one-sheet can fail to load (dead CDN edge, TV offline at that moment);
  // the reel takes the frame back, and each new title starts with a clean slate
  const [artFailed, setArtFailed] = useState(false);
  useEffect(() => setArtFailed(false), [title.tconst]);

  const meta = [
    String(title.startYear),
    kindLabel,
    title.runtimeMinutes == null
      ? null
      : `${title.runtimeMinutes} min${isSeries ? ' / ep' : ''}`,
    `${groupThousands(title.numVotes)} votes`,
  ].filter((m): m is string => m !== null);

  return (
    <View style={screen.root}>
      <Gate />
      <Sprockets top />
      <Sprockets />

      <View style={screen.safe}>
        <View style={styles.grid}>
          <View style={styles.main}>
            <View style={styles.metaLine}>
              <T style={styles.score}>
                {title.averageRating.toFixed(1)}
                <T style={styles.star}> ★</T>
              </T>
              {meta.flatMap((m) => [
                <View key={`${m}-tick`} style={styles.tick} />,
                <T key={m} style={styles.metaText}>
                  {m}
                </T>,
              ])}
            </View>

            <T
              testID="verdict-title"
              style={[
                styles.title,
                title.primaryTitle.length > 15 && styles.titleLong,
                title.primaryTitle.length > 44 && styles.titleHuge,
              ]}
              numberOfLines={2}
            >
              {title.primaryTitle}
            </T>

            <View style={styles.tags}>
              {title.genres.map((g) => (
                <T key={g} style={styles.tag}>
                  {g}
                </T>
              ))}
            </View>

            {title.plot ? (
              <T style={styles.plot} numberOfLines={3}>
                {title.plot}
              </T>
            ) : null}

            <View style={styles.actions}>
              <ActionButton
                label="Pick another"
                testID={testId.rollAgain}
                onPress={onRollAgain}
                hasTVPreferredFocus
                ref={setPickNode}
                style={styles.action}
              />
              <ActionButton
                label="IMDb"
                variant="ghost"
                testID={testId.imdb}
                // a TV without a browser just fails the open; that is still better
                // than a button that pretends to work and does nothing
                onPress={() => Linking.openURL(`https://www.imdb.com/title/${title.tconst}/`).catch(() => {})}
                style={styles.action}
              />
              {plexUrl && (
                <ActionButton
                  label="Open in Plex"
                  variant="ghost"
                  testID={testId.plex}
                  // the server only hands out a link it has actually matched on
                  // Plex; absent means absent, so there is no button at all
                  onPress={() => Linking.openURL(plexUrl).catch(() => {})}
                  style={styles.action}
                />
              )}
            </View>
          </View>

          {/* The one-sheet from TMDB; the reel stands back in when it is
              missing or would not load. */}
          <View style={styles.posterCol}>
            <View style={styles.poster}>
              <T style={styles.posterKind}>{kindLabel}</T>
              {title.posterUrl && !artFailed ? (
                <Image
                  source={{ uri: title.posterUrl }}
                  style={styles.posterArt}
                  resizeMode="cover"
                  accessibilityLabel={`${title.primaryTitle} poster`}
                  onError={() => setArtFailed(true)}
                />
              ) : (
                <Reel />
              )}
              <View style={styles.posterFoot}>
                <T style={styles.posterScore}>{title.averageRating.toFixed(1)} ★</T>
                <T style={styles.posterId}>{title.tconst}</T>
              </View>
            </View>
            {/* the price of the artwork and the plot: TMDB requires
                attribution wherever its data is shown */}
            {(title.plot || (title.posterUrl && !artFailed)) && (
              <T style={styles.credit}>art & plot — TMDB</T>
            )}
          </View>
        </View>

        <Receipt filters={filters} remaining={remaining} onPress={onBack} focusUpTarget={pickNode} />
      </View>

      {thread > 0 && (
        <View style={styles.leader} pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants">
          <View style={styles.leaderRing} />
          <T style={styles.leaderNum}>{thread}</T>
        </View>
      )}
    </View>
  );
}

/**
 * The room lit by the screen itself: one warm cone from the gate below, a
 * faint emulsion wash above, and a broad soft bloom sitting behind the title
 * — the gate light in the room, drawn as light rather than a text shadow,
 * because an Android text shadow ends in a visible edge. Volumetric light
 * through the room, never a neon edge on anything.
 */
function Gate() {
  return (
    <Svg
      pointerEvents="none"
      width="100%"
      height="100%"
      style={StyleSheet.absoluteFill}
    >
      <Defs>
        <RadialGradient id="gate" cx="50%" cy="118%" r="95%">
          <Stop offset="0%" stopColor={colors.sodium} stopOpacity={0.1} />
          <Stop offset="55%" stopColor={colors.sodium} stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id="wash" cx="24%" cy="16%" r="75%">
          <Stop offset="0%" stopColor={colors.chalk} stopOpacity={0.05} />
          <Stop offset="70%" stopColor={colors.chalk} stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id="bloom" cx="33%" cy="42%" r="46%">
          <Stop offset="0%" stopColor={colors.chalk} stopOpacity={0.1} />
          <Stop offset="55%" stopColor={colors.chalk} stopOpacity={0.045} />
          <Stop offset="100%" stopColor={colors.chalk} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#gate)" />
      <Rect width="100%" height="100%" fill="url(#wash)" />
      <Rect width="100%" height="100%" fill="url(#bloom)" />
    </Svg>
  );
}

/** A strip of film holes, top and bottom: the frame the screen is. */
function Sprockets({ top }: { top?: boolean }) {
  return (
    <View pointerEvents="none" style={[styles.sprocketRow, top ? styles.sprocketTop : styles.sprocketBottom]}>
      {Array.from({ length: 30 }, (_, i) => (
        <View key={i} style={styles.sprocket} />
      ))}
    </View>
  );
}

/** The reel standing in whenever the one-sheet is missing. */
function Reel() {
  return (
    <View style={styles.reel}>
      <View style={styles.reelRim} />
      <View style={styles.reelMid} />
      <View style={styles.reelCore} />
    </View>
  );
}

/**
 * The active filters, and the way back. Spans all seven columns as a strip
 * of leader tape.
 *
 * Include and exclude keep their colours from the board — amber and cue cyan —
 * so the tape reads as the same information, not a restatement of it.
 */
function Receipt({
  filters,
  remaining,
  onPress,
  focusUpTarget,
}: {
  filters: Filters;
  remaining: number;
  onPress: () => void;
  focusUpTarget: View | null;
}) {
  const parts: string[] = [
    filters.kinds.map((k) => (k === 'movie' ? 'Movies' : 'TV shows')).join(' + '),
  ];
  for (const key of RANGE_KEYS) {
    const axis = AXES[key];
    const value = filters[key];
    if (isWholeAxis(axis, value)) continue;
    const unit = key === 'rating' ? '★ ' : '';
    const suffix = key === 'votes' ? ' votes' : '';
    parts.push(`${unit}${axis.fmt(value[0])}–${axis.fmt(value[1])}${suffix}`);
  }
  const genres = Object.entries(filters.genres) as [string, GenreState][];

  return (
    <Pressable
      testID={testId.receipt}
      accessibilityRole="button"
      accessibilityLabel={`Filters: ${parts.join(', ')}. ${remaining} left. Back to filters.`}
      onPress={onPress}
      nextFocusUp={focusUpTarget ?? undefined}
      style={({ focused }) => [styles.receipt, focused && styles.receiptFocused]}
    >
      <T style={styles.receiptText} numberOfLines={1}>
        {parts.join('  ·  ')}
        {genres.map(([genre, state]) => (
          <T key={genre} style={state === 'include' ? styles.inc : styles.exc}>
            {`  ·  ${state === 'include' ? '+' : '−'} ${genre}`}
          </T>
        ))}
      </T>
      <T style={styles.receiptLeft}>{`${groupThousands(remaining)} left`}</T>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  grid: { flex: 1, flexDirection: 'row', gap: layout.gap },
  main: { width: layout.span(5) },

  // the frame's own edges — flush with the bezel: the film runs off the screen
  sprocketRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: s(22),
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    backgroundColor: 'rgba(232,230,220,0.05)',
  },
  sprocketTop: { top: 0 },
  sprocketBottom: { bottom: 0 },
  sprocket: { width: s(18), height: s(13), borderRadius: s(3), backgroundColor: colors.boardLo },

  metaLine: { flexDirection: 'row', alignItems: 'center', gap: s(20), marginTop: s(18) },
  tick: { width: StyleSheet.hairlineWidth, height: s(28), backgroundColor: colors.slatHi },
  score: monoBold(44, { color: colors.sodium }),
  star: { fontSize: s(24) },
  metaText: text.label,

  // the title stands in the gate light: silver emulsion, the bloom drawn as
  // room light in the Gate gradient — no text shadow, which ends in a seam
  title: displayHeavy(136, {
    em: -0.02,
    caps: true,
    color: colors.chalk,
    marginTop: s(16),
  }),
  // the two drops keep a two-line title one dramatic line: 136 fills ~15 caps
  // per column, 88 ~22, 64 ~30 — past 44 chars even 88 ellipsizes mid-word
  titleLong: displayHeavy(88, { em: -0.02 }),
  titleHuge: displayHeavy(64, { em: -0.02 }),

  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: s(18), marginTop: s(28) },
  // a selection, like its chip on the board: mixed case, not chrome caps
  tag: mono(23, {
    em: 0.02,
    color: colors.dim,
    borderWidth: s(1),
    borderColor: colors.slatHi,
    paddingHorizontal: s(20),
    paddingVertical: s(9),
    borderRadius: s(2),
    overflow: 'hidden',
  }),
  plot: { ...text.body, lineHeight: s(42), color: colors.dim, marginTop: s(26), maxWidth: layout.span(4) },

  actions: { marginTop: 'auto', flexDirection: 'row', gap: s(28), paddingBottom: s(20) },
  // three actions share the five columns; a fixed span would overflow at the third
  action: { flex: 1 },

  posterCol: { width: layout.span(2) },
  poster: {
    aspectRatio: 2 / 3,
    padding: s(32),
    borderRadius: layout.radius,
    backgroundColor: colors.slat,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.slatHi,
    alignItems: 'center',
  },
  posterKind: mono(22, { em: 0.2, caps: true, color: colors.dim }),
  posterArt: { flex: 1, width: '100%', borderRadius: s(2), backgroundColor: colors.boardLo },
  reel: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  reelRim: {
    width: s(190),
    height: s(190),
    borderRadius: s(95),
    borderWidth: s(3),
    borderColor: 'rgba(232,230,220,0.22)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reelMid: {
    width: s(122),
    height: s(122),
    borderRadius: s(61),
    borderWidth: s(3),
    borderColor: 'rgba(232,230,220,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reelCore: {
    width: s(46),
    height: s(46),
    borderRadius: s(23),
    borderWidth: s(3),
    borderColor: 'rgba(255,176,46,0.55)',
    shadowColor: colors.sodium,
    shadowOpacity: 0.3,
    shadowRadius: s(30),
    elevation: 6,
  },
  posterFoot: {
    marginTop: 'auto',
    paddingTop: s(16),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.slatHi,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
  },
  posterScore: monoBold(24, { color: colors.sodium }),
  posterId: mono(24, { color: colors.dim }),
  credit: mono(18, { em: 0.1, caps: true, color: colors.dim, marginTop: s(10), textAlign: 'center' }),

  // leader tape: one step above the unlit ground, amber ink for the count
  receipt: {
    width: '100%',
    height: s(76),
    paddingHorizontal: s(22),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: s(28),
    borderRadius: layout.radius,
    borderWidth: layout.border,
    borderColor: colors.slatHi,
    backgroundColor: colors.tape,
  },
  receiptFocused: { borderColor: colors.sodium },
  receiptText: mono(24, { em: 0.08, caps: true, color: colors.dim, flexShrink: 1 }),
  inc: { color: colors.sodium },
  exc: { color: colors.cold, textDecorationLine: 'line-through' },
  receiptLeft: monoBold(26, { em: 0.08, caps: true, color: colors.sodium }),

  // the thread-up: opaque leader replaces the frame, numeral in a ring
  leader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.board,
    alignItems: 'center',
    justifyContent: 'center',
  },
  leaderRing: {
    position: 'absolute',
    width: s(240),
    height: s(240),
    borderRadius: s(120),
    borderWidth: s(2),
    borderColor: 'rgba(232,230,220,0.25)',
  },
  leaderNum: displayHeavy(150, { color: 'rgba(232,230,220,0.8)' }),
});
