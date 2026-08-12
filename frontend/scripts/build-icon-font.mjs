#!/usr/bin/env node
/**
 * Rebuilds public/fonts/material-symbols-rounded.woff2 from the icon names
 * the code actually uses.
 *
 *   node scripts/build-icon-font.mjs           # rebuild
 *   node scripts/build-icon-font.mjs --check   # fail if the two diverge
 *
 * Why this exists, and why it works the way it does.
 *
 * The font is subsetted so it costs 30 KB rather than 3 MB. A Material
 * Symbols glyph that is absent from the subset does not fall back to a box
 * or a blank: the ligature fails to resolve and the browser prints the
 * name as text. The login page once read "VERIFIED_USER Access is enforced
 * in the database" mid-sentence, and the patient profile showed CALL and
 * CAKE beside the phone number and the age.
 *
 * The first version of this script matched a handful of JSX patterns, and
 * missed exactly those two, because they are the third element of an array
 * literal rather than a `name=` attribute. Pattern-matching the call sites
 * is a losing game. So instead: take every plausible identifier in the
 * source, and keep the ones Google lists as real icon names. Over-collect,
 * then intersect with the authority.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const ROOTS = ['app', 'components', 'lib'];
// Material *Symbols*, not the legacy Material Icons family. The bare
// /metadata/icons endpoint answers with the old set, which is missing
// pill, radiology, lab_panel, stethoscope and every other name this
// system actually uses; asking for the wrong list once silently dropped
// ten icons from the subset.
const METADATA = 'https://fonts.google.com/metadata/icons?incomplete=1&key=material_symbols';

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (['.ts', '.tsx'].includes(extname(p))) out.push(p);
  }
  return out;
}

// Every single-quoted or double-quoted lower_snake_case word in the source.
const candidates = new Set();
for (const root of ROOTS) {
  for (const file of walk(root)) {
    const text = readFileSync(file, 'utf8');
    for (const m of text.matchAll(/['"]([a-z][a-z0-9_]{1,40})['"]/g)) {
      candidates.add(m[1]);
    }
  }
}

// The authority. Its response is JSON behind an anti-hijacking prefix.
const raw = await fetch(METADATA).then((r) => {
  if (!r.ok) throw new Error(`icon metadata returned ${r.status}`);
  return r.text();
});
const metadata = JSON.parse(raw.slice(raw.indexOf('{')));
const official = new Set(metadata.icons.map((i) => i.name));
if (official.size < 3000) {
  throw new Error(`Only ${official.size} icon names returned; that is the legacy `
    + 'Material Icons list, not Material Symbols.');
}

const wanted = [...candidates].filter((c) => official.has(c)).sort();
console.log(`${candidates.size} candidate identifiers, ${wanted.length} are real icons`);

// Axes pinned to what globals.css asks for: optical size 24, weight 400
// for .icon and 500 for .icon-fill, no grade, FILL kept as a range because
// .icon-fill crosses it. The full ranges cost about 45 KB for variations
// nothing uses.
const url = 'https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded'
  + ':opsz,wght,FILL,GRAD@24,400..500,0..1,0'
  + `&icon_names=${wanted.join(',')}`;

const css = await fetch(url, {
  // Without a modern user agent Google serves a ttf fallback, not woff2.
  headers: {
    'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 '
      + '(KHTML, like Gecko) Chrome/120.0 Safari/537.36',
  },
}).then((r) => {
  if (!r.ok) throw new Error(`Google Fonts returned ${r.status}`);
  return r.text();
});

// Match on the format() declaration, not a .woff2 extension: a subsetted
// font is served from /l/font with the subset in the query string, so the
// URL has no file extension at all.
const fontUrl = css.match(/url\((https:\/\/[^)]+)\)\s*format\('woff2'\)/)?.[1];
if (!fontUrl) throw new Error(`No woff2 in the CSS response:\n${css.slice(0, 400)}`);

const bytes = Buffer.from(await fetch(fontUrl).then((r) => r.arrayBuffer()));
const target = 'public/fonts/material-symbols-rounded.woff2';

if (process.argv.includes('--check')) {
  if (readFileSync(target).equals(bytes)) {
    console.log('Icon font is up to date.');
  } else {
    console.error(`\n${target} does not match the icons in the code.`);
    console.error('Run: node scripts/build-icon-font.mjs\n');
    process.exit(1);
  }
} else {
  writeFileSync(target, bytes);
  console.log(`Wrote ${target} (${(bytes.length / 1024).toFixed(1)} KB, ${wanted.length} icons)`);
}
