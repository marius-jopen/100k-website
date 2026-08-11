#!/usr/bin/env node
/**
 * SUPERSEDED — do not run against the current content.
 *
 * This performed the original one-off migration from the old file CMS into a
 * single `content/media` collection. That collection no longer exists: images
 * are now real files in `public/images` addressed directly by Keystatic's image
 * field, and only videos remain as entries (in `content/videos`, keyed by their
 * Bunny Stream GUID).
 *
 * Running this would rebuild the old shape and break every media reference.
 * Kept only as a record of how the WordPress export was mapped.
 */
if (!process.env.ALLOW_LEGACY_MIGRATION) {
  console.error(
    "scripts/migrate-content.mjs is superseded and would rebuild the removed\n"
    + "content/media collection. Set ALLOW_LEGACY_MIGRATION=1 only if you know\n"
    + "you want the pre-images-migration layout back.",
  );
  process.exit(1);
}

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const legacyRoot = path.resolve(projectRoot, "..", "content");
const contentRoot = path.join(projectRoot, "content");
const mediaRoot = path.resolve(projectRoot, "..", "site", "public", "media");

const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));
const writeJson = (file, value) =>
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);

const VIDEO_EXTENSIONS = /\.(mp4|mov|webm|m4v)$/i;

/* ------------------------------------------------------------------ bunny */

const { videos: bunnyVideos } = readJson(path.join(scriptDir, "bunny-videos.json"));

// Thirteen filenames exist twice in the media tree with different contents (the
// 2023 folder holds re-compressed copies), so the content hash is the primary
// key. The title is only a fallback for files that are not available locally.
const bunnyByHash = new Map();
const bunnyByTitle = new Map();
const ambiguousTitles = new Set();

for (const video of [...bunnyVideos].sort((a, b) => a.guid.localeCompare(b.guid))) {
  if (video.originalHash) bunnyByHash.set(video.originalHash.toLowerCase(), video);
  if (bunnyByTitle.has(video.title)) ambiguousTitles.add(video.title);
  else bunnyByTitle.set(video.title, video);
}

const hashCache = new Map();

