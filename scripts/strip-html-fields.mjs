/**
 * The project `description` and the site `footer` fields used to be authored as
 * raw HTML strings, so the Keystatic editor showed `<p>`/`<br>` markup. They are
 * plain-text fields now — `src/lib/content.ts` turns the text back into HTML at
 * render time (`paragraphsToHtml`). This one-off strips the existing markup:
 *
 *   <p>A<br />B</p><p>C</p>  ->  "A\nB\n\nC"
 *
 * Paragraphs become blank-line-separated blocks and `<br>` becomes a single
 * newline — exactly the shape `paragraphsToHtml` expects, so the rendered output
 * is unchanged. Idempotent: text with no tags is left as-is.
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contentDir = path.join(projectRoot, "content");

function htmlToPlain(html) {
  if (typeof html !== "string" || !html.trim()) return html ?? "";
  const trimmed = html.trim();
  const blocks = [...trimmed.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map((m) => m[1]);
  const source = blocks.length ? blocks : [trimmed];
  return source
    .map((block) =>
      block
        .replace(/<br\s*\/?>\s*/gi, "\n") // a break (and any trailing newline) -> one newline
        .replace(/<[^>]+>/g, "") // drop any other stray tags
        .trim(),
    )
    .filter((block) => block.length)
    .join("\n\n")
    .trim();
}

let changed = 0;

// Project descriptions.
const projectsDir = path.join(contentDir, "projects");
for (const file of readdirSync(projectsDir).filter((f) => f.endsWith(".json"))) {
  const filePath = path.join(projectsDir, file);
  const original = readFileSync(filePath, "utf8");
  const data = JSON.parse(original);
  const next = htmlToPlain(data.description);
  if (next !== data.description) {
    data.description = next;
    writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
    changed += 1;
  }
}

// Site footer.
const sitePath = path.join(contentDir, "site.json");
const site = JSON.parse(readFileSync(sitePath, "utf8"));
let siteChanged = false;
for (const key of ["headline", "body", "emailPrompt", "legal"]) {
  const next = htmlToPlain(site.footer?.[key]);
  if (site.footer && next !== site.footer[key]) {
    site.footer[key] = next;
    siteChanged = true;
  }
}
if (siteChanged) {
  writeFileSync(sitePath, `${JSON.stringify(site, null, 2)}\n`);
  changed += 1;
}

console.log(`Stripped HTML from ${changed} file(s).`);
