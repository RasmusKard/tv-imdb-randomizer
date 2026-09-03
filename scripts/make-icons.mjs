#!/usr/bin/env node
/**
 * Generates every launcher/top-shelf icon for what.watch from one parametric
 * SVG master, in the committed projection-booth world (DESIGN.md): film-black
 * ground, chalk sprocket strips full-bleed top and bottom, and the
 * "what.watch" wordmark in Archivo ExtraBold — emulsion white with the one
 * amber dot. No bloom: the field stays flat film black by owner decision
 * (the amber glow read as generic AI wash and was removed).
 *
 * Direction contract — THESIS: the app icon is a frame of the film itself:
 * sprockets and wordmark; no glyph, no glow, no third colour. OWN-WORLD:
 * board/boardLo/slatHi/chalk/sodium tokens only. STORY: the couch reads
 * "what.watch" and the amber dot at 3 m on the launcher row. FIRST VIEWPORT:
 * wordmark centered between the sprocket bands, flat black field.
 * FORM: gate-light frame, glow stripped (owner-picked concept 2026-09-03,
 * bloom removed same day on owner review).
 * FINISH: renders are verified against the device grammar; rerun after any
 * edit via `node scripts/make-icons.mjs`.
 *
 * Provenance: hand-authored SVG, rendered with librsvg against the same
 * @expo-google-fonts Archivo 800 the app ships. No AI image generation.
 *
 * Outputs:
 *   assets/images/icon-*.png        — source of truth referenced by app.json
 *   android res tv_banner + mipmap launcher webps
 *   ios Images.xcassets brandassets / appiconset copies (byte-identical)
 */

import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';

const ROOT = resolve(dirname(new URL(import.meta.url).pathname), '..');
const BUILD = join(ROOT, '.icon-build');

// Design tokens (DESIGN.md sidecar colors).
const C = {
  board: '#0A0A0C', // film black ground
  boardLo: '#050507', // sprocket cutouts, deeper than ground
  band: '#15151A', // chalk at ~5% over the ground: the sprocket strip
  seam: '#232329', // slatHi hairline between strip and field
  chalk: '#E8E6DC', // emulsion white wordmark
  sodium: '#FFB02E', // the one lamp; the wordmark dot
};

// ---------------------------------------------------------------- geometry

/**
 * One sprocket strip: full-bleed band, pill holes punched darker, hairline
 * seam on the field side. Holes are sized to the canvas height so every
 * render, from the 320x180 Android banner up, keeps the same proportion.
 */
function sprocketStrip({ W, H, y, side }) {
  const sb = Math.round(H * 0.105); // band height
  const hh = Math.round(sb * 0.44); // hole height
  const hw = Math.round(hh * 1.38); // hole width — the system's 18x13 ratio
  const pitch = hw * 2.15;
  const seamY = side === 'top' ? y + sb : y - 1;
  const holeY = y + (sb - hh) / 2;
  const margin = pitch * 0.55;
  const n = Math.max(3, Math.floor((W - 2 * margin) / pitch));
  const used = (n - 1) * pitch + hw;
  const x0 = (W - used) / 2;
  let holes = '';
  for (let i = 0; i < n; i++) {
    holes += `<rect x="${x0 + i * pitch}" y="${holeY}" width="${hw}" height="${hh}" rx="${hh / 2}" fill="${C.boardLo}"/>`;
  }
  return (
    `<rect x="0" y="${y}" width="${W}" height="${sb}" fill="${C.band}"/>` +
    holes +
    `<rect x="0" y="${seamY}" width="${W}" height="1.5" fill="${C.seam}"/>`
  );
}

/** "what.watch" as flowing tspans so kerning survives the amber dot. */
function wordmark({ x, y, fs, lines = ['what', '.watch'] }) {
  const anchor = `text-anchor="middle"`;
  const common = `font-family="Archivo" font-weight="800" letter-spacing="-0.015em"`;
  if (lines.length === 1) {
    return `<text x="${x}" y="${y}" ${anchor} ${common} font-size="${fs}">
      <tspan fill="${C.chalk}">what</tspan><tspan fill="${C.sodium}">.</tspan><tspan fill="${C.chalk}">watch</tspan>
    </text>`;
  }
  const lh = fs * 1.16;
  const top = y - lh / 2 + fs * 0.35;
  return `<text ${anchor} ${common} font-size="${fs}">
    <tspan x="${x}" y="${top}" fill="${C.chalk}">what</tspan>
    <tspan x="${x}" y="${top + lh}"><tspan fill="${C.sodium}">.</tspan><tspan fill="${C.chalk}">watch</tspan></tspan>
  </text>`;
}

