import { createReader } from "@keystatic/core/reader";
import keystaticConfig from "../../keystatic.config";
import { hlsUrl, imageUrl, isVideoPath, mp4Url, posterUrl } from "./media";
import type {
  Asset,
  GridBlock,
  Project,
  ProjectLayout,
  SiteContent,
} from "./schema";

const reader = createReader(process.cwd(), keystaticConfig);

/* ------------------------------------------------------------ media lookup */

/**
 * Images are plain public paths written by Keystatic's image field, so they
 * need no lookup — only a CDN rewrite. Videos are entries in the `videos`
 * collection, keyed by their Bunny Stream GUID.
 */
/**
 * Videos are addressed by their Bunny Stream GUID, written straight into the
 * field. A full player URL is accepted too — editors tend to paste those — and
 * the id is pulled out of it.
 */
const BUNNY_GUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

function videoAsset(value: string | null | undefined): Asset | null {
  const videoId = value?.match(BUNNY_GUID)?.[0];
  if (!videoId) return null;

  return {
    key: videoId,
    path: videoId,
    src: hlsUrl(videoId),
    filename: videoId,
    mimeType: "video/mp4",
    width: null,
    height: null,
    alt: "",
    legacyId: null,
    videoId,
    hls: hlsUrl(videoId),
    mp4: mp4Url(videoId),
    poster: posterUrl(videoId),
    isVideo: true,
  } satisfies Asset;
}

/** Wraps a Keystatic image path as an Asset. */
function imageAsset(path: string | null | undefined): Asset | null {
  if (!path) return null;

  const filename = path.split("/").pop() ?? path;
  return {
    key: path,
    path,
    src: imageUrl(path),
    filename,
    mimeType: "",
    width: null,
    height: null,
    alt: "",
    legacyId: null,
    videoId: null,
    hls: null,
    mp4: null,
    poster: null,
    isVideo: false,
  } satisfies Asset;
}

/** Resolves a conditional image-or-video field into an Asset. */
function resolveMedia(
  field: { discriminant: string; value: unknown } | null | undefined,
): Asset | null {
  if (!field) return null;

  if (field.discriminant === "video") {
    return videoAsset(field.value as string | null);
  }

  return imageAsset(field.value as string | null);
}

/**
 * How wide a logo is against its own height, read off the `viewBox` — which
 * every one of them carries and which is pulled in to the artwork, so this is
 * the shape of the logo itself rather than of the file it arrived in. The
 * client wall sizes each logo from it.
 */
function svgAspectRatio(svg: string | null | undefined): number | null {
  const viewBox = svg?.match(/viewBox="([^"]+)"/)?.[1];
  const [, , width, height] = viewBox?.trim().split(/[\s,]+/).map(Number) ?? [];

  if (!width || !height) return null;
  return width / height;
}

/* ------------------------------------------------------------------- site */

const siteEntry = await reader.singletons.site.read();

if (!siteEntry) {
  throw new Error("content/site.json is missing.");
}

export const siteContent: SiteContent = {
  name: siteEntry.name,
  clients: siteEntry.clients.map((client) => ({
    name: client.name,
    svg: client.svg.trim(),
    image: imageAsset(client.image),
    aspectRatio: svgAspectRatio(client.svg),
    opticalSize: client.opticalSize,
  })),
  servicesIntro: siteEntry.servicesIntro,
  services: siteEntry.services.map((service) => ({
    title: service.title,
    services: [...service.services],
    image: imageAsset(service.image),
  })),
  webglBackgrounds: siteEntry.webglBackgrounds
    .map(imageAsset)
    .filter((asset): asset is Asset => Boolean(asset)),
  mobileLogo: imageAsset(siteEntry.mobileLogo),
  // Footer fields are plain text in Keystatic; downstream renders them as HTML.
  footer: {
    headline: paragraphsToHtml(siteEntry.footer.headline),
    body: paragraphsToHtml(siteEntry.footer.body),
    emailPrompt: paragraphsToHtml(siteEntry.footer.emailPrompt),
    legal: paragraphsToHtml(siteEntry.footer.legal),
  },
  contact: { ...siteEntry.contact },
};

/* --------------------------------------------------------------- projects */

const projectEntries = await reader.collections.projects.all();

/** Slug → position in the Home page's drag-and-drop list. */
const projectRank = new Map<string, number>(
  (siteEntry.projectOrder ?? [])
    .filter((slug): slug is string => Boolean(slug))
    .map((slug, index) => [slug, index]),
);

export const projects: Project[] = projectEntries
  .map(({ slug, entry }): Project => {
    const layout: ProjectLayout = {
      blocks: entry.layout.blocks.flatMap((block): GridBlock[] => {
        const asset = resolveMedia(block.asset);
        if (!asset) return [];

        return [
          {
            type: asset.isVideo ? "video" : "image",
            asset,
            caption: block.caption,
          },
        ];
      }),
    };

    return {
      id: slug,
      slug,
      title: entry.title,
      displayTitle: entry.displayTitle,
      shortDescription: entry.shortDescription,
      tag: entry.tag,
      description: entry.description,
      externalUrl: entry.externalUrl,
      featuredImage: imageAsset(entry.featuredImage),
      desktopBackground: resolveMedia(entry.desktopBackground),
      mobileBackground: resolveMedia(entry.mobileBackground),
      credits: entry.credits.map((credit) => ({ label: credit.label, value: credit.value })),
      layout,
    };
  })
  // The Home page's "Project order" list is now both the running order and the
  // selection: a project that is not on it does not appear on the site.
  .filter((project) => projectRank.has(project.slug))
  .sort((a, b) => (projectRank.get(a.slug) ?? 0) - (projectRank.get(b.slug) ?? 0));

