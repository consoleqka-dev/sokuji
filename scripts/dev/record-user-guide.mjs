#!/usr/bin/env node
// Records the ExTrans first-run walk-through: highlighted stills for the Vietnamese user guide
// (docs/user-guide/images/NN-slug.png) and a narrated-by-captions tutorial video
// (docs/user-guide/media/extrans-user-guide.mp4).
//
// Every step draws a ring + numbered badge + caption bar over the element to press, pauses so the viewer can
// read it, then clicks. No API key is ever typed or read: the credentials step only highlights the key field and
// the provider-guide link, then presses "Skip for now".
//
// Usage: node scripts/dev/record-user-guide.mjs [--dist DIR] [--images DIR] [--media DIR] [--profile DIR]
//                                               [--chrome PATH] [--ffmpeg PATH] [--hold MS]
// Env equivalents: EXTRANS_DIST, EXTRANS_GUIDE_IMAGES, EXTRANS_GUIDE_MEDIA, EXTRANS_GUIDE_PROFILE, CHROME_PATH,
// FFMPEG (or FFMPEG_PATH), EXTRANS_GUIDE_HOLD_MS. DYLD_FALLBACK_LIBRARY_PATH, when set, is passed through to ffmpeg
// (needed on machines whose Homebrew ffmpeg links a removed libx265).
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, mkdtempSync } from 'node:fs';
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
  const cur = document.createElement('div');
  cur.style.cssText = `position:absolute;left:${from.x - 8}px;top:${from.y - 8}px;width:16px;height:16px;border-radius:8px;` +
    'background:rgba(255,64,64,.95);border:2px solid #fff;box-shadow:0 2px 10px rgba(0,0,0,.6);transition:left .8s ease,top .8s ease;';
  root.appendChild(cur);
  document.body.appendChild(root);
  void cur.offsetWidth;
  cur.style.left = `${to.x - 8}px`;
  cur.style.top = `${to.y - 8}px`;
}

const removeOverlay = () => document.getElementById('__guide')?.remove();
const pulseCursor = () => {
  const cur = document.querySelector('#__guide > div:last-child');
  if (!cur) return;
  cur.style.transition = 'transform .25s ease, opacity .25s ease';
  cur.style.transform = 'scale(1.8)';
  cur.style.opacity = '0.45';
};

// -------------------------------------------------------------------------------------------------- guide driver
function makeGuide(page) {
  let stillNo = 0;
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
   *   rings    [{ loc, click?, label? }] — the first entry with click:true is the primary target; others are extra
   *            "look here" rings (dashed, lettered). Rings whose locator matches nothing are dropped.
   *   slug     when set, a still with the highlight burned in is saved as images/NN-slug.png
   *   hold     how long the highlight stays up before the click
   */
  return async function guide({ n, caption, rings, slug, hold = cfg.hold }) {
    const present = [];
    for (const r of rings) {
      const loc = r.loc.first();
      if (await loc.count()) present.push({ ...r, loc });
    }
    if (!present.length) throw new Error(`step ${n}: no ring target found (${caption})`);
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
    const target = spec[present.indexOf(primary)];
    // Park the cursor on the target's bottom-right corner so it never hides the label being pointed at.
    const to = { x: target.x + target.w - Math.min(10, target.w / 2), y: target.y + target.h - Math.min(5, target.h / 2) };
    await page.evaluate(installOverlay, { rings: spec, caption: `Bước ${n}: ${caption}`, from: cursor, to });
    cursor = to;

    await page.waitForTimeout(Math.min(1100, hold)); // cursor arrives
    if (slug) {
      stillNo += 1;
      const file = join(cfg.images, `${String(stillNo).padStart(2, '0')}-${slug}.png`);
      await page.screenshot({ path: file });
      console.log('still', file);
    }
    await page.waitForTimeout(Math.max(0, hold - 1100));

    if (primary.click) {
      await page.evaluate(pulseCursor);
      await primary.loc.click({ timeout: ACT_TIMEOUT });
    }
    await page.waitForTimeout(250);
    await page.evaluate(removeOverlay).catch(() => {}); // the click may have navigated
    await page.waitForTimeout(700);
  };
}

