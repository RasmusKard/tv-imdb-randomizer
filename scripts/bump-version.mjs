#!/usr/bin/env node
/**
 * Writes the release version into app.json, so `expo prebuild --clean` stamps
 * it into Gradle. versionCode can never be a manual edit in build.gradle —
 * prebuild would wipe it.
 *
 *   node scripts/bump-version.mjs v1.2.3
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { versionFromTag } from './version-from-tag.mjs';

const tag = process.argv[2];
const { versionName, versionCode } = versionFromTag(tag);

const appJsonPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'app.json');
const appJson = JSON.parse(readFileSync(appJsonPath, 'utf8'));

appJson.expo.version = versionName;
appJson.expo.android ??= {};
appJson.expo.android.versionCode = versionCode;

writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2) + '\n');
console.log(`${tag} -> version ${versionName} (versionCode ${versionCode})`);
