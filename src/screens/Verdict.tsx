import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import type { Filters, GenreState, Title } from '../api/types';
import { kindOf } from '../api/client';
import { AXES, RANGE_KEYS, testId } from '../config/filters';
import { isWholeAxis } from '../lib/range';
import { ActionButton } from '../components/ActionButton';
import { colors, display, layout, mono, s, screen } from '../theme';

type Props = {
  title: Title;
  filters: Filters;
  /** How many titles are still unseen for these filters. */
  remaining: number;
  onRollAgain: () => void;
  onBack: () => void;
};

/**
 * One answer, and the way back.
 *
 * Encore is pre-focused so the lazy path is a single button, pressed
 * repeatedly. The receipt strip along the bottom keeps the filters present
 * without putting them back on screen, and doubles as the way back to the board.
 */
export function Verdict({ title, filters, remaining, onRollAgain, onBack }: Props) {
  const isSeries = kindOf(title.titleType) === 'series';
  const kindLabel = isSeries ? 'Series' : 'Movie';

  const meta = [
    String(title.startYear),
    kindLabel,
    title.runtimeMinutes == null
      ? null
      : `${title.runtimeMinutes} min${isSeries ? ' / ep' : ''}`,
    `${AXES.votes.fmt(title.numVotes)} votes`,
  ].filter((m): m is string => m !== null);

  return (
    <View style={[screen.root, screen.safe]}>
      <View style={styles.grid}>
        <View style={styles.main}>
          <View style={styles.metaLine}>
            <Text style={styles.score}>
              {title.averageRating.toFixed(1)}
              <Text style={styles.star}> ★</Text>
            </Text>
            {meta.flatMap((m) => [
              <View key={`${m}-tick`} style={styles.tick} />,
              <Text key={m} style={styles.metaText}>
                {m}
              </Text>,
            ])}
          </View>

          <Text
            testID="verdict-title"
            style={[styles.title, title.primaryTitle.length > 18 && styles.titleLong]}
            numberOfLines={2}
          >
            {title.primaryTitle}
          </Text>

          <View style={styles.tags}>
            {title.genres.map((g) => (
              <Text key={g} style={styles.tag}>
                {g}
              </Text>
            ))}
          </View>

          {title.plot ? (
            <Text style={styles.plot} numberOfLines={3}>
              {title.plot}
            </Text>
          ) : null}

          <View style={styles.actions}>
            <ActionButton
              label="Encore"
              testID={testId.rollAgain}
              onPress={onRollAgain}
              hasTVPreferredFocus
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
          </View>
        </View>

        {/* Stands in for the TMDB backdrop, which has nothing to load yet. */}
        <View style={styles.poster}>
          <Text style={styles.posterKind}>{kindLabel}</Text>
          <Text style={styles.posterTitle} numberOfLines={4}>
            {title.primaryTitle}
          </Text>
          <View style={styles.posterFoot}>
            <Text style={styles.posterScore}>{title.averageRating.toFixed(1)} ★</Text>
            <Text style={styles.posterId}>{title.tconst}</Text>
          </View>
        </View>
      </View>

      <Receipt filters={filters} remaining={remaining} onPress={onBack} />
    </View>
  );
}

/**
 * The active filters, and the way back. Spans all seven columns.
 *
 * Include and exclude keep their colours from the board — amber and cyan — so
 * the strip reads as the same information, not a restatement of it.
 */
function Receipt({
  filters,
  remaining,
  onPress,
}: {
  filters: Filters;
  remaining: number;
  onPress: () => void;
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
      style={({ focused }) => [styles.receipt, focused && styles.receiptFocused]}
    >
      <Text style={styles.receiptText} numberOfLines={1}>
        {parts.join('  ·  ')}
        {genres.map(([genre, state]) => (
          <Text key={genre} style={state === 'include' ? styles.inc : styles.exc}>
            {`  ·  ${state === 'include' ? '+' : '−'} ${genre}`}
          </Text>
        ))}
      </Text>
      <Text style={styles.receiptLeft}>{`${remaining} left`}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  grid: { flex: 1, flexDirection: 'row', gap: layout.gap },
  main: { width: layout.span(5) },

  metaLine: { flexDirection: 'row', alignItems: 'center', gap: s(20) },
  tick: { width: StyleSheet.hairlineWidth, height: s(28), backgroundColor: colors.slatHi },
  score: mono(42, { fontWeight: '700', color: colors.sodium }),
  star: { fontSize: s(22) },
  metaText: mono(24, { em: 0.2, caps: true, color: colors.dim }),

  title: display(94, {
    em: -0.035,
    caps: true,
    fontWeight: '800',
    color: colors.chalk,
    marginTop: s(14),
  }),
  titleLong: display(68, { em: -0.03 }),

  tags: { flexDirection: 'row', gap: s(10), marginTop: s(22) },
  tag: mono(24, {
    em: 0.16,
    caps: true,
    color: colors.chalk,
    backgroundColor: colors.slat,
    paddingHorizontal: s(14),
    paddingVertical: s(8),
    borderRadius: s(2),
    overflow: 'hidden',
  }),
  plot: display(32, {
    lineHeight: s(46),
    color: colors.dim,
    marginTop: s(26),
    maxWidth: layout.span(4),
  }),

  actions: { marginTop: 'auto', flexDirection: 'row', gap: layout.gap, paddingBottom: s(20) },
  action: { width: layout.span(2) },

  poster: {
    width: layout.span(2),
    aspectRatio: 2 / 3,
    padding: s(32),
    borderRadius: layout.radius,
    backgroundColor: colors.slat,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.slatHi,
  },
  posterKind: mono(24, { em: 0.24, caps: true, color: colors.dim }),
  posterTitle: display(54, {
    em: -0.03,
    caps: true,
    fontWeight: '800',
    color: colors.chalk,
    marginTop: 'auto',
  }),
  posterFoot: {
    marginTop: s(22),
    paddingTop: s(16),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.slatHi,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  posterScore: mono(24, { color: colors.sodium }),
  posterId: mono(24, { color: colors.dim }),

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
    backgroundColor: colors.boardLo,
  },
  receiptFocused: { borderColor: colors.sodium },
  receiptText: mono(24, { em: 0.08, caps: true, color: colors.chalk, flexShrink: 1 }),
  inc: { color: colors.sodium },
  exc: { color: colors.cold },
  receiptLeft: mono(26, { em: 0.08, caps: true, color: colors.sodium }),
});
