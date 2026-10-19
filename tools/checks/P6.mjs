// P6's check: can the phone menu be seen, does it get out of the way, and does it scroll smoothly?
//
//   node tools/checks/P6.mjs                                       # this tree, light and dark
//   node tools/checks/P6.mjs --base https://www.aaron-sierra.com   # another origin (the live site)
//
// The done criteria are PASS/FAIL lines, and any FAIL exits 1. The open-menu shots go to
// tools/shots/p6-check/phone-menu-open-{light,dark}.png, for reading by eye.
//
// Taps use the phone device (touch, so (hover: hover) is false, as on the iPhone). Transitions are
// frozen as in every shot, which leaves scroll-behavior alone (P1), so a smooth scroll is still
// smooth here. It is told from a jump by recording scrollY on every animation frame: a smooth
// scroll passes through intermediate positions, a jump has none. One sample straight after the
// tap is not enough, because a smooth scroll has not started yet when it is taken.
import fs from 'node:fs';
import path from 'node:path';
import { openPage, SHOTS_DIR } from '../shoot.mjs';

const args = process.argv.slice(2);
const opt = name => (args.includes(name) ? args[args.indexOf(name) + 1] : null);
const baseUrl = opt('--base');
const outDir = path.join(SHOTS_DIR, 'p6-check');
fs.mkdirSync(outDir, { recursive: true });

