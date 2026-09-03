import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as Network from 'expo-network';
import { File } from 'expo-file-system';
import QRCode from 'react-native-qrcode-svg';

import { pushWatched, type Session } from '../api/auth';
import { extractImdbIds } from '../lib/csv';
import { ActionButton } from '../components/ActionButton';
import { T } from '../components/T';
import { GridRow } from '../components/GridRow';
import { Reel } from '../components/Reel';
import { startUploadServer, type UploadOutcome } from '../server/uploadServer';
import { groupThousands } from '../lib/format';
import { colors, displayHeavy, layout, mono, monoBold, s, screen, text } from '../theme';

type Props = {
  session: Session;
  onBack: () => void;
  /** Fired after ids actually landed, so the board recounts its corpus. */
  onImported: () => void;
};

type LogLine = { text: string; kind: 'info' | 'ok' | 'err' };

/** tvOS has no document picker UI at all; Android TV does (SAF). */
const HAS_PICKER = !(Platform.OS === 'ios' && Platform.isTV);

/**
 * The import screen. The main route is the QR: it hosts a small HTTP server on
 * the TV's own Wi-Fi address and shows the URL as a code, so a phone can open
 * the upload page and drop its IMDb export. Picking a file on the TV itself
 * and pasting CSV text are the fallbacks, in that order.
 */
