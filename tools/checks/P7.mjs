// P7's check: does the phone's dot rail stand in for the side pane (D1)?
//
//   node tools/checks/P7.mjs                                       # this tree
//   node tools/checks/P7.mjs --base https://www.aaron-sierra.com   # another origin (the live site)
//
// The done criteria are PASS/FAIL lines, and any FAIL exits 1. Crops of the rail, lit and with a
// label showing, go to tools/shots/p7-check/ for reading by eye.
//
// The phone runs in light and dark with transitions frozen (openPage's default), so "hidden" and
// "shown" are read straight off computed styles and the label's timer is exact. One more phone run
// keeps live motion, to time the label's fade-out as a visitor sees it and to sample the rail on
// every frame of a smooth scroll: it must never pop in or out. Under reduced motion a dot's tap
// jumps. On desktop the rail is not displayed at all.
import fs from 'node:fs';
import path from 'node:path';
import { openPage, scrollToId, measureOverflow, SHOTS_DIR } from '../shoot.mjs';

const args = process.argv.slice(2);
const opt = name => (args.includes(name) ? args[args.indexOf(name) + 1] : null);
const baseUrl = opt('--base');
const outDir = path.join(SHOTS_DIR, 'p7-check');
fs.mkdirSync(outDir, { recursive: true });

