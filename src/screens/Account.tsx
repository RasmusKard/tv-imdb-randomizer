import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, BackHandler, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { fetchWatched, login, register, type Session } from '../api/auth';
import { ActionButton } from '../components/ActionButton';
import { UpdateCard } from '../components/UpdateCard';
import type { UpdateInfo } from '../update/compare';
import { checkForUpdate, installedVersion } from '../update/checker';
import { colors, displayHeavy, layout, mono, s, screen } from '../theme';

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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // account notices change silently otherwise; announce them for TalkBack
  useEffect(() => {
    if (notice) AccessibilityInfo.announceForAccessibility(notice);
  }, [notice]);

  // A TV TextInput that holds focus eats the D-pad for its caret, so the
  // fields are rows first: OK opens one for typing, back or DONE closes it —
  // the same walk-in/walk-out grammar the slider uses.
  const [editing, setEditing] = useState<'email' | 'password' | null>(null);

  // back closes an open field before it leaves the screen; on the board it
  // exits without a confirmation, which is what the Android TV guidance asks for
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (editing) {
        setEditing(null);
        return true;
      }
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [editing, onBack]);

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
      setNotice('enter an email and a password');
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const s = mode === 'signup' ? await register(email.trim(), password) : await login(email.trim(), password);
      onSession(s);
      setPassword('');
    } catch (e) {
      setNotice((e as { message?: string }).message ?? 'couldn\u2019t sign in — try again');
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

        {session ? (
          <View style={styles.form}>
            <Row label="Signed in as">
              <Text style={styles.value}>{session.email}</Text>
            </Row>
            <Row label="Titles watched">
              <Text style={styles.value}>{watchedCount !== null ? group(watchedCount) : '—'}</Text>
            </Row>
            <View style={styles.row}>
              <ActionButton label="Import CSV" testID="account-import" onPress={onImport} style={styles.wide} hasTVPreferredFocus />
            </View>
            <View style={styles.row}>
              <ActionButton label="Sign out" variant="ghost" testID="account-signout" onPress={signOut} style={styles.wide} />
            </View>
          </View>
        ) : (
          <View style={styles.form}>
            <Row label="Email">
              <Field
                open={editing === 'email'}
                onOpen={() => setEditing('email')}
                testID="account-email"
                label="Email"
                initialFocus
              >
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  editable={editing === 'email'}
                  focusable={editing === 'email'}
                  pointerEvents={editing === 'email' ? 'auto' : 'none'}
                  hasTVPreferredFocus={editing === 'email'}
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                  placeholder="you@example.com"
                  placeholderTextColor={colors.dim}
                  onSubmitEditing={() => setEditing(null)}
                />
              </Field>
            </Row>
            <Row label="Password">
              <Field
                open={editing === 'password'}
                onOpen={() => setEditing('password')}
                testID="account-password"
                label="Password"
              >
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  editable={editing === 'password'}
                  focusable={editing === 'password'}
                  pointerEvents={editing === 'password' ? 'auto' : 'none'}
                  hasTVPreferredFocus={editing === 'password'}
                  secureTextEntry
                  autoCapitalize="none"
                  onSubmitEditing={() => setEditing(null)}
                />
              </Field>
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

/**
 * A field row: the D-pad target, not the input itself. OK opens the input for
 * typing (the row lights while open); back or DONE closes it and focus comes
 * back to the row, so the pad never gets trapped in a caret. The email row
 * takes the screen's initial focus — a restored task lands here with no view
 * focused at all, and arrows do nothing without an anchor.
 */
function Field({
  open,
  onOpen,
  testID,
  label,
  initialFocus,
  children,
}: {
  open: boolean;
  onOpen: () => void;
  testID: string;
  label: string;
  initialFocus?: boolean;
  children: ReactNode;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ expanded: open }}
      onPress={onOpen}
      hasTVPreferredFocus={initialFocus}
      style={({ focused }) => [styles.inputRow, (focused || open) && styles.inputRowOpen]}
    >
      {children}
    </Pressable>
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
  // the row owns the chrome: it is the focus target, and it lights when open
  inputRow: {
    borderWidth: layout.border,
    borderColor: colors.slatHi,
    borderRadius: layout.radius,
    backgroundColor: colors.slat,
  },
  inputRowOpen: { borderColor: colors.sodium },
  input: {
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
