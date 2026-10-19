// P8's check: does the desktop side pane stay hidden over the hero (D2), and behave as it always
// has once past it?
//
//   node tools/checks/P8.mjs                                       # this tree
//   node tools/checks/P8.mjs --base https://www.aaron-sierra.com   # another origin (the live site)
//
// The done criteria are PASS/FAIL lines, and any FAIL exits 1. Crops of the right edge, over the
// hero and past it, go to tools/shots/p8-check/ for reading by eye.
//
// Desktop with live motion, so the slide and its 1.8 s timer run as a visitor sees them. "The
// strip" is what the collapsed pane leaves on screen: the panel's own left 14px and its shadow
// (P2's finding; the ::after strip never draws). Whether it is drawn is read off pixels: the right
// edge is shot as it is, then with the pane taken out by display:none, and the two are compared.
// display is not transitionable, so the second shot needs no wait.
import fs from 'node:fs';
import path from 'node:path';
import { openPage, measureOverflow, SHOTS_DIR } from '../shoot.mjs';

const args = process.argv.slice(2);
const opt = name => (args.includes(name) ? args[args.indexOf(name) + 1] : null);
const baseUrl = opt('--base');
const outDir = path.join(SHOTS_DIR, 'p8-check');
fs.mkdirSync(outDir, { recursive: true });

