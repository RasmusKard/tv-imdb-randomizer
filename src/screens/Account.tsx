import { useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, BackHandler, StyleSheet, View } from 'react-native';

import { deviceTag, fetchWatched, type Session } from '../api/auth';
import { ActionButton } from '../components/ActionButton';
import { T } from '../components/T';
import { groupThousands } from '../lib/format';
import { colors, displayHeavy, layout, mono, s, screen, text } from '../theme';

type Props = {
  session: Session | null;
  onImport: () => void;
  onBack: () => void;
};

/**
 * The watched-list screen: what the account is for here — the titles this
 * device has already seen (they never roll again) and the one way to grow
 * the list, the IMDb import. Nothing else: updates live on the board, the
 * device signs itself in invisibly, there is nothing to configure.
 */
export function Account({ session, onImport, onBack }: Props) {
  const [notice, setNotice] = useState<string | null>(null);

  // account notices change silently otherwise; announce them for TalkBack
  useEffect(() => {
    if (notice) AccessibilityInfo.announceForAccessibility(notice);
  }, [notice]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack]);

  const [watchedCount, setWatchedCount] = useState<number | null>(null);
  useEffect(() => {
    if (!session) return;
    let dead = false;
    fetchWatched(session.token)
      .then((ids) => {
        if (!dead) setWatchedCount(ids.length);
      })
      .catch(() => {
        if (!dead) setWatchedCount(null);
      });
    return () => {
      dead = true;
    };
  }, [session]);

  return (
    <View style={screen.root}>
      <View style={screen.safe}>
        <View style={styles.head}>
          <T style={styles.wordmark}>
            your <T style={styles.wordmarkDot}>list</T>
          </T>
          <T style={styles.label}>titles you have watched never roll again</T>
        </View>

        {/* one plate, centered in its span: the two facts and the one door */}
        <View style={styles.form}>
          <Row label="Device">
            <T style={styles.value}>{session ? deviceTag(session.deviceId) : 'signing in…'}</T>
          </Row>
          <Row label="Titles watched">
            <T style={styles.value} testID="account-watched-count">
              {watchedCount !== null ? groupThousands(watchedCount) : '—'}
            </T>
          </Row>
          <View style={styles.row}>
            <ActionButton
              label="Import from IMDb"
              testID="account-import"
              onPress={onImport}
              style={styles.wide}
              hasTVPreferredFocus
            />
          </View>
        </View>
      </View>
    </View>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.fieldRow}>
      <T style={styles.label}>{label}</T>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingBottom: s(8),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.slatHi,
  },
  wordmark: displayHeavy(32, { em: -0.03, color: colors.chalk }),
  wordmarkDot: { color: colors.sodium },

  form: { gap: s(18), width: layout.span(4), justifyContent: 'center', paddingTop: s(24) },
  fieldRow: { gap: s(6) },
  row: { flexDirection: 'row', gap: layout.gap },
  wide: { flex: 1 },
  value: mono(30, { color: colors.chalk }),
  label: text.label,
});
