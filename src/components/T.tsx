import { Text, type TextProps } from 'react-native';

/**
 * The booth is drawn at a fixed 1920x1080 and scaled once by s() — rows are
 * fixed-height, so Android's font-scale setting would clip labels out of their
 * boxes rather than reflow them. Text never rescales itself; readability at
 * three metres is the design's job, not the system's.
 */
export function T(props: TextProps) {
  return <Text allowFontScaling={false} {...props} />;
}
