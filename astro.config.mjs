import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import node from "@astrojs/node";
import sitemap from "@astrojs/sitemap";
import keystatic from "@keystatic/astro";
import { SITE_URL } from "./src/lib/seo";

// `npm run build:static` produces a plain static upload bundle with no server
// runtime and no Keystatic admin routes. Everything else (dev, `npm run build`)
// keeps the Keystatic admin mounted at /keystatic.
const staticExport = process.env.STATIC_EXPORT === "1";

export default defineConfig({
  // Without this Astro emits no absolute URLs, which is what canonical tags and
  // the sitemap are made of. Every SEO tag on the site is derived from it.
  site: SITE_URL,
  output: "static",
  outDir: "./dist",
  publicDir: "./public",
  // "always" would 404 Keystatic's own /api/keystatic/* routes, which are
  // requested without a trailing slash. Pages are still emitted as
  // `<slug>/index.html` and every link in the markup keeps its trailing slash.
  trailingSlash: "ignore",
  devToolbar: {
    enabled: false,
  },
  build: {
    format: "directory",
  },
  // The sitemap ships in both builds: it is the one file a crawler is told to
  // look for by robots.txt, so a static upload without it is a dead reference.
  integrations: (() => {
    // The legal pages carry `noindex`, so listing them in the sitemap would be
    // asking a crawler to fetch what it has been told to ignore.
    const map = sitemap({ filter: (page) => !/\/(impressum|privacy)\/$/.test(page) });
    return staticExport ? [map] : [react(), keystatic(), map];
  })(),
  ...(staticExport ? {} : { adapter: node({ mode: "standalone" }) }),
});
