// P12's check: does every in-page link land on its section, and does every own-origin link answer?
//
//   node tools/checks/P12.mjs                                       # this tree
//   node tools/checks/P12.mjs --base https://www.aaron-sierra.com   # another origin (the live site)
//
// The done criteria are PASS/FAIL lines, and any FAIL exits 1.
//
// Each link is used the way a visitor uses it, through the control that shows it on that device:
// on the phone the menu's links (burger, then the link) and the dot rail's dots; on the desktop
// the hero nav's pills and the side pane's links (the mouse on the pane's tab first, since the pane
// is tucked away until then). Scrolls run smooth (live motion), so "landed" waits for scrollY to
// hold still. A section lands with its top at its 70px scroll-margin; Home lands at scrollY 0.
// Every `a[href^="#"]` on the page must belong to one of those four sets, so a fifth set of in-page
// links added later fails here until it is checked. Own-origin hrefs and srcs (the PDFs, the
// thumbnail, the images, custom.css) must answer 200; external links are listed, not fetched.
import { openPage, scrollToId, measureOverflow } from '../shoot.mjs';

const args = process.argv.slice(2);
const opt = name => (args.includes(name) ? args[args.indexOf(name) + 1] : null);
const baseUrl = opt('--base');

const results = [];
function verdict(ok, what, detail = '') {
  results.push(ok);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? `  (${detail})` : ''}`);
}

const MARGIN = 70; // section[id] { scroll-margin-top: 70px }

/** Wait until scrollY has held still for 300 ms (a smooth scroll is done), up to 5 s. */
async function waitStill(page) {
  let last = -1, still = 0;
  for (let i = 0; i < 100 && still < 6; i++) {
    const y = await page.evaluate(() => window.scrollY);
    still = y === last ? still + 1 : 0;
    last = y;
    await page.waitForTimeout(50);
  }
}

/** Where a link's target sits now: its top in the viewport, and whether the page is at its end. */
const landing = (page, id) => page.evaluate(target => {
  const el = document.getElementById(target);
  const max = document.documentElement.scrollHeight - window.innerHeight;
  return {
    exists: !!el,
    top: el ? Math.round(el.getBoundingClientRect().top) : null,
    scrollY: Math.round(window.scrollY),
    atEnd: window.scrollY >= max - 1,
  };
}, id);

function landed(id, at) {
  if (!at.exists) return false;
  if (id === 'home') return at.scrollY === 0;
  // The last section may sit nearer than 70px only if the page has run out of scroll.
  return Math.abs(at.top - MARGIN) <= 1 || (at.atEnd && at.top <= MARGIN && at.top >= 0);
}

const hrefsOf = (page, sel) => page.$$eval(sel, as => as.map(a => a.getAttribute('href')));

async function checkSet(page, name, hrefs, use, resetTo) {
  for (const href of hrefs) {
    const id = href.slice(1);
    // Start somewhere else, so a link that does nothing cannot pass by standing still.
    const from = id === resetTo.far ? resetTo.near : resetTo.far;
    if (from === 'home') {
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
      await page.waitForTimeout(600);
    } else {
      await scrollToId(page, from, 600);
    }
    await use(href);
    await waitStill(page);
    const at = await landing(page, id);
    verdict(landed(id, at), `${name}: ${href} lands on its section`,
      `top ${at.top}, scrollY ${at.scrollY}${at.atEnd ? ', at page end' : ''}`);
  }
}

// ---------- Phone: the menu's links, then the rail's dots ----------
{
  const { page, close, diag } = await openPage({ device: 'phone', liveMotion: true, baseUrl });
  try {
    const all = await hrefsOf(page, 'a[href^="#"]');
    const menu = await hrefsOf(page, '#mobile-nav a[href^="#"]');
    const rail = await hrefsOf(page, '.dot-rail a[href^="#"]');
    const hero = await hrefsOf(page, '.hero-nav a[href^="#"]');
    const pane = await hrefsOf(page, '.side-nav a[href^="#"]');
    const known = new Set([...menu, ...rail, ...hero, ...pane].map(String));
    const stray = all.filter(h => !known.has(h));
    verdict(stray.length === 0, 'every in-page link is in the menu, the rail, the hero nav or the pane',
      stray.length ? `unchecked: ${stray.join(', ')}` : `${all.length} links`);
    const ids = await page.$$eval('[id]', els => els.map(e => e.id));
    const missing = [...known].filter(h => !ids.includes(h.slice(1)));
    verdict(missing.length === 0, 'every in-page link has a target', missing.join(', '));
    verdict(menu.length === 9 && rail.length === 8, 'the phone has its 9 menu links and 8 dots',
      `${menu.length} and ${rail.length}`);

    await checkSet(page, 'phone menu', menu, async href => {
      await page.locator('.navbar-burger').tap();
      await page.waitForTimeout(150);
      await page.locator(`#mobile-nav a[href="${href}"]`).tap();
    }, { far: 'skills', near: 'about' });
    const open = await page.evaluate(() => document.getElementById('mobile-nav').classList.contains('is-active'));
    verdict(!open, 'phone menu: closed after the last link tap');

    await checkSet(page, 'phone rail', rail, async href => {
      await page.locator(`.dot-rail a[href="${href}"]`).tap();
    }, { far: 'competitions', near: 'about' });

    const ov = await measureOverflow(page);
    verdict(ov.overflow === 0, 'phone: no horizontal overflow after every jump', `${ov.scrollWidth} of ${ov.viewport}`);
    const errs = diag.consoleErrors.filter(e => !/favicon\.ico/.test(e));
    verdict(errs.length === 0, 'phone: no console errors but the favicon 404', errs.join(' | '));
  } finally {
    await close();
  }
}

