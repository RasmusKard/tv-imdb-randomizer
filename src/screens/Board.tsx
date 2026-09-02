import { useCallback, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Filters, Genre, TitleKind } from '../api/types';
import { ActionButton } from '../components/ActionButton';
import { Flaps } from '../components/Flaps';
import { AXES, GENRES, KINDS, testId, type RangeKey } from '../config/filters';
import { Chip, type ChipState } from '../components/Chip';
import { GridRow } from '../components/GridRow';
import { RangeSlider, type Editing } from '../components/RangeSlider';
import { COLS, colors, displayHeavy, layout, mono, s, screen } from '../theme';

type Props = {
  filters: Filters;
  setFilters: (f: Filters) => void;
  /** Exact match count for the current filters, null until the debounced count lands. */
  count: number | null;
  /** True while a roll's batch fetch is in flight, so the button can say so. */
  picking: boolean;
  /** True while a newer count is in flight. */
  pending: boolean;
  /** The corpus total, unfiltered. Null until fetched once at mount. */
  corpus: number | null;
  notice: string | null;
  onRoll: () => void;
  /** True when arriving back from a verdict, so the pick button takes focus on mount. */
  focusRoll?: boolean;
  /** The head-right chip: the account when signed in, sign-in when not. */
  accountLabel: string;
  onOpenAccount: () => void;
  /** An update was found; the banner is a pointer, the card lives on the account screen. */
  updateAvailable: boolean;
  onOpenUpdate: () => void;
};

