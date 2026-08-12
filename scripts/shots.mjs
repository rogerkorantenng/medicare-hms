#!/usr/bin/env node
/**
 * Signs in and screenshots the workspace, so a design change can be looked
 * at rather than guessed at.
 *
 *   node scripts/shots.mjs                       # every screen, default role
 *   node scripts/shots.mjs doctor /workspace/doctor
 *
 * Output goes to /tmp/medicare-shots. Driven through the DevTools protocol
 * directly, because it needs no dependency beyond the Chrome already on the
 * machine.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const WEB = process.env.WEB_URL || 'http://localhost:3010';
const PASSWORD = process.env.DEMO_PASSWORD || 'MediCare2026!Demo';
const OUT = process.env.SHOT_DIR || '/tmp/medicare-shots';
const WIDTH = Number(process.env.SHOT_WIDTH || 1440);
const HEIGHT = Number(process.env.SHOT_HEIGHT || 900);
const PORT = 9222;

const EMAIL = {
  doctor: 'doctor@medicare.com', nurse: 'nurse@medicare.com',
  receptionist: 'reception@medicare.com', lab: 'lab@medicare.com',
  radiology: 'radiology@medicare.com', pharmacist: 'pharmacy@medicare.com',
  cashier: 'cashier@medicare.com', admin: 'admin@medicare.com',
  patient: 'patient@medicare.com',
};

const SCREENS = process.argv[3]
  ? [[process.argv[2], process.argv[3]]]
  : [
    ['admin', '/workspace/admin'],
    ['doctor', '/workspace/account'],
    ['admin', '/workspace/admin/staff'],
    ['admin', '/workspace/admin/audit'],
    ['admin', '/workspace/patients'],
    ['receptionist', '/workspace/receptionist'],
    ['receptionist', '/workspace/receptionist/appointments'],
    ['receptionist', '/workspace/receptionist/register'],
    ['nurse', '/workspace/nurse'],
    ['nurse', '/workspace/nurse/wards'],
    ['nurse', '/workspace/nurse/mar'],
    ['doctor', '/workspace/doctor'],
    ['doctor', '/workspace/doctor/orders'],
    ['doctor', '/workspace/doctor/consultation/PT-20536'],
    ['doctor', '/workspace/patients/PT-20481'],
    ['lab', '/workspace/lab'],
    ['radiology', '/workspace/radiology'],
    ['pharmacist', '/workspace/pharmacist'],
    ['pharmacist', '/workspace/pharmacist/inventory'],
    ['cashier', '/workspace/cashier'],
    ['cashier', '/workspace/cashier/claims'],
  ];

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const chrome = spawn('/usr/bin/google-chrome', [
  `--remote-debugging-port=${PORT}`, '--headless=new', '--no-sandbox',
  '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
  `--window-size=${WIDTH},${HEIGHT}`,
  '--user-data-dir=/tmp/medicare-chrome-profile', 'about:blank',
], { stdio: 'ignore' });

process.on('exit', () => chrome.kill());

/** Waits for the debugger, then opens a websocket to the page target. */
async function connect() {
  for (let i = 0; i < 60; i += 1) {
    try {
      const targets = await fetch(`http://127.0.0.1:${PORT}/json/list`).then((r) => r.json());
      const page = targets.find((t) => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch { /* not up yet */ }
    await sleep(250);
  }
  throw new Error('Chrome did not expose a debugging target');
}

const ws = new WebSocket(await connect());
await new Promise((r) => { ws.onopen = r; });

let nextId = 1;
const pending = new Map();
ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg.result ?? {});
    pending.delete(msg.id);
  }
};
const send = (method, params = {}) => new Promise((resolve) => {
  const id = nextId++;
  pending.set(id, resolve);
  ws.send(JSON.stringify({ id, method, params }));
});

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride',
  { width: WIDTH, height: HEIGHT, deviceScaleFactor: 1, mobile: false });

const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  return r.result?.value;
};

const goto = async (url) => {
  await send('Page.navigate', { url });
  // Settled rather than merely loaded: server components stream in.
  for (let i = 0; i < 80; i += 1) {
    await sleep(150);
    const ready = await evaluate(
      "document.readyState === 'complete' && document.fonts.status === 'loaded'");
    if (ready) break;
  }
  await sleep(400);
};

const signIn = async (role) => {
  await goto(`${WEB}/login`);
  // The first-run tour is remembered in localStorage. Mark every role as
  // having seen it, or it covers the screen in every screenshot.
  await evaluate(`Object.keys(${JSON.stringify(EMAIL)}).forEach(
    r => localStorage.setItem('medicare.tour.' + r, 'seen'))`);
  await evaluate(`fetch('/api/session', {method:'POST',
    headers:{'content-type':'application/json'},
    body: JSON.stringify({email:'${EMAIL[role]}', password:'${PASSWORD}'})}).then(r=>r.json())`);
};

// Every icon that renders wider than a glyph is an unresolved ligature,
// which means the name is showing as text. The static subset builder
// should make this impossible; this is the check that it did.
const ICON_AUDIT = `(() => {
  const bad = [];
  for (const el of document.querySelectorAll('span.icon')) {
    if (el.getBoundingClientRect().width > 40) bad.push(el.textContent.trim());
  }
  return JSON.stringify([...new Set(bad)]);
})()`;

const brokenIcons = new Map();
let signedInAs = null;
for (const [role, path] of SCREENS) {
  if (role !== signedInAs) {
    await evaluate("fetch('/api/session',{method:'DELETE'})");
    await signIn(role);
    signedInAs = role;
  }
  await goto(WEB + path);
  const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  const name = `${role}${path.replace(/\//g, '_')}.png`;
  writeFileSync(`${OUT}/${name}`, Buffer.from(data, 'base64'));

  const broken = JSON.parse((await evaluate(ICON_AUDIT)) || '[]');
  if (broken.length) brokenIcons.set(path, broken);
  console.log(`  ${name}${broken.length ? `   BROKEN ICONS: ${broken.join(', ')}` : ''}`);
}

console.log(`\n${SCREENS.length} screenshots in ${OUT}`);

if (brokenIcons.size) {
  console.error('\nIcons rendering as text:');
  for (const [path, names] of brokenIcons) console.error(`  ${path}: ${names.join(', ')}`);
  console.error('\nRun: cd frontend && node scripts/build-icon-font.mjs\n');
  ws.close(); chrome.kill(); process.exit(1);
}
console.log('Every icon resolved to a glyph.');
ws.close();
chrome.kill();
process.exit(0);
