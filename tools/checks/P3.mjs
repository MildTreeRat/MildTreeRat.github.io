// P3's check: does the text render in Inter, at the new scale, and is every heading readable in
// both colour schemes?
//
//   node tools/checks/P3.mjs            # phone and desktop, light and dark
//
// Computed font-family only says what was *asked for*: the stack starts with Inter whether or not
// any Inter is loaded. So each element also reports the font Chromium actually drew its text in
// (CDP's CSS.getPlatformFontsForNode), which is the proof the webfont arrived. document.fonts.check
// is reported as the plan asks, but it reads true for a family no @font-face names at all.
import { openPage, measureOverflow } from '../shoot.mjs';

const ELEMENTS = {
  body: 'body',
  'about p': '#about .box p',
  'hero h1': '.hero-banner h1.title',
  'hero subtitle': '.hero-banner h2.subtitle',
  'section title (is-3)': '#about h3.title',
  'box title (is-4)': '#education-contact h3.title',
  'school (is-5)': '#education-contact h4.title',
  'strong label': '#education-contact strong',
  'experience role (is-4)': '.experience-card h4.title',
  'experience company': '.experience-card p.is-italic',
  tag: '#skills .tag',
  'hero nav link': '.hero-nav a',
  'navbar item': '.navbar-item',
  footer: 'footer p',
};

const STYLE_KEYS = ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'color'];

async function probe(device, dark) {
  const { page, context, close, diag } = await openPage({ device, dark });
  try {
    const styles = await page.evaluate(({ elements, keys }) => {
      const out = {};
      for (const [name, sel] of Object.entries(elements)) {
        const el = document.querySelector(sel);
        if (!el) { out[name] = null; continue; }
        const cs = getComputedStyle(el);
        out[name] = Object.fromEntries(keys.map(k =>
          [k, k === 'fontFamily' ? cs[k].split(',')[0] : cs[k]]));
      }
      return out;
    }, { elements: ELEMENTS, keys: STYLE_KEYS });

    const cdp = await context.newCDPSession(page);
    await cdp.send('DOM.enable');
    await cdp.send('CSS.enable');
    const { root } = await cdp.send('DOM.getDocument', { depth: -1 });
    for (const [name, sel] of Object.entries(ELEMENTS)) {
      if (!styles[name]) continue;
      const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: sel });
      const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId });
      styles[name].drawnIn = fonts.map(f => `${f.familyName}${f.isCustomFont ? ' (web)' : ''}`).join(' + ');
    }

    const fonts = await page.evaluate(() => ({
      check16: document.fonts.check('16px Inter'),
      check700: document.fonts.check('700 16px Inter'),
      checkMissing: document.fonts.check('16px NoSuchFamilyAtAll'),
      interFacesLoaded: [...document.fonts]
        .filter(f => /inter/i.test(f.family) && f.status === 'loaded')
        .map(f => f.weight)
        .filter((w, i, a) => a.indexOf(w) === i),
    }));
    const overflow = await measureOverflow(page);
    return { device, scheme: dark ? 'dark' : 'light', overflow, fonts, styles, diag };
  } finally {
    await close();
  }
}

for (const device of ['phone', 'desktop']) {
  for (const dark of [false, true]) {
    const r = await probe(device, dark);
    console.log(`\n=== ${r.device} / ${r.scheme} ===`);
    console.log(`scrollWidth ${r.overflow.scrollWidth} of ${r.overflow.viewport}`);
    console.log(`fonts ${JSON.stringify(r.fonts)}`);
    for (const [name, s] of Object.entries(r.styles)) {
      if (!s) { console.log(`  ${name}: (missing)`); continue; }
      console.log(`  ${name}: ${s.fontFamily} ${s.fontWeight} ${s.fontSize}/${s.lineHeight}` +
        ` ls ${s.letterSpacing} ${s.color} | drawn in ${s.drawnIn}`);
    }
    if (r.diag.consoleErrors.length) console.log(`console errors: ${r.diag.consoleErrors.join('; ')}`);
    if (r.diag.failedRequests.length) console.log(`failed requests: ${r.diag.failedRequests.join('; ')}`);
  }
}

// Inter is wider than Segoe UI, and the hero nav's nine uppercase links are one row: does the pill
// still fit at the narrowest width that shows it (Bulma's desktop breakpoint)?
{
  const { page, close } = await openPage({ device: 'desktop' });
  try {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.waitForTimeout(300);
    const nav = await page.evaluate(() => {
      const r = document.querySelector('.hero-nav').getBoundingClientRect();
      return { left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width) };
    });
    const overflow = await measureOverflow(page);
    console.log(`\n=== desktop at 1024 ===\nhero nav ${JSON.stringify(nav)}; ` +
      `scrollWidth ${overflow.scrollWidth} of ${overflow.viewport}`);
  } finally {
    await close();
  }
}
