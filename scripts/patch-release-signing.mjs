#!/usr/bin/env node
/**
 * Points the freshly prebuilt release build at the real keystore. Runs after
 * `expo prebuild --clean` in CI, because prebuild regenerates build.gradle
 * with release signed by the debug key ("Caution!" and all).
 *
 *   node scripts/patch-release-signing.mjs
 *
 * Reads the keystore from android/app/release.keystore (the workflow decodes
 * it from the KEYSTORE_BASE64 secret) and the passwords/alias from env:
 * KEYSTORE_PASSWORD, KEY_ALIAS, KEY_PASSWORD. Fails hard on anything missing —
 * an unsigned "release" must never ship.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const gradlePath = join(
  dirname(fileURLToPath(import.meta.url)), '..', 'android', 'app', 'build.gradle',
);
let gradle = readFileSync(gradlePath, 'utf8');

const secret = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  // the values end up inside single quotes in build.gradle
  return value.replaceAll(`'`, `\\'`);
};

if (gradle.includes('signingConfigs.release')) {
  throw new Error('release signing config already present — patch is not idempotent-safe');
}

// A separate signingConfigs block merges with the prebuild-generated one, so
// the debug block stays untouched.
gradle = gradle.replace(
  /buildTypes \{/,
  `signingConfigs {
    release {
      storeFile file('release.keystore')
      storePassword '${secret('KEYSTORE_PASSWORD')}'
      keyAlias '${secret('KEY_ALIAS')}'
      keyPassword '${secret('KEY_PASSWORD')}'
    }
  }

  buildTypes {`,
);

// Only the release build type flips; the debug build keeps signingConfigs.debug.
const patched = gradle.replace(
  /(release \{[^{}]*?)signingConfig signingConfigs\.debug/,
  '$1signingConfig signingConfigs.release',
);
if (patched === gradle) throw new Error('did not find the release signingConfig line');
if (!/signingConfig signingConfigs\.release/.test(patched)) {
  throw new Error('release build type was not repointed');
}

writeFileSync(gradlePath, patched);
console.log('release build type now signs with signingConfigs.release');