const results = [];
function verdict(ok, what, detail = '') {
  results.push(ok);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? `  (${detail})` : ''}`);
}

const BURGER = '.navbar-burger';
const MENU = '#mobile-nav';

/** What the menu's state looks like from outside: the classes, the attribute, and the box. */
const menuState = page => page.evaluate(({ b, m }) => {
  const burger = document.querySelector(b);
  const menu = document.querySelector(m);
  const cs = getComputedStyle(menu);
  return {
    shown: cs.display !== 'none' && menu.getBoundingClientRect().height > 0,
    burgerActive: burger.classList.contains('is-active'),
    expanded: burger.getAttribute('aria-expanded'),
  };
}, { b: BURGER, m: MENU });

/** The burger as drawn: where it is, what it is, its pill and its bars. */
const burgerLook = page => page.evaluate(b => {
  const el = document.querySelector(b);
  const r = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  const bars = Array.from(el.querySelectorAll('span')).map(s => {
    const sc = getComputedStyle(s);
    const sr = s.getBoundingClientRect();
    return { top: Math.round(sr.top - r.top), color: sc.backgroundColor, opacity: sc.opacity };
  });
  const visibleTops = new Set(bars.filter(s => s.opacity !== '0').map(s => s.top));
  return {
    tag: el.tagName,
    controls: el.getAttribute('aria-controls'),
    box: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
    inViewport: r.top >= 0 && r.left >= 0 && r.bottom <= innerHeight && r.right <= innerWidth,
    background: cs.backgroundImage !== 'none' ? cs.backgroundImage : cs.backgroundColor,
    backdrop: cs.backdropFilter,
    barColors: [...new Set(bars.map(s => s.color))],
    visibleBars: visibleTops.size,
    navPosition: getComputedStyle(el.closest('.navbar')).position,
  };
}, BURGER);

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

/** The menu's background and its links' colour, as computed (rule 7: never Bulma's light theme). */
const menuColours = page => page.evaluate(m => {
  const menu = document.querySelector(m);
  const link = menu.querySelector('a');
  const mc = getComputedStyle(menu);
  return {
    background: mc.backgroundImage !== 'none' ? mc.backgroundImage : mc.backgroundColor,
    backdrop: mc.backdropFilter,
    link: getComputedStyle(link).color,
    linkBackground: getComputedStyle(link).backgroundColor,
  };
}, MENU);

// Light enough to be white-ish text: every channel at least 200
const isLight = rgb => (rgb.match(/\d+(\.\d+)?/g) || []).slice(0, 3).every(v => Number(v) >= 200);
// Every rgba() in a gradient (or the colour) is dark, channels at most 60, and mostly opaque
function isDarkFill(bg) {
  const stops = [...bg.matchAll(/rgba?\(([^)]+)\)/g)].map(m => m[1].split(',').map(Number));
  return stops.length > 0 && stops.every(([r, g, b, a = 1]) => r <= 60 && g <= 60 && b <= 60 && a >= 0.5);
}

/** Record scrollY on every animation frame from now until `stopScrollRecord`. */
const startScrollRecord = page => page.evaluate(() => {
  window.__p6ys = [scrollY];
  window.__p6rec = true;
  const frame = () => { if (!window.__p6rec) return; window.__p6ys.push(scrollY); requestAnimationFrame(frame); };
  requestAnimationFrame(frame);
});
const stopScrollRecord = page => page.evaluate(() => { window.__p6rec = false; return window.__p6ys; });

/** How a scroll got from its first to its last position: the positions strictly between. */
function howItMoved(ys) {
  const start = ys[0];
  const end = ys[ys.length - 1];
  const between = [...new Set(ys.filter(y => y !== start && y !== end))];
  return { start, end, between: between.length, path: `${start} -> (${between.length} between) -> ${end}` };
}

/** Do `act`, and measure where the page lands and how it got there. */
async function actAndLand(page, id, act) {
  await startScrollRecord(page);
  await act();
  await scrollSettled(page);
  const moved = howItMoved(await stopScrollRecord(page));
  const top = await page.evaluate(t => Math.round(document.getElementById(t).getBoundingClientRect().top), id);
  return { ...moved, top };
}

/** Tap a menu link, read the menu's state straight after, then measure the landing. */
async function tapLinkAndLand(page, id) {
  let after;
  const land = await actAndLand(page, id, async () => {
    await page.tap(`${MENU} a[href="#${id}"]`);
    after = await menuState(page);
  });
  return { ...land, after };
}

async function phoneScheme(dark) {
  const scheme = dark ? 'dark' : 'light';
  console.log(`\n== phone, ${scheme} scheme`);
  const { page, close, diag } = await openPage({ device: 'phone', dark, baseUrl });
  try {
    // At rest, over the photo
    const look = await burgerLook(page);
    console.log(`   burger ${look.tag} ${JSON.stringify(look.box)}, background ${look.background}, ` +
      `bars ${look.barColors.join(' / ')}, nav ${look.navPosition}`);
    verdict(look.inViewport && look.box.w >= 44 && look.box.h >= 44, `${scheme}: burger on screen, at least 44x44`,
      `${look.box.w}x${look.box.h} at ${look.box.x},${look.box.y}`);
    verdict(isDarkFill(look.background) && look.backdrop !== 'none',
      `${scheme}: burger sits on a dark translucent pill with a backdrop blur`, look.backdrop);
    verdict(look.barColors.length === 1 && isLight(look.barColors[0]) && look.visibleBars === 3,
      `${scheme}: three white bars`, `${look.visibleBars} visible, ${look.barColors.join(' / ')}`);
    verdict(look.tag === 'BUTTON' && look.controls === 'mobile-nav',
      `${scheme}: burger is a button controlling #mobile-nav`, `${look.tag}, aria-controls=${look.controls}`);
    verdict(look.navPosition === 'fixed', `${scheme}: the bar is fixed, so the menu stays reachable`);
    const closedAtStart = await menuState(page);
    verdict(!closedAtStart.shown && closedAtStart.expanded === 'false', `${scheme}: menu starts closed`);

    // Burger tap opens it
    await page.tap(BURGER);
    const open = await menuState(page);
    verdict(open.shown && open.burgerActive && open.expanded === 'true',
      `${scheme}: tapping the burger opens the menu, aria-expanded="true"`, JSON.stringify(open));
    const colours = await menuColours(page);
    console.log(`   menu background ${colours.background}, links ${colours.link} on ${colours.linkBackground}`);
    verdict(isDarkFill(colours.background) && isLight(colours.link),
      `${scheme}: the open menu is dark with light links`);
    const shot = path.join(outDir, `phone-menu-open-${scheme}.png`);
    await page.screenshot({ path: shot });
    console.log(`   shot: ${path.relative(process.cwd(), shot)}`);

    // A link tap closes it and scrolls there, smoothly
    const land = await tapLinkAndLand(page, 'skills');
    verdict(!land.after.shown && !land.after.burgerActive && land.after.expanded === 'false',
      `${scheme}: tapping "Skills" closes the menu, aria-expanded="false"`, JSON.stringify(land.after));
    verdict(land.top >= 0 && land.top <= 90, `${scheme}: #skills lands 0-90px from the top`, `${land.top}px`);
    verdict(land.end > land.start && land.between >= 3, `${scheme}: the scroll is smooth`, land.path);
    const lookAfter = await burgerLook(page);
    verdict(lookAfter.inViewport, `${scheme}: burger still on screen after the scroll`,
      JSON.stringify(lookAfter.box));

    // A tap outside closes it, on a point that is neither the bar nor a link
    await page.tap(BURGER);
    const reopened = await menuState(page);
    verdict(reopened.shown && reopened.expanded === 'true', `${scheme}: the burger reopens it after the scroll`);
    const outside = await page.evaluate(() => {
      for (const [x, y] of [[30, 300], [30, 500], [30, 700], [200, 780]]) {
        const el = document.elementFromPoint(x, y);
        if (el && !el.closest('a, button, summary, .navbar')) return { x, y, what: el.tagName + '.' + el.className };
      }
      return null;
    });
    if (!outside) verdict(false, `${scheme}: found a plain point to tap outside the menu`);
    else {
      await page.touchscreen.tap(outside.x, outside.y);
      const s = await menuState(page);
      verdict(!s.shown && s.expanded === 'false', `${scheme}: a tap outside closes the menu`,
        `tapped ${outside.what} at ${outside.x},${outside.y}`);
    }

    // Esc closes it and hands focus back to the burger
    await page.tap(BURGER);
    verdict((await menuState(page)).shown, `${scheme}: open again, for Esc`);
    await page.focus(`${MENU} a[href="#about"]`);
    await page.keyboard.press('Escape');
    const esc = await menuState(page);
    const focusOnBurger = await page.evaluate(b => document.activeElement === document.querySelector(b), BURGER);
    verdict(!esc.shown && esc.expanded === 'false' && focusOnBurger,
      `${scheme}: Esc closes the menu and focuses the burger`, JSON.stringify({ ...esc, focusOnBurger }));

    // A keyboard opens it too (it is a button)
    await page.keyboard.press('Enter');
    const kb = await menuState(page);
    verdict(kb.shown && kb.expanded === 'true', `${scheme}: Enter on the focused burger opens the menu`);
    await page.keyboard.press('Escape');

    const scrollBehavior = await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior);
    verdict(scrollBehavior === 'smooth', `${scheme}: html scroll-behavior is smooth`, scrollBehavior);
    verdict(diag.consoleErrors.every(e => e.includes('favicon')),
      `${scheme}: no console errors but the favicon`, diag.consoleErrors.join(' | ') || 'none');
  } finally {
    await close();
  }
}

