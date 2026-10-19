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
| **P2** | Consolidate `custom.css` into one clean file with design tokens | ⬜ |
| **P3** | Typography: Inter and a tighter type scale | ⬜ |
| **P4** | Optimise the images | ⬜ |
| **P5** | Calmer motion: no parallax, hover only where it helps | ⬜ |
| **P6** | The phone menu: visible, closes on tap, smooth scroll | ⬜ |
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
