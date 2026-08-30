import AsyncStorage from '@react-native-async-storage/async-storage';

import { BASE } from './base';

/**
 * The account, and the watched list. The server is PostgREST: register and
 * login are RPCs that hand back a JWT, and the watched table is a plain
 * resource keyed (user_id, tconst) — the user_id comes from the token, never
 * from the client. See the API's "Accounts, and the watched list" section.
 */

const TOKEN_KEY = 'whatwatch.token';
const EMAIL_KEY = 'whatwatch.email';

export type Session = { token: string; email: string };

export async function loadSession(): Promise<Session | null> {
  const [token, email] = await Promise.all([AsyncStorage.getItem(TOKEN_KEY), AsyncStorage.getItem(EMAIL_KEY)]);
  return token && email ? { token, email } : null;
}

export async function saveSession(s: Session): Promise<void> {
  await AsyncStorage.setItem(TOKEN_KEY, s.token);
  await AsyncStorage.setItem(EMAIL_KEY, s.email);
}

export async function clearSession(): Promise<void> {
  await AsyncStorage.removeItem(TOKEN_KEY);
  await AsyncStorage.removeItem(EMAIL_KEY);
}

/**
 * A token riding every title query. The server excludes this user's watched
 * titles from `title_full` when it sees a valid Bearer — an invalid or expired
 * one reads as anonymous instead of erroring, so the failure mode is "titles
 * come back that the user has already seen", never a dead board.
 */
export function authHeaders(token: string | undefined): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

type RpcError = { status: number; message: string };

async function rpc(name: 'register' | 'login', email: string, password: string): Promise<Session> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/rpc/${name}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    throw { status: 0, message: 'Could not reach the server' } satisfies RpcError;
  }
  // the RPC returns the JWT as a bare string; an error comes back as a JSON
  // object with `message`. Accept the documented { token } shape too.
  const body = (await res.json().catch(() => null)) as string | { token?: string; message?: string } | null;
  const token = typeof body === 'string' ? body : body?.token;
  if (!res.ok || !token) {
    const message = (typeof body === 'object' && body?.message) || `sign-in failed (${res.status})`;
    throw {
      status: res.status,
      message: /duplicate|exists|unique/i.test(message)
        ? 'That email already has an account — sign in instead'
        : message,
    } satisfies RpcError;
  }
  return { token, email };
}

/** Register is login-plus-signup: one call creates the account and returns the token. */
export function register(email: string, password: string): Promise<Session> {
  return rpc('register', email, password);
}

export function login(email: string, password: string): Promise<Session> {
  return rpc('login', email, password);
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