// ---------- Desktop: the hero nav's pills, then the side pane's links ----------
{
  const { page, close, diag } = await openPage({ device: 'desktop', liveMotion: true, baseUrl });
  try {
    const hero = await hrefsOf(page, '.hero-nav a[href^="#"]');
    const pane = await hrefsOf(page, '.side-nav a[href^="#"]');
    verdict(hero.length === 9 && pane.length === 8, 'the desktop has its 9 hero-nav links and 8 pane links',
      `${hero.length} and ${pane.length}`);

    // The hero nav scrolls away with the hero, so each pill is clicked from the top (Home from
    // #about, where the pill row is still on screen above the section).
    for (const href of hero) {
      const id = href.slice(1);
      if (id === 'home') await scrollToId(page, 'about', 600);
      else {
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
        await page.waitForTimeout(600);
      }
      await page.locator(`.hero-nav a[href="${href}"]`).click();
      await waitStill(page);
      const at = await landing(page, id);
      verdict(landed(id, at), `desktop hero nav: ${href} lands on its section`,
        `top ${at.top}, scrollY ${at.scrollY}${at.atEnd ? ', at page end' : ''}`);
    }

    const { width: W, height: H } = page.viewportSize();
    await checkSet(page, 'desktop pane', pane, async href => {
      await page.mouse.move(W - 5, H / 2); // onto the tucked-away tab: the pane slides out
      await page.waitForTimeout(600);
      await page.locator(`.side-nav a[href="${href}"]`).click();
      await page.mouse.move(W / 2, H / 2);
    }, { far: 'competitions', near: 'about' });

    const ov = await measureOverflow(page);
    verdict(ov.overflow === 0, 'desktop: no horizontal overflow after every jump', `${ov.scrollWidth} of ${ov.viewport}`);
    const errs = diag.consoleErrors.filter(e => !/favicon\.ico/.test(e));
    verdict(errs.length === 0, 'desktop: no console errors but the favicon 404', errs.join(' | '));

    // ---------- Own-origin links and resources answer; external links are listed ----------
    const refs = await page.evaluate(() => {
      const out = [];
      for (const el of document.querySelectorAll('a[href], img[src], link[href], script[src]')) {
        const raw = el.getAttribute('href') ?? el.getAttribute('src');
        if (!raw || raw.startsWith('#') || raw.startsWith('mailto:') || raw.startsWith('tel:')) continue;
        out.push({ tag: el.tagName.toLowerCase(), raw, abs: new URL(raw, location.href).href });
      }
      return { refs: out, origin: location.origin };
    });
    const own = [...new Map(refs.refs.filter(r => r.abs.startsWith(refs.origin)).map(r => [r.abs, r])).values()];
    const ext = [...new Set(refs.refs.filter(r => !r.abs.startsWith(refs.origin)).map(r => r.abs))];
    for (const r of own) {
      const res = await page.request.get(r.abs);
      verdict(res.status() === 200, `own-origin ${r.tag} ${r.raw} answers 200`, `${res.status()} ${res.headers()['content-type'] ?? ''}`);
    }
    console.log(`INFO  external links and resources (${ext.length}, not fetched):`);
    for (const u of ext) console.log(`        ${u}`);
  } finally {
    await close();
  }
}

const failed = results.filter(ok => !ok).length;
console.log(`\n${results.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
