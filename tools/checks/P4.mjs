// P4's check: how many bytes of images does the page cost, on first load and after scrolling to
// the bottom, and does every image it shows arrive?
//
//   node tools/checks/P4.mjs                                    # this tree, phone and desktop
//   node tools/checks/P4.mjs --base https://www.aaron-sierra.com   # the live site (the "before")
//
// Not built on openPage(): its page has already loaded by the time a check can listen, and the
// first load is the half of the answer that matters on a phone. So the context is made here, from
// the harness's own DEVICES, with the listener on before the first request.
import { DEVICES, launchEdge, startServer, measureOverflow } from '../shoot.mjs';

const args = process.argv.slice(2);
const baseArg = args.includes('--base') ? args[args.indexOf('--base') + 1] : null;

function kb(n) { return `${(n / 1024).toFixed(1)} KB`; }

async function weigh(browser, baseUrl, device) {
  const context = await browser.newContext({ ...DEVICES[device], colorScheme: 'light' });
  const page = await context.newPage();
  const origin = new URL(baseUrl).origin;
  const images = [];   // { url, bytes, phase, sameOrigin }
  const failed = [];
  let phase = 'first load';
  page.on('response', async res => {
    if (res.status() >= 400) failed.push(`${res.status()} ${res.url()}`);
    if (res.request().resourceType() !== 'image') return;
    let bytes = 0;
    try { bytes = (await res.body()).length; } catch { /* a redirect has no body */ }
    images.push({ url: res.url(), bytes, phase, sameOrigin: res.url().startsWith(origin) });
  });
  page.on('requestfailed', req => failed.push(`${req.failure()?.errorText ?? 'failed'} ${req.url()}`));

  await page.goto(baseUrl + '/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  phase = 'on scroll';
  // A viewport at a time, not a section at a time: on the phone the experience section is many
  // screens tall, and jumping from its top to the next section skips lazy logos in between.
  for (;;) {
    const more = await page.evaluate(() => {
      const before = window.scrollY;
      window.scrollBy({ top: Math.round(window.innerHeight * 0.8), behavior: 'instant' });
      return window.scrollY > before;
    });
    await page.waitForTimeout(300);
    await page.waitForLoadState('networkidle');
    if (!more) break;
  }

  // Every <img> on the page loaded, at what natural size, and drawn at what size. Bounded: a lazy
  // image that never came near the viewport would never settle.
  await page.waitForFunction(() => [...document.images].every(i => i.complete), null, { timeout: 5000 })
    .catch(() => {});
  const imgs = await page.evaluate(() => [...document.images].map(i => ({
    src: i.getAttribute('src'),
    natural: `${i.naturalWidth}x${i.naturalHeight}`,
    drawn: `${Math.round(i.getBoundingClientRect().width)}x${Math.round(i.getBoundingClientRect().height)}`,
    lazy: i.loading === 'lazy',
    attrs: i.hasAttribute('width') && i.hasAttribute('height'),
    ok: i.complete && i.naturalWidth > 0,
  })));
  const hero = await page.evaluate(() =>
    getComputedStyle(document.querySelector('.hero.hero-banner')).backgroundImage);
  const overflow = await measureOverflow(page);
  await context.close();
  return { device, images, failed, imgs, hero, overflow };
}

function report(r) {
  const sum = list => list.reduce((a, i) => a + i.bytes, 0);
  const own = r.images.filter(i => i.sameOrigin);
  const first = own.filter(i => i.phase === 'first load');
  console.log(`\n== ${r.device}`);
  console.log(`  hero background: ${r.hero}`);
  console.log(`  own images, first load: ${kb(sum(first))} (${first.length})`);
  console.log(`  own images, whole page: ${kb(sum(own))} (${own.length})`);
  console.log(`  external images: ${kb(sum(r.images.filter(i => !i.sameOrigin)))}`);
  for (const i of r.images) {
    console.log(`    ${i.phase.padEnd(10)} ${kb(i.bytes).padStart(10)}  ${i.url.replace(/^https?:\/\/[^/]+/, i.sameOrigin ? '' : '$&')}`);
  }
  console.log('  <img> elements:');
  for (const i of r.imgs) {
    console.log(`    ${i.ok ? 'ok  ' : 'BAD '} lazy=${i.lazy ? 'y' : 'n'} w/h=${i.attrs ? 'y' : 'n'} ` +
      `natural ${i.natural} drawn ${i.drawn}  ${i.src}`);
  }
  console.log(`  scrollWidth ${r.overflow.scrollWidth} of ${r.overflow.viewport}`);
  console.log(`  failed requests (${r.failed.length}):` + (r.failed.length ? '\n    ' + r.failed.join('\n    ') : ' none'));
}

const server = baseArg
  ? { url: baseArg.replace(/\/$/, ''), close: async () => {} }
  : await startServer();
const browser = await launchEdge();
try {
  console.log(`site: ${server.url}`);
  for (const device of ['phone', 'desktop']) report(await weigh(browser, server.url, device));
} finally {
  await browser.close();
  await server.close();
}
