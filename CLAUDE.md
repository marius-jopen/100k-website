# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

| Command                | What it does                                                        |
| ---------------------- | ------------------------------------------------------------------- |
| `npm run dev`          | Dev server on http://127.0.0.1:4321/, Keystatic admin at `/keystatic/` |
| `npm run build`        | Build with the admin included (Node adapter, needs a server to serve) |
| `npm run build:static` | `STATIC_EXPORT=1` — plain static `dist/`, no admin, no server. **This is what Vercel runs.** |
| `npm run sync:bunny`   | Refresh `scripts/bunny-videos.json` from the Bunny Stream API        |

There is no test suite and no linter. `npm run check` (`astro check`) prompts to install
`@astrojs/check` interactively — for a non-interactive type check use `npx tsc --noEmit`
(one pre-existing error: `process` in `src/lib/content.ts`, no `@types/node` installed).

`npm run migrate` is listed in `package.json` and the README, but `scripts/migrate-content.mjs`
is **superseded** — running it rebuilds a media collection that no longer exists and breaks
every media reference.

Verify UI work in a real browser. Playwright browsers are cached at
`~/Library/Caches/ms-playwright/`; `playwright-core` plus a static server over `dist/`
(`python3 -m http.server 4321 --directory dist`) is enough to drive the page.

## Architecture

### This is a WordPress theme port, not a greenfield Astro site

The rendered markup is deliberately identical to the previous Lay Theme/WordPress build.
`public/assets/legacy/app.js` (1 MB, minified, unbuildable) is still the application: it owns
the front-page↔project navigation (its own `pushState`/`popstate` with `{id, type}` state),
the list highlight, the WebGL logo and the balls canvas. Astro's job is to render the shell
and hand that bundle its data.

Consequences to respect:

- **All three routes render the same component.** `index.astro`, `tag/[tag].astro` and
  `[slug].astro` each render `SiteShell.astro` in full. A project page is the home page with
  `body.show-post` and `data-id`/`data-type` set by `BaseLayout.astro`; the legacy app opens
  the project client-side from there. So the project list, spotlight and footer exist on every
  page.
- **`passedData` is the contract.** `src/lib/content.ts` exports a `passedData` object that
  `BaseLayout` inlines as `window.passedData`, in the shape the legacy bundle expects —
  including `everything.projects[].grid`, which is **pre-rendered HTML** built by
  `renderProjectGrid()`. `data-ix` on a list item and on a background slide is an index into
  `passedData.everything.projects`; keep those indices aligned with the rendered order.
- **`passedData.url` is where the toolbar's Back button goes.** `project-filter.js` rewrites it
  so Back returns to the filtered URL instead of `/`.

### Enhancement scripts

`public/assets/*.js` are plain IIFEs loaded `is:inline` at the end of `SiteShell.astro`, after
`app.js`. They coordinate with the legacy bundle and each other through DOM classes and a few
globals (`window.alignProjectSpotlightToIndex`, `window.attachBunnyHlsTo`,
`window.upgradeBunnyHlsQuality`, the `projectfilterchange` event). Load order matters:
`project-filter.js` registers its capture-phase click handler before `project-page-transition.js`
registers its own.

Two landmines when touching the project list:

- The legacy scroll handler caches every `.project-list-item` **at startup** and reads their
  `getBoundingClientRect().top` against a 350px (270px on phones) line. Rows hidden with
  `display: none` measure 0 and poison it, which is why `project-filter.js` re-asserts the
  `.hover` row and the phone background on every scroll frame while a filter is active, and
  leaves the unfiltered list entirely to the legacy code.
- `project-spotlight.js` keeps two index spaces: a slide's position in the **full** project list
  (what `data-ix` and `passedData` use) and its rank among the rows a filter left visible
  (`activeIndices`/`activeRankByIndex`). Scroll position, stacking and prefetching work in the
  second; anything that touches a slide translates back through it.

### Content

Keystatic in local mode — it edits JSON on disk, no login. `keystatic.config.ts` is the schema;
`src/lib/content.ts` reads it through `@keystatic/core/reader` at build time and maps it onto
the interfaces in `src/lib/schema.ts`.

- `content/site.json` — homepage copy, services, footer, and `projectOrder`. That array is both
  the running order **and** the selection: a project missing from it does not appear on the site.
- `content/projects/*.json` — one file per project. Each carries a `tag` (category).
- Categories live in `src/lib/tags.ts` and nowhere else — the Keystatic select, the filter menu
  behind the "Selected Projects" heading, and the prerendered `/tag/<value>/` pages are all
  built from that list. Adding one is a single entry there.

### Media

`src/lib/media.ts` builds every media URL. Images are real files in `public/images` fronted by
the Bunny pull zone; videos are never files — a project stores a Bunny Stream GUID and
`src/scripts/bunny-hls.ts` (the only bundled TS module) attaches playback: native HLS on Safari,
lazy-loaded `hls.js` elsewhere, progressive MP4 as a last resort. Videos marked
`data-hls-defer="desktop|phone"` only load on their breakpoint; `data-hls-manual` means a script
attaches them by hand. Environment (`.env`) selects the pull zone and its origin prefix.

### CSS

`public/assets/static.css` is the current stylesheet and overrides the legacy `theme.css` /
`laygrid.css`, so `!important` and high-specificity `:is(...)` lists are normal here — check what
the legacy files already set before adding a rule. The breakpoint is 700/701px throughout. The
`data-lay-button-effect-text-slide="1"` markup pattern (sizer + clip + two text spans) is the
site-wide hover effect; its rules live in one `:is()` list that new buttons are added to.

## Conventions

Comments in this codebase explain **why**, usually the non-obvious constraint or the bug that
forced the shape — not what the line does. Match that register; the existing files are the
reference.
