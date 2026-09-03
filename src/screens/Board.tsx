import { useCallback, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { Filters, Genre, TitleKind } from '../api/types';
import { ActionButton } from '../components/ActionButton';
import { T } from '../components/T';
import { AXES, GENRES, KINDS, testId, type RangeKey } from '../config/filters';
import { Chip, type ChipState } from '../components/Chip';
import { GridRow } from '../components/GridRow';
import { RangeSlider, type Editing } from '../components/RangeSlider';
import { COLS, colors, displayHeavy, layout, mono, s, screen, text } from '../theme';
import { UpdateCard } from '../components/UpdateCard';
import type { UpdateInfo } from '../update/compare';
import { checkForUpdate } from '../update/checker';

type Props = {
  filters: Filters;
  setFilters: (f: Filters) => void;
  /** Exact match count for the current filters — drives the pick's zero-state. */
  count: number | null;
  /** True while a roll's batch fetch is in flight, so the button can say so. */
  picking: boolean;
  /** True while a newer count is in flight. */
  pending: boolean;
  onRoll: () => void;
  /** True when arriving back from a verdict, so the pick button takes focus on mount. */
  focusRoll?: boolean;
  onOpenAccount: () => void;
  /** An update the app has found; the header lamp says so, the card below the board installs it. */
  update: UpdateInfo | null;
  /** Runs the manual check: finds (or fails) and sets the notice line. */
  onCheckUpdates: () => Promise<void>;
  /** True while the manual check is in flight, so the chip can say so. */
  checking: boolean;
  /** The board's one notice line — the update check answers here. */
  notice: string | null;
  /** Back to the default filters. Never touches the session's shown list. */
  onReset: () => void;
  onOpenPresets: () => void;
};

export function Board({ filters, setFilters, count, picking, pending, onRoll, focusRoll, onOpenAccount, update, onCheckUpdates, checking, notice, onReset, onOpenPresets }: Props) {
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
  // the Type row's first cell: up from the rating slider lands on column 1, so
  // down-then-up returns to the same chip instead of geometry's centre guess
  const [typeFirst, setTypeFirst] = useState<View | null>(null);

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
  // for these filters — the pick's zero-state asks it here, the verdict's
  // receipt answers it in digits

  return (
    <View style={screen.root}>
      {/* the frame the screen is — same grammar as the verdict, full-bleed
          film holes top and bottom, pointer-transparent, no layout shift */}
      <Sprockets top />
      <Sprockets />
      <View style={screen.safe}>
        <View style={styles.head}>
          <T style={styles.wordmark}>
            what<T style={styles.wordmarkDot}>.</T>watch
          </T>
          <View style={styles.headRight}>
            {/* the counter answers the pick, so it lives in the dock beside it
                (and directly above the gate bar); reset is a utility, not a
                warning — it rides the header with the other doors */}
            <Pressable
              testID={testId.reset}
              accessibilityRole="button"
              accessibilityLabel="Reset filters"
              onPress={onReset}
              nextFocusDown={typeFirst}
              style={({ focused }) => [styles.accountChip, focused && styles.accountChipFocused]}
            >
              {({ focused }) => (
                <T style={[styles.accountName, focused && styles.accountNameFocused]}>reset filters</T>
              )}
            </Pressable>
            {update && (
              // the lamp, not a door: pressing would go nowhere the card below
              // is not already — it says the card is worth reading
              <View style={[styles.accountChip, styles.updateChip]} accessibilityLabel="Update available">
                <View style={styles.updateDot} />
                <T style={styles.updateLabel}>update ready</T>
              </View>
            )}
            {/* the presets door: same chip grammar as the import door beside
                it — the board itself gains nothing else */}
            <Pressable
              testID={testId.presets}
              accessibilityRole="button"
              accessibilityLabel="Your presets — keep this board, load a saved one"
              onPress={onOpenPresets}
              nextFocusDown={typeFirst}
              style={({ focused }) => [styles.accountChip, focused && styles.accountChipFocused]}
            >
              {({ focused }) => (
                <T style={[styles.accountName, focused && styles.accountNameFocused]}>your presets</T>
              )}
            </Pressable>
            {/* the way into the list. It is a control, not a status light: the
                device name is metadata and lives on the list screen — the chip
                speaks the board's own chip grammar (raised slat, two lines,
                ring + lift on focus) and says what is behind the door. */}
            <Pressable
              testID="board-account"
              accessibilityRole="button"
              accessibilityLabel="Your list — import your IMDb titles"
              onPress={onOpenAccount}
              nextFocusDown={typeFirst}
              style={({ focused }) => [styles.accountChip, focused && styles.accountChipFocused]}
            >
              {({ focused }) => (
                <>
                  <T style={[styles.accountName, focused && styles.accountNameFocused]}>Import from IMDb</T>
                </>
              )}
            </Pressable>
            {/* the manual check lives here now: its answer is the notice line
                below and, when one is found, the install card above the dock */}
            <Pressable
              testID="board-check-updates"
              accessibilityRole="button"
              accessibilityLabel={checking ? 'Checking for updates' : 'Check for updates'}
              onPress={onCheckUpdates}
              nextFocusDown={typeFirst}
              style={({ focused }) => [styles.accountChip, focused && styles.accountChipFocused]}
            >
              {({ focused }) => (
                <T style={[styles.accountName, focused && styles.accountNameFocused]}>
                  {checking ? 'checking…' : 'check for updates'}
                </T>
              )}
            </Pressable>
          </View>
        </View>

        <View style={styles.blocks}>
          <Block label="Type">
            <GridRow rowFocusDown={ratingNode} registerFirst={setTypeFirst}>
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
            sliderAbove={typeFirst}
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

          <Block label="Genres" aside="once = include  ·  twice = never show" quiet>
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

        {/* the update, offered where the rest of the app lives — no detour to
            another screen for the one action that changes the app itself */}
        {update && (
          <View style={styles.updateRow}>
            <UpdateCard info={update} testID="board-update-card" />
          </View>
        )}
        {/* the board's one notice line: the update check answers here, and so
            do the errors a roll can raise (previously silent on this screen) */}
        {notice ? (
          <T style={styles.boardNotice} numberOfLines={1} testID="board-notice">
            {notice}
          </T>
        ) : null}

        <Dock
          count={count}
          pending={pending}
          picking={picking}
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
 * The pick, alone on the board's last row — the one gate. The count it rides
 * on is invisible here: a settled zero is the bar's own disabled state, and
 * the number itself is the verdict receipt's fact to state.
 */
function Dock({
  count,
  pending,
  picking,
  onRoll,
  registerRoll,
}: {
  count: number | null;
  pending: boolean;
  picking: boolean;
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

/** A strip of film holes, top and bottom — the verdict's own frame grammar. */
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
  sliderAbove,
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
  /** The first cell of the row above the slider (the Type chips), so up from
   *  the slider is a straight hop, not a centre-distance guess. */
  sliderAbove?: View | null;
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
        nextFocusUp={sliderAbove}
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

function Block({ label, aside, quiet, children }: { label: string; aside?: string; /** the genres wall is fine-tuning, not an entry point: its head sits one step quieter, alpha of the same ink rather than a second grey */ quiet?: boolean; children: ReactNode }) {
  return (
    <View style={styles.block}>
      <View style={styles.blockHead}>
        <T style={[styles.label, quiet && styles.labelQuiet]}>{label}</T>
        {aside ? <T style={[styles.label, quiet && styles.labelQuiet]}>{aside}</T> : null}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
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
    zIndex: 4,
  },
  sprocketTop: { top: 0 },
  sprocketBottom: { bottom: 0 },
  sprocket: { width: s(18), height: s(13), borderRadius: s(3), backgroundColor: colors.boardLo },

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

  headRight: { flexDirection: 'row', alignItems: 'center', gap: s(28) },
  // the account door borrows the Chip's exact grammar — raised slat, two lines,
  // focus as ring + lift + brighten — so it reads as one of the board's controls
  accountChip: {
    flexDirection: 'row',
    height: s(54),
    alignItems: 'center',
    justifyContent: 'center',
    gap: s(10),
    paddingHorizontal: s(16),
    backgroundColor: colors.slat,
    borderRadius: layout.radius,
    borderWidth: layout.border,
    borderColor: 'transparent',
  },
  accountChipFocused: {
    borderColor: colors.sodium,
    transform: [{ scale: 1.05 }],
    elevation: 12,
    zIndex: 3,
  },
  accountName: mono(22, { em: 0.02, color: colors.dim }),
  accountNameFocused: { color: colors.chalk },
  updateChip: { borderColor: colors.sodium },
  // the lamp as a drawn dot, not a typed bullet: glyphs never do icon duty
  updateDot: {
    width: s(10),
    height: s(10),
    borderRadius: s(5),
    backgroundColor: colors.sodium,
  },
  updateLabel: mono(24, { em: 0.2, caps: true, color: colors.sodium }),

  // the cadence: s(4) inside a block, s(14) between blocks — grouping is the
  // gap contrast, not containers; a slider and its bands are one group
  blocks: { paddingTop: s(2), gap: s(14) },
  block: { gap: s(4) },
  blockHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    // 2px under the label's own line box: the mono leading absorbs it, and
    // the chip rows below need the height more than the head does
    height: s(28),
  },
  dock: {
    marginTop: 'auto',
    paddingTop: s(2),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.slatHi,
  },
  updateRow: { paddingTop: s(14) },
  boardNotice: { ...text.notice, paddingTop: s(10) },
  roll: { width: layout.contentWidth },
  label: text.label,
  // large-text 3:1 holds at this alpha on the board ground — checked, not guessed
  labelQuiet: { opacity: 0.75 },
});
