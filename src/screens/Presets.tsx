import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, BackHandler, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import type { Filters } from '../api/types';
import { AXES, RANGE_KEYS, testId } from '../config/filters';
import { isWholeAxis } from '../lib/range';
import { autoName, loadPresets, newPresetId, savePresets, type Preset } from '../lib/presets';
import { ActionButton } from '../components/ActionButton';
import { T } from '../components/T';
import { colors, displayHeavy, layout, mono, monoBold, s, screen, text } from '../theme';

type Props = {
  /** The board as it stands right now — what "keep this board" saves and
   *  "replace" writes over an existing preset with. */
  filters: Filters;
  onLoad: (filters: Filters) => void;
  onBack: () => void;
};

/**
 * Saved boards. The list is the device's own memory of the boards this person
 * re-tunes: save the current one, load any of them back, replace a preset's
 * filters while keeping its name, rename, delete. Loading never touches the
 * session's shown list — never-repeat outranks everything.
 *
 * The summary line shares the receipt's exactness contract: a character budget
 * at the card's width, every cut stated as an amber "+N more", never an
 * ellipsis. The mono face makes the budget arithmetic, not a guess.
 */
export function Presets({ filters, onLoad, onBack }: Props) {
  // the keep row is full-width, so FocusFinder scores its DOWN by centre
  // distance and would land on Replace — a destructive overwrite one bounce
  // away. The board's own cure applies: name the landing.
  const [firstCard, setFirstCard] = useState<View | null>(null);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  /** The preset whose name is being edited; the input replaces its name line. */
  const [renaming, setRenaming] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    loadPresets().then(setPresets).catch(() => setPresets([]));
  }, []);

  // notices retire themselves, like the board's reset note, and speak: every
  // state is spoken, including this screen's
  useEffect(() => {
    if (notice) AccessibilityInfo.announceForAccessibility(notice);
    if (!notice) return;
    // the undo rides the notice: when the note retires, the affordance goes
    // with it — an invisible pressable below the dock is a ghost button
    const t = setTimeout(() => {
      setNotice(null);
      setDeleted(null);
      setReplaced(null);
    }, 4000);
    return () => clearTimeout(t);
  }, [notice]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      // back closes the field; the name applied as typed (see onChangeText),
      // so there is no draft to cancel — nothing a rename opened can be lost
      if (renaming) {
        setRenaming(null);
        return true;
      }
      onBack();
      return true;
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renaming, draft, onBack]);

  const persist = useCallback((next: Preset[]) => {
    setPresets(next);
    savePresets(next).catch(() => setNotice('preset not saved — try again'));
  }, []);

  const keep = () => {
    // a bounced OK must not stack the same board twice; the newest is the
    // likeliest repeat, so that is the only one checked
    if (presets[0] && JSON.stringify(presets[0].filters) === JSON.stringify(filters)) {
      setNotice('this board is already kept — it is at the top');
      return;
    }
    persist([{ id: newPresetId(), name: autoName(filters), filters }, ...presets]);
    setNotice('kept — rename it if this board earns a name');
  };

  // replace overwrites a preset's filters as dead as delete removes the row;
  // it earns the same four-second way back, not less protection because the
  // name survived
  const [replaced, setReplaced] = useState<{ id: string; filters: Filters } | null>(null);
  const replace = (preset: Preset) => {
    setReplaced({ id: preset.id, filters: preset.filters });
    persist(presets.map((p) => (p.id === preset.id ? { ...p, filters } : p)));
    setNotice(`replaced “${preset.name}” — undo`);
  };
  const undoReplace = () => {
    if (!replaced) return;
    persist(presets.map((p) => (p.id === replaced.id ? { ...p, filters: replaced.filters } : p)));
    setReplaced(null);
    setNotice(null);
  };

  // delete answers with an undo, not a confirm: a TV confirm dialog is a
  // third button between a person and the thing they pressed
  const [deleted, setDeleted] = useState<{ preset: Preset; index: number } | null>(null);
  const remove = (preset: Preset) => {
    const index = presets.findIndex((p) => p.id === preset.id);
    persist(presets.filter((p) => p.id !== preset.id));
    setDeleted({ preset, index });
    setNotice('preset deleted — undo');
  };
  const undoDelete = () => {
    if (!deleted) return;
    const next = [...presets];
    next.splice(Math.min(deleted.index, next.length), 0, deleted.preset);
    persist(next);
    setDeleted(null);
    setNotice(null);
  };
  const undo = () => (deleted ? undoDelete() : undoReplace());

  const beginRename = (preset: Preset) => {
    setRenaming(preset.id);
    // the field opens empty on purpose: a pre-filled field that selects its
    // text puts the Android editor in selection mode, where the D-pad keys are
    // eaten for cursor/selection work — the field could not be left (and so
    // not committed) with the remote. Empty + placeholder types a whole name;
    // leaving without typing keeps the old one (commitRename's empty guard)
    setDraft('');
  };

  const commitRename = () => {
    const name = draft.trim();
    if (renaming && name) {
      persist(presets.map((p) => (p.id === renaming ? { ...p, name } : p)));
    }
    setRenaming(null);
  };

  return (
    <View style={screen.root}>
      <View style={screen.safe}>
        <View style={styles.head}>
          <T style={styles.wordmark}>
            your <T style={styles.wordmarkDot}>presets</T>
          </T>
          <T style={styles.label}>tonight's board, kept</T>
        </View>

        <Pressable
          nextFocusDown={firstCard}
          testID={testId.presetKeep}
          accessibilityRole="button"
          accessibilityLabel={`Keep this board: ${autoName(filters)}`}
          onPress={keep}
          // the screen owns its initial focus like the board's dock does —
          // with a card list present nothing else claims it, and the first
          // D-pad press would land nowhere
          hasTVPreferredFocus
          style={({ focused }) => [styles.saveRow, focused && styles.saveRowFocused]}
        >
          <T style={styles.saveTitle}>+ keep this board</T>
          <View style={styles.savePreviewRow}>
            <Summary filters={filters} />
          </View>
        </Pressable>

        {presets.length === 0 ? (
          <T style={styles.empty}>no presets yet — tonight's board can be the first</T>
        ) : (
          <ScrollView style={styles.list} focusable={false}>
            {presets.map((preset, index) => (
              <View key={preset.id} style={styles.row}>
                <Pressable
                  ref={index === 0 ? setFirstCard : undefined}
                  testID={testId.preset(preset.id)}
                  accessibilityRole="button"
                  // the label carries the unsliced summary — TalkBack reads what the card's budget cut
                  accessibilityLabel={`Load preset ${preset.name}: ${autoName(preset.filters)}`}
                  onPress={() => onLoad(preset.filters)}
                  style={({ focused }) => [styles.card, focused && styles.cardFocused]}
                >
                  {renaming === preset.id ? (
                    <TextInput
                      style={styles.rename}
                      value={draft}
                      onChangeText={(t) => {
                        setDraft(t);
                        // the name applies as typed: every keystroke lands in
                        // storage, because the D-pad keys never reach the app
                        // while a TV text field holds focus — there is no
                        // reliable "done" press to hang a commit on. An empty
                        // draft changes nothing (commitRename's guard).
                        if (renaming && t.trim()) {
                          savePresets(
                            presets.map((p) => (p.id === renaming ? { ...p, name: t.trim() } : p)),
                          ).catch(() => setNotice('preset not saved — try again'));
                        }
                      }}
                      allowFontScaling={false}
                      autoFocus
                      selectTextOnFocus={false}
                      selectionColor={colors.sodium}
                      cursorColor={colors.sodium}
                      placeholder="name this board"
                      placeholderTextColor={colors.dim}
                      testID="preset-rename-input"
                      onSubmitEditing={commitRename}
                      onEndEditing={commitRename}
                    />
                  ) : (
                    <>
                      <T style={styles.name} numberOfLines={1}>
                        {preset.name}
                      </T>
                      <Summary filters={preset.filters} />
                    </>
                  )}
                </Pressable>
                <ActionButton
                  label="Replace"
                  variant="ghost"
                  testID={testId.presetReplace(preset.id)}
                  onPress={() => replace(preset)}
                  style={styles.act}
                />
                <ActionButton
                  label="Rename"
                  variant="ghost"
                  testID={testId.presetRename(preset.id)}
                  onPress={() => beginRename(preset)}
                  style={styles.act}
                />
                <ActionButton
                  label="Delete"
                  variant="ghost"
                  testID={testId.presetDelete(preset.id)}
                  onPress={() => remove(preset)}
                  style={styles.act}
                />
              </View>
            ))}
            <View style={styles.tail} />
          </ScrollView>
        )}

        <View style={styles.dock}>
          <ActionButton label="Back" variant="ghost" testID="presets-back" onPress={onBack} style={styles.back} />
        </View>

        {deleted || replaced ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Undo"
            onPress={undo}
            style={({ focused }) => [styles.noticeRow, focused && styles.noticeFocused]}
          >
            <T style={styles.notice} numberOfLines={2}>
              {notice ?? ''}
            </T>
          </Pressable>
        ) : (
          <T style={styles.notice} numberOfLines={2}>
            {notice ?? ''}
          </T>
        )}
      </View>
    </View>
  );
}

