/**
 * Where the what-watch API lives, and the one header every authed call shares.
 *
 * Pure on purpose — no React Native import may appear in this module:
 * `yarn checks` runs client.ts under tsx/esbuild, which cannot parse RN's
 * Flow syntax, so client.ts takes authHeaders from here, never from auth.ts.
 */

/** The emulator's LAN proxy, dev bundles only. A release bundle takes its URL
 * from EXPO_PUBLIC_API_URL at build time — the release workflow enforces one. */
const DEV = process.env.NODE_ENV === 'development';
export const BASE = process.env.EXPO_PUBLIC_API_URL ?? (DEV ? 'http://10.0.2.2:3000' : '');

/**
 * A token riding every title query. The server excludes this user's watched
 * titles from `title_full` when it sees a valid Bearer — an invalid or expired
 * one reads as anonymous instead of erroring, so the failure mode is "titles
 * come back that the user has already seen", never a dead board.
 */
export function authHeaders(token: string | undefined): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}
