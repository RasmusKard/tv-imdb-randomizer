import { Pressable, StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import type { Ref } from 'react';

import { T } from './T';

import { colors, displayHeavy, layout, s } from '../theme';

type Props = {
  label: string;
  /** ghost is the secondary action; it fills in on focus rather than at rest. */
  variant?: 'solid' | 'ghost';
  /** Unavailable: stays focusable — an unfocusable cell would trap D-pad nav — but reads dim and inert. */
  disabled?: boolean;
  testID: string;
  onPress: () => void;
  /** Roll fires its prefetch from here: one request per "done fiddling". */
  onFocus?: () => void;
  hasTVPreferredFocus?: boolean;
  style?: StyleProp<ViewStyle>;
  ref?: Ref<View>;
  /** GridRow injects these; without them a button row's wiring is dead props. */
  nextFocusLeft?: View | null;
  nextFocusRight?: View | null;
  nextFocusUp?: View | null;
  nextFocusDown?: View | null;
  /** False only for labels whose own casing is the brand's ("IMDb"): the
   * recipe uppercases action labels, and it must not be allowed to misspell
   * a proper noun doing it. */
  caps?: boolean;
};

export function ActionButton({
  label,
  variant = 'solid',
  disabled = false,
  testID,
  onPress,
  onFocus,
  hasTVPreferredFocus,
  style,
  ref,
  nextFocusLeft,
  nextFocusRight,
  nextFocusUp,
  nextFocusDown,
  caps = true,
}: Props) {
  return (
    <Pressable
      ref={ref}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      onPress={disabled ? undefined : onPress}
      onFocus={onFocus}
      hasTVPreferredFocus={hasTVPreferredFocus}
      nextFocusLeft={nextFocusLeft}
      nextFocusRight={nextFocusRight}
      nextFocusUp={nextFocusUp}
      nextFocusDown={nextFocusDown}
      style={({ focused }) => [
        styles.base,
        disabled
          ? styles.disabled
          : variant === 'solid'
            ? styles.solid
            : styles.ghost,
        disabled && focused && styles.disabledFocused,
        !disabled && focused && (variant === 'solid' ? styles.solidFocused : styles.ghostFocused),
        style,
      ]}
    >
      {({ focused }) => (
        <T
          style={[
            styles.label,
            !caps && styles.labelAsWritten,
            disabled
              ? styles.labelDisabled
              : variant === 'ghost' && !focused
                ? styles.labelGhost
                : styles.labelSolid,
          ]}
        >
          {label}
        </T>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: s(80),
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: layout.radius,
    borderWidth: layout.border,
  },
  // a solid button at rest sits a step darker: on TV, scale alone is not a
  // readable focus signal on a large filled shape
  solid: { backgroundColor: colors.sodiumDim, borderColor: colors.sodiumDim },
  ghost: { backgroundColor: 'transparent', borderColor: colors.sodium },
  // unavailable: no lamp at all — transparent face, slat edge, dim ink. Focus
  // still shows a ring (the cell must answer the D-pad) but nothing brightens
  // or lifts, so the button reads as reached-but-inert
  disabled: { backgroundColor: 'transparent', borderColor: colors.slatHi },
  disabledFocused: { borderColor: colors.sodium },
  solidFocused: {
    backgroundColor: colors.sodium,
    borderColor: colors.chalk,
    transform: [{ scale: 1.03 }],
    elevation: 12,
  },
  ghostFocused: { backgroundColor: colors.sodium, transform: [{ scale: 1.03 }], elevation: 12 },
  label: displayHeavy(28, { em: 0.12, caps: true }),
  labelAsWritten: { textTransform: 'none' },
  labelSolid: { color: colors.onSodium },
  labelGhost: { color: colors.sodium },
  labelDisabled: { color: colors.dim },
});
