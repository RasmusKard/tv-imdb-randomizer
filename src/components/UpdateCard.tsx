import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ActionButton } from './ActionButton';
import { colors, display, layout, mono, s } from '../theme';
import type { UpdateInfo } from '../update/compare';
import { downloadUpdate, installUpdate } from '../update/installer';

type Props = {
  info: UpdateInfo;
  testID?: string;
  /** Fired after the installer intent went out; the APK itself installs outside the app. */
  onHandedOff?: () => void;
  /** Fired with a human-readable reason when download, checksum or handoff failed. */
  onError?: (message: string) => void;
};

/**
 * One update, offered. A single button does the whole thing: download with
 * progress, verify the MD5, then hand the APK to the system installer —
 * there is nothing worth a second state past that, the installer owns the
 * rest of the flow.
 */
export function UpdateCard({ info, testID = 'update-card', onHandedOff, onError }: Props) {
  // null = idle; while a fraction, the button is replaced by the progress bar
  const [progress, setProgress] = useState<number | null>(null);

  const install = async () => {
    if (progress !== null) return;
    setProgress(0);
    try {
      const fileUri = await downloadUpdate(info, setProgress);
      await installUpdate(fileUri);
      onHandedOff?.();
    } catch (e) {
      onError?.((e as { message?: string }).message ?? 'Update failed');
    } finally {
      setProgress(null);
    }
  };

  return (
    <View style={styles.card} testID={testID}>
      <View style={styles.head}>
        <Text style={styles.version} testID={`${testID}-version`}>
          {info.versionName}
        </Text>
        <Text style={styles.channelNote}>android asks once to allow installs</Text>
      </View>

      {info.changelog.length > 0 && (
        <View style={styles.changelog}>
          {info.changelog.slice(0, 5).map((line, i) => (
            <Text key={i} style={styles.line} numberOfLines={2}>
              {'· '}
              {line}
            </Text>
          ))}
        </View>
      )}

      {progress === null ? (
        <ActionButton
          label={`Install ${info.versionName}`}
          testID={`${testID}-install`}
          onPress={install}
          style={styles.wide}
        />
      ) : (
        <View style={styles.progressRow} testID={`${testID}-progress`}>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.max(3, Math.round(progress * 100))}%` }]} />
          </View>
          <Text style={styles.pct}>{Math.round(progress * 100)}%</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: layout.border,
    borderColor: colors.slatHi,
    borderRadius: layout.radius,
    backgroundColor: colors.slat,
    padding: s(16),
    gap: s(12),
  },
  head: { gap: s(4) },
  version: display(32, { em: -0.02, fontWeight: '800', color: colors.sodium }),
  channelNote: mono(22, { em: 0.1, caps: true, color: colors.dimmer }),

  changelog: { gap: s(4) },
  line: mono(26, { color: colors.chalk }),

  wide: { width: '100%' },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: s(16), height: s(80) },
  track: {
    flex: 1,
    height: s(12),
    borderRadius: s(6),
    backgroundColor: colors.slatHi,
    overflow: 'hidden',
  },
  fill: { height: '100%', backgroundColor: colors.sodium },
  pct: mono(26, { em: 0.1, color: colors.chalk, minWidth: s(90), textAlign: 'right' }),
});
