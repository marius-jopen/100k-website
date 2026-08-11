#!/usr/bin/env node
/**
 * Caches the Bunny Stream library listing to scripts/bunny-videos.json so the
 * content migration can run offline and produce identical output every time.
 *
 * Usage: BUNNY_STREAM_API_KEY=... npm run sync:bunny
 */
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));

const libraryId = process.env.BUNNY_STREAM_LIBRARY_ID ?? "723058";
const apiKey = process.env.BUNNY_STREAM_API_KEY;

if (!apiKey) {
  console.error(
    "Missing BUNNY_STREAM_API_KEY. Find it under Stream → your library → API.",
  );
  process.exit(1);
}

const response = await fetch(
  `https://video.bunnycdn.com/library/${libraryId}/videos?page=1&itemsPerPage=1000`,
  { headers: { AccessKey: apiKey, accept: "application/json" } },
);

if (!response.ok) {
  console.error(`Bunny API responded with ${response.status} ${response.statusText}`);
  process.exit(1);
}

const payload = await response.json();

// Only the fields the migration needs, sorted so the cache file has a stable diff.
const videos = payload.items
  .map((item) => ({
    guid: item.guid,
    title: item.title,
    // SHA-256 of the uploaded file. Thirteen clips share a filename across two
    // upload folders while having different contents, so the hash is what
    // actually identifies them.
    originalHash: item.originalHash ?? null,
    width: item.width,
    height: item.height,
    length: item.length,
    status: item.status,
    availableResolutions: item.availableResolutions,
    hasMP4Fallback: item.hasMP4Fallback,
  }))
  .sort((a, b) => a.title.localeCompare(b.title) || a.guid.localeCompare(b.guid));

writeFileSync(
  path.join(scriptDir, "bunny-videos.json"),
  `${JSON.stringify({ libraryId: Number(libraryId), videos }, null, 2)}\n`,
);

console.log(`Cached ${videos.length} videos from library ${libraryId}.`);
