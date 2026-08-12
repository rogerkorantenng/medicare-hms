#!/usr/bin/env node
/**
 * Rebuilds public/fonts/material-symbols-rounded.woff2 from the icon names
 * the code actually uses.
 *
 *   node scripts/build-icon-font.mjs           # rebuild
 *   node scripts/build-icon-font.mjs --check   # fail if any name is missing
 *
 * Why this exists. The font is subsetted so it costs 60 KB rather than 3 MB,
 * and the subset was originally built by hand. Six icons were left out of it,
 * and a Material Symbols glyph that is absent does not fall back to a blank
 * or a box: the ligature simply does not resolve, so the browser renders the
 * name as text. The login page showed the word VERIFIED_USER in the middle of
 * a sentence, and the radiologist's sidebar showed the word "radiology" where
 * the icon belongs.
 *
 * That failure is invisible to every check that looks at status codes, which
 * is why it survived. Generating the subset from the source of truth (the
 * code) rather than from memory is the fix; --check makes a regression fail
 * the build.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const ROOTS = ['app', 'components', 'lib'];

// `name=` and `icon=` on our own components, in each form they are written.
const PATTERNS = [
  /<Icon\s+name="([a-z_0-9]+)"/g,
  /name=\{'([a-z_0-9]+)'\}/g,
  /name=\{[^}]*\?\s*'([a-z_0-9]+)'\s*:\s*'([a-z_0-9]+)'/g,
  /\bicon="([a-z_0-9]+)"/g,
  /\bicon:\s*'([a-z_0-9]+)'/g,
  /\bicon=\{'([a-z_0-9]+)'\}/g,
  /\[\s*'([a-z_0-9]+)',\s*'/g,      // the [icon, text] pairs on the login panel
];

// Names the patterns above pick up that are not icons. Keeping this list
// short and explicit is better than a cleverer regex that fails silently.
const NOT_ICONS = new Set(['doctor', 'nurse', 'patient', 'admin', 'cashier',
  'lab', 'radiology_role', 'receptionist', 'pharmacist', 'billing', 'critical',
  'ok', 'q', 'true', 'false']);

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (['.ts', '.tsx'].includes(extname(p))) out.push(p);
  }
  return out;
}

const names = new Set();
for (const root of ROOTS) {
  for (const file of walk(root)) {
    const text = readFileSync(file, 'utf8');
    for (const pattern of PATTERNS) {
      for (const match of text.matchAll(pattern)) {
        for (const group of match.slice(1)) {
          if (group && !NOT_ICONS.has(group)) names.add(group);
        }
      }
    }
  }
}

// `radiology` is a real Material Symbol and also a role name; the exclusion
// list above cannot tell them apart, so it is added back explicitly.
names.add('radiology');

const wanted = [...names].sort();
console.log(`${wanted.length} icons referenced by the code`);

// The CSS2 endpoint subsets on the server when given icon_names, so the
// download is already the smallest font that covers them.
// Axes are pinned to what globals.css actually asks for: optical size 24,
// weight 400 for .icon and 500 for .icon-fill, no grade, and the FILL axis
// kept as a range because .icon-fill animates across it. Requesting the
// full axis ranges instead costs about 45 KB for variations nothing uses.
const url = 'https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded'
  + ':opsz,wght,FILL,GRAD@24,400..500,0..1,0'
  + `&icon_names=${wanted.join(',')}`;

const css = await fetch(url, {
  // Without a modern UA, Google serves a ttf fallback rather than woff2.
  headers: { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 '
    + '(KHTML, like Gecko) Chrome/120.0 Safari/537.36' },
}).then((r) => {
  if (!r.ok) throw new Error(`Google Fonts returned ${r.status}`);
  return r.text();
});

// Match on the format() declaration rather than a .woff2 extension: a
// subsetted font is served from /l/font with the subset in the query
// string, so the URL has no file extension at all.
const fontUrl = css.match(/url\((https:\/\/[^)]+)\)\s*format\('woff2'\)/)?.[1];
if (!fontUrl) throw new Error('No woff2 in the CSS response:\n' + css.slice(0, 400));

const bytes = Buffer.from(await fetch(fontUrl).then((r) => r.arrayBuffer()));
const target = 'public/fonts/material-symbols-rounded.woff2';

if (process.argv.includes('--check')) {
  const current = readFileSync(target);
  if (current.equals(bytes)) {
    console.log('Icon font is up to date.');
  } else {
    console.error(`\n${target} does not match the icons in the code.`);
    console.error('Run: node scripts/build-icon-font.mjs\n');
    process.exit(1);
  }
} else {
  writeFileSync(target, bytes);
  console.log(`Wrote ${target} (${(bytes.length / 1024).toFixed(1)} KB)`);
}
