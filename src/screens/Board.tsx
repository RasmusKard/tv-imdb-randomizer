import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { Candidates, Filters, Genre, TitleKind } from '../api/types';
import { estimate } from '../lib/estimate';
import { ActionButton } from '../components/ActionButton';
import { Flaps } from '../components/Flaps';
import { AXES, GENRES, KINDS, RANGE_KEYS, testId, type RangeKey } from '../config/filters';
import { Chip, type ChipState } from '../components/Chip';
import { GridRow } from '../components/GridRow';
import { RangeSlider } from '../components/RangeSlider';
import { COLS, colors, fonts, layout, s, tracking } from '../theme';

type Props = {
  filters: Filters;
  setFilters: (f: Filters) => void;
  /** Non-null once the candidate list has been fetched for these filters. */
  candidates: Candidates | null;
  /** Fired when Roll takes focus, not when it is pressed. */
  onPrefetch: () => void;
  onRoll: () => void;
};

export function Board({ filters, setFilters, candidates, onPrefetch, onRoll }: Props) {
  // Android's FocusFinder scores by centre distance, so a full-width slider is
  // unreachable from a left-hand chip however close it is. Every row that sits
  // next to a slider therefore names it explicitly. See GridRow.
  const [nodes, setNodes] = useState<Partial<Record<RangeKey | 'roll', View | null>>>({});
  const registerRoll = useCallback(
    (node: View | null) => setNodes((prev) => (prev.roll === node ? prev : { ...prev, roll: node })),
    [],
  );
  // built once: a fresh callback each render would make React detach and
  // reattach the slider's ref forever
  const registerSlider = useMemo(() => {
    const make = (key: RangeKey) => (node: View | null) =>
      setNodes((prev) => (prev[key] === node ? prev : { ...prev, [key]: node }));
    return Object.fromEntries(RANGE_KEYS.map((k) => [k, make(k)])) as Record<
      RangeKey,
      (node: View | null) => void
    >;
  }, []);

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
            <GridRow rowFocusDown={nodes.rating}>
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

          {RANGE_KEYS.map((key, i) => (
            <RangeBlock
              key={key}
              rangeKey={key}
              filters={filters}
              setFilters={setFilters}
              registerNode={registerSlider[key]}
              // the band row's neighbours: its own slider above, the next one below
              sliderAbove={nodes[key]}
              sliderBelow={nodes[RANGE_KEYS[i + 1]]}
            />
          ))}

          <Block label="Genres" aside="once = must have  ·  twice = never show">
            {[0, 1, 2].map((row) => (
              // only the first genre row borders a slider
              <GridRow
                key={row}
                rowFocusUp={row === 0 ? nodes.votes : undefined}
                // Roll spans columns 5-7, so its centre is far from column 1 and
                // geometry never finds it from the left of the last genre row
                rowFocusDown={row === 2 ? nodes.roll : undefined}
              >
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

        <Dock
          filters={filters}
          candidates={candidates}
          onPrefetch={onPrefetch}
          onRoll={onRoll}
          registerRoll={registerRoll}
        />
      </View>
    </View>
  );
}

/**
 * Counter, warning, Roll — on the same seven columns as everything above.
 *
 * Two tiers of number. While filtering, the free local estimate: dim, prefixed
 * with an approximately-equals, updated on every keypress, because a COUNT(*)
 * per keypress is not affordable. Once Roll takes focus the real query runs and
 * the exact count settles in — one request per "I'm done fiddling", and it makes
 * the roll itself instant.
 */
function Dock({
  filters,
  candidates,
  onPrefetch,
  onRoll,
  registerRoll,
}: {
  filters: Filters;
  candidates: Candidates | null;
  onPrefetch: () => void;
  onRoll: () => void;
  registerRoll: (node: View | null) => void;
}) {
  const guess = estimate(filters);
  const total = candidates ? candidates.total : guess;
  const exact = candidates !== null;
  const empty = exact && total === 0;

  return (
    <View style={styles.dock}>
      <View
        style={styles.counter}
        testID="dock-count"
        accessible
        accessibilityLabel={
          exact ? `${total} titles match` : `roughly ${total} titles`
        }
      >
        <Text style={styles.dockLabel}>{exact ? 'Titles match' : 'Roughly this many'}</Text>
        <Flaps value={total} exact={exact} />
      </View>
      <Text style={styles.warn} numberOfLines={2}>
        {empty ? 'Nothing in here — widen a range' : total < 40 ? 'Very thin' : ''}
      </Text>
      <ActionButton
        label="Roll"
        testID={testId.roll}
        ref={registerRoll}
        onFocus={onPrefetch}
        onPress={() => {
          if (!empty) onRoll();
        }}
        style={styles.roll}
      />
    </View>
  );
}

/**
 * A slider on its own row, then its seven band presets. The bands write both
 * ends of the slider — they are a shortcut into it, never a parallel control, so
 * there is one source of truth and no mode to fall out of sync.
 */
function RangeBlock({
  rangeKey,
  filters,
  setFilters,
  registerNode,
  sliderAbove,
  sliderBelow,
}: {
  rangeKey: RangeKey;
  filters: Filters;
  setFilters: (f: Filters) => void;
  registerNode: (node: View | null) => void;
  sliderAbove?: View | null;
  sliderBelow?: View | null;
}) {
  const axis = AXES[rangeKey];
  const value = filters[rangeKey];
  const [firstBand, setFirstBand] = useState<View | null>(null);

  return (
    <Block label={axis.label}>
      <RangeSlider
        axis={axis}
        value={value}
        onChange={(next) => setFilters({ ...filters, [rangeKey]: next })}
        testID={testId.slider(rangeKey)}
        nextFocusDown={firstBand}
        registerNode={registerNode}
      />
      <GridRow registerFirst={setFirstBand} rowFocusUp={sliderAbove} rowFocusDown={sliderBelow}>
        {axis.bands.map((band) => (
          <Chip
            key={band.name}
            name={band.name}
            sub={band.sub}
            state={value[0] === band.lo && value[1] === band.hi ? 'on' : 'off'}
            testID={testId.band(rangeKey, band.name)}
            accessibilityLabel={`${band.name}, ${band.sub}`}
            onPress={() => setFilters({ ...filters, [rangeKey]: [band.lo, band.hi] })}
          />
        ))}
      </GridRow>
    </Block>
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

  blocks: { paddingTop: s(10), gap: s(10) },
  block: { gap: s(6) },
  blockHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    height: s(20),
  },
  dock: {
    marginTop: 'auto',
    paddingTop: s(10),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.slatHi,
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.gap,
  },
  counter: { width: layout.span(3), gap: s(5) },
  dockLabel: {
    fontFamily: fonts.mono,
    fontSize: s(15),
    letterSpacing: tracking(s(15), 0.2),
    textTransform: 'uppercase',
    color: colors.dim,
  },
  warn: {
    width: layout.span(1),
    fontFamily: fonts.mono,
    fontSize: s(16),
    letterSpacing: tracking(s(16), 0.1),
    textTransform: 'uppercase',
    color: colors.cold,
  },
  roll: { width: layout.span(3) },
  label: {
    fontFamily: fonts.mono,
    fontSize: s(18),
    letterSpacing: tracking(s(18), 0.2),
    textTransform: 'uppercase',
    color: colors.dim,
  },
});
