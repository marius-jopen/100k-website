#!/usr/bin/env node
/**
 * Drops video files from the built output.
 *
 * `public/media` is the full media tree, and its images still have to reach the
 * server so the Bunny pull zone has something to pull. The videos do not — they
 * are served from Bunny Stream — and they are roughly 80% of the bytes.
 *
 * Only ever touches dist/, never public/.
 */
import { readdirSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mediaDir = path.join(projectRoot, "dist", "media");

const VIDEO_EXTENSIONS = new Set([".mp4", ".mov", ".webm", ".m4v"]);

let removed = 0;
let bytes = 0;

function walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const full = path.join(dir, entry.name);

    // Refuse to follow a symlink out of dist/ — deleting through one would
    // delete the source media.
    if (entry.isSymbolicLink()) continue;

    if (entry.isDirectory()) {
      walk(full);
    } else if (VIDEO_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      bytes += statSync(full).size;
      rmSync(full);
      removed += 1;
    }
  }
}

walk(mediaDir);

console.log(
  `Pruned ${removed} video file(s) from dist/media (${(bytes / 1024 ** 2).toFixed(0)} MB). ` +
    `They are served from Bunny Stream.`,
);
