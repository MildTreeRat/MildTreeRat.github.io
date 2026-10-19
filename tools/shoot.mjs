// Screenshot and measurement harness for the site revamp (docs/plans/site-revamp.md, P1).
//
//   node tools/shoot.mjs <label> [--dark] [--live-motion] [--device phone|desktop]
//
// Serves the repo root over http (not file://, so relative URLs and fetches behave as they do on
// GitHub Pages), opens it in the *installed* Edge through playwright-core (no browser download), and
// for each device writes the top of the page, every section[id] and the full page to
// tools/shots/<label>/ (tools/shots/<label>-dark/ with --dark, so a light and a dark run of the same
// label never overwrite each other). It prints, per device, the horizontal overflow, console errors
// and failed requests, and writes the same to report.json beside the shots.
//
// Later phases' interaction checks import openPage() from here: see tools/checks/<Pn>.mjs.
//
// playwright-core is pinned to 1.61.1: it is the last release whose engines field accepts Node 18/19
// (1.62.0 onward requires Node >= 20), and this machine runs Node 19.8.1.

import http from 'node:http';
import { readFile, stat, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const TOOLS_DIR = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(TOOLS_DIR, '..');
export const SHOTS_DIR = path.join(TOOLS_DIR, 'shots');

// The side pane hides itself 1.8 s after the last scroll (SHOW_DURATION in index.html); waiting
// longer than that after every scroll means a shot never catches it half-way.
export const SETTLE_MS = 2500;

// Deterministic pixels: with transitions off, a class change lands in the frame it is made in.
// Pseudo-elements are included because the hero's film is a ::before. scroll-behavior is left
// alone on purpose, so a check can still read what the page declares; the harness's own scrolls
// pass behavior:'instant' instead.
const FREEZE_CSS =
  '*,*::before,*::after{transition:none!important;animation:none!important}';

export const DEVICES = {
  // The owner's phone is an iPhone: 390x844 CSS px at 3x is an iPhone 12-15. Touch, so
  // (hover: hover) and (pointer: fine) media queries are false, as they are on the real thing.
  phone: {
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  },
  desktop: {
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
  },
};

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

/** Serve `root` on a free localhost port. Missing files are real 404s, as they would be on Pages,
 *  and each one is also kept in `misses`: the browser's own requests (the favicon) never reach
 *  Playwright's request events, so the server is the only place they are seen. */
export async function startServer(root = ROOT) {
  const misses = [];
  const server = http.createServer(async (req, res) => {
    try {
      const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      let file = path.resolve(root, '.' + urlPath);
      if (file !== root && !file.startsWith(root + path.sep)) {
        res.writeHead(403).end('forbidden');
        return;
      }
      let info = await stat(file).catch(() => null);
      if (info?.isDirectory()) {
        file = path.join(file, 'index.html');
        info = await stat(file).catch(() => null);
      }
      if (!info?.isFile()) {
        misses.push(urlPath);
        res.writeHead(404, { 'Content-Type': 'text/plain' }).end('not found');
        return;
      }
      const type = MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
      res.end(req.method === 'HEAD' ? undefined : await readFile(file));
    } catch (err) {
      res.writeHead(500).end(String(err));
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return {
    url: `http://127.0.0.1:${port}`,
    misses,
    close: () => new Promise(resolve => server.close(() => resolve())),
  };
}

/** The installed Edge, headless. */
export function launchEdge() {
  return chromium.launch({ channel: 'msedge', headless: true });
}

/** A page on `baseUrl + path` in a fresh context for one device, loaded to network idle, with its
 *  console errors and failed requests collected into `diag` from the first request on. */
async function newDevicePage(browser, baseUrl, opts = {}) {
  const {
    device = 'phone',
    dark = false,
    liveMotion = false,
    reducedMotion = false,
    path: pagePath = '/',
  } = opts;
  const spec = DEVICES[device];
  if (!spec) throw new Error(`unknown device "${device}" (expected ${Object.keys(DEVICES).join(' or ')})`);

  const context = await browser.newContext({
    ...spec,
    colorScheme: dark ? 'dark' : 'light',
    reducedMotion: reducedMotion ? 'reduce' : 'no-preference',
  });
  if (!liveMotion) {
    // Injected at DOMContentLoaded rather than after load, so nothing the page does on load
    // animates either; and as an init script, so it survives a reload.
    await context.addInitScript(css => {
      document.addEventListener('DOMContentLoaded', () => {
        const s = document.createElement('style');
        s.dataset.harness = 'freeze-motion';
        s.textContent = css;
        document.head.appendChild(s);
      }, { once: true });
    }, FREEZE_CSS);
  }

  const page = await context.newPage();
  const diag = { consoleErrors: [], failedRequests: [] };
  page.on('console', msg => {
    if (msg.type() !== 'error') return;
    // "Failed to load resource" names no resource in its text; the location does.
    const where = msg.location()?.url;
    diag.consoleErrors.push(where ? `${msg.text()} [${where}]` : msg.text());
  });
  page.on('pageerror', err => diag.consoleErrors.push(`uncaught: ${err.message}`));
  page.on('requestfailed', req =>
    diag.failedRequests.push(`${req.failure()?.errorText ?? 'failed'} ${req.url()}`));
  page.on('response', res => {
    if (res.status() >= 400) diag.failedRequests.push(`${res.status()} ${res.url()}`);
  });

  const url = baseUrl + pagePath;
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  return { page, context, url, diag };
}

/**
 * Open the site for an interaction check.
 *
 *   const { page, url, close } = await openPage({ device: 'phone' });
 *   await page.tap('.navbar-burger');
 *   ...
 *   await close();
 *
 * Options: device ('phone' | 'desktop', default phone), dark (prefers-color-scheme: dark),
 * liveMotion (keep transitions and animations; off by default for deterministic pixels),
 * reducedMotion (prefers-reduced-motion: reduce), path (default '/'), baseUrl (open another
 * origin instead of serving the repo, e.g. 'https://www.aaron-sierra.com' to look at the live site).
 *
 * Also returned: `diag` ({ consoleErrors, failedRequests }, filled as the page runs), and the
 * `context` and `browser`, should a check need a second page.
 */
export async function openPage(opts = {}) {
  const server = opts.baseUrl
    ? { url: opts.baseUrl.replace(/\/$/, ''), misses: [], close: async () => {} }
    : await startServer();
  let browser;
  try {
    browser = await launchEdge();
    const { page, context, url, diag } = await newDevicePage(browser, server.url, opts);
    const close = async () => {
      await browser.close();
      await server.close();
    };
    return { page, url, close, diag, context, browser };
  } catch (err) {
    await browser?.close();
    await server.close();
    throw err;
  }
}

/** Scroll so the element with this id is at the top of the viewport, the way a JS scroll does it
 *  (#anchor navigation renders blank in headless Edge), then wait for the page to settle. */
export async function scrollToId(page, id, settleMs = SETTLE_MS) {
  const found = await page.evaluate(target => {
    const el = document.getElementById(target);
    if (!el) return false;
    el.scrollIntoView({ block: 'start', behavior: 'instant' });
    return true;
  }, id);
  if (!found) throw new Error(`no element with id "${id}"`);
  await settle(page, settleMs);
}

/** Wait out the side pane's hide timer, then for anything the scroll started loading. */
export async function settle(page, ms = SETTLE_MS) {
  await page.waitForTimeout(ms);
  await page.waitForLoadState('networkidle');
}

/** document.documentElement.scrollWidth against the viewport: anything above zero is the page
 *  scrolling sideways. */
export function measureOverflow(page) {
  return page.evaluate(() => {
    const scrollWidth = document.documentElement.scrollWidth;
    const viewport = window.innerWidth;
    return { scrollWidth, viewport, overflow: scrollWidth - viewport };
  });
}

async function shootDevice(browser, server, device, outDir, opts) {
  const missesBefore = server.misses.length;
  const { page, context, diag } = await newDevicePage(browser, server.url, { ...opts, device });
  const shots = [];
  const overflow = [];
  const take = async (name, fullPage = false) => {
    const file = `${device}-${name}.png`;
    // The full page is shot at CSS scale: at 3x a phone page is tens of thousands of pixels tall,
    // past what Chromium will capture in one piece. The viewport shots keep the device's 3x.
    await page.screenshot({
      path: path.join(outDir, file),
      fullPage,
      scale: fullPage ? 'css' : 'device',
    });
    shots.push(file);
    overflow.push({ shot: name, ...(await measureOverflow(page)) });
  };

  await settle(page);
  await take('top');

  const ids = await page.evaluate(() =>
    Array.from(document.querySelectorAll('section[id]'), s => s.id));
  for (const id of ids) {
    await scrollToId(page, id);
    await take(id);
  }

  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await settle(page);
  await take('full', true);

  await context.close();
  for (const miss of server.misses.slice(missesBefore)) {
    const url = server.url + miss;
    if (!diag.failedRequests.some(f => f.endsWith(' ' + url))) {
      diag.failedRequests.push(`404 ${url} (browser-initiated: seen by the server only)`);
    }
  }
  const worst = overflow.reduce((a, b) => (b.overflow > a.overflow ? b : a));
  return {
    device,
    viewport: DEVICES[device].viewport,
    deviceScaleFactor: DEVICES[device].deviceScaleFactor,
    sections: ids,
    overflowAtTop: overflow[0],
    overflowWorst: worst,
    overflow,
    consoleErrors: diag.consoleErrors,
    failedRequests: diag.failedRequests,
    shots,
  };
}

function printDevice(r) {
  const { width, height } = r.viewport;
  const fmt = o =>
    `scrollWidth ${o.scrollWidth} vs viewport ${o.viewport}` +
    (o.overflow > 0 ? ` -> OVERFLOW +${o.overflow}px` : ' -> no overflow');
  console.log(`\n${r.device} ${width}x${height} @${r.deviceScaleFactor}x`);
  console.log(`  at top:  ${fmt(r.overflowAtTop)}`);
  console.log(`  worst:   ${fmt(r.overflowWorst)} (shot "${r.overflowWorst.shot}")`);
  console.log(`  sections (${r.sections.length}): ${r.sections.join(', ')}`);
  console.log(`  console errors (${r.consoleErrors.length}):` +
    (r.consoleErrors.length ? '\n    ' + r.consoleErrors.join('\n    ') : ' none'));
  console.log(`  failed requests (${r.failedRequests.length}):` +
    (r.failedRequests.length ? '\n    ' + r.failedRequests.join('\n    ') : ' none'));
  console.log(`  shots (${r.shots.length}): ${r.shots.join(', ')}`);
}

function parseArgs(argv) {
  const args = { label: null, dark: false, liveMotion: false, devices: Object.keys(DEVICES) };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dark') args.dark = true;
    else if (a === '--live-motion') args.liveMotion = true;
    else if (a === '--device') args.devices = [argv[++i]];
    else if (a.startsWith('--')) throw new Error(`unknown flag ${a}`);
    else if (args.label === null) args.label = a;
    else throw new Error(`unexpected argument ${a}`);
  }
  if (!args.label || !/^[A-Za-z0-9._-]+$/.test(args.label)) {
    throw new Error('usage: node tools/shoot.mjs <label> [--dark] [--live-motion] [--device phone|desktop]');
  }
  for (const d of args.devices) {
    if (!DEVICES[d]) throw new Error(`unknown device "${d}"`);
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const dirName = args.label + (args.dark ? '-dark' : '');
  const outDir = path.join(SHOTS_DIR, dirName);
  await mkdir(outDir, { recursive: true });

  const server = await startServer();
  const browser = await launchEdge();
  const results = [];
  try {
    console.log(`serving ${ROOT} at ${server.url}; Edge ${browser.version()}; ` +
      `${args.dark ? 'dark' : 'light'} scheme${args.liveMotion ? ', live motion' : ''}`);
    for (const device of args.devices) {
      const r = await shootDevice(browser, server, device, outDir, args);
      printDevice(r);
      results.push(r);
    }
  } finally {
    await browser.close();
    await server.close();
  }

  const report = {
    label: args.label,
    scheme: args.dark ? 'dark' : 'light',
    liveMotion: args.liveMotion,
    takenAt: new Date().toISOString(),
    devices: results,
  };
  await writeFile(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(`\nwrote ${path.relative(ROOT, outDir)}${path.sep} (report.json beside the shots)`);
}

const invokedDirectly =
  process.argv[1] &&
  path.resolve(process.argv[1]).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase();
if (invokedDirectly) {
  main().catch(err => {
    console.error(err?.stack ?? err);
    process.exit(1);
  });
}
