import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Ref } from 'react';

import { colors, fonts, layout, mono, s } from '../theme';

export type ChipState = 'off' | 'on' | 'excluded';

type Props = {
  name: string;
  /** Second line: a band's range, a kind's qualifier. Genres have none. */
  sub?: string;
  state: ChipState;
  /** Genre chips are shorter and single-line, so 21 of them fit three rows. */
  variant?: 'default' | 'genre';
  testID: string;
  accessibilityLabel: string;
  onPress: () => void;
  ref?: Ref<View>;
  nextFocusLeft?: View | null;
  nextFocusRight?: View | null;
  nextFocusUp?: View | null;
  nextFocusDown?: View | null;
  /**
   * True exactly when this is the most recently pressed control board-wide.
   * `hasTVPreferredFocus` only calls Android's `requestFocus` on a false ->
   * true transition (see ReactViewManager.kt), so this is a real, working
   * "move focus to whatever was just touched" — `Pressable.focus()` is not:
   * it is wired to a native command gated behind `enableImperativeFocus`,
   * which defaults off and isn't enabled in this app, so it silently no-ops.
   */
  hasTVPreferredFocus?: boolean;
};

/**
 * One cell of the grid.
 *
 * Focus is carried by three signals — ring, lift, brighten — because a TV panel
 * is colour-calibrated by a stranger. The excluded state likewise never relies
 * on the cyan alone: it strikes the label through as well.
 */
export function Chip({
  name,
  sub,
  state,
  variant = 'default',
  testID,
  accessibilityLabel,
  onPress,
  ref,
  nextFocusLeft,
  nextFocusRight,
  nextFocusUp,
  nextFocusDown,
  hasTVPreferredFocus,
}: Props) {
  return (
    <Pressable
      ref={ref}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: state === 'on' }}
      onPress={onPress}
      hasTVPreferredFocus={hasTVPreferredFocus}
      nextFocusLeft={nextFocusLeft}
      nextFocusRight={nextFocusRight}
      nextFocusUp={nextFocusUp}
      nextFocusDown={nextFocusDown}
      style={({ focused }) => [
        styles.base,
        variant === 'genre' ? styles.genre : styles.tall,
        box[state],
        focused && styles.focused,
      ]}
    >
      {({ focused }) => (
        <>
          <Text
            numberOfLines={1}
            style={[
              styles.name,
              variant === 'genre' && styles.nameGenre,
              ink[state],
              focused && state === 'off' && styles.nameFocused,
            ]}
          >
            {name}
          </Text>
          {sub ? (
            <Text
              numberOfLines={1}
              style={[styles.sub, subInk[state], focused && state === 'off' && styles.subFocused]}
            >
              {sub}
            </Text>
          ) : null}
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: layout.cell,
    alignItems: 'center',
    justifyContent: 'center',
    gap: s(3),
    paddingHorizontal: s(8),
    backgroundColor: colors.slat,
    borderRadius: layout.radius,
    borderWidth: layout.border,
    borderColor: 'transparent',
  },
  tall: { height: s(58) },
  genre: { height: s(50) },
  focused: {
    borderColor: colors.sodium,
    transform: [{ scale: 1.05 }],
    elevation: 12,
    zIndex: 3,
  },

  // selections read in mixed case: a wall of tracked caps across 21 genres
  // was noise, not broadcast clarity — caps stay reserved for chrome (section
  // labels, kickers, buttons)
  name: mono(24, { em: 0.02, color: colors.dim }),
  /** Only the size changes: the tracking stays the one computed against 24. */
  nameGenre: { fontSize: s(26) },
  nameFocused: { color: colors.chalk },

  sub: mono(20, { em: 0.02, color: colors.dim }),
  subFocused: { color: colors.dim },
});

/** The three states, keyed by the state, so the render path is a lookup. */
const box = StyleSheet.create({
  off: {},
  on: { backgroundColor: colors.sodium, borderColor: colors.sodium },
  excluded: { backgroundColor: colors.boardLo, borderColor: colors.cold },
});

const ink = StyleSheet.create({
  off: {},
  on: { color: colors.onSodium, fontFamily: fonts.monoBold },
  excluded: { color: colors.cold, textDecorationLine: 'line-through' },
});

const subInk = StyleSheet.create({ off: {}, on: { color: colors.onSodiumDim }, excluded: {} });
