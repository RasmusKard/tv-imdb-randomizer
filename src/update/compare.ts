/**
 * Pure update-picking logic. No React Native imports, so src/lib/checks.ts
 * can run it under plain tsx.
 */

export type UpdateInfo = {
  versionName: string;
  versionCode: number;
  apkUrl: string;
  md5: string;
  changelog: string[];
};

/** One entry per channel; a channel with no current release is null. */
export type Manifest = { [channel: string]: UpdateInfo | null };

/**
 * The update this device should install, or null. Strictly greater only —
 * never downgrade, never reinstall the same build.
 */
export function pickUpdate(
  manifest: Manifest,
  channel: string,
  installedCode: number,
): UpdateInfo | null {
  const info = manifest[channel];
  return info && info.versionCode > installedCode ? info : null;
}
