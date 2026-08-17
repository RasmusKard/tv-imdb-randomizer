import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { Filters, Genre, TitleKind } from '../api/types';
import { GENRES, KINDS, testId } from '../config/filters';
import { Chip, type ChipState } from '../components/Chip';
import { GridRow } from '../components/GridRow';
import { COLS, colors, fonts, layout, s, tracking } from '../theme';

type Props = {
  filters: Filters;
  setFilters: (f: Filters) => void;
};

export function Board({ filters, setFilters }: Props) {
  const toggleKind = (kind: TitleKind) => {
    const has = filters.kinds.includes(kind);
    // never let the last one go — an empty type filter matches nothing useful
    if (has && filters.kinds.length === 1) return;
    setFilters({
      ...filters,
      kinds: has ? filters.kinds.filter((k) => k !== kind) : [...filters.kinds, kind],
    });
  };

  /** off -> must have -> never show -> off */
  const cycleGenre = (genre: Genre) => {
    const next = { ...filters.genres };
    if (!next[genre]) next[genre] = 'include';
    else if (next[genre] === 'include') next[genre] = 'exclude';
    else delete next[genre];
    setFilters({ ...filters, genres: next });
  };

  const genreState = (genre: Genre): ChipState => {
    const state = filters.genres[genre];
    return state === 'include' ? 'on' : state === 'exclude' ? 'excluded' : 'off';
  };

  return (
    <View style={styles.root}>
      <ColumnRules />

      <View style={styles.safe}>
        <View style={styles.head}>
          <Text style={styles.wordmark}>
            what<Text style={styles.wordmarkDot}>.</Text>watch
          </Text>
          <Text style={styles.label}>476 818 titles in the corpus</Text>
        </View>

        <View style={styles.blocks}>
          <Block label="Type">
            <GridRow>
              {KINDS.map((k) => (
                <Chip
                  key={k.value}
                  name={k.name}
                  sub={k.sub}
                  state={filters.kinds.includes(k.value) ? 'on' : 'off'}
                  testID={testId.kind(k.value)}
                  accessibilityLabel={k.name}
                  onPress={() => toggleKind(k.value)}
                />
              ))}
            </GridRow>
          </Block>

          <Block label="Genres" aside="once = must have  ·  twice = never show">
            {[0, 1, 2].map((row) => (
              <GridRow key={row}>
                {GENRES.slice(row * COLS, row * COLS + COLS).map((genre) => {
                  const state = genreState(genre);
                  return (
                    <Chip
                      key={genre}
                      name={genre}
                      variant="genre"
                      state={state}
                      testID={testId.genre(genre)}
                      // the tri-state rides the label so a screen reader says it
                      // and agent-device can assert it
                      accessibilityLabel={
                        state === 'on'
                          ? `${genre}, must have`
                          : state === 'excluded'
                            ? `${genre}, never show`
                            : genre
                      }
                      onPress={() => cycleGenre(genre)}
                    />
                  );
                })}
              </GridRow>
            ))}
          </Block>
        </View>
      </View>
    </View>
  );
}

function Block({ label, aside, children }: { label: string; aside?: string; children: ReactNode }) {
  return (
    <View style={styles.block}>
      <View style={styles.blockHead}>
        <Text style={styles.label}>{label}</Text>
        {aside ? <Text style={styles.label}>{aside}</Text> : null}
      </View>
      {children}
    </View>
  );
}

/** The seven columns, drawn faintly, so the structure the D-pad follows is visible. */
function ColumnRules() {
  return (
    <View pointerEvents="none" style={styles.rules}>
      {Array.from({ length: COLS - 1 }, (_, i) => (
        <View
          key={i}
          style={[styles.rule, { left: (layout.cell + layout.gap) * (i + 1) - layout.gap / 2 }]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.board },
  safe: {
    flex: 1,
    paddingHorizontal: layout.overscan,
    paddingVertical: layout.overscan,
  },
  rules: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: layout.overscan,
    width: layout.contentWidth,
  },
  rule: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.035)',
  },

  head: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingBottom: s(12),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.slatHi,
  },
  wordmark: {
    fontFamily: fonts.display,
    fontSize: s(32),
    fontWeight: '800',
    letterSpacing: tracking(s(32), -0.03),
    color: colors.chalk,
  },
  wordmarkDot: { color: colors.sodium },

  blocks: { paddingTop: s(12), gap: s(12) },
  block: { gap: s(8) },
  blockHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    height: s(24),
  },
  label: {
    fontFamily: fonts.mono,
    fontSize: s(18),
    letterSpacing: tracking(s(18), 0.2),
    textTransform: 'uppercase',
    color: colors.dim,
  },
});
