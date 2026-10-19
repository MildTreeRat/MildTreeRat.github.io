// P11's check: the resume section is rendered from resumesData, its card shows at both sizes, its
// links reach a real PDF, and Bulma's light scheme colours none of it.
//
//   node tools/checks/P11.mjs                                       # this tree
//   node tools/checks/P11.mjs --base https://www.aaron-sierra.com   # another origin (the live site)
//
// PASS/FAIL lines; any FAIL exits 1. Phone and desktop, light (the iPhone default, rule 7) and dark.
import { openPage, measureOverflow, scrollToId } from '../shoot.mjs';

const args = process.argv.slice(2);
const opt = name => (args.includes(name) ? args[args.indexOf(name) + 1] : null);
const baseUrl = opt('--base');

const results = [];
function verdict(ok, what, detail = '') {
  results.push(ok);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? `  (${detail})` : ''}`);
}

/** WCAG relative luminance of an `rgb(r, g, b)` string, and the contrast ratio of two of them. */
const luminance = rgb => {
  const [r, g, b] = rgb.match(/[\d.]+/g).slice(0, 3).map(Number).map(c => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

/** Everything about the section the checks below read, in one evaluate. */
const readSection = page => page.evaluate(() => {
  const section = document.getElementById('resume');
  const css = el => (el ? getComputedStyle(el) : null);
  const box = el => (el ? el.getBoundingClientRect().toJSON() : null);
  const cards = Array.from(section.querySelectorAll('.resume-card'));
  return {
    dataCount: typeof resumesData === 'undefined' ? -1 : resumesData.length,
    data: typeof resumesData === 'undefined' ? [] : resumesData,
    titles: Array.from(section.querySelectorAll('h3.title')).map(h => ({
      text: h.textContent.trim(), inBox: !!h.closest('.box'), classes: h.className,
    })),
    oldImage: !!document.querySelector('img[src*="Resume-1"]'),
    viewport: window.innerWidth,
    cards: cards.map(card => {
      const thumbLink = card.querySelector('a.resume-thumb');
      const img = thumbLink?.querySelector('img');
      const view = card.querySelector('a.resume-button.is-primary');
      const dl = card.querySelector('a.resume-button[download]');
      const button = el => el && {
        href: el.getAttribute('href'), target: el.target, rel: el.rel, text: el.textContent.trim(),
        color: css(el).color, background: css(el).backgroundImage, bgColor: css(el).backgroundColor,
        height: box(el).height, rect: box(el),
      };
      return {
        isBox: card.classList.contains('box'),
        rect: box(card),
        cardBg: css(card).backgroundColor,
        label: card.querySelector('h4')?.textContent.trim(),
        labelColor: css(card.querySelector('h4'))?.color,
        updated: card.querySelector('.resume-updated')?.textContent.trim(),
        updatedColor: css(card.querySelector('.resume-updated'))?.color,
        thumb: thumbLink && {
          href: thumbLink.getAttribute('href'), tabindex: thumbLink.getAttribute('tabindex'),
          ariaHidden: thumbLink.getAttribute('aria-hidden'),
          src: img?.getAttribute('src'), complete: img?.complete, naturalWidth: img?.naturalWidth,
          naturalHeight: img?.naturalHeight, rect: box(img),
        },
        view: button(view),
        download: dl && { ...button(dl), download: dl.getAttribute('download') },
      };
    }),
  };
});

async function checkDevice(device, dark) {
  const tag = `${device}${dark ? ' dark' : ''}`;
  const { page, url, close, diag } = await openPage({ device, dark, baseUrl });
  try {
    await scrollToId(page, 'resume');
    // The thumbnail is lazy; scrolling to the section is what starts it, and settle waits it out
    await page.waitForFunction(() =>
      Array.from(document.querySelectorAll('.resume-thumb img')).every(i => i.complete), null,
      { timeout: 10000 }).catch(() => {});
    const s = await readSection(page);

    verdict(s.dataCount >= 1 && s.cards.length === s.dataCount,
      `${tag}: one card per resumesData entry`, `${s.cards.length} card(s), ${s.dataCount} entr(ies)`);
    const t = s.titles;
    verdict(t.length === 1 && t[0].text === 'Resume' && !t[0].inBox
      && t[0].classes.includes('is-3') && t[0].classes.includes('section-title'),
      `${tag}: the section title is "Resume", above its card`, JSON.stringify(t));
    verdict(!s.oldImage, `${tag}: Resume-1.jpg has left the page`);

    for (const [i, c] of s.cards.entries()) {
      const d = s.data[i];
      const name = `${tag}: card "${c.label}"`;
      verdict(c.isBox && c.label === d.label && c.updated === `Updated ${d.updated}`,
        `${name} is a box with its label and date`, `"${c.updated}"`);
      verdict(c.rect.width > 0 && c.rect.height > 0 && c.rect.left >= 0 && c.rect.right <= s.viewport,
        `${name} shows, inside the viewport`,
        `${Math.round(c.rect.left)}..${Math.round(c.rect.right)} of ${s.viewport}, ${Math.round(c.rect.height)} tall`);
      if (d.thumb) {
        const th = c.thumb;
        verdict(th && th.href === d.pdf && th.src === d.thumb && th.tabindex === '-1' && th.ariaHidden === 'true',
          `${name}: the thumbnail links to the PDF, out of the tab order`, JSON.stringify(th && { href: th.href, src: th.src }));
        verdict(th && th.complete && th.naturalWidth === 600,
          `${name}: the thumbnail loaded`, th && `${th.naturalWidth}x${th.naturalHeight}, drawn ${Math.round(th.rect.width)}x${Math.round(th.rect.height)}`);
      }
      const v = c.view, dl = c.download;
      verdict(v && v.href === d.pdf && v.target === '_blank' && v.rel.includes('noopener') && v.text === 'View PDF',
        `${name}: "View PDF" opens the PDF in a new tab`);
      verdict(dl && dl.href === d.pdf && dl.download !== null && dl.text === 'Download',
        `${name}: "Download" carries the download attribute`);
      verdict(v && dl && v.height >= 44 && dl.height >= 44,
        `${name}: both buttons are at least 44px tall`, v && dl && `${v.height}, ${dl.height}`);
      // The filled button's text against both of its gradient's stops, read from the computed
      // gradient; the quiet button's against the card, which is what shows through its 6% wash
      const stops = v ? v.background.match(/rgb\([^)]*\)/g) ?? [] : [];
      const worst = stops.length ? Math.min(...stops.map(st => contrast(v.color, st))) : 0;
      verdict(v && stops.length === 2 && v.color === 'rgb(255, 255, 255)' && worst >= 4.5,
        `${name}: "View PDF" is white on the deep accent gradient`, v && `${v.color} on ${stops.join(' -> ')}, ${worst.toFixed(2)}:1 at the lighter stop`);
      verdict(dl && dl.color === 'rgb(255, 255, 255)' && contrast(dl.color, c.cardBg) >= 4.5,
        `${name}: "Download" is white on the card, not Bulma's scheme`, dl && `${dl.color} on ${c.cardBg}, ${dl.bgColor}`);
      verdict(c.labelColor === 'rgb(235, 236, 240)' && contrast(c.updatedColor, c.cardBg) >= 4.5,
        `${name}: label and date read on the card`, `${c.labelColor}; date ${c.updatedColor} ${contrast(c.updatedColor, c.cardBg).toFixed(2)}:1`);

      // The PDF itself, from the page's own origin
      const res = await page.evaluate(async href => {
        const r = await fetch(href);
        const buf = new Uint8Array(await r.arrayBuffer());
        return { status: r.status, type: r.headers.get('content-type'), head: String.fromCharCode(...buf.slice(0, 5)), bytes: buf.length };
      }, d.pdf);
      verdict(res.status === 200 && /application\/pdf/.test(res.type) && res.head === '%PDF-',
        `${name}: ${d.pdf} answers 200 with a PDF`, `${res.status} ${res.type} ${res.bytes} bytes`);
    }

    const o = await measureOverflow(page);
    verdict(o.overflow <= 0, `${tag}: no horizontal overflow`, `${o.scrollWidth} vs ${o.viewport}`);
    const errors = diag.consoleErrors.filter(e => !e.includes('favicon'));
    verdict(errors.length === 0, `${tag}: no console errors beyond the favicon`, errors.join('; '));
    if (device === 'phone' && !dark) {
      for (const w of [375, 320]) {
        await page.setViewportSize({ width: w, height: 800 });
        await scrollToId(page, 'resume', 600);
        const n = await measureOverflow(page);
        const r = await page.evaluate(() => {
          const b = document.querySelector('.resume-actions').getBoundingClientRect();
          const card = document.querySelector('.resume-card').getBoundingClientRect();
          return { inside: b.left >= card.left && b.right <= card.right, card: card.right };
        });
        verdict(n.overflow <= 0 && r.inside, `phone at ${w} wide: no overflow, buttons inside the card`,
          `${n.scrollWidth} vs ${n.viewport}`);
      }
    }
    console.log(`      (${url})`);
  } finally {
    await close();
  }
}

for (const device of ['phone', 'desktop']) {
  for (const dark of [false, true]) await checkDevice(device, dark);
}

const failed = results.filter(r => !r).length;
console.log(`\n${results.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
