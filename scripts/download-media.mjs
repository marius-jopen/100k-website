/**
 * One-off: pulls every image referenced by the media collection out of the
 * Bunny pull zone and into `public/media`, so Keystatic can manage them as real
 * files instead of pointer entries.
 *
 * Videos are skipped — they live in Bunny Stream and are played from their HLS
 * playlist, never served as files.
 *
 *   node scripts/download-media.mjs
 */
import { mkdir, readFile, readdir, writeFile, stat } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const contentDir = path.join(root, "content", "media");
const outputRoot = path.join(root, "public");

// Matches PUBLIC_IMAGE_CDN_URL / PUBLIC_IMAGE_CDN_PREFIX in .env: the pull zone
// still fronts the old WordPress upload tree.
const CDN = "https://100k-website.b-cdn.net";
const PREFIX = "/wp-content/uploads";
const CONCURRENCY = 8;

const remoteUrl = (src) => `${CDN}${PREFIX}${src.replace(/^\/?media\//, "/")}`;

async function exists(file) {
  try {
    await stat(file);
    return true;
  } catch {
    return false;
  }
}

async function download({ src }) {
  const destination = path.join(outputRoot, src);

  if (await exists(destination)) return { src, status: "skipped" };

  const response = await fetch(remoteUrl(src));
  if (!response.ok) return { src, status: "failed", detail: `HTTP ${response.status}` };

  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, Buffer.from(await response.arrayBuffer()));
  return { src, status: "downloaded" };
}

const files = (await readdir(contentDir)).filter((name) => name.endsWith(".json"));
const images = [];

for (const name of files) {
  const entry = JSON.parse(await readFile(path.join(contentDir, name), "utf8"));
  // A Bunny Stream id means the asset is a video, whatever its extension says.
  if (entry.bunnyVideoId) continue;
  if (entry.src) images.push({ src: entry.src });
}

console.log(`${images.length} images to fetch\n`);

const results = [];
let cursor = 0;

await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    while (cursor < images.length) {
      const image = images[cursor++];
      try {
        const result = await download(image);
        results.push(result);
        if (result.status === "failed") console.log(`  FAILED ${result.src} — ${result.detail}`);
      } catch (error) {
        results.push({ src: image.src, status: "failed", detail: error.message });
        console.log(`  FAILED ${image.src} — ${error.message}`);
      }
      if (results.length % 25 === 0) console.log(`  ${results.length}/${images.length}`);
    }
  }),
);

const tally = results.reduce((counts, { status }) => {
  counts[status] = (counts[status] ?? 0) + 1;
  return counts;
}, {});

console.log("\ndone:", tally);
if (tally.failed) process.exitCode = 1;
