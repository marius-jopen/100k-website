# 100k Studio — Website

The 100k Studio website, rebuilt on **Astro + Keystatic** with all media served
from **Bunny CDN**. The rendered site is byte-for-byte the same as the previous
build apart from the media URLs — same markup, same CSS, same legacy WebGL and
animation JavaScript.

## One setting to change in Bunny before images work

The `100k-website` pull zone currently has its origin set to
`http://100k.studio` **without** *Follow redirects*. The origin answers every
`http://` request with a `301` to `https://`, so the zone caches the redirect
instead of the file:

```
GET https://100k-website.b-cdn.net/wp-content/uploads/2023/09/Group-1-1.jpg
→ 301 https://100k.studio/wp-content/uploads/2023/09/Group-1-1.jpg
```

Fix it in the Bunny dashboard, either way works:

- set **Origin URL** to `https://100k.studio`, or
- enable **Follow redirects** on the pull zone.

Videos are unaffected — they come from Bunny Stream, not this pull zone, and are
verified working.

To work without the CDN in the meantime, set `PUBLIC_IMAGE_CDN_URL=` (empty) in
`.env` and images are served from `public/media`.

## Getting started

```bash
npm install
cp .env.example .env
npm run dev
```

- Website: http://127.0.0.1:4321/
- Keystatic admin: http://127.0.0.1:4321/keystatic/

`public/media` is a symlink to the media tree in the old project. It is only
needed for offline work and for the pull zone's first fetch after deployment; it
is not committed.

## Content

Keystatic runs in **local mode** — it edits JSON files on disk, no login, no
GitHub connection. Everything lives in `content/`:

| Path                    | What it is                                          |
| ----------------------- | --------------------------------------------------- |
| `content/site.json`     | Homepage copy, client logos, services, footer, contact |
| `content/projects/*.json` | One file per project, including the grid layout    |
| `content/media/*.json`  | Media library: one entry per image or video         |

Projects and the homepage never store a file path directly. They reference a
media entry by slug, so an asset's dimensions, alt text and Bunny video id are
defined once and reused everywhere.

The schema lives in `keystatic.config.ts`.

## Media

### Images

Served through the Bunny pull zone. `imageUrl()` in `src/lib/media.ts` turns
`/media/2025/08/tede-0.webp` into
`https://100k-website.b-cdn.net<prefix>/2025/08/tede-0.webp`.

`PUBLIC_IMAGE_CDN_PREFIX` follows whatever the origin serves:

- `/wp-content/uploads` while `100k.studio` is still the WordPress site
- `/media` once this site is deployed as the origin

### Videos

No video files are shipped. All 181 clips live in Bunny Stream library `723058`
and play from their adaptive HLS playlist:

```
https://vz-a22b3102-67f.b-cdn.net/<video-id>/playlist.m3u8
```

`src/scripts/bunny-hls.ts` attaches playback to every `<video data-hls>`:

1. Safari and iOS play the playlist natively.
2. Everything else lazy-loads `hls.js` — only downloaded when a video is
   actually attached, never on the initial page load.
3. If both fail, it falls back to the progressive `play_720p.mp4` rendition.

Desktop and phone project backgrounds are marked `data-hls-defer`, so only the
set belonging to the current breakpoint ever loads.

The video library is a hard requirement: the library blocks requests with no
`Referer` header, which is fine from a browser but means direct `curl` without
one returns `403`.

## Scripts

| Command              | What it does                                                |
| -------------------- | ----------------------------------------------------------- |
| `npm run dev`        | Dev server with the Keystatic admin mounted                  |
| `npm run build`      | Build with the admin included (needs a Node server to serve) |
| `npm run build:static` | Plain static bundle in `dist/`, no server, no admin        |
| `npm run sync:bunny` | Refresh `scripts/bunny-videos.json` from the Stream API      |
| `npm run migrate`    | Re-import `../content` into the Keystatic collections        |

`build:static` is the one to deploy to a plain web host, next to `contact.php`.

### Re-running the migration

`npm run migrate` is a pure function of `../content` and
`scripts/bunny-videos.json`, so it is safe to re-run — but it **overwrites**
`content/`, so any edits made in Keystatic since the last run are lost.

Videos are matched to their Bunny entry by SHA-256 of the local file, not by
name: thirteen filenames exist twice in the media tree with different contents
(the `2023/09` folder holds re-compressed copies of older clips), and matching by
name alone silently pairs them with the wrong video.

## Contact form

Unchanged: `public/contact.php` posts to SendGrid server-side. On the production
server set:

```
SENDGRID_API_KEY=...
SENDGRID_FROM_EMAIL=verified-sender@100k.studio
SENDGRID_TO_EMAIL=contact@100k.studio    # optional
```

## Known quirk carried over

`SiteShell.astro` references an undeclared `prefersReducedMotion` in its inline
script, which throws and leaves the service-card reveal animation inert. This
exists in the current live site too and was ported as-is rather than silently
changed. Declaring it is a one-line fix if the animation is wanted.
# 100k-website
