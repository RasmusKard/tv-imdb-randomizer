#!/usr/bin/env node
/**
 * Generates update-manifest.json, the one file every installed app polls.
 * The checker picks exactly one
 * channel and never sees the other.
 *
 *   node scripts/make-manifest.mjs --tag v1.2.3 --apk app-tv-1.2.3.apk --notes notes.txt
 *
 * A beta tag updates only the "beta" entry, a stable tag only the "stable"
 * entry — the other channel is carried over from the previous manifest so the
 * two channels can release independently, SmartTube-style.
 */
import { createHash } from 'node:crypto';
import { createReadStream, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import { versionFromTag } from './version-from-tag.mjs';

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

const tag = arg('tag');
const apk = arg('apk');
const notesFile = arg('notes');
const out = arg('out') ?? 'update-manifest.json';
const prevPath = arg('prev') ?? (existsSync(out) ? out : undefined);
const repo = arg('repo') ?? process.env.GITHUB_REPOSITORY;
if (!repo) throw new Error('pass --repo owner/name or set GITHUB_REPOSITORY');
if (!apk || !existsSync(apk)) throw new Error(`pass --apk with a path that exists`);

const { versionName, versionCode } = versionFromTag(tag);
const channel = tag.includes('-beta.') ? 'beta' : 'stable';

const changelog = notesFile
  ? readFileSync(notesFile, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean)
  : [];

const md5 = await new Promise((resolve, reject) => {
  const hash = createHash('md5');
  createReadStream(apk)
    .on('data', (chunk) => hash.update(chunk))
    .on('error', reject)
    .on('end', () => resolve(hash.digest('hex')));
});

const manifest = prevPath ? JSON.parse(readFileSync(prevPath, 'utf8')) : {};
manifest[channel] = {
  versionName,
  versionCode,
  apkUrl: `https://github.com/${repo}/releases/download/latest/${basename(apk)}`,
  md5,
  changelog,
};

writeFileSync(out, JSON.stringify(manifest, null, 2) + '\n');
console.log(`${out}: ${channel} ${versionName} (versionCode ${versionCode}, md5 ${md5})`);
