#!/usr/bin/env node
// Records the ExTrans first-run walk-through: highlighted stills for the Vietnamese user guide
// (docs/user-guide/images/NN-slug.png, NN = the step number) and a captioned tutorial video
// (docs/user-guide/media/extrans-user-guide.mp4). Everything is recorded in the LIGHT theme.
//
// Every step draws a ring + numbered badge + caption bar over the element to press, pauses so the viewer can
// read it, then clicks. Steps 1-5 show loading the unpacked build on chrome://extensions (the native folder
// picker cannot be recorded, so a text card says which folder to pick); step 6 is a text card on creating a
// Gemini API key.
//
// Two modes:
//   keyless (default)  No key is typed. The key step highlights the field and presses "Skip for now"; the main
//                      panel highlights Start without pressing it. A one-line notice says so.
//   live               A real Gemini key is typed (masked in the page, never printed, logged, screenshotted or
//                      written). The wizard validates it, the main panel runs mode "Me" against a synthetic
//                      English voice fed to Chrome as the fake microphone, waits for real translated lines, then
//                      presses Stop. The throwaway Chrome profile that stores the key is deleted at the end.
//
// Keyless:        node scripts/dev/record-user-guide.mjs
// Live, env var:  EXTRANS_GEMINI_API_KEY=... node scripts/dev/record-user-guide.mjs
// Live, prompt:   node scripts/dev/record-user-guide.mjs --live      (asks for the key on stdin, no echo)
// The key is read ONLY from EXTRANS_GEMINI_API_KEY or that hidden prompt, never from an argument or a file. Live
// mode needs macOS `say` (an English voice) and ffmpeg to build the fake-microphone WAV in a temp dir.
//
// Options: [--dist DIR] [--images DIR] [--media DIR] [--profile DIR] [--chrome PATH] [--ffmpeg PATH] [--hold MS] [--live]
// Env equivalents: EXTRANS_DIST, EXTRANS_GUIDE_IMAGES, EXTRANS_GUIDE_MEDIA, EXTRANS_GUIDE_PROFILE, CHROME_PATH,
// FFMPEG (or FFMPEG_PATH), EXTRANS_GUIDE_HOLD_MS. DYLD_FALLBACK_LIBRARY_PATH, when set, is passed through to ffmpeg
// (needed on machines whose Homebrew ffmpeg links a removed libx265).
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const require = createRequire(join(repoRoot, 'package.json'));
const { chromium } = require('playwright');

// ---------------------------------------------------------------------------------------------- configuration
const argv = process.argv.slice(2);
const flag = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const wantsLive = argv.includes('--live');
const cfg = {
  dist: resolve(flag('dist') ?? process.env.EXTRANS_DIST ?? join(repoRoot, 'extension', 'dist')),
  images: resolve(flag('images') ?? process.env.EXTRANS_GUIDE_IMAGES ?? join(repoRoot, 'docs', 'user-guide', 'images')),
  media: resolve(flag('media') ?? process.env.EXTRANS_GUIDE_MEDIA ?? join(repoRoot, 'docs', 'user-guide', 'media')),
  profile: resolve(flag('profile') ?? process.env.EXTRANS_GUIDE_PROFILE ?? '/tmp/extrans-guide-profile'),
  ffmpeg: flag('ffmpeg') ?? process.env.FFMPEG ?? process.env.FFMPEG_PATH ?? (existsSync('/opt/homebrew/bin/ffmpeg') ? '/opt/homebrew/bin/ffmpeg' : 'ffmpeg'),
  hold: Number(flag('hold') ?? process.env.EXTRANS_GUIDE_HOLD_MS ?? 2200),
};
const chromeCandidates = [
  flag('chrome'),
  process.env.CHROME_PATH,
  join(process.env.HOME ?? '', 'Library/Caches/ms-playwright/chromium-1248/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'),
  chromium.executablePath(),
].filter(Boolean);
const chromePath = chromeCandidates.find((p) => existsSync(p));
if (!chromePath) throw new Error(`No Chrome executable found; tried:\n${chromeCandidates.join('\n')}`);
if (!existsSync(join(cfg.dist, 'manifest.json'))) throw new Error(`Not an unpacked extension (no manifest.json): ${cfg.dist}`);

const VIEW = { width: 420, height: 860 }; // the panel is designed for a ~360-420px side panel
const OUT_WIDTH = 720; // video is recorded at VIEW size and upscaled for legibility
const NAV_TIMEOUT = 90_000;
const ACT_TIMEOUT = 60_000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const launchArgs = (extra = []) => [
  `--disable-extensions-except=${cfg.dist}`,
  `--load-extension=${cfg.dist}`,
  '--no-first-run',
  '--no-default-browser-check',
  '--window-position=3000,0', // off-screen: extensions need a headed browser
  ...extra,
];

async function extensionBase(ctx) {
  let [sw] = ctx.serviceWorkers();
  if (!sw) sw = await ctx.waitForEvent('serviceworker', { timeout: NAV_TIMEOUT });
  return `chrome-extension://${new URL(sw.url()).host}`;
}

