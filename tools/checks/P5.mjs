// P5's check: does the page stop moving under the cursor, and does it hold still for a finger and
// for prefers-reduced-motion?
//
//   node tools/checks/P5.mjs                       # this tree
//   node tools/checks/P5.mjs --json a.json         # ... and write every hover probe to a.json
//   node tools/checks/P5.mjs --against a.json      # ... and list what moved since a.json
//   node tools/checks/P5.mjs --base https://www.aaron-sierra.com   # another origin (the live site)
//
// The done criteria are PASS/FAIL lines, and any FAIL exits 1. The hover probes are the regression
// half: run once on the tree before the change with --json, once after with --against, and the
// only differences should be the ones the change meant (the big boxes and the logo images).
//
// Hover and tap use the harness's frozen transitions, so a :hover transform lands at once and is
// read in full, not part-way through its .25 s. Boxes are hovered and tapped 6px in from their
// top-left corner, which is padding: the middle of the Contact box is a target=_blank link.
import fs from 'node:fs';
import path from 'node:path';
import { openPage, ROOT } from '../shoot.mjs';

const args = process.argv.slice(2);
const opt = name => (args.includes(name) ? args[args.indexOf(name) + 1] : null);
const baseUrl = opt('--base');
const jsonOut = opt('--json');
const against = opt('--against');

