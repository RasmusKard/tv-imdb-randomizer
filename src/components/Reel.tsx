import { StyleSheet, View } from 'react-native';

import { colors, s } from '../theme';

/**
 * The reel standing in whenever the picture is missing — the verdict's
 * one-sheet, the import's QR. The booth's own word for "nothing on screen
 * here", rather than a dashed box or a gray ghost of what should have been.
 */
export function Reel() {
  return (
    <View style={styles.reel}>
      <View style={styles.rim} />
      <View style={styles.mid} />
      <View style={styles.core} />
    </View>
  );
}

const styles = StyleSheet.create({
  reel: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  rim: {
    width: s(190),
    height: s(190),
    borderRadius: s(95),
    borderWidth: s(3),
    borderColor: 'rgba(232,230,220,0.22)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mid: {
    width: s(122),
    height: s(122),
    borderRadius: s(61),
    borderWidth: s(3),
    borderColor: 'rgba(232,230,220,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  core: {
    width: s(46),
    height: s(46),
    borderRadius: s(23),
    borderWidth: s(3),
    borderColor: 'rgba(255,176,46,0.55)',
    // the one warm native shadow: the lit core glowing through the room
    shadowColor: colors.sodium,
    shadowOpacity: 0.3,
    shadowRadius: s(30),
    elevation: 6,
  },
});