const results = [];
function verdict(ok, what, detail = '') {
  results.push(ok);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? `  (${detail})` : ''}`);
}

const RAIL = '.dot-rail';
const DOT = id => `.dot-rail-dot[href="#${id}"]`;
const LABEL_MS = 1500; // the label must be gone this long after the tap (it is drawn for ~1.2 s)

/** The rail as drawn: computed visibility, its box, and every dot with its label. */
const railState = page => page.evaluate(sel => {
  const rail = document.querySelector(sel);
  const sideLinks = Array.from(document.querySelectorAll('.side-nav a'))
    .map(a => ({ href: a.getAttribute('href'), name: a.textContent.trim() }));
  if (!rail) return { missing: true, sideLinks };
  const cs = getComputedStyle(rail);
  const r = rail.getBoundingClientRect();
  const dots = Array.from(rail.querySelectorAll('.dot-rail-dot')).map(d => {
    const dr = d.getBoundingClientRect();
    const dc = getComputedStyle(d, '::before');
    const label = d.querySelector('.dot-rail-label');
    const lc = getComputedStyle(label);
    const lr = label.getBoundingClientRect();
    return {
      href: d.getAttribute('href'),
      ariaLabel: d.getAttribute('aria-label'),
      current: d.getAttribute('aria-current'),
      active: d.classList.contains('active'),
      box: { x: Math.round(dr.x), y: Math.round(dr.y), w: Math.round(dr.width), h: Math.round(dr.height) },
      dot: { w: dc.width, h: dc.height, opacity: Number(dc.opacity), bg: dc.backgroundImage !== 'none' ? dc.backgroundImage : dc.backgroundColor, transform: dc.transform },
      label: {
        text: label.textContent,
        visibility: lc.visibility,
        opacity: Number(lc.opacity),
        shown: lc.visibility === 'visible' && Number(lc.opacity) > 0.5,
        box: { left: Math.round(lr.left), right: Math.round(lr.right), top: Math.round(lr.top), bottom: Math.round(lr.bottom) },
      },
    };
  });
  return {
    display: cs.display,
    visibility: cs.visibility,
    opacity: Number(cs.opacity),
    pointerEvents: cs.pointerEvents,
    zIndex: cs.zIndex,
    box: { x: Math.round(r.x), y: Math.round(r.y), w: r.width, h: Math.round(r.height), right: Math.round(r.right) },
    heroInView: document.documentElement.classList.contains('hero-in-view'),
    dots,
    sideLinks,
  };
}, RAIL);

const isShown = s => s.display !== 'none' && s.visibility === 'visible' && s.opacity >= 0.99;
const isHidden = s => s.display === 'none' || (s.visibility === 'hidden' && s.opacity === 0 && s.pointerEvents === 'none');
const lit = s => s.dots.filter(d => d.active || d.current);
const scaleOf = t => { const m = /matrix\(([^,]+)/.exec(t || ''); return m ? Number(m[1]) : 1; };

/** Wait until scrollY has held still for `quietMs`, and return it. */
async function scrollSettled(page, quietMs = 400, timeoutMs = 6000) {
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

/** Record, on every animation frame, scrollY and the rail's computed opacity and visibility. */
const startRecord = page => page.evaluate(sel => {
  const rail = document.querySelector(sel);
  window.__p7 = [];
  window.__p7rec = true;
  const frame = () => {
    if (!window.__p7rec) return;
    const cs = getComputedStyle(rail);
    window.__p7.push({ y: scrollY, opacity: Number(cs.opacity), visibility: cs.visibility });
    requestAnimationFrame(frame);
  };
  frame();
}, RAIL);
const stopRecord = page => page.evaluate(() => { window.__p7rec = false; return window.__p7; });

/** Positions strictly between a scroll's first and last: none for a jump, many for a smooth scroll. */
function between(frames) {
  const ys = frames.map(f => f.y);
  const [start, end] = [ys[0], ys[ys.length - 1]];
  return { start, end, n: new Set(ys.filter(y => y !== start && y !== end)).size };
}

async function railCrop(page, file) {
  const s = await railState(page);
  const labelLeft = Math.min(...s.dots.map(d => (d.label.shown ? d.label.box.left : s.box.x)));
  const x = Math.max(0, Math.min(labelLeft, s.box.x) - 12);
  const clip = { x, y: Math.max(0, s.box.y - 12), width: 390 - x, height: s.box.h + 24 };
  await page.screenshot({ path: path.join(outDir, file), clip });
  console.log(`   shot: ${path.relative(process.cwd(), path.join(outDir, file))}`);
}

async function phoneScheme(dark) {
  const scheme = dark ? 'dark' : 'light';
  console.log(`\n== phone, ${scheme} scheme`);
  const { page, close } = await openPage({ device: 'phone', dark, baseUrl });
  try {
    // At the top, over the hero
    const top = await railState(page);
    if (top.missing) { verdict(false, `${scheme}: the page has a dot rail`); return; }
    const sameList = top.dots.length === top.sideLinks.length &&
      top.dots.every((d, i) => d.href === top.sideLinks[i].href && d.ariaLabel === top.sideLinks[i].name &&
        d.label.text === top.sideLinks[i].name);
    verdict(sameList, `${scheme}: one dot per side-pane link, in order, each with its aria-label`,
      top.dots.map(d => d.ariaLabel).join(', '));
    verdict(top.heroInView && isHidden(top), `${scheme}: at the top the rail is hidden`,
      `display ${top.display}, visibility ${top.visibility}, opacity ${top.opacity}, pointer-events ${top.pointerEvents}`);
    const o0 = await measureOverflow(page);
    verdict(o0.scrollWidth === 390, `${scheme}: scrollWidth at the top is 390`, `${o0.scrollWidth}`);

    // A small scroll inside the hero leaves it hidden
    await page.evaluate(() => window.scrollTo({ top: 200, behavior: 'instant' }));
    await page.waitForTimeout(300);
    const inHero = await railState(page);
    verdict(isHidden(inHero), `${scheme}: 200px down, still over the hero, the rail stays hidden`);

    // Scrolled to Skills
    await scrollToId(page, 'skills');
    const sk = await railState(page);
    verdict(!sk.heroInView && isShown(sk), `${scheme}: at #skills the rail is visible`,
      `display ${sk.display}, visibility ${sk.visibility}, opacity ${sk.opacity}`);
    verdict(sk.box.w > 0 && sk.box.w <= 28 && sk.box.right === 390,
      `${scheme}: the rail is at most 28px wide, on the right edge`, `${sk.box.w}px wide, x ${sk.box.x}-${sk.box.right}`);
    verdict(sk.box.y >= 56 && sk.box.y + sk.box.h <= 844 - 8,
      `${scheme}: the rail is clear of the burger (y 4-48) and on screen`, `y ${sk.box.y}-${sk.box.y + sk.box.h}`);
    verdict(sk.dots.every(d => d.box.w === 28 && d.box.h === 36),
      `${scheme}: every tap target is 28x36`, [...new Set(sk.dots.map(d => `${d.box.w}x${d.box.h}`))].join(', '));
    const litSk = lit(sk);
    verdict(litSk.length === 1 && litSk[0].href === '#skills' && litSk[0].active && litSk[0].current === 'true',
      `${scheme}: the lit dot is Skills, with aria-current`, litSk.map(d => `${d.href} current=${d.current}`).join(', '));
    const idle = sk.dots.find(d => !d.active);
    const on = litSk[0];
    verdict(idle && idle.dot.w === '8px' && idle.dot.opacity < 0.6,
      `${scheme}: an unlit dot is 8px and dim`, idle && `${idle.dot.w}, opacity ${idle.dot.opacity}`);
    verdict(on && /gradient/.test(on.dot.bg) && on.dot.opacity === 1 && scaleOf(on.dot.transform) > 1,
      `${scheme}: the lit dot is the accent gradient, opaque and larger`,
      on && `opacity ${on.dot.opacity}, scale ${scaleOf(on.dot.transform)}`);
    verdict(sk.dots.every(d => !d.label.shown), `${scheme}: no label shows before a tap`);
    const oSk = await measureOverflow(page);
    verdict(oSk.scrollWidth === 390, `${scheme}: scrollWidth at #skills is 390`, `${oSk.scrollWidth}`);
    await railCrop(page, `rail-skills-${scheme}.png`);

    // An open menu covers the rail (the bar is z-index 30, the rail 20)
    await page.tap('.navbar-burger');
    const covered = await page.evaluate(() => {
      const menu = document.getElementById('mobile-nav').getBoundingClientRect();
      const dot = Array.from(document.querySelectorAll('.dot-rail-dot'))
        .map(d => d.getBoundingClientRect())
        .find(r => r.top + r.height / 2 > menu.top + 4 && r.top + r.height / 2 < menu.bottom - 4 &&
          r.left + r.width / 2 < menu.right);
      if (!dot) return { found: false };
      const el = document.elementFromPoint(dot.left + dot.width / 2, dot.top + dot.height / 2);
      return { found: true, inMenu: !!el?.closest('#mobile-nav'), what: el?.tagName + '.' + el?.className };
    });
    verdict(covered.found && covered.inMenu, `${scheme}: the open menu draws over the rail`, JSON.stringify(covered));
    await page.tap('.navbar-burger');

    // Tapping Experience: it scrolls there and the label shows, then goes
    const t0 = Date.now();
    await page.tap(DOT('experience'));
    const justAfter = await railState(page);
    const exp = justAfter.dots.find(d => d.href === '#experience');
    const expDot = exp.box;
    verdict(exp.label.shown && justAfter.dots.filter(d => d.label.shown).length === 1,
      `${scheme}: tapping the Experience dot shows its label, and only its`, `"${exp.label.text}"`);
    verdict(exp.label.box.right <= expDot.x + 2 && exp.label.box.left >= 0 &&
      exp.label.box.top >= expDot.y && exp.label.box.bottom <= expDot.y + expDot.h,
      `${scheme}: the label sits left of its dot, on screen`,
      `label x ${exp.label.box.left}-${exp.label.box.right}, dot x ${expDot.x}`);
    const oLabel = await measureOverflow(page);
    verdict(oLabel.scrollWidth === 390, `${scheme}: scrollWidth with the label showing is 390`, `${oLabel.scrollWidth}`);
    await railCrop(page, `rail-label-${scheme}.png`);
    await scrollSettled(page);
    const landed = await page.evaluate(() => Math.round(document.getElementById('experience').getBoundingClientRect().top));
    verdict(landed >= 0 && landed <= 90, `${scheme}: #experience is brought into view`, `top ${landed}px`);
    const afterTap = await railState(page);
    const litExp = lit(afterTap);
    verdict(litExp.length === 1 && litExp[0].href === '#experience' && litExp[0].current === 'true',
      `${scheme}: the lit dot is now Experience`, litExp.map(d => d.href).join(', '));
    const elapsed = Date.now() - t0;
    if (elapsed < LABEL_MS) await page.waitForTimeout(LABEL_MS - elapsed);
    const later = await railState(page);
    verdict(later.dots.every(d => !d.label.shown) && isShown(later),
      `${scheme}: ${LABEL_MS / 1000} s after the tap the label is gone and the rail still shows`,
      `${Date.now() - t0} ms, Experience label visibility ${later.dots.find(d => d.href === '#experience').label.visibility}`);
  } finally {
    await close();
  }
}

