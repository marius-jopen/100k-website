import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import node from "@astrojs/node";
import keystatic from "@keystatic/astro";

// `npm run build:static` produces a plain static upload bundle with no server
// runtime and no Keystatic admin routes. Everything else (dev, `npm run build`)
// keeps the Keystatic admin mounted at /keystatic.
const staticExport = process.env.STATIC_EXPORT === "1";

export default defineConfig({
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
  integrations: staticExport ? [] : [react(), keystatic()],
  ...(staticExport ? {} : { adapter: node({ mode: "standalone" }) }),
});
