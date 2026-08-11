/**
 * Keystatic namespaces a *collection* entry's image assets under the entry
 * slug: a `fields.image({ directory: "public/images", publicPath: "/images/" })`
 * inside the `projects` collection is resolved from
 * `public/images/<slug>/<filename>`, and its stored value is expected to be
 * `/images/<slug>/<filename>`. (Singletons are not slug-scoped, so the site
 * singleton keeps flat `/images/<filename>` values and is left untouched.)
 *
 * The content was migrated with flat `/images/<filename>` values, which the
 * collection editor cannot resolve — every project image showed an empty
 * "Choose file" instead of a thumbnail. This script rewrites each project's
 * image values to the slug-scoped form and copies the referenced files into
 * `public/images/<slug>/` so both the Keystatic editor and the site (which uses
 * the stored value directly as the URL) resolve the same file.
 *
 * Idempotent: values already scoped to their slug are skipped. Files are copied
 * (not moved) because the same image is referenced by several projects and by
 * the site singleton, which still needs the flat original.
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const projectsDir = path.join(projectRoot, "content", "projects");
const imagesDir = path.join(projectRoot, "public", "images");

const IMAGE_PREFIX = "/images/";

/** Rewrite every `/images/<file>` string in `node` to `/images/<slug>/<file>`. */
function rewrite(node, slug, onImage) {
  if (typeof node === "string") {
    if (!node.startsWith(IMAGE_PREFIX)) return node;
    const rest = node.slice(IMAGE_PREFIX.length);
    // Already scoped to this slug — leave it (keeps the script idempotent).
    if (rest.startsWith(`${slug}/`)) return node;
    const filename = rest.split("/").pop();
    onImage(filename);
    return `${IMAGE_PREFIX}${slug}/${filename}`;
  }
  if (Array.isArray(node)) return node.map((item) => rewrite(item, slug, onImage));
  if (node && typeof node === "object") {
    return Object.fromEntries(
      Object.entries(node).map(([key, value]) => [key, rewrite(value, slug, onImage)]),
    );
  }
  return node;
}

let changedProjects = 0;
let copied = 0;
const missing = [];

for (const file of readdirSync(projectsDir).filter((f) => f.endsWith(".json"))) {
  const slug = file.replace(/\.json$/, "");
  const filePath = path.join(projectsDir, file);
  const original = readFileSync(filePath, "utf8");
  const data = JSON.parse(original);

  const files = new Set();
  const next = rewrite(data, slug, (filename) => files.add(filename));

  if (files.size === 0) continue;

  const destDir = path.join(imagesDir, slug);
  mkdirSync(destDir, { recursive: true });
  for (const filename of files) {
    const source = path.join(imagesDir, filename);
    const dest = path.join(destDir, filename);
    if (!existsSync(source)) {
      missing.push(`${slug}/${filename}`);
      continue;
    }
    if (!existsSync(dest)) {
      copyFileSync(source, dest);
      copied += 1;
    }
  }

  const serialized = `${JSON.stringify(next, null, 2)}\n`;
  if (serialized !== original) {
    writeFileSync(filePath, serialized);
    changedProjects += 1;
  }
}

console.log(`Rewrote ${changedProjects} project file(s), copied ${copied} image(s).`);
if (missing.length) {
  console.warn(`\n${missing.length} referenced file(s) missing from public/images:`);
  for (const m of missing) console.warn(`  ${m}`);
}