async function phoneLiveMotion() {
  console.log('\n== phone, live motion');
  const { page, close } = await openPage({ device: 'phone', liveMotion: true, baseUrl });
  try {
    await scrollToId(page, 'skills');
    await startRecord(page);
    const t0 = Date.now();
    await page.tap(DOT('experience'));
    await scrollSettled(page);
    const frames = await stopRecord(page);
    const mv = between(frames);
    const popped = frames.filter(f => f.visibility !== 'visible' || f.opacity < 0.99);
    verdict(mv.end > mv.start && mv.n >= 3, 'live: the dot\'s scroll is smooth', `${mv.start} -> (${mv.n} between) -> ${mv.end}`);
    verdict(popped.length === 0, `live: the rail stays shown on all ${frames.length} frames of the scroll`,
      popped.length ? `${popped.length} frames not shown` : '');
    const elapsed = Date.now() - t0;
    if (elapsed < LABEL_MS) await page.waitForTimeout(LABEL_MS - elapsed);
    const later = await railState(page);
    const lab = later.dots.find(d => d.href === '#experience').label;
    verdict(lab.opacity === 0 && lab.visibility === 'hidden',
      `live: ${LABEL_MS / 1000} s after the tap the label has faded out`, `opacity ${lab.opacity}, ${lab.visibility}`);

    // Back to the top: the rail fades away over the hero; then down again, it returns
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await page.waitForTimeout(600);
    const up = await railState(page);
    verdict(isHidden(up), 'live: back at the top the rail has faded away', `opacity ${up.opacity}, ${up.visibility}`);
    await scrollToId(page, 'about', 600);
    const down = await railState(page);
    verdict(isShown(down), 'live: at #about it is back', `opacity ${down.opacity}, ${down.visibility}`);
  } finally {
    await close();
  }
}

