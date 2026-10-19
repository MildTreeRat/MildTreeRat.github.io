// P10's check: one card style, titles outside their cards, the spacing, and the certificate link.
//
//   node tools/checks/P10.mjs                                       # this tree
//   node tools/checks/P10.mjs --base https://www.aaron-sierra.com   # another origin (the live site)
//
// The done criteria are PASS/FAIL lines, and any FAIL exits 1. Phone and desktop, each in the
// light scheme (the iPhone default, rule 7) and the dark one, because every card colour is meant
// to be set here and not left to Bulma's scheme.
import { openPage, measureOverflow } from '../shoot.mjs';

const args = process.argv.slice(2);
const opt = name => (args.includes(name) ? args[args.indexOf(name) + 1] : null);
const baseUrl = opt('--base');

const results = [];
function verdict(ok, what, detail = '') {
  results.push(ok);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? `  (${detail})` : ''}`);
}

const PDF = 'CompTIASecurityPlus.pdf';

/** Every box's card style, as computed. One style means one distinct value per key. */
const cardStyles = page => page.evaluate(() => {
  const keys = ['borderTopLeftRadius', 'borderTopWidth', 'borderTopColor', 'backgroundColor',
    'boxShadow', 'paddingTop', 'paddingLeft'];
  const boxes = Array.from(document.querySelectorAll('.box'));
  const distinct = {};
  for (const k of keys) distinct[k] = [...new Set(boxes.map(b => getComputedStyle(b)[k]))];
  return { n: boxes.length, distinct };
});

/** Each section's h3 titles: where they sit and how big they are. */
const titles = page => page.evaluate(() =>
  Array.from(document.querySelectorAll('section[id] h3.title')).map(h => ({
    text: h.textContent.trim(),
    inBox: !!h.closest('.box'),
    classes: h.className,
    size: getComputedStyle(h).fontSize,
  })));

/** Rows of boxes inside a container: boxes grouped by their top edge, with their heights. */
const rows = (page, sel) => page.evaluate(s => {
  const byTop = new Map();
  for (const b of document.querySelectorAll(s)) {
    const r = b.getBoundingClientRect();
    const top = Math.round(r.top + scrollY);
    if (!byTop.has(top)) byTop.set(top, []);
    byTop.get(top).push(Math.round(r.height * 10) / 10);
  }
  return [...byTop.values()];
}, sel);

async function scheme(device, dark) {
  const tag = `${device}${dark ? ' dark' : ''}`;
  const { page, close, diag } = await openPage({ device, dark, baseUrl });
  try {
    // One card style
    const cs = await cardStyles(page);
    const spread = Object.entries(cs.distinct).filter(([, v]) => v.length !== 1)
      .map(([k, v]) => `${k}: ${v.join(' | ')}`);
    verdict(spread.length === 0, `${tag}: all ${cs.n} boxes share one card style`, spread.join('; '));
    const d = cs.distinct;
    verdict(d.borderTopLeftRadius[0] === '16px' && d.borderTopWidth[0] === '1px'
      && d.borderTopColor[0] === 'rgba(255, 255, 255, 0.08)',
      `${tag}: cards are 16px round with a 1px low-alpha edge`,
      `${d.borderTopLeftRadius} ${d.borderTopWidth} ${d.borderTopColor}`);
    const wantPad = device === 'phone' ? '20px' : '28px';
    verdict(d.paddingTop[0] === wantPad && d.paddingLeft[0] === wantPad,
      `${tag}: card padding is ${wantPad}`, `${d.paddingTop} ${d.paddingLeft}`);
    verdict(!/255, 255, 255/.test(d.boxShadow[0]), `${tag}: the resting shadow is no longer a white glow`,
      d.boxShadow[0]);

    // Titles
    const ts = await titles(page);
    const inside = ts.filter(t => t.inBox).map(t => t.text);
    verdict(inside.length === 0, `${tag}: no section title sits inside a card`, inside.join('; '));
    const sizes = [...new Set(ts.map(t => t.size))];
    const unclassed = ts.filter(t => !/\bis-3\b/.test(t.classes) || !/\bsection-title\b/.test(t.classes))
      .map(t => t.text);
    verdict(sizes.length === 1 && unclassed.length === 0,
      `${tag}: all ${ts.length} section titles are one size (.title.is-3.section-title)`,
      `${sizes.join(', ')}${unclassed.length ? `; unclassed: ${unclassed.join(', ')}` : ''}`);

    // The page and the footer
    const page_ = await page.evaluate(() => {
      const cs = el => getComputedStyle(el);
      const footer = document.querySelector('footer.footer');
      return {
        html: cs(document.documentElement).backgroundColor,
        body: cs(document.body).backgroundColor,
        card: cs(document.querySelector('.box')).backgroundColor,
        footerBg: cs(footer).backgroundColor,
        footerPad: [cs(footer).paddingTop, cs(footer).paddingBottom],
        sectionPad: cs(document.querySelector('section.section')).paddingTop,
      };
    });
    verdict(page_.html === page_.body, `${tag}: html is the page colour, so overscroll is too`,
      `html ${page_.html}, body ${page_.body}`);
    verdict(page_.footerBg === page_.card && page_.footerPad[1] === '28px',
      `${tag}: the footer is a card-coloured band, 28px below its line`,
      `${page_.footerBg}, padding ${page_.footerPad.join(' / ')}`);
    const wantSection = device === 'phone' ? '32px' : '56px';
    verdict(page_.sectionPad === wantSection, `${tag}: section padding is ${wantSection} above and below`,
      page_.sectionPad);

    // Tags
    const tags = await page.evaluate(() => {
      const one = s => { const c = getComputedStyle(document.querySelector(s)); return { size: c.fontSize, margin: c.margin, radius: c.borderTopLeftRadius }; };
      return { card: one('.experience-card .tag'), skills: one('#skills .tag') };
    });
    verdict(tags.card.size === '13px' && tags.skills.size === '15px'
      && tags.card.margin === '0px' && parseFloat(tags.card.radius) > 100,
      `${tag}: tags are pills, 13px in the cards and 15px in Skills, spaced by the gap alone`,
      JSON.stringify(tags));

    // Fold-out lists
    const lists = await page.evaluate(() => ['.notable-projects ul', '.comp-details ul'].map(s => {
      const c = getComputedStyle(document.querySelector(s));
      return `${c.fontSize}/${c.lineHeight}`;
    }));
    verdict(lists[0] === lists[1] && lists[0] === '14.4px/21.6px',
      `${tag}: both fold-outs' lists are .9rem at 1.5`, lists.join(' vs '));

    // The certificate
    const cert = await page.evaluate(async pdf => {
      const links = Array.from(document.querySelectorAll(`#certifications a[href="${pdf}"]`));
      const imgLink = links.find(a => a.querySelector('img'));
      const textLink = links.find(a => !a.querySelector('img'));
      const res = await fetch(pdf, { method: 'GET' });
      const buf = new Uint8Array(await res.arrayBuffer());
      return {
        n: links.length,
        imgLink: !!imgLink,
        text: textLink?.textContent.trim(),
        textVisible: !!textLink && textLink.getBoundingClientRect().width > 0,
        status: res.status,
        type: res.headers.get('content-type'),
        magic: String.fromCharCode(...buf.slice(0, 5)),
      };
    }, PDF);
    verdict(cert.imgLink && cert.text === 'View certificate (PDF)' && cert.textVisible,
      `${tag}: the Security+ image and a "View certificate (PDF)" line both link to ${PDF}`,
      `${cert.n} links`);
    verdict(cert.status === 200 && cert.magic === '%PDF-',
      `${tag}: ${PDF} resolves`, `${cert.status} ${cert.type} ${cert.magic}`);

    if (device === 'desktop') {
      // Equal heights, row by row
      const lead = await rows(page, '#leadership .box');
      const uneven = lead.filter(r => new Set(r).size !== 1);
      verdict(uneven.length === 0 && lead.length === 3,
        `${tag}: leadership cards are equal height in each row`, JSON.stringify(lead));
      const lone = await page.evaluate(() => {
        const boxes = Array.from(document.querySelectorAll('#leadership .box'));
        const c = document.querySelector('#leadership .container').getBoundingClientRect();
        const r = boxes[boxes.length - 1].getBoundingClientRect();
        return Math.abs((r.left + r.right) / 2 - (c.left + c.right) / 2);
      });
      verdict(lone < 1, `${tag}: the last leadership card is centred under the others`, `${lone}px off`);
      const ec = await rows(page, '#education-contact .box');
      verdict(ec.length === 1 && new Set(ec[0]).size === 1,
        `${tag}: the Education and Contact cards are equal height`, JSON.stringify(ec));

      if (!dark) {
        const link = page.locator('.hero-nav a:not(.is-active)').first();
        await page.evaluate(() => scrollTo(0, 0));
        await link.hover();
        const deco = await link.evaluate(a => getComputedStyle(a).textDecorationLine);
        verdict(deco === 'none', `${tag}: a hero-nav link does not underline under the cursor`, deco);
      }
    }

    if (device === 'phone') {
      // A short competition card ends at its content, not 320px of flex-basis below it
      const tails = await page.evaluate(() =>
        Array.from(document.querySelectorAll('.experience-card, .competition-card')).map(card => {
          const last = card.querySelector('details');
          const pad = parseFloat(getComputedStyle(card).paddingBottom)
            + parseFloat(getComputedStyle(card).borderBottomWidth);
          return Math.round(card.getBoundingClientRect().bottom - last.getBoundingClientRect().bottom - pad);
        }));
      verdict(tails.every(t => Math.abs(t) <= 1),
        `${tag}: each experience and competition card ends at its fold-out`, `extra px: ${tails.join(', ')}`);
      const gaps = await page.evaluate(() =>
        Array.from(document.querySelectorAll('.experience-media, .competition-media')).map(f => {
          const img = f.querySelector('img');
          return Math.round(f.getBoundingClientRect().height - img.getBoundingClientRect().height);
        }));
      verdict(gaps.every(g => g === 0), `${tag}: each logo's figure is as tall as the logo`, gaps.join(', '));

      if (!dark) {
        // Keyboard focus shows on a fold-out's summary (the old rule switched it off)
        await page.locator('.experience-card .notable-projects summary').first().scrollIntoViewIfNeeded();
        await page.focus('.experience-card .notable-projects summary');
        await page.keyboard.press('Shift+Tab');
        await page.keyboard.press('Tab');
        const ring = await page.evaluate(() => {
          const el = document.activeElement;
          return { tag: el.tagName, outline: getComputedStyle(el).outlineStyle };
        });
        verdict(ring.tag === 'SUMMARY' && ring.outline === 'solid',
          `${tag}: a fold-out's summary shows a focus ring from the keyboard`, JSON.stringify(ring));

        // Narrower phones than the harness's: nothing runs off the side, the Contact card included
        for (const width of [390, 375, 320]) {
          await page.setViewportSize({ width, height: 700 });
          await page.waitForTimeout(150);
          const o = await measureOverflow(page);
          const card = await page.evaluate(() => {
            const c = document.querySelector('.contact-card');
            const widest = Math.max(...Array.from(c.querySelectorAll('p, a')).map(e => e.getBoundingClientRect().right));
            return { right: Math.round(c.getBoundingClientRect().right), widest: Math.round(widest),
              wrap: getComputedStyle(c.querySelector('p')).overflowWrap };
          });
          verdict(o.overflow === 0 && card.widest <= card.right && card.wrap === 'anywhere',
            `${tag} @${width}: no horizontal overflow, and the Contact links stay inside their card`,
            `scrollWidth ${o.scrollWidth}/${o.viewport}, text right ${card.widest} vs card ${card.right}, ${card.wrap}`);
        }
      }
    }

    const errs = diag.consoleErrors.filter(e => !/favicon\.ico/.test(e));
    verdict(errs.length === 0, `${tag}: no console errors but the favicon 404`, errs.join('; '));
  } finally {
    await close();
  }
}

for (const device of ['phone', 'desktop']) {
  for (const dark of [false, true]) await scheme(device, dark);
}

const failed = results.filter(r => !r).length;
console.log(`\n${results.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