function svgDoc({ W, H, body }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${C.board}"/>
  ${body}
</svg>`;
}

// ------------------------------------------------------------ compositions

/** Landscape: single-line wordmark centered between the sprocket strips.
 *  No bloom — the field stays flat film black by owner decision (the glow
 *  read as generic AI gradient wash; removed 2026-09-03). */
function landscapeSVG(W, H) {
  const fs = Math.min(H * 0.34, (W * 0.78) / 5.3);
  const cy = H / 2;
  return svgDoc({
    W, H,
    body:
      sprocketStrip({ W, H, y: 0, side: 'top' }) +
      sprocketStrip({ W, H, y: H - Math.round(H * 0.105), side: 'bottom' }) +
      wordmark({ x: W / 2, y: cy + fs * 0.35, fs, lines: ['what.watch'] }),
  });
}

/** Square: the wordmark wrapped at its amber dot, two lines, flat field
 *  (no bloom, same owner decision). */
function squareSVG(W) {
  const H = W;
  const fs = (W * 0.70) / 3.11; // ".watch" measures ~3.11em
  const cy = H / 2;
  return svgDoc({
    W, H,
    body:
      sprocketStrip({ W, H, y: 0, side: 'top' }) +
      sprocketStrip({ W, H, y: H - Math.round(H * 0.105), side: 'bottom' }) +
      wordmark({ x: W / 2, y: cy, fs, lines: ['what', '.watch'] }),
  });
}

// ----------------------------------------------------------------- render

const LANDSCAPE = [
  [400, 240], [800, 480], [1280, 768],
  [1920, 720], [3840, 1440], [2320, 720], [4640, 1440],
];
const SQUARE = [760, 1024];
const MIPMAP = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };

function sh(cmd, args, env) {
  execFileSync(cmd, args, { env: { ...process.env, ...env }, stdio: 'pipe' });
}

// Fontconfig pointed at the shipped @expo-google-fonts Archivo 800 so librsvg
// resolves the exact face the app renders.
mkdirSync(join(BUILD, 'fonts'), { recursive: true });
mkdirSync(join(BUILD, 'cache'), { recursive: true });
cpSync(
  join(ROOT, 'node_modules/@expo-google-fonts/archivo/800ExtraBold/Archivo_800ExtraBold.ttf'),
  join(BUILD, 'fonts/Archivo_800ExtraBold.ttf'),
);
const fontsConf = join(BUILD, 'fonts.conf');
writeFileSync(fontsConf, `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <dir>${join(BUILD, 'fonts')}</dir>
  <cachedir>${join(BUILD, 'cache')}</cachedir>
</fontconfig>
`);
const ENV = { FONTCONFIG_FILE: fontsConf };

function renderPng(svg, W, H, out) {
  mkdirSync(dirname(out), { recursive: true });
  const svgPath = join(BUILD, `${basename(out)}.svg`);
  writeFileSync(svgPath, svg);
  sh('rsvg-convert', ['-w', String(W), '-h', String(H), '-o', out, svgPath], ENV);
}

const out = (rel) => join(ROOT, rel);
const ASSETS = 'assets/images';
const XC = 'ios/tvimdbrandomizer/Images.xcassets/TVAppIcon.brandassets';
const RES = 'android/app/src/main/res';

// 1. Source of truth in assets/images.
const rendered = {};
for (const [W, H] of LANDSCAPE) {
  const f = `${ASSETS}/icon-${W}x${H}.png`;
  renderPng(landscapeSVG(W, H), W, H, out(f));
  rendered[`${W}x${H}`] = f;
}
for (const S of SQUARE) {
  const f = `${ASSETS}/icon-${S}x${S}.png`;
  renderPng(squareSVG(S), S, S, out(f));
  rendered[`${S}x${S}`] = f;
}

// 2. Android: banner (every density bucket the template seeded, same art —
// the banner is not density-scaled content) + launcher webps.
for (const bucket of ['drawable', 'drawable-mdpi', 'drawable-hdpi', 'drawable-xhdpi', 'drawable-xxhdpi', 'drawable-xxxhdpi']) {
  cpSync(out(rendered['400x240']), out(`${RES}/${bucket}/tv_banner.png`));
}
const hasCwebp = (() => {
  try { sh('cwebp', ['-version'], ENV); return true; } catch { return false; }
})();
for (const [dpi, size] of Object.entries(MIPMAP)) {
  const png = join(BUILD, `launcher-${size}.png`);
  renderPng(squareSVG(size), size, size, png);
  for (const name of ['ic_launcher', 'ic_launcher_round']) {
    const webp = out(`${RES}/mipmap-${dpi}/${name}.webp`);
    if (hasCwebp) sh('cwebp', ['-quiet', '-q', '95', png, '-o', webp], ENV);
    else sh('magick', [png, '-quality', '95', webp], ENV);
  }
}

// 3. iOS: brandassets copies keep their existing filenames byte-identical.
const cp = (from, to) => cpSync(out(rendered[from]), out(to));
for (const layer of ['Front', 'Middle', 'Back']) {
  cp('1280x768', `${XC}/App Icon - Large.imagestack/${layer}.imagestacklayer/Content.imageset/icon-1280x768.png`);
  for (const f of ['icon-400x240.png', 'icon-800x480.png']) {
    cp(f.replace('.png', '').replace('icon-', ''), `${XC}/App Icon - Small.imagestack/${layer}.imagestacklayer/Content.imageset/${f}`);
  }
}
for (const f of ['icon-1920x720.png', 'icon-3840x1440.png']) {
  cp(f.replace('icon-', '').replace('.png', ''), `${XC}/Top Shelf Image.imageset/${f}`);
}
for (const f of ['icon-2320x720.png', 'icon-4640x1440.png']) {
  cp(f.replace('icon-', '').replace('.png', ''), `${XC}/Top Shelf Image Wide.imageset/${f}`);
}
cpSync(out(rendered['1024x1024']), out('ios/tvimdbrandomizer/Images.xcassets/AppIcon.appiconset/App-Icon-1024x1024@1x.png'));

// Report.
const files = readdirSync(out(ASSETS)).filter((f) => f.endsWith('.png')).sort();
console.log(`icons: ${files.join(', ')}`);
console.log(`android: tv_banner x6 buckets + ${Object.keys(MIPMAP).length} mipmap densities`);
console.log('ios: brandassets imagestacks, top shelf, appiconset 1024');