export function Board({ filters, setFilters, count, picking, pending, corpus, notice, onRoll, focusRoll, accountLabel, onOpenAccount, updateAvailable, onOpenUpdate }: Props) {
  // Android's FocusFinder scores by centre distance, so a full-width slider is
  // unreachable from a left-hand chip however close it is. Every row that sits
  // next to a slider therefore names it explicitly. See GridRow.
  //
  // Plain useState per node: its setter is already referentially stable, so it
  // can be handed straight to a ref without the callback changing identity every
  // render and making React detach and reattach forever.
  const [ratingNode, setRatingNode] = useState<View | null>(null);
  const [yearNode, setYearNode] = useState<View | null>(null);
  const [votesNode, setVotesNode] = useState<View | null>(null);
  const [rollNode, setRollNode] = useState<View | null>(null);

  // At most one slider is armed at a time, tracked here rather than inside
  // each RangeSlider: a bare touch or a pointer-mode IR remote can activate a
  // different control directly, bypassing the D-pad focus trap that would
  // otherwise stop it, so whichever control fires next needs one shared place
  // to close out the slider that thought it still had the keys.
  const [activeRange, setActiveRange] = useState<RangeKey | null>(null);
  const [activeSide, setActiveSide] = useState<Editing>(null);
  const closeEdit = useCallback(() => {
    setActiveRange(null);
    setActiveSide(null);
  }, []);
  const handleEditingChange = useCallback((key: RangeKey, side: Editing) => {
    setActiveRange(side === null ? null : key);
    setActiveSide(side);
    if (side !== null) setFocusedKey(testId.slider(key));
  }, []);

  // A touch or a pointer-mode IR remote can activate any control directly by
  // coordinate without Android ever moving its own view focus there — so a
  // D-pad press right after would still act on wherever focus was before the
  // tap. `Pressable.focus()` looks like the fix but is wired to a native
  // command gated behind `enableImperativeFocus`, off by default and not
  // enabled here, so it silently no-ops. `hasTVPreferredFocus` genuinely
  // calls `requestFocus` on a false -> true transition (see
  // ReactViewManager.kt), so whichever key was pressed last really does
  // become the one true focus follows — same mechanism this board already
  // used for the pick button on returning from a verdict.
  const [focusedKey, setFocusedKey] = useState<string | null>(null);

  const toggleKind = (kind: TitleKind) => {
    const has = filters.kinds.includes(kind);
    // never let the last one go — an empty type filter matches nothing useful
    if (has && filters.kinds.length === 1) return;
    closeEdit();
    setFocusedKey(testId.kind(kind));
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
    closeEdit();
    setFocusedKey(testId.genre(genre));
    setFilters({ ...filters, genres: next });
  };

  const genreState = (genre: Genre): ChipState => {
    const state = filters.genres[genre];
    return state === 'include' ? 'on' : state === 'exclude' ? 'excluded' : 'off';
  };

  // the counter answers the same question everywhere: how many picks remain
  // for these filters, and is that number the settled truth
  const total = count ?? 0;
  const settled = count !== null && !pending;

  return (
    <View style={screen.root}>
      <View style={screen.safe}>
        <View style={styles.head}>
          <Text style={styles.wordmark}>
            what<Text style={styles.wordmarkDot}>.</Text>watch
          </Text>
          <View style={styles.headRight}>
            {/* the counter lives in the corner: it is feedback, not a control,
                and the dock belongs to the action and its warnings. The corpus
                rides beside it, small and quiet — context for those looking
                for it, invisible to those who are not */}
            <View style={styles.counter} testID="dock-count" accessible accessibilityLabel={`${total} titles left`}>
              <Text style={styles.dockLabel}>Titles left:</Text>
              <Flaps value={total} settled={settled} />
              {corpus !== null && (
                <Text style={styles.corpusNote}>(out of {groupThousands(corpus)})</Text>
              )}
            </View>
            {updateAvailable && (
              <Pressable
                testID="board-update"
                accessibilityRole="button"
                accessibilityLabel="Update available"
                onPress={onOpenUpdate}
                style={({ focused }) => [styles.accountChip, styles.updateChip, focused && styles.accountChipFocused]}
              >
                <Text style={styles.updateLabel}>● update ready</Text>
              </Pressable>
            )}
            <Pressable
              testID="board-account"
              accessibilityRole="button"
              accessibilityLabel="Account"
              onPress={onOpenAccount}
              style={({ focused }) => [styles.accountChip, focused && styles.accountChipFocused]}
            >
              <Text style={[styles.accountLabel, !!accountLabel && styles.accountLabelOn]}>● {accountLabel}</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.blocks}>
          <Block label="Type">
            <GridRow rowFocusDown={ratingNode}>
              {KINDS.map((k) => (
                <Chip
                  key={k.value}
                  name={k.name}
                  sub={k.sub}
                  state={filters.kinds.includes(k.value) ? 'on' : 'off'}
                  testID={testId.kind(k.value)}
                  accessibilityLabel={k.name}
                  onPress={() => toggleKind(k.value)}
                  hasTVPreferredFocus={focusedKey === testId.kind(k.value)}
                />
              ))}
            </GridRow>
          </Block>

          {/* three ranges, named rather than mapped, so each can point at the next */}
          <RangeBlock
            rangeKey="rating"
            filters={filters}
            setFilters={setFilters}
            closeEdit={closeEdit}
            editing={activeRange === 'rating' ? activeSide : null}
            onEditingChange={(side) => handleEditingChange('rating', side)}
            focusedKey={focusedKey}
            setFocusedKey={setFocusedKey}
            registerNode={setRatingNode}
            sliderNode={ratingNode}
            sliderBelow={yearNode}
          />
          <RangeBlock
            rangeKey="year"
            filters={filters}
            setFilters={setFilters}
            closeEdit={closeEdit}
            editing={activeRange === 'year' ? activeSide : null}
            onEditingChange={(side) => handleEditingChange('year', side)}
            focusedKey={focusedKey}
            setFocusedKey={setFocusedKey}
            registerNode={setYearNode}
            sliderNode={yearNode}
            sliderBelow={votesNode}
          />
          <RangeBlock
            rangeKey="votes"
            filters={filters}
            setFilters={setFilters}
            closeEdit={closeEdit}
            editing={activeRange === 'votes' ? activeSide : null}
            onEditingChange={(side) => handleEditingChange('votes', side)}
            focusedKey={focusedKey}
            setFocusedKey={setFocusedKey}
            registerNode={setVotesNode}
            sliderNode={votesNode}
            sliderBelow={null}
          />

          <Block label="Genres" aside="once = include  ·  twice = never show">
            {[0, 1, 2].map((row) => (
              <GridRow
                key={row}
                // the pick button spans columns 5-7, so its centre is far from column 1 and
                // geometry never finds it from the left of the last genre row
                rowFocusDown={row === 2 ? rollNode : undefined}
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
                      // and agent-device can assert it. "included", not "must
                      // have": several included genres match ANY of them (the
                      // API's `ov.` is an overlap), so the stronger wording lied
                      accessibilityLabel={
                        state === 'on'
                          ? `${genre}, included`
                          : state === 'excluded'
                            ? `${genre}, never show`
                            : genre
                      }
                      onPress={() => cycleGenre(genre)}
                      hasTVPreferredFocus={focusedKey === testId.genre(genre)}
                    />
                  );
                })}
              </GridRow>
            ))}
          </Block>
        </View>

        <Dock
          count={count}
          pending={pending}
          picking={picking}
          notice={notice}
          onRoll={() => {
            closeEdit();
            setFocusedKey(testId.roll);
            onRoll();
          }}
          registerRoll={setRollNode}
        />
      </View>
    </View>
  );
}