// ------------------------------------------------------------------------------------- highlight overlay (in page)
// Draws rings/badges/caption/cursor. Everything has pointer-events:none so the real click still lands on the target.
// With no rings it draws the caption alone (no cursor).
function installOverlay({ rings, caption, from, to }) {
  document.getElementById('__guide')?.remove();
  const root = document.createElement('div');
  root.id = '__guide';
  root.style.cssText = 'position:fixed;inset:0;z-index:2147483647;pointer-events:none;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;';
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const PAD = 6;

  const boxes = rings.map((r) => ({ x: r.x - PAD, y: r.y - PAD, w: r.w + PAD * 2, h: r.h + PAD * 2 }));
  rings.forEach((r, i) => {
    const b = boxes[i];
    const ring = document.createElement('div');
    ring.style.cssText = `position:absolute;left:${b.x}px;top:${b.y}px;width:${b.w}px;height:${b.h}px;box-sizing:border-box;` +
      `border:3px ${r.primary ? 'solid' : 'dashed'} #ffcc00;border-radius:${r.radius + PAD}px;` +
      'box-shadow:0 0 0 2px #111,0 0 0 4px rgba(255,255,255,.55),0 0 18px 6px rgba(255,204,0,.55),inset 0 0 0 2px rgba(0,0,0,.55);';
    root.appendChild(ring);
    const badge = document.createElement('div');
    const bx = Math.min(Math.max(b.x - 10, 4), vw - 32);
    const by = Math.min(Math.max(b.y - 12, 4), vh - 32);
    badge.textContent = r.label;
    badge.style.cssText = `position:absolute;left:${bx}px;top:${by}px;width:28px;height:28px;border-radius:14px;` +
      `background:${r.primary ? '#ffcc00' : '#fff'};color:#111;font:800 15px/28px sans-serif;text-align:center;` +
      'box-shadow:0 0 0 2px #111,0 2px 8px rgba(0,0,0,.5);';
    root.appendChild(badge);
  });

  // Caption bar: top or bottom, whichever overlaps the rings less. A caption can wrap to two lines,
  // so the check uses that height, and covering a click target (solid ring) outweighs covering any
  // amount of a look-here (dashed) ring.
  const CAP_H = 64;
  const CAP_REACH = 110;
  const overlap = (y0, y1) => boxes.reduce((s, b, i) => {
    const px = Math.max(0, Math.min(y1, b.y + b.h) - Math.max(y0, b.y));
    return s + (rings[i].primary ? px * 1000 : px);
  }, 0);
  const atTop = overlap(0, CAP_REACH) <= overlap(vh - CAP_REACH, vh);
  const bar = document.createElement('div');
  bar.textContent = caption;
  bar.style.cssText = `position:absolute;left:10px;right:10px;${atTop ? 'top:10px' : 'bottom:10px'};min-height:${CAP_H - 16}px;` +
    'box-sizing:border-box;padding:10px 14px;border-radius:12px;background:rgba(10,14,28,.94);color:#fff;' +
    'font:600 15px/1.35 sans-serif;border:2px solid #ffcc00;box-shadow:0 6px 24px rgba(0,0,0,.55);display:flex;align-items:center;';
  root.appendChild(bar);

  // Fake cursor glides from the previous position to the target.
  if (to) {
    const cur = document.createElement('div');
    cur.id = '__guide_cursor';
    cur.style.cssText = `position:absolute;left:${from.x - 8}px;top:${from.y - 8}px;width:16px;height:16px;border-radius:8px;` +
      'background:rgba(255,64,64,.95);border:2px solid #fff;box-shadow:0 2px 10px rgba(0,0,0,.6);transition:left .8s ease,top .8s ease;';
    root.appendChild(cur);
    document.body.appendChild(root);
    void cur.offsetWidth;
    cur.style.left = `${to.x - 8}px`;
    cur.style.top = `${to.y - 8}px`;
  } else {
    document.body.appendChild(root);
  }
}

const removeOverlay = () => document.getElementById('__guide')?.remove();
const pulseCursor = () => {
  const cur = document.getElementById('__guide_cursor');
  if (!cur) return;
  cur.style.transition = 'transform .25s ease, opacity .25s ease';
  cur.style.transform = 'scale(1.8)';
  cur.style.opacity = '0.45';
};

// Hides whatever a credential field would show: the typed characters as discs and the whole box blurred, on every
// page of the recording (the wizard's key field and Settings → Accounts and keys), whatever its input type.
const MASK_CSS = '.setup-field input,#provider-section input,input[type="password"]' +
  '{-webkit-text-security:disc !important;filter:blur(7px) !important;}';
function installMask(css) {
  const put = () => {
    if (document.getElementById('__guide_mask')) return;
    const style = document.createElement('style');
    style.id = '__guide_mask';
    style.textContent = css;
    (document.head ?? document.documentElement).appendChild(style);
  };
  if (document.documentElement) put();
  document.addEventListener('DOMContentLoaded', put);
  new MutationObserver(put).observe(document, { childList: true, subtree: true });
}

