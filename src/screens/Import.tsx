import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, ScrollView, StyleSheet, View } from 'react-native';
import * as Network from 'expo-network';
import QRCode from 'react-native-qrcode-svg';
import TcpSocket from 'react-native-tcp-socket';

import { BASE } from '../api/base';
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

/**
 * The LAN address the QR must point at. expo-network's getIpAddressAsync
 * reads the Wi-Fi manager only, so an Ethernet TV box answers 0.0.0.0; the
 * fallback dials the API host and reads the socket's own local address —
 * the address this device reaches the world through is the address a phone
 * on the same network needs. Best effort: on failure the screen goes fatal.
 */
async function lanAddress(): Promise<string> {
  const ip = await Network.getIpAddressAsync();
  if (ip && ip !== '0.0.0.0') return ip;

  let url: URL;
  try {
    url = new URL(BASE);
  } catch {
    return '';
  }
  // the emulator's LAN proxy: dialing it always "succeeds" through Android's
  // NAT and reports a 10.0.2.15 no phone can reach — that build gets no QR
  if (!url.hostname || url.hostname === '10.0.2.2') return '';

  return new Promise((resolve) => {
    let settled = false;
    const settle = (v: string) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(v);
    };
    const timer = setTimeout(() => settle(''), 4000);
    const socket = TcpSocket.createConnection(
      {
        host: url.hostname,
        port: Number(url.port) || (url.protocol === 'https:' ? 443 : 80),
      },
      () => {
        clearTimeout(timer);
        // only an IPv4 the phone can dial: an IPv6 link-local is unreachable from elsewhere
        const local = socket.localAddress ?? '';
        settle(/^\d+\.\d+\.\d+\.\d+$/.test(local) && local !== '0.0.0.0' ? local : '');
      },
    );
    socket.on('error', () => {
      clearTimeout(timer);
      settle('');
    });
  });
}

/**
 * The import screen. One route in: the QR. It hosts a small HTTP server on
 * the TV's own LAN address and shows the URL as a code, so a phone can open
 * the upload page and drop its IMDb export.
 */
export function Import({ session, onBack, onImported }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const [log, setLog] = useState<LogLine[]>([]);
  const [totals, setTotals] = useState<{ found: number; added: number; total: number } | null>(null);

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
        // no usable address at all (the ATV emulator) still answers 0.0.0.0
        // after the fallback — the QR would point nowhere, so say so.
        const ip = await lanAddress();
        const reachable = !!ip && ip !== '0.0.0.0';
        const started = await startUploadServer((csv) => runImport(csv, 'upload'));
        if (stopped) {
          started.stop();
          return;
        }
        server = started;
        if (reachable) setUrl(`http://${ip}:${started.port}${started.path}`);
        else setFatal(`no usable network address on this device (${ip || 'none'}) — check the connection and reopen this screen`);
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
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack]);

  return (
    <View style={screen.root}>
      <View style={screen.safe}>
        <View style={styles.head}>
          <T style={styles.wordmark}>
            sync your <T style={styles.wordmarkDot}>list</T>
          </T>
          <T style={styles.label}>
            {fatal
              ? 'no upload server — check the network and reopen this screen'
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
            <T style={styles.step}>3 · Open this page on the phone, drop ratings.csv</T>

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
          </View>
        </View>

        <View style={styles.dock}>
          <GridRow>
            <ActionButton
              label="Back"
              variant="ghost"
              testID="import-back"
              onPress={onBack}
              hasTVPreferredFocus
              style={styles.buttonWide}
            />
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

  dock: { marginTop: 'auto', paddingTop: s(2), borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.slatHi },
  // the QR path is driven from the phone; the only on-TV action is leaving
  buttonWide: { width: layout.span(2) },
});
