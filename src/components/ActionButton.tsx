import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import type { Ref } from 'react';

import { colors, display, layout, s } from '../theme';

type Props = {
  label: string;
  /** ghost is the secondary action; it fills in on focus rather than at rest. */
  variant?: 'solid' | 'ghost';
  testID: string;
  onPress: () => void;
  /** Roll fires its prefetch from here: one request per "I'm done fiddling". */
  onFocus?: () => void;
  hasTVPreferredFocus?: boolean;
  style?: StyleProp<ViewStyle>;
  ref?: Ref<View>;
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
  // a solid button at rest sits a step darker: on TV, scale alone is not a
  // readable focus signal on a large filled shape
  solid: { backgroundColor: colors.sodiumDim, borderColor: colors.sodiumDim },
  ghost: { backgroundColor: 'transparent', borderColor: colors.sodium },
  solidFocused: {
    backgroundColor: colors.sodium,
    borderColor: colors.chalk,
    transform: [{ scale: 1.03 }],
    elevation: 12,
  },
  ghostFocused: { backgroundColor: colors.sodium, transform: [{ scale: 1.03 }], elevation: 12 },
  label: display(28, { em: 0.12, caps: true, fontWeight: '800' }),
  labelSolid: { color: colors.onSodium },
  labelGhost: { color: colors.sodium },
});