// -------------------------------------------------------------------------------------------------- guide driver
function makeGuide(page) {
  let cursor = { x: VIEW.width / 2, y: VIEW.height - 40 };

  async function rectOf(loc) {
    const box = await loc.boundingBox();
    if (!box) throw new Error('target has no bounding box');
    const radius = await loc.evaluate((el) => parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0);
    return { x: box.x, y: box.y, w: box.width, h: box.height, radius: Math.min(radius, 18) };
  }

  /**
   * One guided phase.
   *   n        step number shown in the badge and caption
   *   caption  Vietnamese caption text (prefixed with "Bước n:")
   *   rings    [{ loc, click?, primary?, label? }] — the first entry with click:true is the primary target; others are
   *            extra "look here" rings (dashed, lettered). Rings whose locator matches nothing are dropped. An empty
   *            list shows the caption alone.
   *   slug     when set, a still with the highlight burned in is saved as images/NN-slug.png (NN = n)
   *   hold     how long the highlight stays up before the click
   */
  return async function guide({ n, caption, rings, slug, hold = cfg.hold }) {
    const present = [];
    for (const r of rings) {
      const loc = r.loc.first();
      if (await loc.count()) present.push({ ...r, loc });
    }
    if (rings.length && !present.length) throw new Error(`step ${n}: no ring target found (${caption})`);
    // Scroll every target into view; recompute geometry after the last scroll settles.
    for (const r of present) await r.loc.scrollIntoViewIfNeeded({ timeout: ACT_TIMEOUT });
    await page.waitForTimeout(450);

    const primary = present.find((r) => r.click) ?? present.find((r) => r.primary) ?? present[0];
    let letter = 0;
    const spec = [];
    for (const r of present) {
      const isPrimary = r === primary;
      const rect = await rectOf(r.loc);
      spec.push({ ...rect, primary: isPrimary, label: isPrimary ? String(n) : (r.label ?? String.fromCharCode(65 + letter++)) });
    }
    let to = null;
    if (primary) {
      const target = spec[present.indexOf(primary)];
      // Park the cursor on the target's bottom-right corner so it never hides the label being pointed at.
      to = { x: target.x + target.w - Math.min(10, target.w / 2), y: target.y + target.h - Math.min(5, target.h / 2) };
    }
    await page.evaluate(installOverlay, { rings: spec, caption: `Bước ${n}: ${caption}`, from: cursor, to });
    if (to) cursor = to;

    await page.waitForTimeout(Math.min(1100, hold)); // cursor arrives
    if (slug) {
      const file = join(cfg.images, `${String(n).padStart(2, '0')}-${slug}.png`);
      await page.screenshot({ path: file });
      console.log('still', file);
    }
    await page.waitForTimeout(Math.max(0, hold - 1100));

    if (primary?.click) {
      await page.evaluate(pulseCursor);
      await primary.loc.click({ timeout: ACT_TIMEOUT });
    }
    await page.waitForTimeout(250);
    await page.evaluate(removeOverlay).catch(() => {}); // the click may have navigated
    await page.waitForTimeout(700);
  };
}

// -------------------------------------------------------------------------------------------------- text cards
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** A light-theme full-page card: optional "Bước n" kicker, a title, a lead line and a short list of lines.
 *  `lead` and `lines` are trusted literals from this file and may carry <b>/<code>. */
