import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';

import { BASE, authHeaders } from './base';

/**
 * The account, and the watched list. The account is the device itself: the
 * ANDROID_ID is sent to `POST /rpc/device_login`, which finds or creates the
 * user and hands back the same JWT login used to. The server is PostgREST, and
 * the watched table is a plain resource keyed (user_id, tconst) — the user_id
 * comes from the token, never from the client. See the API's
 * "Accounts, and the watched list" section.
 */

const TOKEN_KEY = 'whatwatch.token';
const EMAIL_KEY = 'whatwatch.email';
const DEVICE_ID_KEY = 'whatwatch.deviceId';

export type Session = { token: string; deviceId: string };

/** A short tag for the account chip: the ANDROID_ID's last four hex digits. */
export function deviceTag(deviceId: string): string {
  return `device ${deviceId.slice(-4)}`;
}

/**
 * The device UID. ANDROID_ID is unique per app-signing key, user and device,
 * and survives reinstalls and updates; the persisted random fallback only
 * exists for the emulator edge where the setting reads empty, so the account
 * still binds to something stable.
 */
export async function getDeviceId(): Promise<string> {
  const androidId = Application.getAndroidId();
  if (androidId) return androidId;
  let stored = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (!stored) {
    stored = Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    await AsyncStorage.setItem(DEVICE_ID_KEY, stored);
  }
  return stored;
}

export async function loadSession(): Promise<Session | null> {
  // accounts used to carry an email; sweep the dead key out of old installs
  await AsyncStorage.removeItem(EMAIL_KEY);
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  if (!token) return null;
  return { token, deviceId: await getDeviceId() };
}

export async function saveSession(s: Session): Promise<void> {
  await AsyncStorage.setItem(TOKEN_KEY, s.token);
}

export async function clearSession(): Promise<void> {
  await AsyncStorage.removeItem(TOKEN_KEY);
}

/**
 * Sign in as the device. Idempotent on the server: the first call creates the
 * account, every later one returns the same user. The RPC returns the JWT as a
 * bare string; an error comes back as a JSON object with `message`. Accept the
 * documented { token } shape too.
 */
export async function deviceLogin(): Promise<Session> {
  const deviceId = await getDeviceId();
  let res: Response;
  try {
    res = await fetch(`${BASE}/rpc/device_login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_device_id: deviceId }),
    });
  } catch {
    throw new Error('Could not reach the server');
  }
  const body = (await res.json().catch(() => null)) as string | { token?: string; message?: string } | null;
  const token = typeof body === 'string' ? body : body?.token;
  if (!res.ok || !token) {
    const message = (typeof body === 'object' && body?.message) || `device sign-in failed (${res.status})`;
    throw new Error(message);
  }
  return { token, deviceId };
}

/** The signed-in user's watched tconsts. An expired token reads as an empty list. */
export async function fetchWatched(token: string): Promise<string[]> {
  const res = await fetch(`${BASE}/watched`, { headers: authHeaders(token) });
  if (!res.ok) throw new Error(`watched fetch failed: ${res.status}`);
  const rows = await res.json();
  if (!Array.isArray(rows)) throw new Error('watched: server answered, not with rows');
  return rows.map((r) => r.tconst);
}

export type PushResult = { added: number; total: number };

/**
 * Mark ids watched. The list already on the server is fetched first and the
 * delta posted in chunks with `resolution=ignore-duplicates`, so an import is
 * idempotent however many times it runs, and a whole CSV lands in a handful of
 * requests instead of one per title. A 409 (raced duplicate) counts as done.
 */
export async function pushWatched(token: string, ids: string[]): Promise<PushResult> {
  const existing = new Set(await fetchWatched(token));
  const fresh = ids.filter((id) => !existing.has(id));

  for (let i = 0; i < fresh.length; i += 500) {
    const chunk = fresh.slice(i, i + 500);
    const res = await fetch(`${BASE}/watched`, {
      method: 'POST',
      headers: {
        ...authHeaders(token),
        'Content-Type': 'application/json',
        Prefer: 'resolution=ignore-duplicates',
      },
      body: JSON.stringify(chunk.map((tconst) => ({ tconst }))),
    });
    if (!res.ok && res.status !== 409) throw new Error(`watched push failed: ${res.status}`);
  }
  return { added: fresh.length, total: existing.size + fresh.length };
}
