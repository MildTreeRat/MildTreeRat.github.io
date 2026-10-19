// Render page 1 of a PDF to a PNG thumbnail (docs/plans/site-revamp.md, P11).
//
//   node tools/pdf-thumb.mjs resumes/Aaron_Sierra_SWE_Resume.pdf            # → resumes/…_Resume.png
//   node tools/pdf-thumb.mjs <pdf> [--width 600] [--out <png>]
//
// ImageMagick cannot do this here: it rasterises PDFs through Ghostscript, and this machine has none.
// So the page is drawn by pdf.js inside the installed Edge, on the harness's local server (which
// serves tools/node_modules/ at /tools/…; the live site excludes tools/, and needs none of this),
// and the canvas comes back as a PNG. Paths are relative to the repo root.
//
// The PNG is then re-encoded by ImageMagick, stripped of metadata and reduced to a 32-shade
// palette: a resume page is near-white with dark text, so the palette costs nothing visible and
// about two-thirds of the bytes. Without `magick` on PATH the canvas's own PNG is kept as it is.
//
// pdfjs-dist is pinned to 4.8.69, the last release whose engines field accepts Node 18/19 (4.9.124
// onward requires Node >= 20), for the reason shoot.mjs pins playwright-core. It runs in Edge, not
// in Node, so its optional `canvas` dependency (a native build that fails here) is never needed.

import { writeFile, rename, stat } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { openPage, ROOT } from './shoot.mjs';

const run = promisify(execFile);

const args = process.argv.slice(2);
const opt = name => (args.includes(name) ? args[args.indexOf(name) + 1] : null);
const pdfArg = args.find((a, i) => !a.startsWith('--') && !['--width', '--out'].includes(args[i - 1]));
if (!pdfArg) {
  console.error('usage: node tools/pdf-thumb.mjs <pdf> [--width 600] [--out <png>]');
  process.exit(2);
}
const width = Number(opt('--width') ?? 600);
const pdfPath = path.resolve(ROOT, pdfArg);
const outPath = path.resolve(ROOT, opt('--out') ?? pdfArg.replace(/\.pdf$/i, '.png'));
const rel = path.relative(ROOT, pdfPath);
const show = p => path.relative(ROOT, p).split(path.sep).join('/');
if (rel.startsWith('..')) throw new Error(`${pdfArg} is outside the repo, so the local server cannot serve it`);
const pdfUrl = '/' + rel.split(path.sep).join('/');

const { page, close } = await openPage({ device: 'desktop' });
try {
  const result = await page.evaluate(async ({ pdfUrl, width }) => {
    const base = '/tools/node_modules/pdfjs-dist';
    const pdfjs = await import(`${base}/build/pdf.mjs`);
    pdfjs.GlobalWorkerOptions.workerSrc = `${base}/build/pdf.worker.mjs`;
    const doc = await pdfjs.getDocument({
      url: pdfUrl,
      standardFontDataUrl: `${base}/standard_fonts/`,
      cMapUrl: `${base}/cmaps/`,
      cMapPacked: true,
    }).promise;
    const first = await doc.getPage(1);
    const natural = first.getViewport({ scale: 1 });
    const viewport = first.getViewport({ scale: width / natural.width });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext('2d');
    // A PDF page has no background of its own; an unpainted canvas is transparent, which the
    // site's dark cards would show through.
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await first.render({ canvasContext: ctx, viewport }).promise;
    const text = (await first.getTextContent()).items.map(i => i.str).join(' ').replace(/\s+/g, ' ');
    return {
      png: canvas.toDataURL('image/png').split(',')[1],
      pages: doc.numPages,
      size: [canvas.width, canvas.height],
      pointSize: [natural.width, natural.height],
      text: text.slice(0, 160),
    };
  }, { pdfUrl, width });

  await writeFile(outPath, Buffer.from(result.png, 'base64'));
  const raw = (await stat(outPath)).size;
  let optimised = 'kept as rendered (no magick on PATH)';
  try {
    const tmp = `${outPath}.tmp.png`;
    await run('magick', [outPath, '-strip', '-colors', '32', `PNG8:${tmp}`]);
    await rename(tmp, outPath);
    optimised = `re-encoded ${Math.round(raw / 1024)} KB → ${Math.round((await stat(outPath)).size / 1024)} KB`;
  } catch {
    // Keep the canvas's PNG: a larger file is still a correct thumbnail.
  }
  console.log(`${show(pdfPath)}: ${result.pages} page(s), page 1 is ${result.pointSize.join(' x ')} pt`);
  console.log(`wrote ${show(outPath)}: ${result.size.join(' x ')} px, ${optimised}`);
  console.log(`page 1 text begins: ${result.text}`);
} finally {
  await close();
}