export function Import({ session, onBack, onImported }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const [log, setLog] = useState<LogLine[]>([]);
  const [totals, setTotals] = useState<{ found: number; added: number; total: number } | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');

  const sessionRef = useRef(session);
  sessionRef.current = session;

  const addLog = useCallback((text: string, kind: LogLine['kind'] = 'info') => {
    setLog((l) => [...l.slice(-6), { text, kind }]);
  }, []);

  // uploads are serialized — two devices dropping at once must not interleave
  // two pushWatched calls' chunk loops
  const chain = useRef<Promise<unknown>>(Promise.resolve());

  const runImport = useCallback(
    (csv: string, source: string): Promise<UploadOutcome> => {
      const run = async (): Promise<UploadOutcome> => {
        const ids = extractImdbIds(csv);
        if (!ids.length) {
          addLog(`${source}: no IMDb ids found — is it an IMDb export?`, 'err');
          return { ok: false, error: 'No IMDb ids (Const column) in that file — is it an IMDb export?' };
        }
        addLog(`${source}: ${groupThousands(ids.length)} ids, pushing…`);
        try {
          const r = await pushWatched(sessionRef.current.token, ids);
          setTotals({ found: ids.length, added: r.added, total: r.total });
          addLog(`${source}: ${groupThousands(r.added)} new, ${groupThousands(r.total)} watched in total`, 'ok');
          onImported();
          return { ok: true, added: r.added, total: r.total };
        } catch (e) {
          const message = (e as { message?: string }).message ?? '';
          // a raw status is log-speak, not copy: the 401 gets its own line
          // (the session is dead), everything else reads as one server refusal
          const error = message === 'watched push failed: 401'
            ? 'device session expired — try again'
            : /watched push failed/.test(message) || !message
              ? 'the server refused part of that — try again'
              : message;
          addLog(`${source}: ${error}`, 'err');
          return { ok: false, error };
        }
      };
      const next = chain.current.then(run, run);
      // a failed upload must not poison the chain for the next one
      chain.current = next.catch(() => {});
      return next;
    },
    [addLog, onImported],
  );

  // the server lives exactly as long as this screen
  useEffect(() => {
    let stopped = false;
    let server: { stop: () => void } | null = null;
    (async () => {
      try {
        // SDK 57 returns the address itself, not a { ip } record. A device with
        // no Wi-Fi interface (the ATV emulator) answers 0.0.0.0 — the QR would
        // point nowhere, so say so and leave the paste path as the route in.
        const ip = await Network.getIpAddressAsync();
        const reachable = !!ip && ip !== '0.0.0.0';
        const started = await startUploadServer((csv) => runImport(csv, 'upload'));
        if (stopped) {
          started.stop();
          return;
        }
        server = started;
        if (reachable) setUrl(`http://${ip}:${started.port}${started.path}`);
        else setFatal(`no Wi-Fi address on this device (${ip}) — the QR cannot work; use Paste CSV`);
      } catch (e) {
        if (!stopped) setFatal((e as Error).message);
      }
    })();
    return () => {
      stopped = true;
      server?.stop();
    };
  }, [runImport]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      // the input grammar: back closes the open row first, exits second
      if (pasteOpen) {
        setPasteOpen(false);
        return true;
      }
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack, pasteOpen]);

  const pickFile = useCallback(async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ multiple: false });
      if (res.canceled) return;
      const asset = res.assets[0];
      const csv = await new File(asset.uri).text();
      await runImport(csv, asset.name);
    } catch (e) {
      addLog(`file pick failed: ${(e as Error).message}`, 'err');
    }
  }, [addLog, runImport]);

  const importPaste = useCallback(async () => {
    await runImport(pasteText, 'pasted CSV');
    setPasteText('');
    setPasteOpen(false);
  }, [pasteText, runImport]);

  return (
    <View style={screen.root}>
      <View style={screen.safe}>
        <View style={styles.head}>
          <T style={styles.wordmark}>
            sync your <T style={styles.wordmarkDot}>list</T>
          </T>
          <T style={styles.label}>
            {fatal
              ? 'no upload server — paste CSV is the way in'
              : url
                ? 'scan the code with your phone — it opens the upload page'
                : 'starting the upload server…'}
          </T>
        </View>

        <View style={styles.body}>
          <View style={styles.qrColumn}>
            {url ? (
              <>
                <View style={styles.qrCard}>
                  <QRCode value={url} size={s(380)} backgroundColor="#FFFFFF" color={colors.boardLo} />
                </View>
                <T style={styles.url} selectable>
                  {url}
                </T>
              </>
            ) : fatal ? (
              // the dead code: same card, same footprint, no white — white says
              // "scanner target" and this one points nowhere. The reel is the
              // booth's own stand-in for a picture that is not there, and the
              // warning takes the URL's place beneath it
              <>
                <View style={styles.qrDead}>
                  <Reel />
                </View>
                <T style={styles.fatal}>{fatal}</T>
              </>
            ) : (
              <T style={styles.waiting}>{fatal ?? 'Same Wi-Fi as your phone, in a moment…'}</T>
            )}
          </View>

          <View style={styles.side}>
            <T style={styles.step}>1 · On your phone: imdb.com, sign in</T>
            <T style={styles.step}>2 · Account menu → Your ratings → Export</T>
            {/* the third step names the route that actually exists: with no
                server there is no page to open, and the QR instructions would
                point at a door that is not there */}
            <T style={styles.step}>
              {fatal ? '3 · Open ratings.csv, copy everything, paste it here' : '3 · Open this page on the phone, drop ratings.csv'}
            </T>

            {/* the log lives here only once there is a log: an empty bordered
                strip is a container doing proximity's job */}
            {(totals !== null || log.length > 0) && (
              <View style={styles.logBox}>
                {totals ? (
                  <T style={styles.totals}>
                    found {groupThousands(totals.found)} · added {groupThousands(totals.added)} · watched {groupThousands(totals.total)}
                  </T>
                ) : null}
                <ScrollView focusable={false}>
                  {log.map((l, i) => (
                    <T key={i} style={l.kind === 'ok' ? styles.logOk : l.kind === 'err' ? styles.logErr : styles.logInfo}>
                      {l.text}
                    </T>
                  ))}
                </ScrollView>
              </View>
            )}

            {pasteOpen ? (
              <TextInput
                style={styles.paste}
                value={pasteText}
                onChangeText={setPasteText}
                multiline
                allowFontScaling={false}
                placeholder="paste the contents of ratings.csv here"
                placeholderTextColor={colors.dim}
                testID="import-paste-input"
              />
            ) : null}
          </View>
        </View>

        <View style={styles.dock}>
          <GridRow>
            {/* paste mode replaces pick mode: four span(2) buttons would be
                eight columns, and the back button would leave the screen */}
            {HAS_PICKER && !pasteOpen ? (
              <ActionButton label="Pick CSV" testID="import-pick" onPress={pickFile} style={styles.button} hasTVPreferredFocus={!fatal} />
            ) : null}
            {pasteOpen ? (
              <ActionButton label="Import pasted" testID="import-paste-go" onPress={importPaste} style={styles.button} hasTVPreferredFocus={!HAS_PICKER} />
            ) : null}
            <ActionButton
              label={pasteOpen ? 'Close paste' : 'Paste CSV'}
              variant="ghost"
              testID="import-paste"
              onPress={() => setPasteOpen(!pasteOpen)}
              // with no server there is exactly one working route in; it leads
              hasTVPreferredFocus={!!fatal && !pasteOpen}
              style={styles.button}
            />
            <ActionButton label="Back" variant="ghost" testID="import-back" onPress={onBack} style={styles.button} />
          </GridRow>
        </View>
      </View>
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
  label: text.label,

  body: { flexDirection: 'row', gap: layout.gap, paddingTop: s(20) },
  qrColumn: { width: layout.span(3), alignItems: 'center', gap: s(14) },
  // scanners read dark-on-light far more reliably than the inverted scheme
  qrCard: {
    backgroundColor: '#FFFFFF',
    padding: s(16),
    borderRadius: layout.radius,
  },
  url: mono(24, { color: colors.chalk, textAlign: 'center' }),
  waiting: { ...text.body, color: colors.dim, textAlign: 'center', marginTop: s(180) },
  /** the dead QR card: the live card's exact footprint, unlit — slat, not
   * white, because white is the scanner target and there is nothing to scan */
  qrDead: {
    width: s(380) + s(16) * 2,
    height: s(380) + s(16) * 2,
    justifyContent: 'center',
    backgroundColor: colors.slat,
    padding: s(16),
    borderRadius: layout.radius,
    borderWidth: layout.border,
    borderColor: colors.slatHi,
  },
  /** the warning voice: a dead server is a warning, not a quiet aside */
  fatal: { ...text.notice, textAlign: 'center' },

  side: { width: layout.span(4), gap: s(10) },
  step: { ...text.body, color: colors.chalk },

  logBox: {
    height: s(160),
    backgroundColor: colors.boardLo,
    borderColor: colors.slatHi,
    borderWidth: layout.border,
    borderRadius: layout.radius,
    padding: s(12),
    gap: s(6),
  },
  totals: monoBold(26, { em: 0.08, caps: true, color: colors.sodium }),
  logInfo: mono(22, { color: colors.dim }),
  logOk: mono(22, { color: colors.sodium }),
  logErr: mono(22, { color: colors.cold }),

  paste: {
    ...mono(22, { color: colors.chalk }),
    backgroundColor: colors.slat,
    borderColor: colors.slatHi,
    borderWidth: layout.border,
    borderRadius: layout.radius,
    padding: s(12),
    height: s(160),
  },

  dock: { marginTop: 'auto', paddingTop: s(2), borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.slatHi },
  button: { width: layout.span(2) },
});