const results = [];
function verdict(ok, what, detail = '') {
  results.push(ok);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? `  (${detail})` : ''}`);
}

const STYLE_KEYS = ['transform', 'boxShadow', 'color', 'backgroundColor', 'backgroundImage',
  'textDecorationLine', 'transitionDuration'];
const readStyle = (loc, keys = STYLE_KEYS) => loc.evaluate((el, ks) => {
  const cs = getComputedStyle(el);
  return Object.fromEntries(ks.map(k => [k, cs[k]]));
}, keys);

// translateY out of a computed matrix(a, b, c, d, tx, ty); 0 for none
function liftOf(transform) {
  const m = /matrix\(([^)]+)\)/.exec(transform);
  return m ? -Number(m[1].split(',')[5]) : 0;
}

const CORNER = { position: { x: 6, y: 6 } };

/** Every .box on the page, named and split into the big ones and the small leadership cards. */
async function boxes(page) {
  const all = page.locator('.box');
  const n = await all.count();
  const out = [];
  for (let i = 0; i < n; i++) {
    const loc = all.nth(i);
    const name = await loc.evaluate(el => {
      const sec = el.closest('section[id]')?.id ?? '?';
      const label = el.querySelector('h3, h4, p')?.textContent.trim().slice(0, 28) ?? '';
      return `${sec}: ${label}`;
    });
    out.push({ loc, name, small: name.startsWith('leadership:') });
  }
  return out;
}

async function desktopHover() {
  const { page, close } = await openPage({ device: 'desktop', baseUrl });
  try {
    const canHover = await page.evaluate(() => matchMedia('(hover: hover) and (pointer: fine)').matches);
    verdict(canHover, 'desktop matches (hover: hover) and (pointer: fine)');

    const probes = {};
    let bigMoved = [];
    let smallStill = [];
    let smallTooHigh = [];
    for (const { loc, name, small } of await boxes(page)) {
      await loc.scrollIntoViewIfNeeded();
      await loc.hover(CORNER);
      const s = await readStyle(loc);
      probes[`box ${name}`] = s;
      const lift = liftOf(s.transform);
      if (small) {
        if (s.transform === 'none') smallStill.push(name);
        if (lift > 2) smallTooHigh.push(`${name} ${lift}px`);
      } else if (s.transform !== 'none') {
        bigMoved.push(`${name} ${s.transform}`);
      }
    }
    verdict(bigMoved.length === 0, 'desktop: hovering every big box leaves transform none',
      bigMoved.join('; '));
    verdict(smallStill.length === 0, 'desktop: hovering every leadership card lifts it',
      smallStill.join('; '));
    verdict(smallTooHigh.length === 0, 'desktop: no leadership card lifts more than 2px',
      smallTooHigh.join('; '));

    // The logo images used to lift and scale under the cursor
    for (const sel of ['.experience-media img', '.competition-media img']) {
      const loc = page.locator(sel).first();
      await loc.scrollIntoViewIfNeeded();
      await loc.hover();
      probes[`img ${sel}`] = await readStyle(loc);
    }
    const imgMoved = Object.entries(probes)
      .filter(([k, s]) => k.startsWith('img ') && s.transform !== 'none').map(([k]) => k);
    verdict(imgMoved.length === 0, 'desktop: hovering a logo image leaves transform none',
      imgMoved.join('; '));

    // Hover effects that should be exactly as before: links, tags, the two navs
    const links = {
      'contact link': '#education-contact a',
      'comp link': '.comp-link',
      tag: '#skills .tag',
    };
    for (const [name, sel] of Object.entries(links)) {
      const loc = page.locator(sel).first();
      await loc.scrollIntoViewIfNeeded();
      await loc.hover();
      probes[name] = await readStyle(loc);
    }

    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    const heroLink = page.locator('.hero-nav a').first();
    await heroLink.evaluate(el => el.parentElement.querySelectorAll('a')
      .forEach(a => a.classList.remove('is-active')));
    await heroLink.hover();
    probes['hero nav link'] = await readStyle(heroLink);
    await heroLink.evaluate(el => el.classList.add('is-active'));
    await page.mouse.move(5, 5);
    await heroLink.hover();
    probes['hero nav link, active'] = await readStyle(heroLink);

    // The pane is collapsed to a 14px tab on the right: entering it expands it (mouseenter)
    await page.evaluate(() => {
      const el = document.getElementById('about');
      el.scrollIntoView({ block: 'start', behavior: 'instant' });
    });
    await page.mouse.move(1440 - 5, 450);
    await page.waitForTimeout(100);
    const sideLinks = page.locator('.side-nav a');
    await sideLinks.evaluateAll(as => as.forEach(a => a.classList.remove('active')));
    await sideLinks.nth(1).hover();
    probes['side nav link'] = await readStyle(sideLinks.nth(1));
    await sideLinks.nth(1).evaluate(a => a.classList.add('active'));
    await sideLinks.nth(2).hover();
    await sideLinks.nth(1).hover();
    probes['side nav link, active'] = await readStyle(sideLinks.nth(1));

    // No fixed background anywhere, ::before and ::after included
    const fixed = await page.evaluate(() => {
      const hits = [];
      for (const el of document.querySelectorAll('*')) {
        for (const pseudo of [null, '::before', '::after']) {
          if (getComputedStyle(el, pseudo).backgroundAttachment.includes('fixed')) {
            hits.push(`${el.tagName.toLowerCase()}.${[...el.classList].join('.')}${pseudo ?? ''}`);
          }
        }
      }
      return hits;
    });
    verdict(fixed.length === 0, 'desktop: no element computes background-attachment fixed',
      fixed.join(', '));

    return probes;
  } finally {
    await close();
  }
}

async function phoneTap() {
  const { page, close } = await openPage({ device: 'phone', baseUrl });
  try {
    const canHover = await page.evaluate(() => matchMedia('(hover: hover) and (pointer: fine)').matches);
    verdict(!canHover, 'phone does not match (hover: hover) and (pointer: fine)');
    const moved = [];
    let n = 0;
    for (const { loc, name } of await boxes(page)) {
      await loc.scrollIntoViewIfNeeded();
      await loc.tap(CORNER);
      const { transform, boxShadow } = await readStyle(loc, ['transform', 'boxShadow']);
      if (transform !== 'none') moved.push(`${name} ${transform}`);
      n++;
    }
    verdict(n > 0 && moved.length === 0, `phone: tapping each of ${n} boxes leaves transform none`,
      moved.join('; '));
    for (const sel of ['.experience-media img', '.competition-media img']) {
      const loc = page.locator(sel).first();
      await loc.scrollIntoViewIfNeeded();
      await loc.tap();
      const { transform } = await readStyle(loc, ['transform']);
      verdict(transform === 'none', `phone: tapping ${sel} leaves transform none`, transform);
    }
  } finally {
    await close();
  }
}

/** Live motion, with and without prefers-reduced-motion: what moves, and how a JS smooth scroll
 *  behaves, since CSS cannot reach a scrollIntoView that names behavior:'smooth' itself. */
async function motion(reducedMotion) {
  const { page, close } = await openPage({ device: 'desktop', baseUrl, liveMotion: true, reducedMotion });
  try {
    const out = await page.evaluate(() => {
      const td = sel => getComputedStyle(document.querySelector(sel)).transitionDuration;
      return {
        'side pane wrapper': td('.side-nav-wrapper'),
        'side pane link dot': getComputedStyle(document.querySelector('.side-nav a'), '::before')
          .transitionDuration,
        'hero nav link': td('.hero-nav a'),
        'leadership card': td('#leadership .box'),
        'notable projects': td('.notable-projects'),
        'html scroll-behavior': getComputedStyle(document.documentElement).scrollBehavior,
      };
    });
    // P6 declares html { scroll-behavior: smooth }; the reduced-motion block has to beat it
    out['html scroll-behavior, smooth declared'] = await page.evaluate(() => {
      const s = document.createElement('style');
      s.textContent = 'html { scroll-behavior: smooth; }';
      document.head.appendChild(s);
      const v = getComputedStyle(document.documentElement).scrollBehavior;
      s.remove();
      return v;
    });
    const card = page.locator('#leadership .box').first();
    await card.scrollIntoViewIfNeeded();
    await card.hover(CORNER);
    await page.waitForTimeout(400);
    out['leadership card hovered'] = (await readStyle(card, ['transform'])).transform;

    // A hero nav click at the top: how far the page has got 60 ms in, against where it ends
    await page.mouse.move(5, 5);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await page.waitForTimeout(300);
    await page.locator('.hero-nav a[href="#skills"]').click();
    const at60 = await page.evaluate(() => new Promise(r => setTimeout(() => r(scrollY), 60)));
    await page.waitForTimeout(1500);
    const end = await page.evaluate(() => scrollY);
    out['hero nav click scrollY at 60ms / settled'] = `${Math.round(at60)} / ${Math.round(end)}`;
    return out;
  } finally {
    await close();
  }
}

const probes = await desktopHover();
await phoneTap();
const live = await motion(false);
const reduced = await motion(true);

console.log('\nLive motion, no preference -> prefers-reduced-motion: reduce');
for (const k of Object.keys(live)) console.log(`  ${k}: ${live[k]}  ->  ${reduced[k]}`);
const stillMoving = ['side pane wrapper', 'side pane link dot', 'hero nav link', 'leadership card',
  'notable projects'].filter(k => !/^0s(, 0s)*$/.test(reduced[k]));
verdict(stillMoving.length === 0, 'reduced motion: every probed transition is 0s', stillMoving.join(', '));
verdict(live['html scroll-behavior, smooth declared'] === 'smooth'
  && reduced['html scroll-behavior, smooth declared'] === 'auto',
  'reduced motion: html scroll-behavior is auto even with smooth declared',
  `${live['html scroll-behavior, smooth declared']} -> ${reduced['html scroll-behavior, smooth declared']}`);
verdict(reduced['leadership card hovered'] === 'none', 'reduced motion: a hovered leadership card does not lift',
  reduced['leadership card hovered']);

if (!baseUrl) {
  const hits = ['custom.css', 'index.html'].flatMap(f =>
    fs.readFileSync(path.join(ROOT, f), 'utf8').split('\n')
      .map((line, i) => (/background-attachment\s*:\s*fixed/.test(line) ? `${f}:${i + 1}` : null))
      .filter(Boolean));
  verdict(hits.length === 0, 'no background-attachment: fixed in custom.css or index.html', hits.join(', '));
}

if (jsonOut) {
  fs.writeFileSync(jsonOut, JSON.stringify(probes, null, 2));
  console.log(`\nwrote ${Object.keys(probes).length} hover probes to ${jsonOut}`);
}
if (against) {
  const before = JSON.parse(fs.readFileSync(against, 'utf8'));
  console.log(`\nHover probes that differ from ${against}:`);
  let same = 0;
  for (const name of new Set([...Object.keys(before), ...Object.keys(probes)])) {
    const a = before[name] ?? {};
    const b = probes[name] ?? {};
    const diffs = STYLE_KEYS.filter(k => a[k] !== b[k]).map(k => `${k}: ${a[k]} -> ${b[k]}`);
    if (diffs.length) console.log(`  ${name}\n    ${diffs.join('\n    ')}`);
    else same++;
  }
  console.log(`  (${same} probes identical)`);
}

const failed = results.filter(ok => !ok).length;
console.log(`\n${results.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