// -------------------------------------------------------------------------------------------------- title cards
function slideHtml(title, subtitle, iconDataUrl) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;height:100%;background:radial-gradient(circle at 30% 20%,#1b2a5c,#070b1a 70%);color:#fff;
      font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;}
    .w{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:0 28px;gap:18px}
    img{width:96px;height:96px;border-radius:22px;box-shadow:0 8px 30px rgba(60,110,255,.5)}
    h1{margin:0;font-size:30px;line-height:1.25}
    p{margin:0;font-size:17px;line-height:1.5;color:#b9c4ee}
    .s{margin-top:24px;font-size:13px;color:#7f8bb8}
  </style></head><body><div class="w">${iconDataUrl ? `<img src="${iconDataUrl}" alt="">` : ''}
    <h1>${title}</h1><p>${subtitle}</p>
    <div class="s">ExTrans is based on Sokuji by Kizuna AI Lab, licensed under AGPL-3.0.</div></div></body></html>`;
}

// ---------------------------------------------------------------------------------------------------- main
const log = (...a) => console.log('[record-user-guide]', ...a);
let ctx = null;
let tmpVideoDir = null;

async function cleanup() {
  if (ctx) { await ctx.close().catch(() => {}); ctx = null; }
  rmSync(cfg.profile, { recursive: true, force: true });
  if (tmpVideoDir) rmSync(tmpVideoDir, { recursive: true, force: true });
}
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { cleanup().finally(() => process.exit(130)); });

async function main() {
  rmSync(cfg.profile, { recursive: true, force: true });
  mkdirSync(cfg.images, { recursive: true });
  for (const f of readdirSync(cfg.images)) if (/^\d\d-.*\.png$/.test(f)) rmSync(join(cfg.images, f)); // stale stills only
  mkdirSync(cfg.media, { recursive: true });
  tmpVideoDir = mkdtempSync(join(tmpdir(), 'extrans-guide-video-'));

  // Pass 1 (not recorded): give the profile a clean, dark-scheme first-run state so the wizard starts at step 1.
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
      await new Promise((r) => chrome.storage.sync.set({ 'settings.common.theme': 'dark' }, r));
      localStorage.setItem('sokuji.theme', 'dark');
    });
    await sleep(1500);
  } finally {
    await prep.close().catch(() => {});
  }

  // Pass 2 (recorded): the walk-through.
  log('pass 2: recording');
  ctx = await chromium.launchPersistentContext(cfg.profile, {
    executablePath: chromePath, headless: false, viewport: VIEW, deviceScaleFactor: 2,
    recordVideo: { dir: tmpVideoDir, size: VIEW },
    args: launchArgs(),
  });
  // The popup only offers "Open ExTrans" when the active tab is a supported site; as a standalone tab its active
  // tab is itself, so present a supported site to it. Only popup.html is affected.
  await ctx.addInitScript(() => {
    if (location.pathname.endsWith('/popup.html')) {
      chrome.tabs.query = async () => [{ id: 1, url: 'https://meet.google.com/' }];
    }
  });
  const base = await extensionBase(ctx);
  const page = ctx.pages()[0] ?? await ctx.newPage();
  page.setDefaultTimeout(ACT_TIMEOUT);
  page.setDefaultNavigationTimeout(NAV_TIMEOUT);
  const guide = makeGuide(page);

  const iconFile = join(cfg.dist, 'icons', 'icon128.png');
  const iconUrl = existsSync(iconFile) ? `data:image/png;base64,${readFileSync(iconFile).toString('base64')}` : '';
  await page.goto('about:blank');
  await page.setContent(slideHtml('ExTrans — Hướng dẫn sử dụng', 'Dịch giọng nói trực tiếp ngay trong trình duyệt', iconUrl));
  await page.waitForTimeout(3500);

  const body = page.locator('.setup-wizard__body');
  const next = page.locator('.setup-wizard__footer button').last();
  const nextBtn = page.locator('.setup-wizard__footer button.btn-primary, .setup-wizard__footer button').last();
  const card = (valueSel) => body.locator('label.setup-card').filter({ has: page.locator(valueSel) });

  // 1. Popup -------------------------------------------------------------------------------------------------
  await page.goto(`${base}/popup.html`);
  await page.waitForSelector('#openSidePanel', { state: 'visible', timeout: NAV_TIMEOUT });
  await page.waitForTimeout(800);
  // Point at the button; the real popup closes itself and opens the side panel, so the stand-in tab is used next.
  await guide({
    n: 1, slug: 'popup-open', hold: cfg.hold + 800,
    caption: 'Mở một trang web được hỗ trợ (vd. Google Meet), bấm biểu tượng ExTrans rồi bấm "Open ExTrans"',
    rings: [{ loc: page.locator('#openSidePanel'), primary: true }],
  });

  // 2-7. Setup wizard (fullpage.html stands in for the side panel) ------------------------------------------
  await page.goto(`${base}/fullpage.html`);
  await page.waitForSelector('.setup-wizard__card', { timeout: NAV_TIMEOUT });
  await page.waitForTimeout(900);

  await guide({
    n: 2, slug: 'wizard-language',
    caption: 'Thiết lập 1/6: chọn ngôn ngữ giao diện (A), rồi bấm "Next"',
    rings: [{ loc: body.locator('select'), label: 'A' }, { loc: next, click: true }],
  });

  await guide({
    n: 3, slug: 'wizard-scenario',
    caption: 'Thiết lập 2/6: chọn tình huống gần nhất với nhu cầu của bạn',
    rings: [{ loc: body.locator('label.setup-card').first(), click: true }],
  });
  await guide({ n: 3, caption: 'Bấm "Next"', rings: [{ loc: next, click: true }], hold: 1500 });

  await guide({
    n: 4, caption: 'Thiết lập 3/6: chọn "I have my own API key" (dùng khóa của bạn)',
    rings: [{ loc: card('input[value="own-key"]'), click: true }],
  });
  await page.waitForSelector('.setup-wizard__body input[name="provider"]');
  await guide({
    n: 4, slug: 'wizard-provider',
    caption: 'Chọn nhà cung cấp AI bạn có tài khoản (link A: hướng dẫn lấy khóa)',
    rings: [
      { loc: body.locator('.setup-note, .setup-step__note a.setup-link'), label: 'A' },
      { loc: card('input[name="provider"]:not([disabled])'), click: true },
    ],
  });
  await guide({ n: 4, caption: 'Bấm "Next"', rings: [{ loc: next, click: true }], hold: 1500 });

  // Credentials: ring the key field and the guide link, then skip. Nothing is typed into the field.
  await page.waitForSelector('.setup-wizard__body .setup-field input');
  await guide({
    n: 5, slug: 'wizard-credentials', hold: cfg.hold + 1200,
    caption: 'Thiết lập 4/6: dán API key vào ô A, xem cách lấy khóa ở link B. Ở đây ta bấm "Skip for now"',
    rings: [
      { loc: body.locator('.setup-field input'), label: 'A' },
      { loc: body.locator('a.setup-link'), label: 'B' },
      { loc: body.getByRole('button', { name: 'Skip for now' }), click: true },
    ],
  });

  await page.waitForSelector('.setup-wizard__body select');
  await guide({
    n: 6, slug: 'wizard-language-pair',
    caption: 'Thiết lập 5/6: chọn ngôn ngữ nguồn (A) và ngôn ngữ đích (B)',
    rings: [
      { loc: body.locator('select').nth(0), label: 'A' },
      { loc: body.locator('select').nth(1), label: 'B' },
      { loc: next, click: true },
    ],
  });

  await page.waitForSelector('.setup-summary');
  await guide({
    n: 7, slug: 'wizard-finish',
    caption: 'Thiết lập 6/6: xem lại cấu hình, rồi bấm "Finish"',
    rings: [{ loc: next, click: true }],
  });

  // 8-9. Product tour ----------------------------------------------------------------------------------------
  await page.waitForSelector('.tour-popover:not(.is-resolving)', { timeout: NAV_TIMEOUT });
  await page.waitForTimeout(800);
  const tourNext = page.locator('.tour-popover__btn--primary');
  const tourSkip = page.locator('.tour-popover__btn--ghost');
  await guide({
    n: 8, slug: 'tour-welcome',
    caption: 'Hướng dẫn nhanh: bấm "Next" để xem từng phần (hoặc "Skip" để bỏ qua)',
    rings: [{ loc: tourSkip, label: 'A' }, { loc: tourNext, click: true }],
  });
  await page.waitForSelector('.tour-popover:not(.is-resolving)');
  await page.waitForTimeout(600);
  await guide({
    n: 9, slug: 'tour-mode-picker',
    caption: 'Phần này nói về bộ chọn chế độ. Bấm "Skip" để kết thúc phần hướng dẫn nhanh',
    rings: [{ loc: tourNext, label: 'A' }, { loc: tourSkip, click: true }],
  });

  // 10. Main panel -------------------------------------------------------------------------------------------
  await page.waitForSelector('[data-tour="mode-picker"]', { timeout: NAV_TIMEOUT });
  await page.waitForTimeout(900);
  await guide({
    n: 10, slug: 'main-panel', hold: cfg.hold + 1500,
    caption: 'Màn hình chính: chọn chế độ Me / Other / Both (A), rồi bấm "Start" (B) khi đã thêm API key',
    rings: [
      { loc: page.locator('[data-tour="mode-picker"]'), label: 'A' },
      { loc: page.locator('[data-tour="main-action"]'), label: 'B', primary: true },
    ],
  });

  // 11-15. Settings ------------------------------------------------------------------------------------------
  const settingsBtn = page.locator('[data-tour="settings-button"]');
  await guide({ n: 11, slug: 'settings-open', caption: 'Bấm "Settings" để mở cài đặt', rings: [{ loc: settingsBtn, click: true }] });
  await page.waitForSelector('.settings-page');
  await page.waitForTimeout(800);
  await guide({
    n: 12, slug: 'settings-categories',
    caption: 'Chọn "Accounts and keys" (nơi thêm API key). "General" (A) có giao diện sáng/tối',
    rings: [
      { loc: page.locator('.settings-page__item[data-category="general"]'), label: 'A' },
      { loc: page.locator('.settings-page__item[data-category="accounts"]'), click: true },
    ],
  });
  await page.waitForSelector('#provider-section');
  await page.waitForTimeout(800);
  await guide({
    n: 13, slug: 'settings-api-key', hold: cfg.hold + 1000,
    caption: 'Đây là nơi dán/đổi API key của nhà cung cấp. Bấm "Back to the list" để quay lại',
    rings: [{ loc: page.locator('#provider-section'), label: 'A' }, { loc: page.locator('.settings-page__back').first(), click: true }],
  });
  await guide({
    n: 14, caption: 'Bấm "General" để đổi giao diện sáng/tối',
    rings: [{ loc: page.locator('.settings-page__item[data-category="general"]'), click: true }], hold: 1500,
  });
  await page.waitForSelector('.settings-seg');
  await page.waitForTimeout(800);
  const appearance = page.locator('.settings-seg').first();
  await guide({
    n: 14, slug: 'settings-appearance-dark', hold: cfg.hold + 800,
    caption: 'Mục "Appearance" (A): System / Dark / Light. Bấm "Light" để chuyển sang giao diện sáng',
    rings: [{ loc: appearance, label: 'A' }, { loc: appearance.getByRole('button', { name: 'Light' }), click: true }],
  });
  await page.waitForTimeout(2500); // let the viewer see the light UI
  await guide({
    n: 15, slug: 'settings-appearance-light', hold: cfg.hold + 800,
    caption: 'Đã chuyển sang giao diện sáng. Bấm "Dark" để quay lại giao diện tối',
    rings: [{ loc: appearance.getByRole('button', { name: 'Dark' }), click: true }],
  });
  await page.waitForTimeout(1200);
  await guide({
    n: 15, caption: 'Bấm "Back to the list" để quay lại danh sách',
    rings: [{ loc: page.locator('.settings-page__back').first(), click: true }], hold: 1500,
  });
  await guide({
    n: 16, slug: 'settings-back',
    caption: 'Bấm "Back to the session" để về màn hình chính',
    rings: [{ loc: page.locator('.settings-page__back').first(), click: true }],
  });
  await page.waitForSelector('[data-tour="mode-picker"]');
  await page.waitForTimeout(1200);

  await page.goto('about:blank');
  await page.setContent(slideHtml('Hoàn tất', 'Thêm API key của bạn trong Settings → Accounts and keys, rồi bấm Start để dịch trực tiếp.', iconUrl));
  await page.waitForTimeout(3500);

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
  ], { stdio: 'inherit', env: { ...process.env } });
  log(`done: ${out} (${(statSync(out).size / 1e6).toFixed(2)} MB); stills in ${cfg.images}: ${readdirSync(cfg.images).length}`);
}

try {
  await main();
} catch (err) {
  console.error(err);
  process.exitCode = 1;
} finally {
  await cleanup();
}