function cardHtml({ kicker, title, lead, lines = [], iconDataUrl }) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;height:100%;background:radial-gradient(circle at 30% 15%,#ffffff,#e9eefb 75%);color:#141a33;
      font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;}
    .w{height:100%;box-sizing:border-box;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:0 26px;gap:16px}
    img{width:96px;height:96px;border-radius:22px;box-shadow:0 8px 28px rgba(60,110,255,.35)}
    .k{display:inline-block;padding:4px 12px;border-radius:14px;background:#ffcc00;color:#111;font:800 14px/1.4 sans-serif;box-shadow:0 0 0 2px #111}
    h1{margin:0;font-size:27px;line-height:1.25}
    p{margin:0;font-size:17px;line-height:1.5;color:#3d4670}
    ol{margin:6px 0 0;padding:0;list-style:none;text-align:left;width:100%;display:flex;flex-direction:column;gap:10px;counter-reset:s}
    li{counter-increment:s;position:relative;padding:10px 12px 10px 46px;border-radius:12px;background:#fff;border:1px solid #cfd7f0;
      font-size:16px;line-height:1.45;box-shadow:0 2px 8px rgba(30,50,120,.08)}
    li::before{content:counter(s);position:absolute;left:12px;top:9px;width:24px;height:24px;border-radius:12px;background:#ffcc00;color:#111;
      font:800 13px/24px sans-serif;text-align:center;box-shadow:0 0 0 2px #111}
    code{font:600 14px ui-monospace,Menlo,monospace;background:#eef1fb;border-radius:5px;padding:1px 5px}
  </style></head><body><div class="w">${iconDataUrl ? `<img src="${iconDataUrl}" alt="">` : ''}
    ${kicker ? `<span class="k">${esc(kicker)}</span>` : ''}
    <h1>${esc(title)}</h1>${lead ? `<p>${lead}</p>` : ''}
    ${lines.length ? `<ol>${lines.map((l) => `<li>${l}</li>`).join('')}</ol>` : ''}</div></body></html>`;
}

// ---------------------------------------------------------------------------------------------- live-mode inputs
const log = (...a) => console.log('[record-user-guide]', ...a);
let apiKey = ''; // only ever set in live mode; never written, logged or passed to the page except as keystrokes
const scrub = (text) => {
  let out = String(text);
  if (apiKey) out = out.split(apiKey).join('***');
  return out;
};

/** Reads one line from stdin without echoing it. On a TTY it switches to raw mode; piped input is just read. */
function readHidden(promptText) {
  const input = process.stdin;
  process.stderr.write(promptText);
  return new Promise((resolvePromise, reject) => {
    let value = '';
    const finish = (err) => {
      input.off('data', onData);
      input.off('end', onEnd);
      if (input.isTTY) input.setRawMode(false);
      input.pause();
      process.stderr.write('\n');
      if (err) reject(err); else resolvePromise(value);
    };
    const onEnd = () => finish();
    const onData = (chunk) => {
      for (const ch of chunk.toString('utf8')) {
        if (ch === '\r' || ch === '\n') return finish();
        if (ch === '\u0003') return finish(new Error('Cancelled'));
        if (ch === '\u007f' || ch === '\b') value = value.slice(0, -1);
        else if (ch >= ' ') value += ch;
      }
    };
    if (input.isTTY) input.setRawMode(true);
    input.on('data', onData);
    input.on('end', onEnd);
    input.resume();
  });
}

async function obtainKey() {
  const fromEnv = (process.env.EXTRANS_GEMINI_API_KEY ?? '').trim();
  // Keep the key out of every child process (Chrome, ffmpeg) environment.
  delete process.env.EXTRANS_GEMINI_API_KEY;
  let key = fromEnv;
  if (!key && wantsLive) key = (await readHidden('Gemini API key (input hidden): ')).trim();
  if (!key) return '';
  if (/\s/.test(key) || key.length < 8) throw new Error('The Gemini API key looks malformed (it must be a single token); nothing was recorded.');
  return key;
}

const childEnv = () => Object.assign({}, process.env);
const run = (file, args) => execFileSync(file, args, { stdio: ['ignore', 'ignore', 'pipe'], env: childEnv() });

/** Builds the fake-microphone WAV: an English voice reading a few natural sentences, padded and looped to ~40 s,
 *  48 kHz 16-bit mono PCM. */
function makeMicWav(dir) {
  const speech = join(dir, 'speech.txt');
  writeFileSync(speech, [
    'Good morning everyone, and thank you for joining today\'s meeting.',
    'Let me start by explaining what we are going to cover this week.',
    'First, we will review the schedule, and then we will talk about the next steps for the project.',
    'If you have any questions, please feel free to ask at any time.',
  ].join(' '));
  const aiff = join(dir, 'speech.aiff');
  const once = join(dir, 'once.wav');
  const out = join(dir, 'mic.wav');
  run('say', ['-v', 'Samantha', '-r', '165', '-o', aiff, '-f', speech]);
  run(cfg.ffmpeg, ['-y', '-loglevel', 'error', '-i', aiff, '-af', 'apad=pad_dur=1.5', '-ar', '48000', '-ac', '1', '-c:a', 'pcm_s16le', once]);
  run(cfg.ffmpeg, ['-y', '-loglevel', 'error', '-stream_loop', '-1', '-i', once, '-t', '40', '-ar', '48000', '-ac', '1', '-c:a', 'pcm_s16le', out]);
  return out;
}

// ---------------------------------------------------------------------------------------------------- main
let ctx = null;
let tmpVideoDir = null;
let tmpAudioDir = null;

async function cleanup() {
  if (ctx) { await ctx.close().catch(() => {}); ctx = null; }
  rmSync(cfg.profile, { recursive: true, force: true });
  if (tmpVideoDir) rmSync(tmpVideoDir, { recursive: true, force: true });
  if (tmpAudioDir) rmSync(tmpAudioDir, { recursive: true, force: true });
}
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { cleanup().finally(() => process.exit(130)); });

async function main() {
  apiKey = await obtainKey();
  const live = apiKey !== '';
  if (!live) log('no Gemini key (EXTRANS_GEMINI_API_KEY unset, no --live): recording without a key; the key step is skipped and Start is only highlighted.');

  rmSync(cfg.profile, { recursive: true, force: true });
  mkdirSync(cfg.images, { recursive: true });
  for (const f of readdirSync(cfg.images)) if (/^\d\d-.*\.png$/.test(f)) rmSync(join(cfg.images, f)); // stale stills only
  mkdirSync(cfg.media, { recursive: true });
  tmpVideoDir = mkdtempSync(join(tmpdir(), 'extrans-guide-video-'));
  let micArgs = [];
  if (live) {
    tmpAudioDir = mkdtempSync(join(tmpdir(), 'extrans-guide-audio-'));
    const wav = makeMicWav(tmpAudioDir);
    micArgs = ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${wav}`];
    log('live mode: fake microphone WAV ready');
  }

  // Pass 1 (not recorded): give the profile a clean, light-scheme first-run state so the wizard starts at step 1.
  // `sokuji.theme` is the cache the boot script (theme-boot.js) reads for the first paint; the storage key is the setting.
  log('pass 1: preparing a fresh profile');
  const prep = await chromium.launchPersistentContext(cfg.profile, {
    executablePath: chromePath, headless: false, viewport: VIEW, args: launchArgs(),
  });
  try {
    const base = await extensionBase(prep);
    const p = prep.pages()[0] ?? await prep.newPage();
    p.setDefaultTimeout(ACT_TIMEOUT);
    await p.goto(`${base}/fullpage.html`, { timeout: NAV_TIMEOUT });
    await p.evaluate(async () => {
      await new Promise((r) => chrome.storage.sync.clear(r));
      await new Promise((r) => chrome.storage.local.clear(r));
      localStorage.clear();
      await new Promise((r) => chrome.storage.sync.set({ 'settings.common.theme': 'light' }, r));
      localStorage.setItem('sokuji.theme', 'light');
    });
    await sleep(1500);
  } finally {
    await prep.close().catch(() => {});
  }

  // Pass 2 (recorded): the walk-through.
  log('pass 2: recording');
  ctx = await chromium.launchPersistentContext(cfg.profile, {
    executablePath: chromePath, headless: false, viewport: VIEW, deviceScaleFactor: 2, colorScheme: 'light',
    recordVideo: { dir: tmpVideoDir, size: VIEW },
    args: launchArgs(micArgs),
  });
  // The popup only offers "Open ExTrans" when the active tab is a supported site; as a standalone tab its active
  // tab is itself, so present a supported site to it. Only popup.html is affected.
  await ctx.addInitScript(() => {
    if (location.pathname.endsWith('/popup.html')) {
      chrome.tabs.query = async () => [{ id: 1, url: 'https://meet.google.com/' }];
    }
  });
  if (live) await ctx.addInitScript(installMask, MASK_CSS);
  const base = await extensionBase(ctx);
  const page = ctx.pages()[0] ?? await ctx.newPage();
  page.setDefaultTimeout(ACT_TIMEOUT);
  page.setDefaultNavigationTimeout(NAV_TIMEOUT);
  const guide = makeGuide(page);

  const iconFile = join(cfg.dist, 'icons', 'icon128.png');
  const iconUrl = existsSync(iconFile) ? `data:image/png;base64,${readFileSync(iconFile).toString('base64')}` : '';
  /** Shows a text card for a time that grows with how much there is to read. */
  const showCard = async (spec, ms) => {
    await page.goto('about:blank');
    await page.setContent(cardHtml(spec));
    await page.waitForTimeout(ms ?? 3000 + (spec.lines?.length ?? 0) * 1800 + (spec.lead ? 1500 : 0));
  };
  /** Draws a caption on its own (no ring) and leaves it up until `hideCaption`. */
  const showCaption = (n, text) => page.evaluate(installOverlay, { rings: [], caption: `Bước ${n}: ${text}`, from: null, to: null });
  const hideCaption = () => page.evaluate(removeOverlay).catch(() => {});
  /** chrome://extensions is built for a wide window; at 420 px its toolbar and cards run off the right edge.
   *  Zooming the page's own element (not the overlay, which sits outside it) fits it without moving the rings. */
  const fitExtensionsPage = () => page.evaluate(() => {
    const m = document.querySelector('extensions-manager');
    if (m) m.style.zoom = '0.8';
  }).catch(() => {});

  await showCard({ title: 'ExTrans — Hướng dẫn sử dụng', lead: 'Dịch giọng nói trực tiếp ngay trong trình duyệt', iconDataUrl: iconUrl }, 3500);

  // 1-5. Load the unpacked build ------------------------------------------------------------------------------
  let extensionsPage = true;
  try {
    await page.goto('chrome://extensions', { timeout: 20_000 });
    await page.waitForSelector('#devMode', { state: 'visible', timeout: 20_000 });
  } catch (err) {
    extensionsPage = false;
    log(`chrome://extensions could not be driven (${scrub(err.message).split('\n')[0]}); using text cards for steps 1-4`);
  }
  if (extensionsPage) {
    await fitExtensionsPage();
    await page.waitForTimeout(900);
    await guide({
      n: 1, slug: 'extensions-page', rings: [], hold: cfg.hold + 800,
      caption: 'Gõ chrome://extensions vào thanh địa chỉ của Chrome rồi nhấn Enter',
    });
    await guide({
      n: 2, slug: 'developer-mode',
      caption: 'Bật công tắc "Developer mode" ở góc trên bên phải',
      rings: [{ loc: page.locator('#devMode'), click: true }],
    });
    await page.waitForSelector('#loadUnpacked', { state: 'visible' });
    await page.waitForTimeout(900);
    await guide({
      n: 3, slug: 'load-unpacked', hold: cfg.hold + 800,
      caption: 'Bấm "Load unpacked" (Tải tiện ích đã giải nén)',
      rings: [{ loc: page.locator('#loadUnpacked'), primary: true }],
    });
  } else {
    await showCard({
      kicker: 'Bước 1-3', title: 'Nạp bản chưa đóng gói',
      lines: ['Mở <code>chrome://extensions</code> trong Chrome', 'Bật công tắc <b>Developer mode</b> ở góc trên bên phải', 'Bấm <b>Load unpacked</b>'],
    });
  }
  await showCard({
    kicker: 'Bước 3', title: 'Chọn thư mục extension/dist',
    lead: 'Hộp thoại chọn thư mục của hệ điều hành sẽ mở ra. Chọn thư mục <code>extension/dist</code> của dự án ExTrans rồi bấm <b>Select</b>.',
  }, 6500);
  if (extensionsPage) {
    await page.goto('chrome://extensions', { timeout: 20_000 });
    await page.waitForSelector('extensions-item', { timeout: 20_000 });
    await fitExtensionsPage();
    await page.waitForTimeout(900);
    await guide({
      n: 4, slug: 'extension-card', hold: cfg.hold + 1000,
      caption: 'Thẻ "ExTrans" xuất hiện trong danh sách tiện ích; công tắc bên phải thẻ phải đang bật',
      rings: [{ loc: page.locator('extensions-item').filter({ hasText: 'ExTrans' }), primary: true }],
    });
  } else {
    await showCard({ kicker: 'Bước 4', title: 'Thẻ ExTrans xuất hiện', lead: 'Thẻ <b>ExTrans</b> hiện trong danh sách tiện ích và công tắc của nó đang bật.' }, 4500);
  }
  await showCard({
    kicker: 'Bước 5', title: 'Ghim ExTrans lên thanh công cụ',
    lines: ['Bấm biểu tượng <b>mảnh ghép</b> (Extensions) cạnh thanh địa chỉ', 'Bấm biểu tượng <b>ghim</b> cạnh ExTrans'],
  });

  // 6. Gemini API key (text only) ------------------------------------------------------------------------------
  await showCard({
    kicker: 'Bước 6', title: 'Tạo Gemini API key',
    lines: [
      'Vào <code>aistudio.google.com/apikey</code> (Google AI Studio)',
      'Đăng nhập bằng tài khoản Google',
      'Bấm <b>Create API key</b>',
      'Chọn một dự án có sẵn hoặc tạo dự án mới',
      'Sao chép khóa; giữ riêng tư, không chia sẻ',
    ],
  }, 12_000);

  const body = page.locator('.setup-wizard__body');
  const next = page.locator('.setup-wizard__footer button').last();
  const card = (valueSel) => body.locator('label.setup-card').filter({ has: page.locator(valueSel) });

  // 7. Popup -------------------------------------------------------------------------------------------------
  await page.goto(`${base}/popup.html`);
  await page.waitForSelector('#openSidePanel', { state: 'visible', timeout: NAV_TIMEOUT });
  await page.waitForTimeout(800);
  // Point at the button; the real popup closes itself and opens the side panel, so the stand-in tab is used next.
  await guide({
    n: 7, slug: 'popup-open', hold: cfg.hold + 800,
    caption: 'Mở một trang web được hỗ trợ (vd. Google Meet), bấm biểu tượng ExTrans rồi bấm "Open ExTrans"',
    rings: [{ loc: page.locator('#openSidePanel'), primary: true }],
  });

  // 8-13. Setup wizard (fullpage.html stands in for the side panel) -----------------------------------------
  await page.goto(`${base}/fullpage.html`);
  await page.waitForSelector('.setup-wizard__card', { timeout: NAV_TIMEOUT });
  await page.waitForTimeout(900);

  await guide({
    n: 8, slug: 'wizard-language',
    caption: 'Thiết lập 1/6: chọn ngôn ngữ giao diện (A), rồi bấm "Next"',
    rings: [{ loc: body.locator('select'), label: 'A' }, { loc: next, click: true }],
  });

  await guide({
    n: 9, slug: 'wizard-scenario',
    caption: 'Thiết lập 2/6: chọn tình huống gần nhất với nhu cầu của bạn',
    rings: [{ loc: body.locator('label.setup-card').first(), click: true }],
  });
  await guide({ n: 9, caption: 'Bấm "Next"', rings: [{ loc: next, click: true }], hold: 1500 });

  await guide({
    n: 10, caption: 'Thiết lập 3/6: chọn "I have my own API key" (dùng khóa của bạn)',
    rings: [{ loc: card('input[value="own-key"]'), click: true }],
  });
  await page.waitForSelector('.setup-wizard__body input[name="provider"]');
  await guide({
    n: 10, slug: 'wizard-provider',
    caption: 'Chọn nhà cung cấp "Google Gemini" (link A: hướng dẫn lấy khóa)',
    rings: [
      { loc: body.locator('.setup-note, .setup-step__note a.setup-link'), label: 'A' },
      { loc: body.locator('label.setup-card').filter({ hasText: 'Google Gemini' }), click: true },
    ],
  });
  await guide({ n: 10, caption: 'Bấm "Next"', rings: [{ loc: next, click: true }], hold: 1500 });

  // Credentials. Keyless: ring the field and the guide link, nothing typed, press "Skip for now". Live: type the key
  // into the masked field, validate it, wait for acceptance.
  await page.waitForSelector('.setup-wizard__body .setup-field input');
  const keyField = body.locator('.setup-field input').first();
  const skipBtn = body.getByRole('button', { name: 'Skip for now' });
  const validateBtn = body.getByRole('button', { name: 'Validate' });
  if (!live) {
    await guide({
      n: 11, slug: 'wizard-api-key', hold: cfg.hold + 1200,
      caption: 'Thiết lập 4/6: dán API key vào ô A, xem cách lấy khóa ở link B. Ở đây ta bấm "Skip for now"',
      rings: [
        { loc: keyField, label: 'A' },
        { loc: body.locator('a.setup-link'), label: 'B' },
        { loc: skipBtn, click: true },
      ],
    });
  } else {
    await guide({
      n: 11, slug: 'wizard-api-key', hold: cfg.hold + 1200,
      caption: 'Thiết lập 4/6: bấm vào ô A và dán API key Gemini (khóa được che khi quay), xem cách lấy khóa ở link B',
      rings: [
        { loc: keyField, click: true },
        { loc: body.locator('a.setup-link'), label: 'B' },
        { loc: validateBtn, label: 'C' },
      ],
    });
    // Fail closed: the field must already be masked before a single character of the key goes in.
    const masked = await keyField.evaluate((el) => {
      const cs = getComputedStyle(el);
      return cs.getPropertyValue('-webkit-text-security') === 'disc' && /blur/.test(cs.filter);
    });
    if (!masked) throw new Error('Refusing to type the key: the key field is not masked.');
    await keyField.focus();
    await page.keyboard.type(apiKey, { delay: 45 });
    await page.waitForTimeout(800);
    await guide({ n: 11, caption: 'Bấm "Validate" để kiểm tra khóa', rings: [{ loc: validateBtn, click: true }], hold: 1500 });
    try {
      await body.getByText('Key accepted.').waitFor({ state: 'visible', timeout: 45_000 });
    } catch {
      throw new Error('The wizard did not accept the Gemini key within 45 s (rejected, offline, or quota); nothing more was recorded.');
    }
    await showCaption(11, 'Khóa hợp lệ: ExTrans báo "Key accepted."');
    await page.waitForTimeout(2800);
    await hideCaption();
    await guide({ n: 11, caption: 'Bấm "Next"', rings: [{ loc: next, click: true }], hold: 1500 });
  }

  // Language pair: English -> Vietnamese in both modes, so the stills match the live run.
  await page.waitForSelector('.setup-wizard__body select');
  await body.locator('select').nth(0).selectOption('en');
  await body.locator('select').nth(1).selectOption('vi');
  await guide({
    n: 12, slug: 'wizard-language-pair',
    caption: 'Thiết lập 5/6: chọn ngôn ngữ nguồn (A: English) và ngôn ngữ đích (B: Vietnamese)',
    rings: [
      { loc: body.locator('select').nth(0), label: 'A' },
      { loc: body.locator('select').nth(1), label: 'B' },
      { loc: next, click: true },
    ],
  });

  await page.waitForSelector('.setup-summary');
  await guide({
    n: 13, slug: 'wizard-finish',
    caption: 'Thiết lập 6/6: xem lại cấu hình, rồi bấm "Finish"',
    rings: [{ loc: next, click: true }],
  });

  // 14-15. Product tour --------------------------------------------------------------------------------------
  await page.waitForSelector('.tour-popover:not(.is-resolving)', { timeout: NAV_TIMEOUT });
  await page.waitForTimeout(800);
  const tourNext = page.locator('.tour-popover__btn--primary');
  const tourSkip = page.locator('.tour-popover__btn--ghost');
  await guide({
    n: 14, slug: 'tour-welcome',
    caption: 'Hướng dẫn nhanh: bấm "Next" để xem từng phần (hoặc "Skip" để bỏ qua)',
    rings: [{ loc: tourSkip, label: 'A' }, { loc: tourNext, click: true }],
  });
  await page.waitForSelector('.tour-popover:not(.is-resolving)');
  await page.waitForTimeout(600);
  await guide({
    n: 15, slug: 'tour-mode-picker',
    caption: 'Phần này nói về bộ chọn chế độ. Bấm "Skip" để kết thúc phần hướng dẫn nhanh',
    rings: [{ loc: tourNext, label: 'A' }, { loc: tourSkip, click: true }],
  });

  // 16-18. Main panel: choose "Me", then Start (live) -----------------------------------------------------------
  await page.waitForSelector('[data-tour="mode-picker"]', { timeout: NAV_TIMEOUT });
  await page.waitForTimeout(900);
  const startStop = page.locator('[data-tour="main-action"]');
  await guide({
    n: 16, slug: 'main-panel', hold: cfg.hold + 1500,
    caption: 'Màn hình chính: chọn chế độ Me / Other / Both (A), rồi bấm "Start" (B)',
    rings: [
      { loc: page.locator('[data-tour="mode-picker"]'), label: 'A' },
      { loc: startStop, label: 'B', primary: true },
    ],
  });
  const meSegment = page.locator('[data-tour="mode-picker"]').getByRole('button', { name: 'Me', exact: true });
  const meActive = (await meSegment.getAttribute('aria-pressed')) === 'true';
  await guide({
    n: 17, slug: 'mode-me',
    caption: meActive ? 'Chế độ "Me" (dịch giọng của bạn) đã được chọn' : 'Chọn chế độ "Me": dịch giọng của bạn',
    // An already-active segment opens its device popover when clicked, so it is only pointed at.
    rings: [{ loc: meSegment, click: !meActive, primary: true }],
  });

  if (!live) {
    await guide({
      n: 18, slug: 'main-start', hold: cfg.hold + 1500,
      caption: 'Khi đã có API key hợp lệ, bấm "Start" để bắt đầu dịch (ở đây chưa có khóa nên Start chưa dùng được)',
      rings: [{ loc: startStop, primary: true }],
    });
  } else {
    await guide({
      n: 18, slug: 'main-start', caption: 'Bấm "Start": ExTrans nghe micro và bắt đầu dịch trực tiếp',
      rings: [{ loc: startStop, click: true }],
    });
    await showCaption(18, 'Đang nghe micro (giọng đọc mẫu) và dịch từ English sang Vietnamese. Chờ bản dịch hiện ra…');
    try {
      await page.waitForFunction(
        () => document.querySelectorAll('.conversation-row .row-text.tr').length >= 2,
        undefined, { timeout: 60_000 },
      );
    } catch {
      throw new Error('No translated lines appeared within 60 s of pressing Start; nothing more was recorded.');
    }
    await hideCaption();
    await showCaption(18, 'Bản dịch tiếng Việt hiện ngay trong khung hội thoại');
    await page.waitForTimeout(6000);
    await hideCaption();
    await guide({ n: 18, caption: 'Bấm "Stop" để dừng phiên dịch', rings: [{ loc: startStop, click: true }], hold: 1800 });
    await page.waitForTimeout(1500);
  }

  // 19-24. Settings ------------------------------------------------------------------------------------------
  const settingsBtn = page.locator('[data-tour="settings-button"]');
  await guide({ n: 19, slug: 'settings-open', caption: 'Bấm "Settings" để mở cài đặt', rings: [{ loc: settingsBtn, click: true }] });
  await page.waitForSelector('.settings-page');
  await page.waitForTimeout(800);
  await guide({
    n: 20, slug: 'settings-categories',
    caption: 'Chọn "Accounts and keys" (nơi thêm API key). "General" (A) có giao diện sáng/tối',
    rings: [
      { loc: page.locator('.settings-page__item[data-category="general"]'), label: 'A' },
      { loc: page.locator('.settings-page__item[data-category="accounts"]'), click: true },
    ],
  });
  await page.waitForSelector('#provider-section');
  await page.waitForTimeout(800);
  await guide({
    n: 21, slug: 'settings-api-key', hold: cfg.hold + 1000,
    caption: 'Đây là nơi dán/đổi API key của nhà cung cấp. Bấm "Back to the list" để quay lại',
    rings: [{ loc: page.locator('#provider-section'), label: 'A' }, { loc: page.locator('.settings-page__back').first(), click: true }],
  });
  await guide({
    n: 22, caption: 'Bấm "General" để đổi giao diện sáng/tối',
    rings: [{ loc: page.locator('.settings-page__item[data-category="general"]'), click: true }], hold: 1500,
  });
  await page.waitForSelector('.settings-seg');
  await page.waitForTimeout(800);
  const appearance = page.locator('.settings-seg').first();
  await guide({
    n: 22, slug: 'settings-appearance-light', hold: cfg.hold + 800,
    caption: 'Mục "Appearance" (A): System / Dark / Light, đang là Light. Bấm "Dark" để chuyển sang giao diện tối',
    rings: [{ loc: appearance, label: 'A' }, { loc: appearance.getByRole('button', { name: 'Dark' }), click: true }],
  });
  await page.waitForTimeout(2500); // let the viewer see the dark UI
  await guide({
    n: 23, slug: 'settings-appearance-dark', hold: cfg.hold + 800,
    caption: 'Đã chuyển sang giao diện tối. Bấm "Light" để quay lại giao diện sáng',
    rings: [{ loc: appearance.getByRole('button', { name: 'Light' }), click: true }],
  });
  await page.waitForTimeout(1200);
  await guide({
    n: 23, caption: 'Bấm "Back to the list" để quay lại danh sách',
    rings: [{ loc: page.locator('.settings-page__back').first(), click: true }], hold: 1500,
  });
  await guide({
    n: 24, slug: 'settings-back',
    caption: 'Bấm "Back to the session" để về màn hình chính',
    rings: [{ loc: page.locator('.settings-page__back').first(), click: true }],
  });
  await page.waitForSelector('[data-tour="mode-picker"]');
  await page.waitForTimeout(1200);

  await showCard({
    title: 'Hoàn tất',
    lead: live
      ? 'Bấm Start để dịch trực tiếp, bấm Stop để dừng. Đổi API key bất cứ lúc nào trong Settings → Accounts and keys.'
      : 'Thêm API key của bạn trong Settings → Accounts and keys, rồi bấm Start để dịch trực tiếp.',
    iconDataUrl: iconUrl,
  }, 3500);

  // Finalise the recording.
  const video = page.video();
  await ctx.close();
  ctx = null;
  const webm = video ? await video.path() : null;
  if (!webm || !existsSync(webm)) throw new Error('Playwright produced no video');

  const out = join(cfg.media, 'extrans-user-guide.mp4');
  const w = OUT_WIDTH;
  const h = Math.round((VIEW.height * OUT_WIDTH) / VIEW.width / 2) * 2;
  log(`encoding ${webm} -> ${out} (${w}x${h})`);
  execFileSync(cfg.ffmpeg, [
    '-y', '-loglevel', 'error', '-i', webm,
    '-vf', `scale=${w}:${h}:flags=lanczos,fps=25,format=yuv420p`,
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', out,
  ], { stdio: 'inherit', env: childEnv() });
  log(`done: ${out} (${(statSync(out).size / 1e6).toFixed(2)} MB); stills in ${cfg.images}: ${readdirSync(cfg.images).length}`);
}

try {
  await main();
} catch (err) {
  console.error(scrub(err instanceof Error ? (err.stack ?? err.message) : err));
  process.exitCode = 1;
} finally {
  await cleanup();
}
