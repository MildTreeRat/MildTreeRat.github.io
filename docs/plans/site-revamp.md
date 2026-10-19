# Site revamp — less clunky, phone-friendly, cleaner look

Repo: `C:\Users\aaron\Desktop\repo\MildTreeRat.github.io` (GitHub `MildTreeRat/MildTreeRat.github.io`),
live at **https://www.aaron-sierra.com** via GitHub Pages from `main` (Jekyll build, no `.nojekyll`).
One page (`index.html` + `custom.css`, Bulma 1.0.4 from unpkg). Planned 2026-10-19 with the owner.

The owner's two complaints: the site feels clunky (both how it **moves** and how it **looks**), and
on a phone the right-side section pane covers half the screen.

## Status checklist

**Stop after every phase. Every time.** A phase is one session. When it is done:
1. commit and **push to `main`** (D7), in the same change as ticking its row here;
2. append what it *found* under "Phase findings" at the foot, addressing anything a later phase must
   know to that phase by number ("**For P7**: …");
3. stop, and tell the user to `/clear` and run `/next-phase`.

| Phase | What | State |
|---|---|---|
| **P0** | This plan document, and keep `docs/` off the live site | ✅ Done *(2026-10-19)* — approved by the owner |
| **P1** | The screenshot harness, and the baseline shots | ✅ Done *(2026-10-19)* |
| **P2** | Consolidate `custom.css` into one clean file with design tokens | ✅ Done *(2026-10-19)* |
| **P3** | Typography: Inter and a tighter type scale | ✅ Done *(2026-10-19)* |
| **P4** | Optimise the images | ✅ Done *(2026-10-19)* |
| **P5** | Calmer motion: no parallax, hover only where it helps | ✅ Done *(2026-10-19)* |
| **P6** | The phone menu: visible, closes on tap, smooth scroll | ✅ Done *(2026-10-19)* |
| **P7** | Phone slim dots replace the side pane | ⬜ |
| **P8** | Desktop side pane stays hidden over the hero | ⬜ |
| **P9** | The phone hero: shorter, readable, nothing off the edge | ⬜ |
| **P10** | Cards, spacing and section polish | ⬜ |
| **P11** | The resume section, with the SWE resume as a PDF | ⬜ |
| **P12** | Close: full review, changelog line, leftovers listed | ⬜ |

---

## Rules (every phase)

1. **Stop after every phase. Every time.** Tick the row, write the findings, push, stop.
2. **Push to `main` after every phase** (D7). Stage only the phase's own files (never `git add -A`
   blindly), commit with a short imperative message in the repo's style, `git push origin main`.
   **Never force-push.** If the push is rejected (remote moved), or the tree has changes the phase
   did not make when it starts, stop: `BLOCKED`.
3. **Wording stays.** Same sections, same order, same text — except where a phase says otherwise
   (P10's certificate link, P11's resume section). The phone number stays (D6). Bulma 1.0.4 from
   unpkg stays.
4. **Do not touch:** `showcase.html` / `showcase.css` / `showcase.js` (an unlinked Bulma template kept
   for reference), `about.html` (empty), `CNAME`, `Resume_Aaron 3.28.22.docx`, other branches.
5. **Never delete an original image.** Optimised copies get new names; originals that become
   unreferenced stay on disk and P12 lists them for the owner.
6. **The owner's phone is an iPhone (Safari).** Pair every `backdrop-filter` with
   `-webkit-backdrop-filter`; use `svh` with a `vh` fallback; `scroll-behavior` and `:has()` are fine
   (iOS 15.4+). Test touch with the harness's touch device so `(hover: hover)` queries behave.
7. **Bulma 1.0 follows `prefers-color-scheme`.** Most iPhones are in light mode, so the harness shoots
   phone in **light** scheme by default; anything Bulma renders (navbar menu, buttons) must be styled
   explicitly dark, not left to Bulma's theme.
8. Keep `custom.css` organised as P2 leaves it (tokens → base → components → media queries), and use
   the tokens rather than new raw colours.
9. **Live check (soft).** After pushing, poll for a marker string from the change, up to 10 minutes
   (Pages builds in ~1 min; the CDN caches for `max-age=600`):
   `curl -s https://www.aaron-sierra.com/custom.css | grep -c '<marker>'`. Not live within 10 minutes is
   a finding, not a failure.

## Verify commands

```bash
cd /c/Users/aaron/Desktop/repo/MildTreeRat.github.io
node tools/shoot.mjs <label>            # P1 builds it. Phone 390x844 + desktop 1440x900 → tools/shots/<label>/
node tools/shoot.mjs <label> --dark     # same, prefers-color-scheme: dark
magick compare -metric AE a.png b.png diff.png   # pixel diff; AE 0 = identical (prints to stderr)
curl -s https://www.aaron-sierra.com/ | grep -c '<marker>'   # live check (rule 9)
```