async function phoneReducedMotion() {
  console.log('\n== phone, reduced motion');
  const { page, close } = await openPage({ device: 'phone', reducedMotion: true, liveMotion: true, baseUrl });
  try {
    await scrollToId(page, 'skills');
    await startRecord(page);
    await page.tap(DOT('experience'));
    await scrollSettled(page);
    const mv = between(await stopRecord(page));
    verdict(mv.end > mv.start && mv.n === 0, 'reduced motion: the dot\'s tap jumps', `${mv.start} -> (${mv.n} between) -> ${mv.end}`);
  } finally {
    await close();
  }
}

async function desktop() {
  console.log('\n== desktop');
  const { page, close } = await openPage({ device: 'desktop', baseUrl });
  try {
    await scrollToId(page, 'skills');
    const s = await railState(page);
    const pane = await page.evaluate(() => getComputedStyle(document.querySelector('.side-nav-wrapper')).display);
    verdict(s.display === 'none', 'desktop: the dot rail is not displayed', s.display);
    verdict(pane === 'flex', 'desktop: the side pane still is', pane);
  } finally {
    await close();
  }
}

await phoneScheme(false);
await phoneScheme(true);
await phoneLiveMotion();
await phoneReducedMotion();
await desktop();

const failed = results.filter(ok => !ok).length;
console.log(`\n${results.length - failed} PASS, ${failed} FAIL`);
process.exit(failed ? 1 : 0);
