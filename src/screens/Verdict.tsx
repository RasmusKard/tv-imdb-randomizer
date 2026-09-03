import { useEffect, useState } from 'react';
import { Image, Linking, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Defs, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import type { Filters, GenreState, Title } from '../api/types';
import { kindOf } from '../api/client';
import { AXES, RANGE_KEYS, testId } from '../config/filters';
import { isWholeAxis } from '../lib/range';
import { useReduceMotion } from '../lib/motion';
import { ActionButton } from '../components/ActionButton';
import { Reel } from '../components/Reel';
import { T } from '../components/T';
import { groupThousands } from '../lib/format';
import { colors, displayHeavy, layout, mono, monoBold, s, screen, text } from '../theme';

type Props = {
  title: Title;
  filters: Filters;
  /** How many titles are still unseen for these filters. */
  remaining: number;
  /** A roll that failed while this verdict stayed up: the verdict answers
   *  where the press happened, in the dock's own warning voice. */
  notice?: string | null;
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
export function Verdict({ title, filters, remaining, notice, onRollAgain, onBack }: Props) {
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

  // a long plot is readable, not clipped: the plot takes whatever height the
  // column has left above the action row, OK on it opens it to the whole
  // slot, OK again closes. The cut is geometric, never guessed — a hidden
  // unclamped copy of the text reports the height the full plot needs, and
  // "+ more" appears only when that exceeds the slot's whole-line budget.
  // (The text's own onTextLayout cannot be the oracle: on Android its line
  // texts do not describe the clamped layout.) Focus tints like a slider; a
  // ring around prose would read as an alarm
  const [plotSlot, setPlotSlot] = useState(0);
  const [plotFullHeight, setPlotFullHeight] = useState(0);
  const [plotOpen, setPlotOpen] = useState(false);
  useEffect(() => setPlotOpen(false), [title.tconst]);

  const PLOT_LINE = s(42);
  // whole lines the measured slot holds, never fewer than three
  const fitLines = Math.max(3, Math.floor(plotSlot / PLOT_LINE));
  // closed keeps one line back for the + more affordance
  const closedLines = Math.max(3, fitLines - 1);
  const plotCut = plotFullHeight > closedLines * PLOT_LINE + 1;
  const plotOpenCut = plotFullHeight > fitLines * PLOT_LINE + 1;

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
              <View style={styles.scoreRow}>
                <T style={styles.score}>{title.averageRating.toFixed(1)}</T>
                {/* drawn, not typed: glyphs never do icon duty, and a TTS
                    engine never has to guess what a ★ is called */}
                <Star />
              </View>
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

            {/* the slot always renders and always owns the column's slack —
                the tail below used to take it with marginTop:auto, which
                starves a flex child back to zero. Empty when there is no
                plot; the tail then simply sits at the slot's bottom edge */}
            <View style={styles.plotSlot} onLayout={(e) => setPlotSlot(e.nativeEvent.layout.height)}>
              {/* the hidden unclamped copy whose height is the cut oracle */}
              {title.plot ? (
                <T
                  style={[styles.plot, styles.plotMeasure]}
                  onLayout={(e) => setPlotFullHeight(e.nativeEvent.layout.height)}
                >
                  {title.plot}
                </T>
              ) : null}
              {/* nothing renders until the slot is measured: the first pass
                  would clamp to three lines and flash + more on plots that
                  actually fit */}
              {title.plot && plotSlot > 0 ? (
                plotCut ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${plotOpen ? 'Close' : 'Open'} the full plot. ${title.plot}`}
                    onPress={() => setPlotOpen(!plotOpen)}
                    style={({ focused }) => [styles.plotHit, focused && styles.plotFocused]}
                  >
                    <T style={styles.plot} numberOfLines={plotOpen ? fitLines : closedLines}>
                      {title.plot}
                    </T>
                    {/* the same contract as the receipt: a cut is stated */}
                    {!plotOpen ? (
                      <T style={styles.plotMore}>+ more</T>
                    ) : plotOpenCut ? (
                      <T style={styles.plotTrim}>trimmed — the rest is on IMDb</T>
                    ) : null}
                  </Pressable>
                ) : (
                  <T style={styles.plot} numberOfLines={fitLines}>
                    {title.plot}
                  </T>
                )
              ) : null}
            </View>

            {/* the tail block pins to the column's bottom: the plot may grow
                above it, the buttons never move */}
            <View style={styles.tail}>
            {notice ? <T style={styles.rollNotice} numberOfLines={1}>{notice}</T> : null}

            <View style={styles.actions}>
              <ActionButton
                label="Pick another"
                testID={testId.rollAgain}
                // the overlay is pointer-transparent and this button holds
                // focus, so a stray OK during the countdown would skip the
                // verdict before it was ever seen — the print finishes first
                disabled={thread > 0}
                onPress={onRollAgain}
                hasTVPreferredFocus
                ref={setPickNode}
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
                {/* the score already stands 44px amber in the meta line; the
                    foot is the catalog id's plate — one amber per screen */}
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
        // the arrival beat speaks too: the numeral carries the number, and
        // nothing hides the frame behind it from a reader that got here
        <View style={styles.leader} pointerEvents="none">
          <View style={styles.leaderRing} />
          <T style={styles.leaderNum} accessibilityLabel={`threading up, ${thread}`}>
            {thread}
          </T>
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
/** The score's star: one drawn mark, same weight as the ledger beside it. */
function Star() {
  return (
    <Svg width={s(22)} height={s(22)} viewBox="0 0 24 24">
      <Path
        d="M12 2.5l2.85 6.14 6.72.74-5 4.5 1.38 6.62L12 17.2l-5.95 3.3 1.38-6.62-5-4.5 6.72-.74z"
        fill={colors.sodium}
      />
    </Svg>
  );
}

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

  // the tape is also a ledger: it does not drop a filter silently. The tape is
  // mono, so a segment's rendered width is its character count — walk the
  // genre segments until the character budget runs out and count the rest,
  // rather than letting numberOfLines ellipsize facts away
  const countText = `${groupThousands(remaining)} left`;
  const genreCharW = s(24) * 0.7; // mono advance 0.6em + 0.08em tracking, padded
  const genreBudget =
    layout.contentWidth - s(22) * 2 - s(28) - countText.length * s(26) * 0.7;
  let spent = 0;
  let shownGenres = 0;
  let overflow = 0;
  for (const [genre] of genres) {
    const cost = (7 + genre.length) * genreCharW; // "  ·  ± name"
    if (spent + cost > genreBudget) {
      overflow = genres.length - shownGenres;
      break;
    }
    spent += cost;
    shownGenres += 1;
  }
  const genreSummary = genres
    .slice(0, shownGenres)
    .map(([genre, state]) => `${state === 'include' ? '+' : '−'} ${genre}`)
    .join('  ·  ');

  return (
    <Pressable
      testID={testId.receipt}
      accessibilityRole="button"
      accessibilityLabel={`Filters: ${parts.join(', ')}${genres.length ? `, ${genreSummary}` : ''}${
        overflow ? `, ${overflow} more` : ''
      }. ${remaining} left. Back to filters.`}
      onPress={onPress}
      nextFocusUp={focusUpTarget ?? undefined}
      style={({ focused }) => [styles.receipt, focused && styles.receiptFocused]}
    >
      {/* the tape states facts in two lines: what was asked (chalk), what it
          meant (amber include, cyan exclude) — dim is for the separators only,
          because dim on the tape's near-black was unreadable at three metres */}
      <View style={styles.receiptLines}>
        <T style={styles.receiptText} numberOfLines={1}>
          {parts.map((part, i) => (
            <T key={part}>
              {i > 0 ? <T style={styles.receiptSep}>{'  ·  '}</T> : null}
              <T style={styles.receiptFact}>{part}</T>
            </T>
          ))}
        </T>
        {genres.length > 0 && (
          <T style={styles.receiptText} numberOfLines={1}>
            {genres.slice(0, shownGenres).map(([genre, state]) => (
              <T key={genre} style={state === 'include' ? styles.inc : styles.exc}>
                {`  ·  ${state === 'include' ? '+' : '−'} ${genre}`}
              </T>
            ))}
            {overflow > 0 && <T style={styles.inc}>{`  ·  +${overflow} more`}</T>}
          </T>
        )}
      </View>
      <T style={styles.receiptLeft}>{countText}</T>
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
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: s(8) },
  score: monoBold(44, { color: colors.sodium }),
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
  // the flexible region between the tags and the pinned action row — its
  // measured height is the plot's whole-line budget
  plotSlot: { flex: 1, marginTop: s(26) },
  // the hidden oracle: full unclamped wrap of the plot at the slot's width —
  // top/left/right only, never bottom, so its height stays the content's own
  plotMeasure: { position: 'absolute', top: 0, left: 0, right: 0, opacity: 0 },
  plotHit: { alignSelf: 'flex-start' },
  plotFocused: { backgroundColor: 'rgba(255,176,46,0.17)', borderRadius: layout.radius },
  plot: { ...text.body, lineHeight: s(42), color: colors.dim },
  plotMore: { ...text.body, lineHeight: s(42), color: colors.sodium },
  plotTrim: { ...text.body, lineHeight: s(42), color: colors.dim },

  // no marginTop:auto here: the plot slot's flex:1 owns the slack, and an
  // auto margin would starve it back to zero height
  tail: {},
  rollNotice: { ...text.notice, paddingBottom: s(10) },
  actions: { flexDirection: 'row', gap: s(28), paddingBottom: s(20) },
  // three actions share the five columns; a fixed span would overflow at the third
  action: { flex: 1 },

  posterCol: { width: layout.span(2) },
  poster: {
    aspectRatio: 2 / 3,
    // a thin mat, not a frame: the one-sheet owns the panel, the slat only
    // binds its edge — a 32px mat letterboxed the art inside its own card
    padding: s(10),
    borderRadius: layout.radius,
    backgroundColor: colors.slat,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.slatHi,
    alignItems: 'center',
  },
  posterKind: mono(22, { em: 0.2, caps: true, color: colors.dim }),
  posterArt: { flex: 1, width: '100%', borderRadius: s(2), backgroundColor: colors.boardLo },
  posterFoot: {
    marginTop: 'auto',
    paddingTop: s(10),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.slatHi,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  posterId: mono(24, { color: colors.dim }),
  credit: mono(18, { em: 0.1, caps: true, color: colors.dim, marginTop: s(10), textAlign: 'center' }),

  // leader tape: one step above the unlit ground, amber ink for the count.
  // Two 24px lines (2 x 30 leading) sit inside the 76px strip, so the tape
  // never ellipsizes a filter away to stay one line
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
  receiptLines: { flexDirection: 'column', gap: s(2), flexShrink: 1 },
  receiptFocused: { borderColor: colors.sodium },
  receiptText: mono(24, { em: 0.08, caps: true, color: colors.dim, flexShrink: 1 }),
  receiptFact: { color: colors.chalk },
  receiptSep: { color: colors.dim },
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
