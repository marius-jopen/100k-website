/**
 * Every media URL on the site is built here.
 *
 * Images are served through the Bunny pull zone (`100k-website.b-cdn.net`),
 * which pulls from the origin configured in the Bunny dashboard. Videos are not
 * served as files at all — they live in the Bunny Stream library and are played
 * from their HLS playlist.
 */

const env = import.meta.env;

/** Pull zone hostname. Set to an empty string to serve images from /media locally. */
export const IMAGE_CDN_URL = (env.PUBLIC_IMAGE_CDN_URL ?? "https://100k-website.b-cdn.net").replace(/\/$/, "");

/**
 * Path the pull zone origin serves the media tree from.
 *
 * The old WordPress origin exposes it as `/wp-content/uploads`; once this site
 * is the origin it becomes `/media`.
 */
export const IMAGE_CDN_PREFIX = (env.PUBLIC_IMAGE_CDN_PREFIX ?? "/media").replace(/\/$/, "");

/** Bunny Stream pull zone hostname for the video library. */
export const STREAM_HOST = env.PUBLIC_BUNNY_STREAM_HOST ?? "vz-a22b3102-67f.b-cdn.net";

export const VIDEO_EXTENSIONS = /\.(mp4|mov|webm|m4v)$/i;

export function isVideoPath(src: string): boolean {
  return VIDEO_EXTENSIONS.test(src);
}

/**
 * Images live in `public/images` and are served by this site, so a `/images/…`
 * path is already final — the deployed host (or a pull zone in front of it)
 * serves it directly.
 *
 * The `/media/…` branch is only for content that has not been migrated yet:
 * `/media/2025/08/tede-0.webp` → `https://100k-website.b-cdn.net/wp-content/uploads/2025/08/tede-0.webp`
 */
export function imageUrl(src: string): string {
  if (!src) return src;
  if (/^(https?:)?\/\//.test(src) || src.startsWith("data:")) return src;
  if (src.startsWith("/images/")) return src;
  if (!IMAGE_CDN_URL) return src;

  const relative = src.replace(/^\/?media\//, "/");
  return `${IMAGE_CDN_URL}${IMAGE_CDN_PREFIX}${relative}`;
}

/** Adaptive HLS playlist — the source used for playback everywhere. */
export function hlsUrl(videoId: string): string {
  return `https://${STREAM_HOST}/${videoId}/playlist.m3u8`;
}

/** Progressive MP4 rendition, used only if HLS cannot be attached at all. */
export function mp4Url(videoId: string, resolution = 720): string {
  return `https://${STREAM_HOST}/${videoId}/play_${resolution}p.mp4`;
}

/** Bunny-generated still, used as the video poster so nothing pops in black. */
export function posterUrl(videoId: string): string {
  return `https://${STREAM_HOST}/${videoId}/thumbnail.jpg`;
}
