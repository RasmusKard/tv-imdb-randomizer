import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Ref } from 'react';

import { colors, fonts, layout, s, tracking } from '../theme';

export type ChipState = 'off' | 'on' | 'excluded';

type Props = {
  name: string;
  /** Second line: a band's range, a kind's qualifier. Genres have none. */
  sub?: string;
  state?: ChipState;
  /** Genre chips are shorter and single-line, so 21 of them fit three rows. */
  variant?: 'default' | 'genre';
  /** How many of the seven columns this cell occupies. */
  span?: number;
  testID: string;
  accessibilityLabel: string;
  onPress: () => void;
  ref?: Ref<View>;
  nextFocusLeft?: View | null;
  nextFocusRight?: View | null;
  nextFocusUp?: View | null;
  nextFocusDown?: View | null;
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
  state = 'off',
  variant = 'default',
  span = 1,
  testID,
  accessibilityLabel,
  onPress,
  ref,
  nextFocusLeft,
  nextFocusRight,
  nextFocusUp,
  nextFocusDown,
}: Props) {
  return (
    <Pressable
      ref={ref}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: state === 'on' }}
      onPress={onPress}
      nextFocusLeft={nextFocusLeft}
      nextFocusRight={nextFocusRight}
      nextFocusUp={nextFocusUp}
      nextFocusDown={nextFocusDown}
      style={({ focused }) => [
        styles.base,
        variant === 'genre' ? styles.genre : styles.tall,
        { width: layout.span(span) },
        state === 'on' && styles.on,
        state === 'excluded' && styles.excluded,
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
              state === 'on' && styles.nameOn,
              state === 'excluded' && styles.nameExcluded,
              focused && state === 'off' && styles.nameFocused,
            ]}
          >
            {name}
          </Text>
          {sub ? (
            <Text
              numberOfLines={1}
              style={[
                styles.sub,
                state === 'on' && styles.subOn,
                focused && state === 'off' && styles.subFocused,
              ]}
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
  genre: { height: s(52) },

  on: { backgroundColor: colors.sodium, borderColor: colors.sodium },
  excluded: {
    backgroundColor: colors.boardLo,
    borderColor: colors.cold,
  },
  focused: {
    borderColor: colors.sodium,
    transform: [{ scale: 1.05 }],
    elevation: 12,
    zIndex: 3,
  },

  name: {
    fontFamily: fonts.mono,
    fontSize: s(18),
    letterSpacing: tracking(s(18), 0.09),
    textTransform: 'uppercase',
    color: colors.dim,
  },
  nameGenre: { fontSize: s(21) },
  nameOn: { color: colors.onSodium, fontWeight: '700' },
  nameExcluded: { color: colors.cold, textDecorationLine: 'line-through' },
  nameFocused: { color: colors.chalk },

  sub: {
    fontFamily: fonts.mono,
    fontSize: s(14),
    letterSpacing: tracking(s(14), 0.05),
    textTransform: 'uppercase',
    color: colors.dimmer,
  },
  subOn: { color: colors.onSodiumDim },
  subFocused: { color: colors.dim },
});