/**
 * Counter, warning, pick — on the same seven columns as everything above.
 *
 * The number is the exact match count, fetched on a debounce after the last
 * filter change — 8-47ms server-side, cheap enough to run per "I'm done
 * fiddling" rather than guessed at. `pending` is true while a newer count is in
 * flight, and the dim `≈` mode covers exactly that gap.
 */
function Dock({
  count,
  pending,
  picking,
  notice,
  onRoll,
  registerRoll,
}: {
  count: number | null;
  pending: boolean;
  picking: boolean;
  notice: string | null;
  onRoll: () => void;
  registerRoll: (node: View | null) => void;
}) {
  const total = count ?? 0;
  const settled = count !== null && !pending;
  // disable only on a *settled* zero: a stale count from before a filter change
  // must not grey the button out for the pending gap and back
  const empty = settled && count === 0;

  return (
    <View style={styles.dock}>
      <Text style={styles.warn} numberOfLines={2}>
        {notice ? notice : empty ? 'Nothing in here — widen a range' : total < 40 ? 'Very thin' : ''}
      </Text>
      <ActionButton
        label={picking ? 'Picking…' : "Pick tonight's show"}
        disabled={empty}
        testID={testId.roll}
        ref={registerRoll}
        // the board owns an anchor on mount: with no view focused, arrows go
        // nowhere — and the pick button is one press from everything
        hasTVPreferredFocus
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
  closeEdit,
  editing,
  onEditingChange,
  focusedKey,
  setFocusedKey,
  registerNode,
  sliderNode,
  sliderBelow,
}: {
  rangeKey: RangeKey;
  filters: Filters;
  setFilters: (f: Filters) => void;
  /** Closes whichever slider (if any) is currently armed, board-wide. */
  closeEdit: () => void;
  editing: Editing;
  onEditingChange: (editing: Editing) => void;
  /** The most recently pressed control board-wide, by testID. */
  focusedKey: string | null;
  setFocusedKey: (key: string) => void;
  registerNode: (node: View | null) => void;
  /** This block's own slider, which its band row points back up at. */
  sliderNode: View | null;
  /** The next range's slider, which its band row points down at. */
  sliderBelow: View | null;
}) {
  const axis = AXES[rangeKey];
  const value = filters[rangeKey];
  const [firstBand, setFirstBand] = useState<View | null>(null);

  // While a slider is mid-edit, values are changing every notch — highlighting
  // a band the moment its exact numbers are passed through would flash on and
  // off as the handle keeps moving. Freeze the band row's own copy of the
  // value for the duration and only let it catch up once editing exits, so a
  // band lights up for landing on it, not for passing through it.
  const isEditing = editing !== null;
  // While a slider is mid-edit, values are changing every notch — highlighting
  // a band the moment its exact numbers are passed through would flash on and
  // off as the handle keeps moving. Freeze the band row's own copy of the
  // value for the duration and only let it catch up once editing exits, so a
  // band lights up for landing on it, not for passing through it.
  const frozen = useRef(value);
  if (!isEditing) frozen.current = value;
  const bandValue = isEditing ? frozen.current : value;

  // the OK-walk is the one convention nothing on screen teaches; borrow the
  // genres aside slot to say it, but only while this slider is armed — once
  // the sequence is known the hint is noise
  const hint = isEditing ? 'ok: lower · upper · done — arrows adjust' : undefined;

  return (
    <Block label={axis.label} aside={hint}>
      <RangeSlider
        axis={axis}
        value={value}
        onChange={(next) => setFilters({ ...filters, [rangeKey]: next })}
        testID={testId.slider(rangeKey)}
        nextFocusDown={firstBand}
        registerNode={registerNode}
        selfNode={sliderNode}
        editing={editing}
        onEditingChange={onEditingChange}
        hasTVPreferredFocus={focusedKey === testId.slider(rangeKey)}
      />
      <GridRow registerFirst={setFirstBand} rowFocusUp={sliderNode} rowFocusDown={sliderBelow}>
        {axis.bands.map((band) => (
          <Chip
            key={band.name}
            name={band.name}
            sub={band.sub}
            state={bandValue[0] === band.lo && bandValue[1] === band.hi ? 'on' : 'off'}
            testID={testId.band(rangeKey, band.name)}
            accessibilityLabel={`${band.name}, ${band.sub}`}
            onPress={() => {
              closeEdit();
              setFocusedKey(testId.band(rangeKey, band.name));
              setFilters({ ...filters, [rangeKey]: [band.lo, band.hi] });
            }}
            hasTVPreferredFocus={focusedKey === testId.band(rangeKey, band.name)}
          />
        ))}
      </GridRow>
    </Block>
  );
}