const results = [];
function verdict(ok, what, detail = '') {
  results.push(ok);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? `  (${detail})` : ''}`);
}

const W = 1440;
const H = 900;
const AWAY = [720, 450];          // the mouse, somewhere that is not the pane
const EDGE = [W - 5, H / 2];      // the mouse, on the collapsed tab
const EDGE_CLIP = { x: W - 60, y: 150, width: 60, height: 600 };
const SHOW_MS = 600;              // the slide is .45 s; by this long after a reveal it has landed
const HIDDEN_AT_MS = 2500;        // the plan's "2.5 s later"

/** The pane as drawn: its state classes, computed styles, and how much of it is on screen. */
const paneState = page => page.evaluate(() => {
  const w = document.querySelector('.side-nav-wrapper');
  const cs = getComputedStyle(w);
  const r = w.getBoundingClientRect();
  return {
    collapsed: w.classList.contains('collapsed'),
    expanded: w.classList.contains('expanded'),
    visibility: cs.visibility,
    opacity: Number(cs.opacity),
    pointerEvents: cs.pointerEvents,
    onScreen: Math.max(0, Math.round(innerWidth - r.left)),
    heroInView: document.documentElement.classList.contains('hero-in-view'),
    y: Math.round(scrollY),
  };
});
const fmt = s => `${s.expanded ? 'expanded' : s.collapsed ? 'collapsed' : 'neither'}, ${s.onScreen}px on screen, ` +
  `opacity ${s.opacity}, ${s.visibility}, scrollY ${s.y}, hero-in-view ${s.heroInView}`;

/** Is anything of the pane drawn at the right edge? The edge as it is, against the edge without it. */
async function edgeDrawn(page, file) {
  const as = await page.screenshot({ clip: EDGE_CLIP });
  if (file) fs.writeFileSync(path.join(outDir, file), as);
  await page.evaluate(() => {
    const s = document.createElement('style');
    s.id = 'p8-no-pane';
    s.textContent = '.side-nav-wrapper{display:none!important}';
    document.head.appendChild(s);
  });
  const without = await page.screenshot({ clip: EDGE_CLIP });
  await page.evaluate(() => document.getElementById('p8-no-pane').remove());
  return (await pixelsApart(page, as, without)) > DRAWN_PX;
}

// Two shots of the hero photo with nothing changed differ by up to 1/255 per channel, so a byte
// compare of the PNGs failed "not drawn" in 1 run of 4 at P9 and in most runs by P11 (P9-P11
// findings). A pixel counts as different only past PIXEL_TOLERANCE, and the strip counts as drawn
// only past DRAWN_PX of them: the collapsed tab alone is 14 x ~365 px, far above either.
const PIXEL_TOLERANCE = 3; // of 255, on any channel
const DRAWN_PX = 20;

/** How many pixels of two same-sized PNG screenshots differ by more than PIXEL_TOLERANCE, decoded
 *  by the page's own canvas (the harness has no PNG decoder in Node). */
function pixelsApart(page, a, b) {
  return page.evaluate(async ([srcA, srcB, tol]) => {
    const load = src => new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
    const [ia, ib] = await Promise.all([load(srcA), load(srcB)]);
    const canvas = document.createElement('canvas');
    canvas.width = ia.width;
    canvas.height = ia.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(ia, 0, 0);
    const da = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(ib, 0, 0);
    const db = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let n = 0;
    for (let i = 0; i < da.length; i += 4) {
      if (Math.abs(da[i] - db[i]) > tol || Math.abs(da[i + 1] - db[i + 1]) > tol
        || Math.abs(da[i + 2] - db[i + 2]) > tol) n++;
    }
    return n;
  }, [`data:image/png;base64,${a.toString('base64')}`, `data:image/png;base64,${b.toString('base64')}`, PIXEL_TOLERANCE]);
}

/** Count every time the pane gains .expanded, from now on. */
const watchExpands = page => page.evaluate(() => {
  const w = document.querySelector('.side-nav-wrapper');
  window.__p8expands = 0;
  window.__p8mo?.disconnect();
  window.__p8mo = new MutationObserver(() => { if (w.classList.contains('expanded')) window.__p8expands++; });
  window.__p8mo.observe(w, { attributes: true, attributeFilter: ['class'] });
});
const expands = page => page.evaluate(() => window.__p8expands);

/** Wait until scrollY has held still for `quietMs`, and return it. */
async function scrollSettled(page, quietMs = 300, timeoutMs = 6000) {
  const t0 = Date.now();
  let last = await page.evaluate(() => scrollY);
  let stillSince = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    await page.waitForTimeout(50);
    const y = await page.evaluate(() => scrollY);
    if (y !== last) { last = y; stillSince = Date.now(); }
    else if (Date.now() - stillSince >= quietMs) break;
  }
  return last;
}

const jumpTo = (page, top) => page.evaluate(t => window.scrollTo({ top: t, behavior: 'instant' }), top);
const jumpToId = (page, id) => page.evaluate(target =>
  document.getElementById(target).scrollIntoView({ block: 'start', behavior: 'instant' }), id);
async function waitUntil(t0, ms, page) {
  const left = t0 + ms - Date.now();
  if (left > 0) await page.waitForTimeout(left);
}

/** Record, on every animation frame, the hero's bottom edge and how much of the pane is drawn. */
const startRecord = page => page.evaluate(() => {
  const w = document.querySelector('.side-nav-wrapper');
  const hero = document.querySelector('.hero-banner');
  window.__p8 = [];
  window.__p8rec = true;
  const frame = () => {
    if (!window.__p8rec) return;
    const cs = getComputedStyle(w);
    window.__p8.push({
      y: scrollY,
      heroBottom: hero.getBoundingClientRect().bottom,
      onScreen: Math.max(0, innerWidth - w.getBoundingClientRect().left),
      opacity: Number(cs.opacity),
      visibility: cs.visibility,
    });
    requestAnimationFrame(frame);
  };
  frame();
});
const stopRecord = page => page.evaluate(() => { window.__p8rec = false; return window.__p8; });
const drawn = f => f.visibility === 'visible' && f.opacity > 0.01 && f.onScreen >= 1;

async function desktop() {
  console.log('\n== desktop, live motion');
  const { page, close, diag } = await openPage({ device: 'desktop', liveMotion: true, baseUrl });
  try {
    await page.mouse.move(...AWAY);
    await page.waitForTimeout(SHOW_MS);

    // At the top, over the hero
    const top = await paneState(page);
    verdict(top.heroInView && top.collapsed && !top.expanded, 'at the top the pane is collapsed', fmt(top));
    verdict(!(await edgeDrawn(page, 'edge-top.png')), 'at the top the strip is not drawn', fmt(top));
    const o0 = await measureOverflow(page);
    verdict(o0.scrollWidth === W, `scrollWidth at the top is ${W}`, `${o0.scrollWidth}`);

    // Small scrolls inside the hero, by wheel and by script, never expand it
    await watchExpands(page);
    for (const dy of [60, 90, 120]) {
      await page.mouse.wheel(0, dy);
      await scrollSettled(page);
    }
    for (const y of [330, 400, 300]) {
      await jumpTo(page, y);
      await page.waitForTimeout(250);
    }
    await page.waitForTimeout(SHOW_MS);
    const small = await paneState(page);
    const n = await expands(page);
    verdict(small.heroInView && small.collapsed && n === 0,
      'six small scrolls inside the hero leave the pane collapsed, never expanding', `${n} expands; ${fmt(small)}`);
    verdict(!(await edgeDrawn(page, 'edge-in-hero.png')), 'after them the strip is still not drawn', `scrollY ${small.y}`);

    // Nor do the mouse on the edge, or focus on one of its links
    await page.mouse.move(...EDGE);
    await page.waitForTimeout(SHOW_MS);
    const hovered = await paneState(page);
    verdict(hovered.collapsed && (await expands(page)) === 0, 'over the hero the mouse on the right edge does not expand it', fmt(hovered));
    await page.mouse.move(...AWAY);
    await page.evaluate(() => document.querySelector('.side-nav a').focus());
    await page.waitForTimeout(SHOW_MS);
    const focused = await paneState(page);
    verdict(focused.collapsed && (await expands(page)) === 0, 'over the hero focusing a pane link does not expand it', fmt(focused));
    await page.evaluate(() => document.activeElement?.blur());

    // Past the hero: scrolling to #about shows it, and 2.5 s later it is tucked away again
    await jumpTo(page, 0);
    await page.waitForTimeout(SHOW_MS);
    const t0 = Date.now();
    await jumpToId(page, 'about');
    await waitUntil(t0, SHOW_MS, page);
    const about = await paneState(page);
    verdict(!about.heroInView && about.expanded && about.onScreen >= 200 && about.opacity === 1 && about.visibility === 'visible',
      'after scrolling to #about the pane is expanded', fmt(about));
    const o1 = await measureOverflow(page);
    verdict(o1.scrollWidth === W, `scrollWidth at #about is ${W}`, `${o1.scrollWidth}`);
    await waitUntil(t0, HIDDEN_AT_MS, page);
    const later = await paneState(page);
    verdict(later.collapsed && later.onScreen > 0 && later.onScreen <= 16 && later.visibility === 'visible',
      `${HIDDEN_AT_MS / 1000} s later it is collapsed`, `${Date.now() - t0} ms; ${fmt(later)}`);
    verdict(await edgeDrawn(page, 'edge-about.png'), 'and the strip is drawn', `${Date.now() - t0} ms`);

    // Past the hero the rest is as it was: hover holds it open, leaving lets it go, focus opens it
    await page.mouse.move(...EDGE);
    await page.waitForTimeout(HIDDEN_AT_MS);
    const held = await paneState(page);
    verdict(held.expanded && held.onScreen >= 200, 'past the hero, the mouse on the tab opens it and holds it open 2.5 s', fmt(held));
    await page.mouse.move(...AWAY);
    await page.waitForTimeout(1000);
    const left = await paneState(page);
    verdict(left.collapsed && left.onScreen <= 16, 'leaving it lets it tuck away', fmt(left));
    await page.evaluate(() => document.querySelector('.side-nav a').focus());
    await page.waitForTimeout(SHOW_MS);
    const kb = await paneState(page);
    const focusOn = await page.evaluate(() => document.activeElement?.matches('.side-nav a') ?? false);
    verdict(focusOn && kb.expanded && kb.onScreen >= 200, 'keyboard focus on a pane link opens it', fmt(kb));
    await page.evaluate(() => document.activeElement?.blur());
    await page.waitForTimeout(1200);

    // Back up to the hero from an open pane: it goes, strip and all
    await page.mouse.wheel(0, 120);
    await scrollSettled(page, 150);
    const reopened = await paneState(page);
    verdict(reopened.expanded, 'a small scroll past the hero shows it, as before', fmt(reopened));
    await jumpTo(page, 0);
    await page.waitForTimeout(SHOW_MS);
    const back = await paneState(page);
    verdict(back.heroInView && back.collapsed && back.onScreen === 0 && (back.opacity === 0 || back.visibility === 'hidden'),
      'jumping back to the top from an open pane hides it', fmt(back));
    verdict(!(await edgeDrawn(page, 'edge-back-top.png')), 'and no strip is drawn there');

    // A smooth scroll down from the top, by the hero nav: no frame draws the pane while the
    // hero's foot is still below the middle of the screen, and it is out once past it
    await page.mouse.move(...AWAY);
    await startRecord(page);
    await page.click('.hero-nav a[href="#skills"]');
    await scrollSettled(page);
    const frames = await stopRecord(page);
    const overHero = frames.filter(f => f.heroBottom > H / 2);
    const leaks = overHero.filter(drawn);
    verdict(overHero.length >= 3 && leaks.length === 0,
      `smooth scroll to #skills: on all ${overHero.length} frames over the hero the pane is not drawn`,
      leaks.length ? `${leaks.length} drawn, first at scrollY ${leaks[0].y}` : '');
    const past = frames.filter(f => f.heroBottom <= H / 2);
    verdict(past.length > 0 && drawn(past[past.length - 1]), 'and once past the hero it is out',
      past.length ? `${past.filter(drawn).length} of ${past.length} frames past it drawn` : 'no frames past it');

    const errors = diag.consoleErrors.filter(e => !/favicon/.test(e));
    verdict(errors.length === 0, 'no console errors but the favicon', errors.join(' | '));
  } finally {
    await close();
  }
}

await desktop();

const failed = results.filter(ok => !ok).length;
console.log(`\n${results.length - failed} PASS, ${failed} FAIL`);
process.exit(failed ? 1 : 0);
