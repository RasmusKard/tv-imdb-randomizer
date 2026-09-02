import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, BackHandler, StyleSheet, View } from 'react-native';

import { deviceTag, fetchWatched, type Session } from '../api/auth';
import { ActionButton } from '../components/ActionButton';
import { T } from '../components/T';
import { UpdateCard } from '../components/UpdateCard';
import type { UpdateInfo } from '../update/compare';
import { checkForUpdate, installedVersion } from '../update/checker';
import { groupThousands } from '../lib/format';
import { colors, displayHeavy, layout, mono, s, screen, text } from '../theme';

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
          <T style={styles.wordmark}>
            your <T style={styles.wordmarkDot}>list</T>
          </T>
          <T style={styles.label}>titles you have watched never roll again</T>
        </View>

        <View style={styles.form}>
          <Row label="Device">
            <T style={styles.value}>{session ? deviceTag(session.deviceId) : 'signing in…'}</T>
          </Row>
          <Row label="Titles watched">
            <T style={styles.value}>{watchedCount !== null ? groupThousands(watchedCount) : '—'}</T>
          </Row>
          <View style={styles.row}>
            <ActionButton label="Import from IMDb" testID="account-import" onPress={onImport} style={styles.wide} hasTVPreferredFocus />
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
          <T style={styles.versionLabel} testID="account-version">
            {version.versionName ?? 'dev'} ({version.versionCode})
          </T>
          <ActionButton
            label={checking ? 'Checking…' : 'Check for updates'}
            variant="ghost"
            testID="account-check-updates"
            onPress={checkForUpdates}
            style={styles.checkButton}
          />
        </View>

        <T style={styles.notice} numberOfLines={2} testID="account-notice">
          {notice ?? ''}
        </T>
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

  form: { paddingTop: s(24), gap: s(18), width: layout.span(4) },
  fieldRow: { gap: s(6) },
  row: { flexDirection: 'row', gap: layout.gap },
  wide: { flex: 1 },
  // sized, not stretched: the row is span(4), the check button takes span(2)
  checkButton: { width: layout.span(2) },
  value: mono(30, { color: colors.chalk }),

  notice: { ...text.notice, marginTop: 'auto' },
  label: text.label,

  updateBlock: { width: layout.span(4) },
  versionRow: {
    flexDirection: 'row',
    gap: layout.gap,
    width: layout.span(4),
    alignItems: 'center',
    // the update card used to sit between this row and the summary; keep the
    // same breathing room now that the row can directly follow the form
    paddingTop: s(24),
  },
  versionLabel: text.label,
});
