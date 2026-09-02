import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ActionButton } from './ActionButton';
import { T } from './T';
import { colors, layout, mono, monoBold, s, text } from '../theme';
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
        <T style={styles.version} testID={`${testID}-version`}>
          {info.versionName}
        </T>
        <T style={styles.channelNote}>android asks once to allow installs</T>
      </View>

      {info.changelog.length > 0 && (
        <View style={styles.changelog}>
          {/* three lines is the whole card's budget: the account screen has no
              scroll, and a five-entry release pushes the version row off the
              inset — slice, don't grow */}
          {info.changelog.slice(0, 3).map((line, i) => (
            <T key={i} style={styles.line} numberOfLines={2}>
              {'· '}
              {line}
            </T>
          ))}
        </View>
      )}

      {progress === null ? (
        <ActionButton
          // the version is named right above; the ledger keeps digits out of Archivo
          label="Install"
          testID={`${testID}-install`}
          onPress={install}
          style={styles.wide}
        />
      ) : (
        <View style={styles.progressRow} testID={`${testID}-progress`}>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.max(3, Math.round(progress * 100))}%` }]} />
          </View>
          <T style={styles.pct}>{Math.round(progress * 100)}%</T>
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
  // a version is a number, so the ledger carries it — not Archivo
  version: monoBold(32, { color: colors.sodium }),
  channelNote: mono(22, { em: 0.1, caps: true, color: colors.dim }),

  changelog: { gap: s(4) },
  line: { ...text.body, color: colors.chalk },

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
  pct: monoBold(26, { color: colors.chalk, minWidth: s(90), textAlign: 'right' }),
});