const groupThousands = (n: number) => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

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

const styles = StyleSheet.create({
  head: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingBottom: s(8),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.slatHi,
  },
  wordmark: displayHeavy(32, { em: -0.03, color: colors.chalk }),
  wordmarkDot: { color: colors.sodium },

  headRight: { flexDirection: 'row', alignItems: 'center', gap: s(20) },
  accountChip: {
    borderWidth: layout.border,
    borderColor: colors.slatHi,
    borderRadius: layout.radius,
    paddingVertical: s(8),
    paddingHorizontal: s(16),
  },
  accountChipFocused: { borderColor: colors.sodium, backgroundColor: colors.slat },
  accountLabel: mono(24, { em: 0.15, caps: true, color: colors.dim }),
  accountLabelOn: { color: colors.sodium },
  updateChip: { borderColor: colors.sodium },
  updateLabel: mono(24, { em: 0.15, caps: true, color: colors.sodium }),

  blocks: { paddingTop: s(4), gap: s(6) },
  block: { gap: s(4) },
  blockHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    height: s(30),
  },
  dock: {
    marginTop: 'auto',
    paddingTop: s(6),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.slatHi,
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.gap,
  },
  counter: { flexDirection: 'row', alignItems: 'center', gap: s(8) },
  dockLabel: mono(24, { em: 0.2, caps: true, color: colors.dim }),
  corpusNote: mono(18, { em: 0.08, caps: true, color: colors.dim }),
  warn: mono(24, { em: 0.1, caps: true, color: colors.cold, width: layout.span(4) }),
  roll: { width: layout.span(3) },
  label: mono(24, { em: 0.2, caps: true, color: colors.dim }),
});
