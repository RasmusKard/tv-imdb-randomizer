import * as IntentLauncher from 'expo-intent-launcher';
import * as FileSystem from 'expo-file-system/legacy';

import type { UpdateInfo } from './compare';

/**
 * Download, checksum, hand to the Android package installer.
 *
 * File work goes through expo-file-system/legacy: the legacy download
 * computes the APK's MD5 natively (the new API cannot, and hashing 50 MB in
 * JS on a low-RAM TV stick is not a plan), and getContentUriAsync turns the
 * file:// path into a content:// URI through Expo's own FileProvider, which
 * is the only thing the installer intent is allowed to read. Shape follows
 * PLAN-update.md.
 */

const UPDATES_DIR = 'updates';

async function updatesDir(): Promise<string> {
  const base = FileSystem.cacheDirectory;
  if (!base) throw new Error('no cache directory');
  const dir = `${base}${UPDATES_DIR}`;
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  return dir;
}

/** A failed install must not leave a 50 MB corpse in the cache. */
async function sweep(dir: string): Promise<void> {
  for (const name of await FileSystem.readDirectoryAsync(dir)) {
    await FileSystem.deleteAsync(`${dir}/${name}`, { idempotent: true });
  }
}

/**
 * Downloads the APK and verifies it against the manifest's MD5. Resolves
 * with the local file path; a mismatched checksum deletes the file and
 * throws, so a corrupt download can never reach the installer.
 */
export async function downloadUpdate(
  info: UpdateInfo,
  onProgress: (fraction: number) => void,
): Promise<string> {
  const dir = await updatesDir();
  await sweep(dir);
  const fileUri = `${dir}/app-${info.versionName}.apk`;

  const resumable = FileSystem.createDownloadResumable(
    info.apkUrl,
    fileUri,
    { md5: true },
    (progress) => {
      if (progress.totalBytesExpectedToWrite > 0) {
        onProgress(progress.totalBytesWritten / progress.totalBytesExpectedToWrite);
      }
    },
  );
  const result = await resumable.downloadAsync();
  if (!result) throw new Error('the download was cancelled');
  if (result.md5 && result.md5.toLowerCase() !== info.md5.toLowerCase()) {
    await FileSystem.deleteAsync(fileUri, { idempotent: true });
    throw new Error('the download does not match its checksum');
  }
  return fileUri;
}

/**
 * Opens the APK in the system package installer. First time around Android
 * asks for the "install unknown apps" grant — on a TV that lives under
 * Settings > Apps > Security & restrictions, which is why the card says so.
 */
export async function installUpdate(fileUri: string): Promise<void> {
  const contentUri = await FileSystem.getContentUriAsync(fileUri);
  // the library only constants Settings actions; a plain VIEW intent takes the
  // raw action string, which startActivityAsync accepts
  await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
    data: contentUri,
    // FLAG_GRANT_READ_URI_PERMISSION — the installer reads, never the app
    flags: 1,
    type: 'application/vnd.android.package-archive',
  });
}