What `shoot.mjs` does (P1's contract, later phases rely on it):
- Serves the repo root on a local port with Node's `http` (not `file://`), opens it in the **installed
  Edge** through `playwright-core` (`channel: 'msedge'`, no browser download), waits for network idle.
- **Phone:** 390×844, `deviceScaleFactor: 3`, `isMobile: true`, `hasTouch: true`, light scheme.
  **Desktop:** 1440×900, mouse, light scheme.
- Shoots the top of the page, then **each `section[id]` scrolled into view by JS** — `#anchor` URLs
  render blank in headless Edge — then the full page. Waits 2.5 s after every scroll so the side
  pane's 1.8 s hide timer has fired, and injects `*{transition:none!important;animation:none!important}`
  for deterministic pixels (`--live-motion` turns that off).
- Prints, per device: `document.documentElement.scrollWidth` against the viewport width (horizontal
  overflow), console errors, and failed requests (404s).
- **Exports `openPage({ device, dark, liveMotion })`** returning `{ page, url, close }`, so a phase's
  own interaction check is a few lines in `tools/checks/<Pn>.mjs` (tap the burger, tap a dot, dispatch
  scrolls, read computed styles).

`tools/shots/` and `tools/node_modules/` are gitignored. `tools/shots/baseline/` (P1) is the "before"
every later phase compares against; it lives on this machine only.

## Decisions (with the owner, 2026-10-19)

- **D1 — Phone: slim dots.** Below 1024px the side pane becomes a slim column of dots on the right
  edge (rail ≤ 28px wide). The current section's dot is lit; tapping a dot scrolls there and briefly
  shows the section's name; the rail does not pop in and out while scrolling. Hidden while the hero is
  in view, like the desktop pane (D2).
- **D2 — Desktop side pane keeps hiding away.** The owner likes that it pops out on scroll and tucks
  away again; **do not make it stay put.** The one change: it does not appear while the hero photo is
  in view.
- **D3 — Look: clean & modern.** Inter, a tighter type scale, softer cards, more breathing room. Keep
  the dark theme, the blue/purple accent (`#5e8dff` → `#9b60ff`), the grad photo as the hero, and
  every section in its order.
- **D4 — Resumes: the SWE resume only, for now.** Source `C:\Users\aaron\Downloads\SWE_Resume_Aaron.docx`
  (modified 2026-08-09), converted to PDF with Word. The section is data-driven so another resume
  (another skill set) is one PDF plus one array entry. The Jan 2025 resume image leaves the page.
  The owner approved publishing the PDF, contact details included.
- **D5 — Security+:** the certificate image links to the existing `CompTIASecurityPlus.pdf`.
- **D6 — The phone number stays** in Contact.
- **D7 — Push to `main` after every phase.** The owner is away from home and previews the live site
  on their phone; a bad phase is reverted with `git revert <sha>`.
- **D8 — The plan stays off the site.** `_config.yml` excludes `docs/` and `tools/` from the Jekyll
  build (otherwise this file would be served raw at `/docs/plans/site-revamp.md`).
- **D9 — Calmer motion.** No `background-attachment: fixed`. Hover lift/glow only on small cards, only
  on devices that can hover (`(hover: hover) and (pointer: fine)`), and `prefers-reduced-motion`
  honoured everywhere.
- **D10 — Phone menu:** visible against the photo, closes after a link tap (and on outside tap / Esc),
  scrolls smoothly.
- **D11 — Phone hero:** shorter than full height, name and subtitle fully on screen and readable, not
  sitting over the stole.

## What research found (2026-10-19)

- **The phone pane bug.** `custom.css:327-329` hides `.side-nav-wrapper` below 1024px; the
  "SIDE NAV FIX PATCH" at `custom.css:560-566` re-declares `display:flex` later with no media query and
  wins the cascade. The pane is 210px wide, and the scroll listener at `index.html:651` pops it open on
  any 2px of scroll.
- **CSS duplication.** `.side-nav` is declared three times (`:193`, `:238`, `:569` with `!important`
  resets), `.side-nav-wrapper` three times, `.hero.hero-banner` and its `::before` twice (`:55`/`:342`,
  `:66`/`:350` — the **second** wins, so the white film is `rgba(255,255,255,0.18)`), and a legacy
  no-op `.side-nav.is-hidden-side-nav`.
- **Motion.** `.hover-glow` (lift 3px + glow) is on every box, including About, Skills, Resume and every
  experience card; on touch, a tap leaves it stuck. The hero uses `background-attachment: fixed`.
- **Phone menu.** The burger (`index.html:41-60`) is a transparent fixed navbar with no brand; in a
  390px screenshot it is invisible against the bright sky. No handler closes the menu after a link tap
  (`index.html:327-335`), and only the hero nav and side nav links smooth-scroll.
- **Phone hero.** At 390px the subtitle runs off the right edge (the page is wider than the viewport —
  likely the off-screen pane), the name sits over the stole, the hero is `is-fullheight`, there is an
  empty `<figure class="hero-avatar">` with a commented-out image, and the white film lowers the
  contrast of the white text.
- **Images.** `images/Aaron_and_karina.jpg` 8.9 MB (shown at max 360px), `AaronGrad.jpeg` 2.0 MB
  (hero), `Resume-1.jpg` 1.0 MB, `CompTIASecurityPlus-1.jpg` 440 KB, `images/oso_esports.jpg` 386 KB
  and `images/swccdc.png` 227 KB (both shown at 110px). Photos may carry EXIF (GPS) — strip it.
- **Script.** Experience and competitions render from `experiencesData` / `competitionsData` arrays
  in `index.html`'s inline script; P11's resumes follow the same pattern. The hero nav's active-link
  tracking (`index.html:592-602`) only matters while the hero is on screen.
- **Tools on this machine:** Word 16 (COM automation works), ImageMagick 7.1.2 (`magick`; **no
  Ghostscript**, so it cannot rasterise a PDF), ffmpeg, Node 19.8.1 / npm 9.5.1, Edge at
  `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`. No `docs/` existed before P0.

---

## Phases

### P0 — This plan document, and keep `docs/` off the live site

- **Goal:** the plan is in the repo where every session can see it, and not on the public site.
- **Read:** nothing beyond this plan.
- **Files:** `docs/plans/site-revamp.md` (this file), `_config.yml` (new: `exclude: [docs, tools]`).
- **Done when:** both are committed and pushed; after the Pages build,
  `curl -s -o /dev/null -w '%{http_code}' https://www.aaron-sierra.com/docs/plans/site-revamp.md`
  prints `404` and the home page still returns `200` with its content.
- **Verify:** the two `curl` checks above (soft per rule 9 for timing, but the 404 must hold once the
  build is live).

### P1 — The screenshot harness, and the baseline shots

- **Goal:** every later phase can see the site at phone and desktop size and measure it, with
  interaction checks a few lines long.
- **Read:** "Verify commands" above (it is this phase's contract); `index.html` lines 37-110 and the
  script at the end, to know the selectors.
- **Files:** `tools/package.json` (`"type": "module"`, `playwright-core` as a dev dependency — pick a
  version that runs on Node 19), `tools/package-lock.json`, `tools/shoot.mjs`, `.gitignore`
  (add `tools/node_modules/` and `tools/shots/`).
- **Steps:** `npm install` in `tools/`; write the server, the two devices, the shots, the measures, the
  `openPage` export; run `node tools/shoot.mjs baseline` before touching any site file.
- **Done when:** `tools/shots/baseline/` holds phone and desktop shots (top, every section, full page),
  and the run printed scrollWidth, console errors and failed requests for both devices.
- **Verify:** Read the phone top shot and one section shot and confirm they match what the live site
  shows (the phone pane bug visible). **Record in the findings:** phone and desktop scrollWidth, the
  list of section ids, any console errors or 404s — P2 onward compare against these.

### P2 — Consolidate `custom.css` into one clean file with design tokens

- **Goal:** one declaration per component, organised and tokenised, **rendering identically on
  desktop** — and, because the duplicate is gone, the phone pane hidden below 1024px as originally
  intended (the interim until P7).
- **Read:** `custom.css` whole; "What research found" (CSS duplication); P1's findings.
- **Files:** `custom.css` only.
- **Steps:** rewrite in this order: `:root` tokens (colours, accent gradient, radii, spacing, shadows,
  font stack), base, hero, hero nav, side nav (one block for the wrapper, one for the panel, one for
  links), boxes and tags, experience, competitions, utilities, then media queries last so the
  `<1024px` hide wins. Carry over each property's **winning** value: e.g. the hero film is `0.18`, not
  `0.25`; `.side-nav` ends `position: relative`, padding `1.1rem 0 1.1rem .9rem`, `transition: padding
  .35s`; `.side-nav-wrapper.collapsed` is `translateX(calc(100% - 14px))`. Delete the FIX PATCH block
  and the legacy no-op.
- **Done when:** no selector is declared twice outside media queries; no `!important` remains;
  desktop shots compare **AE 0** with `baseline` (top and full page) — any non-zero AE is explained in
  the findings or fixed; the phone shows no side pane.
- **Verify:** `node tools/shoot.mjs p2`; `magick compare` desktop top + full against baseline; record
  the phone scrollWidth (does hiding the pane alone fix the overflow? **For P9**).

### P3 — Typography: Inter and a tighter type scale

- **Goal:** the text reads polished and consistent (D3).
- **Read:** `custom.css` tokens section; `index.html` `<head>`; P2's findings.
- **Files:** `index.html` (`<head>`: preconnect + Google Fonts Inter 400/500/600/700 with
  `display=swap`), `custom.css` (font tokens; set Bulma 1.0's `--bulma-family-primary` and
  `--bulma-family-secondary` to the Inter stack so Bulma components follow; a `clamp()` heading scale;
  body `line-height` ~1.6; headings weight 700 with slight negative letter-spacing).
- **Done when:** body and headings compute to Inter (check `getComputedStyle` and
  `document.fonts.check('16px Inter')` through `openPage`); no wording changed; no horizontal overflow
  at 390px introduced.
- **Verify:** `node tools/shoot.mjs p3`; Read phone and desktop top + two section shots.

### P4 — Optimise the images

- **Goal:** the page loads fast on a phone (most of the weight is two photos).
- **Read:** "What research found" (Images); `index.html` image references; the hero rules in
  `custom.css`.
- **Files:** new optimised files under `images/` (new names, rule 5): `hero-1920.jpg`, `hero-900.jpg`,
  `aaron-karina-800.jpg`, `security-plus-840.jpg`, and 2× logo copies (~280px) for `oso_esports` and
  `swccdc`; `index.html` and `custom.css` references; `loading="lazy"` + `width`/`height` on
  below-the-fold `<img>`. The hero uses `hero-900.jpg` at ≤768px through a media query.
- **Steps:** `magick <in> -auto-orient -strip -resize <w>x -quality 78 <out>` (PNG logos may become
  WebP or optimised PNG). Record whether the originals carried GPS EXIF.
- **Done when:** a before/after bytes table is in the findings and the page's image weight drops by at
  least 80%; shots look the same (compare informational, Read them); no 404s.
- **Verify:** `node tools/shoot.mjs p4`; check the failed-requests list is empty.

### P5 — Calmer motion: no parallax, hover only where it helps

- **Goal:** the page stops moving under the cursor and scrolls smoothly (D9).
- **Read:** `custom.css` (`.hover-glow`, hero, side nav, experience/competition image hovers);
  `index.html` uses of `hover-glow`.
- **Files:** `custom.css`, `index.html` (class changes only).
- **Steps:** remove `background-attachment: fixed`. Big boxes (About text and photo, Education,
  Contact, Skills, Certifications, Resume, experience and competition cards) get a static subtle
  border/shadow with no lift. The small leadership cards keep a gentle lift (≤2px) and glow. Wrap every
  hover effect in `@media (hover: hover) and (pointer: fine)`. Add a `prefers-reduced-motion: reduce`
  block that removes transitions, smooth scrolling and the side pane slide.
- **Done when:** through `openPage`: on desktop, hovering a big box leaves `transform` `none`, hovering
  a leadership card does not; on the phone device, tapping a box leaves `transform` `none`; no
  `background-attachment: fixed` remains.
- **Verify:** `tools/checks/P5.mjs` for the above; `node tools/shoot.mjs p5`.

### P6 — The phone menu: visible, closes on tap, smooth scroll

- **Goal:** D10.
- **Read:** `index.html` lines 37-60 (mobile navbar) and the burger script; `custom.css` navbar and
  `section[id]` rules; rule 7 (Bulma's light theme on iPhones).
- **Files:** `index.html` (navbar markup and script), `custom.css`.
- **Steps:** give the burger a dark translucent pill (with `-webkit-backdrop-filter`) and white bars so
  it reads on any photo; style the opened menu explicitly dark; close it on link tap, outside tap and
  Esc, keeping `aria-expanded` true to state; `html { scroll-behavior: smooth }` (off under reduced
  motion) so every in-page link scrolls smoothly; `scroll-margin-top` clears the fixed bar.
- **Done when:** in the phone top shot the burger is plainly visible; `tools/checks/P6.mjs` taps the
  burger (menu shown, shot taken), taps "Skills" (menu closed, `aria-expanded="false"`, and `#skills`'
  top lands within 0-90px of the viewport top once scrolling settles).
- **Verify:** `tools/checks/P6.mjs`; Read the open-menu shot in light **and** `--dark` scheme.

### P7 — Phone slim dots replace the side pane

- **Goal:** D1.
- **Read:** `index.html` side nav markup (`:96-108`) and its script (`:613-694`); `custom.css` side
  nav section and tokens; P2's and P6's findings.
- **Files:** `index.html` (script builds the rail from the side nav's links — one list of sections, not
  two), `custom.css` (rail styles inside the `<1024px` query).
- **Steps:** a fixed rail on the right edge, vertically centred: 8px dots inside tap targets about
  28×36px, rail ≤ 28px wide, low-opacity until active; the active dot (from the same
  IntersectionObserver as the pane) is lit with the accent gradient and slightly larger, with
  `aria-current`; each dot has an `aria-label`. Tapping scrolls to the section and shows a small label
  pill left of the dot for ~1.2 s. Hidden (faded) while the hero is in view; otherwise always present —
  no pop in/out on scroll. The desktop pane stays exactly as P2 left it.
- **Done when:** `tools/checks/P7.mjs`: at the top the rail is hidden; scrolled to `#skills` the rail is
  visible, its bounding box ≤ 28px wide, and the lit dot is Skills; tapping the Experience dot brings
  `#experience` into view and shows the label, gone again after 1.5 s; phone scrollWidth equals 390;
  desktop shots unchanged from P6's.
- **Verify:** `tools/checks/P7.mjs`; `node tools/shoot.mjs p7`; Read two phone section shots.

### P8 — Desktop side pane stays hidden over the hero

- **Goal:** D2 — same pop-out-then-hide behaviour, but not while the hero photo is on screen.
- **Read:** `index.html` side nav script (`:613-694`) and the hero markup; `custom.css` side nav
  section; P7's findings (the shared observer).
- **Files:** `index.html` (script), `custom.css` (a hidden-on-hero state that also hides the 14px strip).
- **Steps:** observe the hero; while it is meaningfully in view, scroll/hover/focus do not expand the
  pane and the strip is hidden; once past it, behaviour is exactly today's (scroll shows it for 1.8 s,
  hover keeps it open, keyboard focus expands it). **Do not make it stay put.**
- **Done when:** `tools/checks/P8.mjs` (desktop, `liveMotion`): at the top, small scrolls inside the
  hero leave the wrapper collapsed and the strip invisible; after scrolling to `#about` it is expanded;
  2.5 s later it is collapsed with the strip visible.
- **Verify:** `tools/checks/P8.mjs`; `node tools/shoot.mjs p8`.

### P9 — The phone hero: shorter, readable, nothing off the edge

- **Goal:** D11.
- **Read:** `index.html` hero (`:37-95`); `custom.css` hero section and tokens; P2's finding on the
  overflow; P4's hero images.
- **Files:** `index.html` (remove the empty avatar figure), `custom.css`.
- **Steps:** below 768px make the hero ~80svh (80vh fallback) and pick a `background-position` that
  keeps the face and tower; move the name and subtitle to the lower part over a **dark gradient scrim**
  (replacing the white film — on desktop too, if it reads better there; keep the photo prominent);
  `clamp()` the subtitle so it wraps; make the name clearly readable. Fix whatever still widens the
  page if P2 did not.
- **Done when:** phone top shot: name and subtitle fully on screen, readable, not over the stole;
  phone scrollWidth equals 390; desktop top shot has no regression (Read both).
- **Verify:** `node tools/shoot.mjs p9`; also `--dark`.

### P10 — Cards, spacing and section polish

- **Goal:** the rest of D3: softer cards, consistent sections, more breathing room.
- **Read:** `custom.css` boxes, tags, experience, competitions; `index.html` sections from About to
  Competitions; P3's and P5's findings.
- **Files:** `custom.css`, `index.html` (structure/classes only, plus the certificate link).
- **Steps:** one card style from the tokens (radius, 1px low-alpha border, subtle background,
  consistent padding); consistent section titles (some sit inside their box, some outside — pick one);
  less section padding on phones; contact links wrap (`overflow-wrap: anywhere`) so long URLs never
  overflow; tags refined; leadership cards equal height; experience/competition card spacing; footer.
  **D5:** wrap the Security+ image in a link to `CompTIASecurityPlus.pdf` with a short "View certificate
  (PDF)" link under it.
- **Done when:** no horizontal overflow at 390px; every section shot reads cleanly at both sizes (Read
  them); the certificate link resolves locally.
- **Verify:** `node tools/shoot.mjs p10`.

### P11 — The resume section, with the SWE resume as a PDF

- **Goal:** D4.
- **Precondition:** `C:\Users\aaron\Downloads\SWE_Resume_Aaron.docx` exists. If not: `BLOCKED` (ask for
  the file's location).
- **Read:** `index.html` resume section (`:288-298`) and the `experiencesData` render pattern;
  `custom.css` card styles; P10's findings.
- **Files:** `resumes/Aaron_Sierra_SWE_Resume.pdf` (new), `resumes/Aaron_Sierra_SWE_Resume.png`
  (thumbnail, new), `index.html`, `custom.css`, and `tools/` if the thumbnail needs a helper.
- **Steps:** convert with Word COM, read-only, from PowerShell:
  `$w = New-Object -ComObject Word.Application; $d = $w.Documents.Open($src, $false, $true);
  $d.ExportAsFixedFormat($out, 17); $d.Close(0); $w.Quit()`. Render page 1 to the thumbnail (ImageMagick
  cannot: no Ghostscript) — e.g. `pdfjs-dist` in `tools/` driven through `openPage`, ~600px wide; if
  that fails, a text-only card is acceptable and the findings say so. Add a `resumesData` array
  (`{ label: "Software Engineering", updated: "Aug 2026", pdf, thumb }`) rendered as cards: thumbnail
  linking to the PDF, a "View PDF" button and a "Download" link (`download` attribute). The section
  title becomes "Resume"; `Resume-1.jpg` leaves the page (the file stays, rule 5).
- **Done when:** Read the thumbnail and confirm it is the SWE resume's first page; the card shows at
  both sizes; the PDF link returns 200 locally; after the push the live PDF URL returns 200 (soft,
  rule 9).
- **Verify:** `node tools/shoot.mjs p11`; `curl -sI` the local and live PDF URLs.

### P12 — Close: full review, changelog line, leftovers listed

- **Goal:** the whole page is checked end to end and the owner knows what is left.
- **Read:** this plan's findings, all of them (the plan is short enough by now); `index.html` header
  comment.
- **Files:** `index.html` (one "Date Last Modified" line in the header comment's format, summarising the
  revamp), small fixes only, this plan.
- **Steps:** `node tools/shoot.mjs final` and `final --dark`; Read every section at both sizes; fix small
  regressions (anything bigger becomes a finding for the owner, not a new phase's worth of work here);
  confirm no console errors, no 404s, every in-page link lands on its section, no horizontal overflow.
  List unreferenced originals (`AaronGrad.jpeg`, `images/Aaron_and_karina.jpg`, `Resume-1.jpg`,
  `CompTIASecurityPlus-1.jpg`, the old logos) for the owner to keep or delete. Write how to add another
  resume (drop the PDF in `resumes/`, add one `resumesData` entry, thumbnail via the P11 helper).
- **Done when:** the final shots are clean and the findings carry the leftovers list and the
  add-a-resume note.
- **Verify:** `node tools/shoot.mjs final`; the live site serves the last commit (rule 9).

---

## Phase findings

*(Each phase appends `### Pn (YYYY-MM-DD)` here. Address later phases by number: "**For P9**: …".)*

### P0 (2026-10-19)

- Plan approved by the owner as written. `docs/plans/site-revamp.md` and `_config.yml`
  (`exclude: [docs, tools]`) committed and pushed to `main`.
- No `docs/` or `_config.yml` existed before; the tree was clean and level with `origin/main`.
- **For P1**: `tools/` is already excluded from the Jekyll build by `_config.yml`; only `.gitignore`
  needs `tools/node_modules/` and `tools/shots/`.

### P1 (2026-10-19)

- **Harness:** `tools/shoot.mjs` on `playwright-core` **1.61.1**, pinned exactly: it is the last release
  whose engines accept Node 18/19 (1.62.0 onward needs Node 20). Drives the installed Edge
  155.0.4283.62 headless; a run of both devices takes ~55 s.
- **Beyond the contract:** shots are `tools/shots/<label>/<device>-top.png`, `<device>-<section id>.png`
  and `<device>-full.png`, with a `report.json` beside them (overflow at every shot, console errors,
  failed requests). `--dark` writes to `tools/shots/<label>-dark/`, so `final` and `final --dark`
  never overwrite each other; `--device phone|desktop` shoots one. Exports besides `openPage`:
  `scrollToId(page, id)` (JS scroll + settle), `settle(page)` (2.5 s, then network idle),
  `measureOverflow(page)`, `DEVICES`, `startServer`, `launchEdge`. `openPage` also takes
  `reducedMotion`, `path` and `baseUrl` (e.g. `'https://www.aaron-sierra.com'` to open the live site), and
  returns `diag` (`consoleErrors`, `failedRequests`), `context` and `browser` as well.
- Full-page shots are at **CSS scale** (the phone page is 390×13229 CSS px; at 3× it would be ~39,700 px,
  past what Chromium captures in one piece). Viewport shots keep the device's scale (phone 1170×2532).
- The freeze style also covers `::before`/`::after`, and leaves `scroll-behavior` alone (the harness's
  own scrolls pass `behavior: 'instant'`). **For P6**: `html`'s computed `scroll-behavior` reads true
  through `openPage` without `liveMotion`.
- **Baseline** (`tools/shots/baseline/`, plus `baseline-dark/` for the `--dark` phases):
  - **Section ids** (8, in order): `about`, `education-contact`, `skills`, `leadership`,
    `certifications`, `resume`, `experience`, `competitions`. The hero is not one (`id="home"` is on
    the wrapper `div`), so the hero appears only in `top` and `full`.
  - **scrollWidth:** phone **390** of 390, desktop **1440** of 1440: no horizontal overflow at any
    shot, in either scheme.
  - **Console errors:** one, `/favicon.ico` 404. **Failed requests:** the same favicon 404 and nothing
    else. It is Chromium's own request, so Playwright never sees it; the server reports it, under
    whichever device runs first (the browser caches the miss). The live site 404s `/favicon.ico`
    too. **For P4 and P12**: this 404 predates the revamp and is no image P4 touches, so the
    failed-requests list cannot read empty unless a favicon is added.
- **Local matches live:** `index.html` and `custom.css` equal the served files apart from CRLF (git
  `autocrlf`), and `AaronGrad.jpeg` is byte-identical. Local and live top shots differ only inside the
  hero photo: max channel difference 1/255 on desktop, 8/255 on the phone.
- **Pixel noise. For P2:** two runs of an untouched tree gave AE 0 on 19 of 20 shots. `phone-top`
  gave **AE 0.0065**, with a max channel difference of 1/255, all inside the hero photo, and one
  `openPage` run gave `desktop-top` 0.0052 the same way. ImageMagick 7.1.2 prints AE as a fraction.
  An AE below 1 on a top shot is therefore hero raster noise. To show that, run
  `magick compare -metric AE -fuzz 1% …`, which reads it as 0. A real CSS change scores in the
  hundreds or more.
- **The phone pane bug, confirmed:** every settled phone shot shows the collapsed pane's 14px tab on
  the right edge. `tools/shots/baseline/phone-pane-open.png` was taken 300 ms after a scroll through
  `openPage`, and shows the pane open over the page: 210px wide, left edge at x=180 of 390,
  `display: flex`, class `expanded`.
- **For P9:** "the subtitle runs off the right edge" did **not** reproduce. Under mobile emulation at
  390px the subtitle wraps to two lines and scrollWidth stays 390. The harness renders in Segoe UI
  (Windows) where the iPhone uses SF Pro, so line breaks differ until P3 brings Inter; the measured
  overflow is 0. Confirmed from the top shot: the name and subtitle sit over the stole and tie, and
  the white film flattens their contrast.
- **For P3 (and P12):** in the **light** scheme, which is the iPhone default (rule 7), every section
  heading (`#about .title`, `#skills .title`, …) computes to `rgb(46, 51, 61)` on the dark boxes. They
  are near-invisible in `phone-about.png` and `phone-skills.png`, and on desktop the same way. Under
  `--dark` they compute to `rgb(235, 236, 240)`. Bulma's light theme is colouring them, and "What
  research found" missed it. P3's heading rules should set the colour explicitly from a token. P2
  cannot, because P2 must render identically.
- **For P6:** the burger computes `rgb(66, 88, 255)` (Bulma's link blue) in both schemes. In the light
  phone top shot it shows as thin blue bars against the white sky.
- **For P11:** the local server serves the whole repo root, `tools/` included, so
  `tools/node_modules/…` is reachable at `/tools/…` locally. The live site excludes `tools/`.

### P2 (2026-10-19)

- **`custom.css` rewritten** (601 → 615 lines, the `:root` block being most of the growth): tokens, base,
  hero, hero nav, side nav, boxes and tags, experience, competitions, utilities, then every media query.
  A script that walked the top-level rules counted 80 selectors outside media queries, each declared once.
  No `!important` remains. The FIX PATCH, the legacy no-op and the empty
  `.experience-card.alt-right .experience-layout {}` are gone.
- **Desktop renders identically.** In light, every desktop shot gives AE 0 against `baseline` except
  `desktop-top`, which gives 0.0052: the hero raster noise P1 measured, and `-fuzz 1%` reads it as 0.
  In dark (`--dark --device desktop` against `baseline-dark`), all 10 shots give AE 0.
- **Phone: no side pane.** At 390px `.side-nav-wrapper` computes `display: none`, and still does after
  a scroll flips its class to `expanded`. The phone shots differ from baseline (AE 2,000–20,000), across
  the tab and also as text anti-aliasing all over the page: taking away the fixed, backdrop-filtered
  pane changes compositing. That the pane is the *only* change was shown by forcing it back:
  injecting `.side-nav-wrapper{display:flex!important}` reproduced baseline `phone-top`, `-about` and
  `-skills` at AE 0 under `-fuzz 1%`, and `-experience` to within a max channel difference of 5/255.
- **For P9:** the phone scrollWidth is **390 of 390** at every shot, and also after a scroll with the
  pane hidden. That is the same as baseline, so hiding the pane had no overflow to fix. As P1 found,
  the off-edge subtitle needs looking for on the real iPhone or after P3's Inter, not in this harness.
- **Departures from "carry over the winning value"**, none of them visible on desktop:
  (1) `-webkit-backdrop-filter: brightness(1.05)` was added beside the hero film's `backdrop-filter`
  (rule 6), so Safari now brightens the photo 5% under the film, as Chromium always did;
  (2) the hero nav's radii (46px pill, 28px links) are `--radius-pill: 999px`, which draws the same
  because a radius is clamped to half the height (AE 0 confirms);
  (3) the standalone `.hero-menu-desktop { position: relative }` merged into the hero's lift group,
  since that element is always inside the hero;
  (4) `.side-nav-wrapper.expanded .side-nav { padding-right: 0 }` was dropped, because the panel's
  right padding is now 0 in both states. `.side-nav`'s old `top`/`right`/`transform`, which
  `!important` used to neutralise, are now simply unset.
- **Tokens keep exact values**, so some near-duplicates sit side by side: `--color-text-nav` `#d2d2d5`
  against `--color-text-side-nav` `#d2d2d6`, `--white-05` against `--white-06` (hero-nav hover vs
  side-nav hover), and `--white-14` against `--white-15` (open `comp-details` vs `notable-projects`
  border). **For P10:** candidates to unify.
- **For P3:** `--font-sans` is defined but **not applied**. It is Bulma 1.0.4's own
  `--bulma-family-primary`, and that stack **already starts with `Inter`**, so loading an `Inter`
  webfont may change every Bulma-styled element before any rule here names it. Note also that on
  the hero `h1`, `.hero.hero-banner h1`'s text-shadow out-specifies `.font-outline`'s, so only the
  outline's stroke shows there.
- **For P6:** `.hero.hero-banner .navbar` (specificity 0,3,0, the rule lifting hero content above the
  film) beats Bulma's `.navbar.is-fixed-top` (0,2,0). The phone navbar therefore computes
  `position: relative` and scrolls away with the hero, so it is **not fixed**. P2 kept that. A menu
  that stays reachable needs that group to stop matching the navbar.
- **For P7 and P8:** the `.side-nav::after` "indicator strip" never shows. It sits right of the
  panel, which ends at or past the viewport's right edge in both states, and the panel's
  `overflow: hidden` clips it anyway. The collapsed "tab" is the panel's own left 14px plus its
  shadow (the phone diff at the tab is ~29 CSS px wide because of the shadow). The CSS comment says so.

### P3 (2026-10-19)

- **Inter is loaded and drawn.** `index.html`'s `<head>` preconnects to `fonts.googleapis.com` and
  `fonts.gstatic.com` and loads `Inter:wght@400;500;600;700&display=swap`, before Bulma. `custom.css`
  sets `--bulma-family-primary` and `--bulma-family-secondary` to `--font-sans` and the body
  `line-height` to 1.6 (`--bulma-body-line-height`). In both devices and both schemes every probed
  element computes to `Inter`, the four weights load, and CDP's `CSS.getPlatformFontsForNode` reports
  the text **drawn in `Inter (web)`**. Before P3 the same text was drawn in Segoe UI and Segoe UI Black.
- **`document.fonts.check` proves nothing here.** It read `true` before P3 too, and it reads `true` for
  `'16px NoSuchFamilyAtAll'`. Computed `font-family` is also `Inter` before P3, because Bulma's stack
  starts with it. The proof is the platform font. `tools/checks/P3.mjs` (new; the contract's place for
  a phase check) prints all three: `node tools/checks/P3.mjs`.
- **The scale** (`--text-title-*`, `clamp()`, px at 390 → 1440): `.title.is-3` 24 → 30 (was 32),
  `.title.is-4` 20 → 22 (was 24), `.title.is-5` 17 → 18 (was 20), hero subtitle 19 → 22 at weight 500
  (was 24 at 400). Titles are weight 700 (Bulma's was 800), `line-height` 1.2, letter-spacing −0.02em.
  The hero h1 stays 32/40/48px, at 700 now, because its markup's `is-size-*` helpers are `!important`.
  **For P9:** dropping those helper classes from the h1 is how to put it on a `clamp()`.
- **P1's light-scheme headings are fixed, with `<strong>` too.** In light, every `.title` and every
  `<strong>` (the Contact and Education labels, the `Notable Projects` summaries) computed
  `rgb(46, 51, 61)` on the dark boxes. They now take the new token `--color-heading: #ebecf0`, which is
  exactly what Bulma's dark scheme already gave them, so the dark scheme is unchanged. **For P12:**
  rule 7's check for other Bulma light-theme text is still worth one pass. This fixes only titles and
  `strong`.
- **Inter broke the outlined hero name, and P3 fixed it.** Google serves Inter as a variable font, and
  its glyphs overlap their own contours. `.font-outline`'s `-webkit-text-stroke` painted over the fill
  drew those overlaps as lines through the A's crossbar and the e's bar. Now the stroke is 2px with
  `paint-order: stroke fill`, so the fill covers the inner half and the visible outline is the 1px it
  was. Checked in Edge only. **For P9:** confirm on the iPhone that Safari honours `paint-order` on
  HTML text. If it does not, the name shows the lines again with a 2px stroke. The fallback is to drop
  the stroke and keep the text-shadow.
- **Fallback stack:** `--font-sans` now goes `Inter, -apple-system, BlinkMacSystemFont, system-ui,
  "Segoe UI", …`. Bulma's `"SF Pro"` is not a name Safari exposes, so before P3 the iPhone drew the
  site in Helvetica Neue. During `swap`, or if Google Fonts fails, it now draws San Francisco.
- **No overflow:** scrollWidth is 390 of 390 and 1440 of 1440 at every shot. At 1024 wide, the
  narrowest that shows it, the hero nav pill is 926px, so Inter's wider caps still fit on one row.
  The only error is still the favicon 404.
- **The page got taller:** full shots are phone 390×13484 (baseline 13229) and desktop 1440×8444
  (8215), from the 1.6 line-height. **For P4 onward:** pixel diffs of anything with text now go against
  `tools/shots/p3/`, not `baseline`. Against baseline, `-fuzz 1%` AE is ~6,300 on `desktop-top` and
  ~30,000 on `phone-top`.
- **For P9:** at 19px/500 Inter the phone subtitle still wraps ("… • Cybersecurity / Focus") over the
  stole and tie, with the white film's low contrast. The overflow is still 0.
- **For P10:** the experience and competition tags are Bulma's default 12px, while Skills uses
  `are-medium` (16px). `.notable-projects ul` and `.comp-details ul` keep `line-height: 1.35` at
  .9/.85rem, tighter than the body's 1.6. Both are candidates for the card polish.

### P4 (2026-10-19)

- **Resumed.** The first attempt made every copy and edit, then stopped BLOCKED on the phone hero.
  This session applied the owner's answer, re-ran the verify, and committed. Everything the first
  attempt left in the tree was P4's and was kept, apart from `hero-900.jpg`.
- **The phone hero gets `hero-1920.jpg` too (the owner's call, 2026-10-19).** The plan's 900px copy
  at ≤768px was visibly blurry. On a portrait phone, `background-size: cover` with a 4:3 photo fits
  the photo's **height**, so a 390×844 hero draws it 844 CSS px tall, which is 2,532 device px at 3×.
  `hero-900.jpg` has 676 rows (stretched 3.75×), `hero-1920.jpg` has 1,442 (1.76×), and the original
  has 3,448. In a face crop of the phone top shot, the original was sharp, 1920 slightly soft and 900
  plainly soft. The other options were 900 (the plan as written) and a portrait phone crop. So the
  768px query is back to its P3 form (`background-attachment: scroll` only), and the hero rule's
  comment says why. `hero-900.jpg` was a new file, never committed, and it is deleted.
- **Bytes** (`-auto-orient -strip -resize <w>x -quality 78`; the originals stay on disk, rule 5):

  | Original | Bytes | Copy | Bytes | Pixels |
  |---|---:|---|---:|---|
  | `AaronGrad.jpeg` (hero) | 2,136,850 | `images/hero-1920.jpg` | 386,653 | 1920×1442 |
  | `images/Aaron_and_karina.jpg` | 9,115,839 | `images/aaron-karina-800.jpg` | 148,396 | 800×1067 |
  | `CompTIASecurityPlus-1.jpg` | 449,729 | `images/security-plus-840.jpg` | 57,614 | 840×649 |
  | `images/oso_esports.jpg` | 394,998 | `images/oso-esports-280.jpg` | 26,990 | 280×333 |
  | `images/swccdc.png` | 231,706 | `images/swccdc-280.webp` | 15,622 | 280×220 |
  | **the five** | **12,329,122** | | **635,275** | **−94.8%** |

- **Page image weight** (`node tools/checks/P4.mjs`, own-origin images; the "before" is the P3 site
  measured live with `--base https://www.aaron-sierra.com`). Phone and desktop now load the same
  images:

  | | Before (P3, live) | After (P4) | Change |
  |---|---:|---:|---:|
  | Whole page, scrolled to the bottom | 13,185 KB | 1,765.6 KB | **−86.6%** |
  | First load | 12,452 KB | 522.5 KB | **−95.8%** |

  The first load on both devices is the hero plus the About photo, because Chromium's lazy threshold
  reaches the About box from the top. `Resume-1.jpg` (1,023 KB, now lazy) is 58% of what remains.
- **Lazy loading:** every `<img>` below the fold has `loading="lazy"` with `width`/`height`: the About
  photo, the TryHackMe badge (external, 249×58), Security+ and `Resume-1.jpg`. The experience and
  competition logos, which the inline script renders, already had both. `P4.mjs` lists every `<img>`
  as loaded, lazy, and sized, on both devices.
- **EXIF:** no original carried GPS. `AaronGrad.jpeg` carried camera EXIF (Panasonic DMC-G7, lens,
  capture dates, a serial-like string), XMP, IPTC and an sRGB ICC profile, and `-strip` drops them all
  (sRGB is what browsers assume anyway). `Aaron_and_karina.jpg` (q100) carried no metadata at all.
  `magick identify` finds no EXIF in any of the five copies.
- **swccdc:** chose lossy WebP (15.6 KB) over a full-alpha PNG (51 KB) and a PNG8 (15 KB), because
  the PNG8 lost the alpha anti-aliasing round the badge's rim. `hivestorm.webp` was already WebP.
- **Shots** (`p4` against `p3`, `-fuzz 1%` AE): `desktop-resume` is 0. The other desktop shots are
  1,100 to 5,800, and the phone shots 3,000 to 72,000. I read `phone-top`, `phone-certifications` and
  `phone-resume` beside their `p3` versions, and they look the same. The phone top shows the 1920
  copy with no visible softening at that scale. Two causes account for the AE. The hero's
  recompression moves pixels in the top shots. Below About, there is a **sub-pixel layout shift**,
  not a content change. The copies' rounded aspect ratios make the About photo 480.14 CSS px tall
  instead of 480, and the Security+ image 324.5 instead of 324.44. So everything below them sits
  0.14–0.2 px lower (measured through `openPage`, live against local), and whole-pixel shift tests
  cannot cancel it.
- **No overflow and no 404s from P4:** scrollWidth is 390 of 390 and 1440 of 1440. `P4.mjs` sees 0
  failed requests on both devices. `shoot.mjs` reports the same single favicon 404 that P1 recorded,
  which predates the revamp and is no image.
- **For P9:** the phone hero draws `hero-1920.jpg` 1.76× upscaled at full height. A shorter hero
  (D11) makes it **sharper**, not softer: at about 70svh, `cover` is still height-limited and the
  stretch drops to about 1.2×. If P9 wants more, the third option was a portrait phone crop
  (`hero-phone-*.jpg`, new name, rule 5) behind a media query. The empty `<figure class="hero-avatar">`
  (`index.html:70`) still holds a commented-out `AaronGrad.jpeg` `<img>`; it loads nothing.
- **For P11:** `Resume-1.jpg` is now `loading="lazy" width="2550" height="3300"`. It is the largest
  image left on the page, and removing it (D4) takes the whole page to about 742 KB.
- **For P12:** the originals that are now unreferenced by `index.html` and `custom.css` are
  `AaronGrad.jpeg`, `images/Aaron_and_karina.jpg`, `CompTIASecurityPlus-1.jpg`,
  `images/oso_esports.jpg` and `images/swccdc.png`. Check `showcase.html` before calling any of them
  deletable. `Resume-1.jpg` joins them after P11.

### P5 (2026-10-19)

- **What changed.** `background-attachment: fixed` is gone from the hero, and so is the 768px query
  that undid it on phones. Every `.box` now rests in `--shadow-card`, the old resting glow, so the
  page looks the same at rest. `hover-glow` stays only on the 7 leadership cards: they lift 2px (was
  3px, `--lift-card`) and keep the old glow (`--shadow-card-hover`). `index.html` changed only
  classes: 9 `hover-glow`s came off, 7 of them in markup and 2 in the experience and competition
  templates. Every `:hover` rule now lives in one `@media (hover: hover) and (pointer: fine)` block,
  kept in its old order. A `prefers-reduced-motion: reduce` block, last in the file, sets
  `transition`, `animation` and `scroll-behavior` off on everything, and stops a leadership card's
  lift (it still glows). That block holds the file's only `!important`. Its comment explains why:
  it has to beat Bulma's transitions as well as the site's own.
- **Beyond the step list: the logo images no longer move under the cursor.** The experience and
  competition logos used to lift 4px and scale 1.03 or 1.04 with a purple glow on hover. They are
  not links. D9 allows lift and glow on the small cards only, and the Goal is "the page stops moving
  under the cursor", so both hovers are gone, with their transitions and the two
  `--shadow-media-hover*` tokens.
- **The cascade, for whoever adds a hover next.** `a:hover` used to come *before* the nav rules, so
  `.side-nav a`'s `text-decoration: none` and the two navs' active styles beat it. In the foot block
  it comes after them. So the block restates two things: `.side-nav a:hover { text-decoration: none }`,
  and `:not(.is-active)` / `:not(.active)` on the nav hovers, so an active link keeps its gradient
  under the cursor. `node tools/checks/P5.mjs --json before.json` on the untouched tree, and
  `--against before.json` after, showed **7 hover probes identical**: a contact link, `.comp-link`,
  a tag, a hero-nav link (plain and active) and a side-nav link (plain and active). The only probes
  that differ are the 19 big boxes (no lift, no hover glow), the 7 leadership cards (lift −3 → −2)
  and the 2 logos.
- **Done criteria** (`node tools/checks/P5.mjs`, 14 PASS lines). On desktop, the hover query
  matches. Hovering any of the 19 big boxes leaves `transform: none`, and hovering a leadership card
  gives `matrix(1, 0, 0, 1, 0, -2)`. No element (or its `::before`/`::after`) computes a fixed
  background, and neither file contains the string. On the phone the hover query does not match,
  and tapping any of the 26 boxes, or either logo, leaves `transform: none`. Before P5 every one of
  those taps left the box stuck at −3px. Under reduced motion, the side pane, its dots, the hero nav,
  the cards and `<details>` all compute `0s`. `html` stays `auto` even when a
  `scroll-behavior: smooth` is injected, which is P6's rule, simulated.
- **Shots** (`p5` against `p4`): **19 of 20 give AE 0**, `phone-top` and `desktop-top` included.
  At scroll 0 the hero fills the viewport, so a fixed and a scrolling background draw the same.
  `desktop-about` gives 31,594 px, and that is the parallax itself. The 70px scroll margin shows the
  hero's foot above `#about`. Fixed, that strip showed the photo's sky. Now it shows the photo's own
  bottom edge (grass), and the nav pill's backdrop blur changes with it. scrollWidth is 390 of 390
  and 1440 of 1440, and the favicon 404 is the only error.
- **For P6:** `html` computes `scroll-behavior: auto` today; neither Bulma nor this file sets it.
  P1's "reads true" means the harness's freeze leaves it truthful. The reduced-motion block already forces `auto` on every
  element, so P6's `html { scroll-behavior: smooth }` needs no reduced-motion twin. **But the two
  scripted scrolls ignore it.** `scrollIntoView({ behavior:'smooth' })` sits at `index.html:615`
  (hero nav) and `:682` (side nav). A call that names `'smooth'` overrides CSS. Edge does not honour
  emulated reduced motion for it either: under `reduce`, a hero-nav click had scrolled 45 of 1,867 px
  after 60 ms. Dropping the `behavior` option (it defaults to `'auto'`, which follows CSS) lets the
  new `html` rule and the reduced-motion block decide for both calls. P5's Files allowed it no script
  change. P6 owns `index.html`'s script.
- **For P7:** the rail's tap-to-scroll should likewise call `scrollIntoView` with no `behavior` and
  let CSS decide. The label pill's and the rail's fade transitions need nothing extra for reduced
  motion, because the foot block turns them off. Any hover the rail gets belongs in the hover
  block, though on the phone it never matches.
- **For P8:** under reduced motion the desktop pane still pops out and tucks away, but it jumps
  instead of sliding. `P8.mjs` runs with `liveMotion` and no `reducedMotion`, so its timings are
  unaffected.
- **For P10:** the hero-nav links still underline on hover. That predates P5: the base `a:hover`
  underline reaches them, and `.hero-nav a` never resets it, while the active link draws its own
  gradient underline. The resting card shadow is one token, `--shadow-card`, a 5px white glow kept
  so P5 changed no resting pixel. "Softer cards" (D3) can change it there for all 26 boxes. The
  leadership hover glow (`--shadow-card-hover`, 18px at 0.7 alpha) was kept as it was.
- **For P12:** new hover rules go in the foot hover block, and the reduced-motion block stays last.
  `tools/checks/P5.mjs` re-runs in about a minute and catches a stuck tap on the phone.

### P6 (2026-10-19)

- **The bar is fixed now.** `.hero.hero-banner .navbar` left the hero's lift group, so Bulma's
  `.navbar.is-fixed-top` applies (`position: fixed`, z-index 30). Before, the burger had scrolled to
  y = −2718 after a jump to Skills. The full-width 52px strip is `pointer-events: none`, and only the
  burger and the open menu take taps, so the strip blocks nothing under it.
- **The burger** is a `<button type="button" aria-controls="mobile-nav">`, so a keyboard can open it.
  It was an `<a role="button">` with no `href`, which could not take focus. It also has **four
  spans**. Bulma 1.0's burger draws its three bars and its X from four. With the old three, spans 1
  and 2 overlapped, so it showed **two** bars, in Bulma's link blue `rgb(66, 88, 255)`, at 40px. Now
  it has white bars on the hero nav's dark glass (`--glass-pill`, `--blur-pill` with the `-webkit-`
  twin, `--white-14` border, `--shadow-pill`). It is 44×44 at x 334–378, y 4–48 (CSS px at 390
  wide), and plainly visible on the sky in `p6/phone-top.png` and on the page in every section shot.
  Its tap highlight is off, because Chromium drew it as a light-blue square over the round pill.
- **The open menu** is a dark card under the burger, right-aligned, `min(16rem, 100% − 1.5rem)`
  wide, on a new token, `--glass-menu` (0.94 → 0.88 alpha, near opaque because it opens over the
  sky). Its rows are 44.8px tall and `--color-text-nav`. Every colour is set outright. **Before**, in
  the light scheme (rule 7), it was a full-width white sheet (`rgb(255, 255, 255)`) under links
  coloured `rgb(243, 244, 246)` by `.hero.is-dark .navbar`, so the links were near-invisible. The
  "before" shot is `tools/shots/p6-before/phone-menu-open-light.png`. Bulma's light-scheme hover and
  focus fill on `a.navbar-item` is near white, and `background: none` on the rows keeps it away.
  Light and dark now draw the same menu.
- **Closing.** Before, `aria-expanded` never left `"false"`, and nothing closed the menu but the
  burger. Now `setMenu(open)` keeps both `is-active` classes and `aria-expanded` together. A link
  tap closes the menu, and the link's own jump scrolls. A tap outside closes it on **`pointerdown`,
  not `click`**, because iOS Safari sends no click for a tap on a plain element, so a delegated
  click listener would never hear it. Esc closes the menu and focuses the burger.
- **Smooth scroll.** `html { scroll-behavior: smooth }` is in Base. Both `scrollIntoView` calls
  (hero nav, side pane) dropped `behavior: 'smooth'`, as P5 asked, so CSS decides for them too. The
  reduced-motion block's comment now says so. The menu's links use native anchor jumps and set the
  URL hash. The two navs' scripted scrolls still `preventDefault` and set no hash.
- **Done criteria:** `node tools/checks/P6.mjs` (new) gives **45 PASS, 0 FAIL**, on the untouched
  tree 12 PASS / 27 FAIL. It covers light and dark: the burger is drawn and in reach, tapping it
  opens the menu (shot taken), and tapping "Skills" closes it with `aria-expanded="false"`, `#skills`
  landing at **70px**, through **194 intermediate frames** (0 → 2724). It also checks the burger
  after the scroll, an outside tap, Esc, and Enter. Under reduced motion "Skills" jumps (0 frames
  between). On desktop the bar is `display: none`, and the hero nav and the side pane land at 70px,
  smoothly (157 and 172 frames), and jump under reduced motion. Before, those two still
  smooth-scrolled under `reduce`; P5's own probe now reads 1867 / 1867 at 60ms, where it read 45.
  The check tells smooth from a jump by recording `scrollY` every animation frame, because one
  sample straight after the tap catches a smooth scroll before it starts.
- **Regressions:** `node tools/checks/P5.mjs` still gives 14 passed, 0 failed. Desktop `p6` against
  `p5` gives AE 0 on 6 shots, and on the other 4 (`top`, `about`, `resume`, `full`) under 0.006, which
  `-fuzz 1%` reads as 0. So desktop is unchanged. The phone shots differ (`-fuzz 1%` AE 1,657 to
  44,050), because the burger now rides on every one, and in `top` because of the hero shift below.
  scrollWidth is 390 of 390 and 1440 of 1440. The favicon 404 is the only error.
- **For P7:** the fixed burger owns the top-right corner: 44×44 at x 334–378, y 4–48, z-index 30
  (Bulma's `--bulma-navbar-fixed-z`, under the side pane's 60). Keep the rail clear of the top ~56px,
  or centre it vertically as the pane is. A touch on a rail dot is outside the bar, so it closes an
  open menu (`pointerdown`), which seems right. The dot's scroll should be a bare `scrollIntoView()`,
  as both navs' now are.
- **For P9:** the bar left the hero's flex column, so the hero body gained 52px and its centred
  text moved **up 26px** (h1 top 408 → 382, subtitle 455 → 429, at 390×844). Over the stole it
  still is. The burger pill sits over the sky at the top right. A shorter hero does not move it.
- **For P10 or P12 (rule 7, found in passing):** `body`'s `has-background-dark` is Bulma's
  `!important` helper, so the page computes `rgb(46, 51, 61)` in **both** schemes, never
  `--color-bg: #111`. In light, `html` computes white, which is what an iPhone's rubber-band
  overscroll past the page's ends would show. Neither is P6's to change.
- **For P12:** `tools/checks/P6.mjs` re-runs in about two minutes. It writes the open-menu shots to
  `tools/shots/p6-check/` and takes `--base` for the live site.