async function phoneReducedMotion() {
  console.log('\n== phone, reduced motion');
  const { page, close } = await openPage({ device: 'phone', reducedMotion: true, baseUrl });
  try {
    const sb = await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior);
    verdict(sb === 'auto', 'reduced motion: html scroll-behavior is auto', sb);
    await page.tap(BURGER);
    const land = await tapLinkAndLand(page, 'skills');
    verdict(land.end > land.start && land.between === 0 && land.top >= 0 && land.top <= 90,
      'reduced motion: "Skills" jumps straight there', `${land.path}, top ${land.top}px`);
  } finally {
    await close();
  }
}

async function desktopNavs() {
  console.log('\n== desktop');
  for (const reducedMotion of [false, true]) {
    const tag = reducedMotion ? 'desktop, reduced motion' : 'desktop';
    const { page, close } = await openPage({ device: 'desktop', reducedMotion, baseUrl });
    try {
      if (!reducedMotion) {
        const shown = await page.evaluate(b => getComputedStyle(document.querySelector(b).closest('.navbar')).display, BURGER);
        verdict(shown === 'none', 'desktop: the phone bar is hidden', shown);
      }
      // The hero nav's scripted scroll now follows CSS: smooth, or a jump under reduced motion
      const land = await actAndLand(page, 'skills', () => page.click('.hero-nav a[href="#skills"]'));
      const smoothOk = land.end > land.start && (reducedMotion ? land.between === 0 : land.between >= 3);
      verdict(smoothOk && land.top >= 0 && land.top <= 90,
        `${tag}: hero nav "Skills" lands at ${land.top}px, ${reducedMotion ? 'jumping' : 'smoothly'}`, land.path);
      // The side pane's link the same way. It is tucked away off the edge, so its click is
      // dispatched rather than aimed; its handler is the other scripted scroll.
      const side = await actAndLand(page, 'experience', () =>
        page.evaluate(() => document.querySelector('.side-nav a[href="#experience"]').click()));
      const sideOk = side.end > side.start && (reducedMotion ? side.between === 0 : side.between >= 3);
      verdict(sideOk && side.top >= 0 && side.top <= 90,
        `${tag}: side pane "Experience" lands at ${side.top}px, ${reducedMotion ? 'jumping' : 'smoothly'}`, side.path);
    } finally {
      await close();
    }
  }
}

await phoneScheme(false);
await phoneScheme(true);
await phoneReducedMotion();
await desktopNavs();

const failed = results.filter(ok => !ok).length;
console.log(`\n${results.length - failed} PASS, ${failed} FAIL`);
process.exit(failed ? 1 : 0);