function localFileHash(src) {
  if (hashCache.has(src)) return hashCache.get(src);

  const file = path.join(mediaRoot, src.replace(/^\/?media\//, ""));
  const hash = existsSync(file)
    ? createHash("sha256").update(readFileSync(file)).digest("hex")
    : null;

  hashCache.set(src, hash);
  return hash;
}

/** Resolves the Bunny Stream video for a media path, by content first. */
function findBunnyVideo(src, filename) {
  const hash = localFileHash(src);
  const byHash = hash ? bunnyByHash.get(hash) : null;
  if (byHash) return { video: byHash, matchedBy: "hash" };

  const byTitle = bunnyByTitle.get(filename);
  if (!byTitle) return { video: null, matchedBy: "none" };

  return {
    video: byTitle,
    matchedBy: ambiguousTitles.has(filename) ? "ambiguous-title" : "title",
  };
}

/* ------------------------------------------------------------- media slugs */

const usedSlugs = new Set();

function slugify(value) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "asset";
}

/** `/media/2025/08/tede-0.webp` → `2025-08-tede-0-webp` */
function mediaSlug(src) {
  const base = slugify(src.replace(/^\/?media\//, ""));
  if (!usedSlugs.has(base)) {
    usedSlugs.add(base);
    return base;
  }
  let counter = 2;
  while (usedSlugs.has(`${base}-${counter}`)) counter += 1;
  const slug = `${base}-${counter}`;
  usedSlugs.add(slug);
  return slug;
}

/* ----------------------------------------------------------- media library */

/** src → { slug, entry } */
const mediaBySrc = new Map();
const missingBunnyVideos = [];
const ambiguousMatches = [];

function registerAsset(asset) {
  if (!asset || typeof asset.src !== "string" || !asset.src) return null;

  const existing = mediaBySrc.get(asset.src);
  if (existing) {
    // Later occurrences sometimes carry an alt text the first one lacked.
    if (!existing.entry.alt && asset.alt) existing.entry.alt = asset.alt;
    return existing.slug;
  }

  const filename = asset.filename || asset.src.split("/").pop();
  const isVideo = VIDEO_EXTENSIONS.test(asset.src);
  let bunnyVideoId = null;

  if (isVideo) {
    const { video, matchedBy } = findBunnyVideo(asset.src, filename);
    if (video) {
      bunnyVideoId = video.guid;
      if (matchedBy === "ambiguous-title") ambiguousMatches.push(asset.src);
    } else {
      missingBunnyVideos.push(asset.src);
    }
  }

  const slug = mediaSlug(asset.src);
  const entry = {
    filename,
    src: asset.src,
    mimeType: asset.mimeType || (isVideo ? "video/mp4" : "application/octet-stream"),
    width: Number.isFinite(asset.width) ? asset.width : null,
    height: Number.isFinite(asset.height) ? asset.height : null,
    alt: asset.alt ?? "",
    bunnyVideoId,
    legacyId: Number.isFinite(asset.id) ? asset.id : null,
  };

  mediaBySrc.set(asset.src, { slug, entry });
  return slug;
}

/* -------------------------------------------------------------- migration */

const legacyProjects = readdirSync(path.join(legacyRoot, "projects"))
  .filter((file) => file.endsWith(".json"))
  .sort()
  .map((file) => ({ file, data: readJson(path.join(legacyRoot, "projects", file)) }));

const legacySite = readJson(path.join(legacyRoot, "site.json"));

// Register assets in a stable order so slug de-duplication is reproducible.
for (const asset of legacySite.clients ?? []) registerAsset(asset);
for (const service of legacySite.services ?? []) registerAsset(service.image);
for (const asset of legacySite.webglBackgrounds ?? []) registerAsset(asset);
registerAsset(legacySite.mobileLogo);

for (const { data } of legacyProjects) {
  registerAsset(data.featuredImage);
  registerAsset(data.desktopBackground);
  registerAsset(data.mobileBackground);
  for (const block of data.layout?.blocks ?? []) registerAsset(block.asset);
}

const refOf = (asset) => (asset?.src ? (mediaBySrc.get(asset.src)?.slug ?? null) : null);

/* ------------------------------------------------------------------ write */

rmSync(path.join(contentRoot, "media"), { recursive: true, force: true });
rmSync(path.join(contentRoot, "projects"), { recursive: true, force: true });
mkdirSync(path.join(contentRoot, "media"), { recursive: true });
mkdirSync(path.join(contentRoot, "projects"), { recursive: true });

for (const { slug, entry } of mediaBySrc.values()) {
  writeJson(path.join(contentRoot, "media", `${slug}.json`), entry);
}

for (const { file, data } of legacyProjects) {
  const slug = file.replace(/\.json$/, "");
  writeJson(path.join(contentRoot, "projects", `${slug}.json`), {
    title: data.title,
    displayTitle: data.displayTitle,
    shortDescription: data.shortDescription ?? "",
    description: data.description ?? "",
    externalUrl: data.externalUrl ?? "",
    order: data.order ?? 0,
    published: data.published !== false,
    featuredImage: refOf(data.featuredImage),
    desktopBackground: refOf(data.desktopBackground),
    mobileBackground: refOf(data.mobileBackground),
    credits: (data.credits ?? []).map((credit) => ({
      label: credit.label ?? "",
      value: credit.value ?? "",
    })),
    // Gutters, frame margins and the per-block spacing/playback flags are not
    // content — the stylesheet and the renderer own them.
    layout: {
      blocks: (data.layout?.blocks ?? []).map((block) => ({
        type: block.type,
        asset: refOf(block.asset),
        row: block.row ?? 0,
        column: block.column ?? 0,
        columnSpan: block.columnSpan ?? 12,
        caption: block.caption ?? "",
      })),
    },
    updatedAt: data.updatedAt ?? null,
  });
}

writeJson(path.join(contentRoot, "site.json"), {
  name: legacySite.name,
  clients: (legacySite.clients ?? []).map(refOf).filter(Boolean),
  servicesIntro: legacySite.servicesIntro ?? "",
  services: (legacySite.services ?? []).map((service) => ({
    title: service.title,
    services: service.services ?? [],
    image: refOf(service.image),
  })),
  webglBackgrounds: (legacySite.webglBackgrounds ?? []).map(refOf).filter(Boolean),
  mobileLogo: refOf(legacySite.mobileLogo),
  footer: {
    headline: legacySite.footer?.headline ?? "",
    body: legacySite.footer?.body ?? "",
    emailPrompt: legacySite.footer?.emailPrompt ?? "",
    legal: legacySite.footer?.legal ?? "",
  },
  contact: {
    endpoint: legacySite.contact?.endpoint ?? "/contact.php",
  },
});

/* ----------------------------------------------------------------- report */

const videoCount = [...mediaBySrc.values()].filter((m) => m.entry.bunnyVideoId).length;
console.log(`Projects:      ${legacyProjects.length}`);
console.log(`Media entries: ${mediaBySrc.size}`);
console.log(`Bunny videos:  ${videoCount} linked`);

if (ambiguousMatches.length) {
  console.warn(
    `\n${ambiguousMatches.length} video(s) matched by filename only — the local file was not\navailable to hash and the name exists more than once in the library:`,
  );
  for (const src of ambiguousMatches) console.warn(`  ${src}`);
}

if (missingBunnyVideos.length) {
  console.warn(`\n${missingBunnyVideos.length} video(s) missing from Bunny Stream:`);
  for (const src of missingBunnyVideos) console.warn(`  ${src}`);
  process.exitCode = 1;
}