const SUMMARY_FS = 22;
/** mono advance 0.6em + 0.06em tracking, padded — the receipt's own arithmetic */
const summaryCharW = () => s(SUMMARY_FS) * 0.68;
const summaryBudget = () => layout.span(4) - s(12) * 2 - s(4);

function Summary({ filters }: { filters: Filters }) {
  const parts: string[] = [];
  const kinds = filters.kinds.map((k) => (k === 'movie' ? 'Movies' : 'TV shows')).join(' + ');
  parts.push(kinds);
  for (const key of RANGE_KEYS) {
    const axis = AXES[key];
    const value = filters[key];
    if (isWholeAxis(axis, value)) continue;
    const unit = key === 'rating' ? '★ ' : '';
    parts.push(`${unit}${axis.fmt(value[0])}–${axis.fmt(value[1])}`);
  }
  // parts are the skeleton: they render first and always; the genre marks walk
  // what is left of the budget, and the cut is counted, never ellipsized
  const partsText = parts.join('  ·  ');
  let spent = partsText.length;
  let shown = 0;
  for (const [genre] of Object.entries(filters.genres)) {
    const cost = 7 + genre.length; // "  ·  ± name"
    if ((spent + cost) * summaryCharW() > summaryBudget()) break;
    spent += cost;
    shown += 1;
  }
  const genreList = Object.entries(filters.genres) as [string, 'include' | 'exclude'][];
  const overflow = genreList.length - shown;

  return (
    <T style={styles.summary} numberOfLines={1}>
      {parts.map((part, i) => (
        <T key={part}>
          {i > 0 ? <T style={styles.summarySep}>{'  ·  '}</T> : null}
          <T style={styles.summaryFact}>{part}</T>
        </T>
      ))}
      {genreList.slice(0, shown).map(([genre, state]) => (
        <T key={genre} style={state === 'include' ? styles.summaryInc : styles.summaryExc}>
          {`  ·  ${state === 'include' ? '+' : '−'} ${genre}`}
        </T>
      ))}
      {overflow > 0 && <T style={styles.summaryInc}>{`  ·  +${overflow} more`}</T>}
    </T>
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
  label: text.label,

  saveRow: {
    marginTop: s(14),
    backgroundColor: colors.slat,
    borderRadius: layout.radius,
    borderWidth: layout.border,
    borderColor: colors.slatHi,
    padding: s(10),
    gap: s(4),
  },
  saveRowFocused: { borderColor: colors.sodium, transform: [{ scale: 1.03 }], elevation: 12 },
  saveTitle: monoBold(24, { em: 0.08, caps: true, color: colors.sodium }),
  savePreviewRow: { marginTop: s(2) },

  list: { marginTop: s(14), flex: 1 },
  row: { flexDirection: 'row', gap: layout.gap, marginBottom: s(10) },
  card: {
    width: layout.span(4),
    backgroundColor: colors.slat,
    borderRadius: layout.radius,
    borderWidth: layout.border,
    borderColor: colors.slatHi,
    padding: s(12),
    gap: s(4),
    justifyContent: 'center',
  },
  cardFocused: { borderColor: colors.sodium, transform: [{ scale: 1.03 }], elevation: 12 },
  name: monoBold(26, { color: colors.chalk }),
  // explicit on every axis an EditText can default: ink, highlight, padding —
  // a rename field that renders empty is a field that cannot be trusted
  rename: {
    ...mono(26, { color: colors.chalk }),
    backgroundColor: colors.boardLo,
    borderColor: colors.sodium,
    borderWidth: layout.border,
    borderRadius: layout.radius,
    paddingHorizontal: s(10),
    height: s(44),
    paddingVertical: 0,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  act: { width: layout.cell, alignSelf: 'stretch' },
  tail: { height: s(4) },

  summary: mono(SUMMARY_FS, { em: 0.06, caps: true, color: colors.dim }),
  summaryFact: { color: colors.chalk },
  summarySep: { color: colors.dim },
  summaryInc: { color: colors.sodium },
  summaryExc: { color: colors.cold, textDecorationLine: 'line-through' },

  dock: { marginTop: 'auto', paddingTop: s(2), borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.slatHi },
  back: { width: layout.span(2) },
  notice: { ...text.label, color: colors.chalk },
  noticeRow: { marginTop: s(8), alignSelf: 'flex-start' },
  noticeFocused: { borderWidth: layout.border, borderColor: colors.sodium, borderRadius: layout.radius, paddingHorizontal: s(6) },
  empty: { ...text.body, color: colors.dim, textAlign: 'center', marginTop: s(120) },
});