/* ------------------------------------------------------------ grid markup */

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/**
 * The description and footer fields are authored as plain text in Keystatic —
 * one blank line between paragraphs, a single newline for a line break — so the
 * editor shows no markup. This turns that text into the `<p>`/`<br>` HTML the
 * footer (`set:html`) and the project read-more (which walks `<p>` children)
 * expect. Empty input stays an empty string.
 */
function paragraphsToHtml(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .trim()
    .split(/\n\s*\n/)
    .map((block) => `<p>${escapeHtml(block.trim()).replaceAll("\n", "<br />")}</p>`)
    .join("");
}

function renderAsset(asset: Asset, type: "image" | "video", projectTitle: string): string {
  const dimensions =
    asset.width && asset.height ? ` width="${asset.width}" height="${asset.height}"` : "";

  if (type === "video") {
    // No <source> element: playback is attached by bunny-hls at runtime, which
    // picks HLS natively (Safari), via hls.js, or the progressive MP4.
    const poster = asset.poster ? ` poster="${escapeHtml(asset.poster)}"` : "";
    const hls = asset.hls ? ` data-hls="${escapeHtml(asset.hls)}"` : "";
    const mp4 = asset.mp4 ? ` data-mp4="${escapeHtml(asset.mp4)}"` : "";
    return `<video playsinline muted loop preload="none"${dimensions}${poster}${hls}${mp4}></video>`;
  }

  return `<img src="${escapeHtml(asset.src)}"${dimensions} alt="${escapeHtml(asset.alt || projectTitle)}" loading="lazy" decoding="async">`;
}

/**
 * Grid geometry, in vw. These were per-project Keystatic fields, but all 37
 * projects carried identical values and nothing ever varied them.
 */
const GRID_COLUMN_GUTTER = 1;
const GRID_ROW_GUTTER = 5;
const GRID_FRAME_MARGIN = 5;

export function renderProjectGrid(project: Project): string {
  // One block per row, full width: the carousel shows a single piece of media
  // at a time, so there is nothing for grid positioning to express.
  const content = project.layout.blocks
    .map((block) => (
      `<div class="static-grid-row">`
      + `<figure class="static-grid-block static-grid-${block.type}" style="grid-column:1/span 12">`
      + renderAsset(block.asset, block.type, project.title)
      + (block.caption ? `<figcaption>${block.caption}</figcaption>` : "")
      + `</figure></div>`
    ))
    .join("");

  return `<div class="static-project-grid" style="--grid-gutter:${GRID_COLUMN_GUTTER}vw;--row-gap:${GRID_ROW_GUTTER}vw;--frame-top:${GRID_FRAME_MARGIN}vw;--frame-right:${GRID_FRAME_MARGIN}vw;--frame-bottom:${GRID_FRAME_MARGIN}vw;--frame-left:${GRID_FRAME_MARGIN}vw">${content}</div>`;
}

/* ------------------------------------------------ data handed to legacy JS */

function legacyAsset(asset: Asset | null) {
  if (!asset) return null;
  return {
    ID: asset.legacyId,
    id: asset.legacyId,
    url: asset.src,
    mime_type: asset.mimeType,
    width: asset.width,
    height: asset.height,
  };
}

export const passedData = {
  rest_root: "",
  rest_nonce: "",
  template_directory: "/assets/legacy",
  title: siteContent.name,
  url: "/",
  ajax_url: siteContent.contact.endpoint,
  projects: projects.map((project) => ({
    title: project.title,
    url: `/${project.slug}/`,
    id: project.id,
    image: project.featuredImage?.src ?? "",
    image_big: project.featuredImage?.src ?? "",
    background: legacyAsset(project.desktopBackground),
    background_phone: legacyAsset(project.mobileBackground),
    short_description: project.shortDescription,
  })),
  everything: {
    frontpage: projects.map((project) => ({
      title: project.title,
      url: `/${project.slug}/`,
      id: project.id,
    })),
    projects: projects.map((project, index) => ({
      title: project.title,
      projectUrl: `/${project.slug}/`,
      id: project.id,
      grid: renderProjectGrid(project),
      url: project.externalUrl,
      image_big: project.featuredImage?.src ?? "",
      description: paragraphsToHtml(project.description),
      acf_title: project.displayTitle,
      credits: project.credits.map((credit) => ({ left: credit.label, right: credit.value })),
      short_description: project.shortDescription,
      ix: index,
    })),
  },
  backgrounds: projects.map((project) => legacyAsset(project.desktopBackground)),
};
