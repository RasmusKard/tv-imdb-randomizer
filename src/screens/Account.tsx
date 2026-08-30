import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { BackHandler, StyleSheet, Text, TextInput, View } from 'react-native';

import { fetchWatched, login, register, type Session } from '../api/auth';
import { ActionButton } from '../components/ActionButton';
import { UpdateCard } from '../components/UpdateCard';
import type { UpdateInfo } from '../update/compare';
import { checkForUpdate, installedVersion } from '../update/checker';
import { colors, display, layout, mono, s, screen } from '../theme';

type Props = {
  session: Session | null;
  onSession: (s: Session | null) => void;
  onImport: () => void;
  onBack: () => void;
  /** An update the app has found and is offering; lives here so the board banner can point at it. */
  update: UpdateInfo | null;
  onUpdate: (u: UpdateInfo | null) => void;
};

/**
 * The account screen: a sign-in form when signed out, the account summary and
 * the way into the CSV import when signed in. Remote typing is miserable, so
 * the form is exactly two fields and two actions — register reuses the same
 * fields, since the server's register is login-plus-signup anyway.
 */
export function Account({ session, onSession, onImport, onBack, update, onUpdate }: Props) {
  // back returns to the board — it works signed out, so there is nothing to confirm
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

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

  const submit = useCallback(async () => {
    if (busy || !email.includes('@') || password.length < 1) {
      setNotice('Enter an email and a password');
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const s = mode === 'signup' ? await register(email.trim(), password) : await login(email.trim(), password);
      onSession(s);
      setPassword('');
    } catch (e) {
      setNotice((e as { message?: string }).message ?? 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }, [busy, email, password, mode, onSession]);

  const signOut = useCallback(() => {
    onSession(null);
    setWatchedCount(null);
    setMode('signin');
  }, [onSession]);

  // updates have nothing to do with the account — the row lives below the
  // form either way. A manual check always answers, unlike the daily one.
  const version = installedVersion();
  const [checking, setChecking] = useState(false);
  const checkForUpdates = useCallback(async () => {
    if (checking) return;
    setChecking(true);
    setNotice(null);
    try {
      const found = await checkForUpdate({ force: true });
      onUpdate(found);
      if (!found) setNotice('Up to date');
    } catch (e) {
      setNotice((e as { message?: string }).message ?? 'Update check failed');
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

        {session ? (
          <View style={styles.form}>
            <Row label="Signed in as">
              <Text style={styles.value}>{session.email}</Text>
            </Row>
            <Row label="Titles watched">
              <Text style={styles.value}>{watchedCount !== null ? group(watchedCount) : '—'}</Text>
            </Row>
            <View style={styles.row}>
              <ActionButton label="Import CSV" testID="account-import" onPress={onImport} style={styles.wide} />
            </View>
            <View style={styles.row}>
              <ActionButton label="Sign out" variant="ghost" testID="account-signout" onPress={signOut} style={styles.wide} />
            </View>
          </View>
        ) : (
          <View style={styles.form}>
            <Row label="Email">
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                placeholder="you@example.com"
                placeholderTextColor={colors.dimmer}
                testID="account-email"
              />
            </Row>
            <Row label="Password">
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                testID="account-password"
              />
            </Row>
            <View style={styles.row}>
              <ActionButton
                label={mode === 'signup' ? 'Create account' : 'Sign in'}
                testID="account-submit"
                onPress={submit}
                style={styles.wide}
              />
              <ActionButton
                label={mode === 'signup' ? 'I have an account' : 'New here? Create one'}
                variant="ghost"
                testID="account-mode"
                onPress={() => setMode(mode === 'signup' ? 'signin' : 'signup')}
                style={styles.wide}
              />
            </View>
          </View>
        )}

        {update && (
          <View style={styles.updateBlock}>
            <UpdateCard
              info={update}
              testID="update-card"
              onHandedOff={() => setNotice('Installer opened — confirm it there')}
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
  wordmark: display(32, { em: -0.03, fontWeight: '800', color: colors.chalk }),
  wordmarkDot: { color: colors.sodium },

  form: { paddingTop: s(24), gap: s(18), width: layout.span(4) },
  fieldRow: { gap: s(6) },
  row: { flexDirection: 'row', gap: layout.gap },
  wide: { flex: 1 },
  value: mono(30, { color: colors.chalk }),
  input: {
    backgroundColor: colors.slat,
    borderColor: colors.slatHi,
    borderWidth: layout.border,
    borderRadius: layout.radius,
    color: colors.chalk,
    fontSize: s(30),
    paddingHorizontal: s(16),
    height: s(64),
  },

  notice: mono(26, { em: 0.1, caps: true, color: colors.cold, marginTop: 'auto' }),
  label: mono(26, { em: 0.2, caps: true, color: colors.dim }),

  updateBlock: { width: layout.span(4) },
  versionRow: { flexDirection: 'row', gap: layout.gap, width: layout.span(4), alignItems: 'center' },
  versionLabel: mono(26, { em: 0.2, caps: true, color: colors.dim }),
});
