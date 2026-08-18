import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Ref } from 'react';

import { colors, fonts, layout, s, tracking } from '../theme';

type Props = {
  label: string;
  /** ghost is the secondary action; it fills in on focus rather than at rest. */
  variant?: 'solid' | 'ghost';
  testID: string;
  onPress: () => void;
  /** Roll fires its prefetch from here: one request per "I'm done fiddling". */
  onFocus?: () => void;
  hasTVPreferredFocus?: boolean;
  style?: object;
  ref?: Ref<View>;
  nextFocusLeft?: View | null;
  nextFocusRight?: View | null;
  nextFocusUp?: View | null;
  nextFocusDown?: View | null;
};

export function ActionButton({
  label,
  variant = 'solid',
  testID,
  onPress,
  onFocus,
  hasTVPreferredFocus,
  style,
  ref,
  ...focusProps
}: Props) {
  return (
    <Pressable
      ref={ref}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      onFocus={onFocus}
      hasTVPreferredFocus={hasTVPreferredFocus}
      {...focusProps}
      style={({ focused }) => [
        styles.base,
        variant === 'solid' ? styles.solid : styles.ghost,
        focused && (variant === 'solid' ? styles.solidFocused : styles.ghostFocused),
        style,
      ]}
    >
      {({ focused }) => (
        <Text
          style={[
            styles.label,
            variant === 'ghost' && !focused ? styles.labelGhost : styles.labelSolid,
          ]}
        >
          {label}
        </Text>
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
  solid: { backgroundColor: colors.sodium, borderColor: colors.sodium },
  ghost: { backgroundColor: 'transparent', borderColor: colors.sodium },
  solidFocused: { transform: [{ scale: 1.03 }], elevation: 12 },
  ghostFocused: { backgroundColor: colors.sodium, transform: [{ scale: 1.03 }], elevation: 12 },
  label: {
    fontFamily: fonts.display,
    fontSize: s(28),
    fontWeight: '800',
    letterSpacing: tracking(s(28), 0.12),
    textTransform: 'uppercase',
  },
  labelSolid: { color: colors.onSodium },
  labelGhost: { color: colors.sodium },
});
