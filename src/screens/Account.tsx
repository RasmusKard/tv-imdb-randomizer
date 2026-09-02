import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, BackHandler, StyleSheet, Text, View } from 'react-native';

import { deviceTag, fetchWatched, type Session } from '../api/auth';
import { ActionButton } from '../components/ActionButton';
import { UpdateCard } from '../components/UpdateCard';
import type { UpdateInfo } from '../update/compare';
import { checkForUpdate, installedVersion } from '../update/checker';
import { colors, displayHeavy, layout, mono, s, screen } from '../theme';

type Props = {
  session: Session | null;
  onImport: () => void;
  onBack: () => void;
  /** An update the app has found and is offering; lives here so the board banner can point at it. */
  update: UpdateInfo | null;
  onUpdate: (u: UpdateInfo | null) => void;
};

/**
 * The account screen. The account is the device itself — there is nothing to
 * sign in or out of — so this is a summary and the way into the CSV import.
 * The update row lives here too, as it always has: updates have nothing to do
 * with the account.
 */
export function Account({ session, onImport, onBack, update, onUpdate }: Props) {
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

  // a manual check always answers, unlike the daily one.
  const version = installedVersion();
  const [checking, setChecking] = useState(false);
  const checkForUpdates = useCallback(async () => {
    if (checking) return;
    setChecking(true);
    setNotice(null);
    try {
      const found = await checkForUpdate({ force: true });
      onUpdate(found);
      if (!found) setNotice('up to date');
    } catch (e) {
      setNotice((e as { message?: string }).message ?? 'couldn\u2019t check — try again');
    } finally {
      setChecking(false);
    }
  }, [checking, onUpdate]);

  return (
    <View style={screen.root}>
      <View style={screen.safe}>
        <View style={styles.head}>
          <Text style={styles.wordmark}>
            your <Text style={styles.wordmarkDot}>account</Text>
          </Text>
          <Text style={styles.label}>titles you have watched never roll again</Text>
        </View>

        <View style={styles.form}>
          <Row label="Device">
            <Text style={styles.value}>{session ? deviceTag(session.deviceId) : 'signing in…'}</Text>
          </Row>
          <Row label="Titles watched">
            <Text style={styles.value}>{watchedCount !== null ? group(watchedCount) : '—'}</Text>
          </Row>
          <View style={styles.row}>
            <ActionButton label="Import CSV" testID="account-import" onPress={onImport} style={styles.wide} hasTVPreferredFocus />
          </View>
        </View>

        {update && (
          <View style={styles.updateBlock}>
            <UpdateCard
              info={update}
              testID="update-card"
              onHandedOff={() => setNotice('installer opened — confirm it there')}
              onError={setNotice}
            />
          </View>
        )}

        <View style={styles.versionRow}>
          <Text style={styles.versionLabel} testID="account-version">
            {version.versionName ?? 'dev'} ({version.versionCode})
          </Text>
          <ActionButton
            label={checking ? 'Checking…' : 'Check for updates'}
            variant="ghost"
            testID="account-check-updates"
            onPress={checkForUpdates}
            style={styles.wide}
          />
        </View>

        <Text style={styles.notice} numberOfLines={2} testID="account-notice">
          {notice ?? ''}
        </Text>
      </View>
    </View>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.fieldRow}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

const group = (n: number) => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

const styles = StyleSheet.create({
  head: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingBottom: s(12),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.slatHi,
  },
  wordmark: displayHeavy(32, { em: -0.03, color: colors.chalk }),
  wordmarkDot: { color: colors.sodium },

  form: { paddingTop: s(24), gap: s(18), width: layout.span(4) },
  fieldRow: { gap: s(6) },
  row: { flexDirection: 'row', gap: layout.gap },
  wide: { flex: 1 },
  value: mono(30, { color: colors.chalk }),

  notice: mono(26, { em: 0.1, caps: true, color: colors.cold, marginTop: 'auto' }),
  label: mono(26, { em: 0.2, caps: true, color: colors.dim }),

  updateBlock: { width: layout.span(4) },
  versionRow: { flexDirection: 'row', gap: layout.gap, width: layout.span(4), alignItems: 'center' },
  versionLabel: mono(26, { em: 0.2, caps: true, color: colors.dim }),
});
