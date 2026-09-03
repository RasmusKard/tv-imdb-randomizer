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
  const [notice, setNotice] = useState<{ text: string; kind: 'ok' | 'err' } | null>(null);

  // account notices change silently otherwise; announce them for TalkBack
  useEffect(() => {
    if (notice) AccessibilityInfo.announceForAccessibility(notice.text);
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
      if (!found) setNotice({ text: 'up to date', kind: 'ok' });
    } catch (e) {
      setNotice({ text: (e as { message?: string }).message ?? 'couldn\u2019t check — try again', kind: 'err' });
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

        {/* the screen's one split: the task on the left (facts and the way
            in), the machine on the right (version, updates, their notices) —
            the same 4+3 column split the import screen uses, so the grid
            carries across both rooms of the house */}
        <View style={styles.body}>
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

          <View style={styles.machine}>
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
            {update && (
              <UpdateCard
                info={update}
                testID="update-card"
                onHandedOff={() => setNotice({ text: 'installer opened — confirm it there', kind: 'ok' })}
                onError={(text) => setNotice({ text, kind: 'err' })}
              />
            )}
            <T style={notice?.kind === 'ok' ? styles.noticeOk : styles.notice} numberOfLines={2} testID="account-notice">
              {notice?.text ?? ''}
            </T>
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

  body: { flexDirection: 'row', gap: layout.gap, paddingTop: s(24), flex: 1 },
  // the task column holds two rows and a door; centered in its span, it reads
  // as a plate, not a form abandoned at the top of an empty column
  form: { gap: s(18), width: layout.span(4), justifyContent: 'center' },
  fieldRow: { gap: s(6) },
  row: { flexDirection: 'row', gap: layout.gap },
  wide: { flex: 1 },
  // the machine column: version, updates, notices — one stacked block on the
  // grid's right three columns, button full-width like every board dock;
  // centered like the task column so the two plates share one midline
  machine: { gap: s(18), width: layout.span(3), justifyContent: 'center' },
  checkButton: { width: '100%' },
  value: mono(30, { color: colors.chalk }),

  // cyan speaks only for trouble; a good outcome answers in chalk
  notice: { ...text.notice },
  noticeOk: { ...text.label, color: colors.chalk },
  label: text.label,
  versionLabel: text.label,
});
