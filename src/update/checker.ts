import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';

import { pickUpdate, type Manifest, type UpdateInfo } from './compare';

/**
 * The OTA check. The manifest is a static JSON published to a GitHub
 * "latest" release — there is no update server, only a
 * file this build was pointed at through EXPO_PUBLIC_UPDATE_MANIFEST_URL.
 */

const MANIFEST_URL = process.env.EXPO_PUBLIC_UPDATE_MANIFEST_URL ?? '';
const CHANNEL = process.env.EXPO_PUBLIC_UPDATE_CHANNEL ?? 'stable';
const LAST_CHECK_KEY = 'whatwatch.lastUpdateCheck';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export function updateChannel(): string {
  return CHANNEL;
}

export function installedVersion(): { versionName: string | null; versionCode: number } {
  return {
    versionName: Application.nativeApplicationVersion ?? null,
    // versionCode on Android, which is the only half the comparison uses
    versionCode: Number(Application.nativeBuildVersion ?? 0),
  };
}

/**
 * The update to offer, or null when up to date, unconfigured, or this
 * channel has no release. Auto-checks run at most once a day (AsyncStorage
 * stamp; force skips it). A throw means the check itself failed — callers
 * show that only for manual checks, auto-checks stay silent.
 */
export async function checkForUpdate({
  force = false,
}: { force?: boolean } = {}): Promise<UpdateInfo | null> {
  if (!MANIFEST_URL) return null;
  const last = Number((await AsyncStorage.getItem(LAST_CHECK_KEY)) ?? 0);
  if (!force && Date.now() - last < ONE_DAY_MS) return null;

  const res = await fetch(MANIFEST_URL);
  if (!res.ok) throw new Error(`update manifest answered ${res.status}`);
  const manifest = (await res.json()) as Manifest;
  // the stamp only survives a check that actually reached the manifest, so a
  // failed one retries on the next app start
  await AsyncStorage.setItem(LAST_CHECK_KEY, String(Date.now()));

  return pickUpdate(manifest, CHANNEL, installedVersion().versionCode);
}
