import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ActionButton } from './ActionButton';
import { T } from './T';
import { colors, layout, mono, monoBold, s, text } from '../theme';
import type { UpdateInfo } from '../update/compare';
import { downloadUpdate, installUpdate } from '../update/installer';

type Props = {
  info: UpdateInfo;
  onClose: () => void;
  testID?: string;
};

/**
 * The update, asked for over the board: version, the whole changelog, and the
 * one action. A single button does the whole thing — download with progress,
 * verify the MD5, hand the APK to the system installer; Android owns the rest.
 *
 * Mounted only while open (the board gates it), so the install button's
 * focus claim fires on every open and back always has a live onRequestClose.
 * Back — or a touch on the dark — closes even mid-download: the download
 * outlives its window and still lands the handoff, so closing never orphans
 * an install, it just stops making you watch.
 */
export function UpdateModal({ info, onClose, testID = 'update-modal' }: Props) {
  // null = idle; while a fraction, the button is replaced by the progress bar
  const [progress, setProgress] = useState<number | null>(null);
  /** A download, checksum or handoff failure answers here, over the actions. */
  const [error, setError] = useState<string | null>(null);

  const install = async () => {
    if (progress !== null) return;
    setError(null);
    setProgress(0);
    try {
      const fileUri = await downloadUpdate(info, setProgress);
      await installUpdate(fileUri);
      // the system installer has the baton; the board takes the screen back
      onClose();
    } catch (e) {
      setError((e as { message?: string }).message ?? 'Update failed');
    } finally {
      setProgress(null);
    }
  };

  return (
    <Modal
      // hard cut: the booth moves in steps, never eases
      animationType="none"
      transparent
      visible
      onRequestClose={onClose}
    >
      <Pressable style={styles.veil} onPress={onClose}>
        <View
          style={styles.sheet}
          testID={testID}
          // dead areas of the sheet swallow taps instead of closing through to the veil
          onStartShouldSetResponder={() => true}
        >
          <View style={styles.head}>
            <T style={styles.version} testID={`${testID}-version`}>
              {info.versionName}
            </T>
            <T style={styles.note}>android asks once to allow installs</T>
          </View>

          {info.changelog.length > 0 && (
            // the room the board's card never had: the whole list, and a
            // scroll when a release outgrows the sheet
            <ScrollView
              style={styles.changelog}
              contentContainerStyle={styles.changelogBody}
              testID={`${testID}-changelog`}
            >
              {info.changelog.map((line, i) => (
                <T key={i} style={styles.line}>
                  {'· '}
                  {line}
                </T>
              ))}
            </ScrollView>
          )}

          {progress === null ? (
            <ActionButton
              // the version is named right above; the ledger keeps digits out of Archivo
              label="Install"
              testID={`${testID}-install`}
              onPress={install}
              hasTVPreferredFocus
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

          {error ? (
            <T style={styles.error} testID={`${testID}-error`}>
              {error}
            </T>
          ) : null}
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  /** the board, darkened: the modal reads as over the filters, not beside them */
  veil: {
    flex: 1,
    backgroundColor: 'rgba(5,5,7,0.86)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: layout.overscan,
  },
  // the card grammar, centered and roomy: slat fill, slatHi border, no shadow
  sheet: {
    width: s(1040),
    maxHeight: '82%',
    backgroundColor: colors.slat,
    borderWidth: layout.border,
    borderColor: colors.slatHi,
    borderRadius: layout.radius,
    padding: s(24),
    gap: s(14),
  },

  head: { gap: s(4) },
  // a version is a number, so the ledger carries it — not Archivo
  version: monoBold(40, { color: colors.sodium }),
  note: mono(22, { em: 0.1, caps: true, color: colors.dim }),

  changelog: { maxHeight: s(480) },
  changelogBody: { gap: s(6) },
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
  error: { ...text.notice },
});
