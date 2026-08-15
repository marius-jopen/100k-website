/**
 * Shapes the rest of the site works with, after Keystatic entries have been
 * read and their media relationships resolved.
 */

export interface Asset {
  /** Media collection slug. */
  key: string;
  /** Site-relative source path, e.g. `/media/2025/08/tede-0.webp`. */
  path: string;
  /** Ready-to-use URL: CDN image URL, or the HLS playlist for videos. */
  src: string;
  filename: string;
  mimeType: string;
  width: number | null;
  height: number | null;
  alt: string;
  legacyId: number | null;
  /** Bunny Stream GUID, present on every video. */
  videoId: string | null;
  /** Bunny Stream HLS playlist. */
  hls: string | null;
  /** Progressive MP4 rendition, used as a last-resort fallback. */
  mp4: string | null;
  /** Bunny-generated poster frame. */
  poster: string | null;
  isVideo: boolean;
}

export interface Credit {
  label: string;
  value: string;
}

export interface GridBlock {
  type: "image" | "video";
  asset: Asset;
  caption: string;
}

export interface ProjectLayout {
  blocks: GridBlock[];
}

export interface Project {
  id: string;
  slug: string;
  title: string;
  displayTitle: string;
  shortDescription: string;
  /** Category slug from `PROJECT_TAGS`; drives the homepage filter. */
  tag: string;
  description: string;
  externalUrl: string;
  featuredImage: Asset | null;
  desktopBackground: Asset | null;
  mobileBackground: Asset | null;
  credits: Credit[];
  layout: ProjectLayout;
}

export interface ClientLogo {
  name: string;
  /** Inline SVG markup; empty when the logo only exists as an image. */
  svg: string;
  image: Asset | null;
}

export interface ServiceCard {
  title: string;
  services: string[];
  image: Asset | null;
}

export interface SiteContent {
  name: string;
  clients: ClientLogo[];
  servicesIntro: string;
  services: ServiceCard[];
  webglBackgrounds: Asset[];
  mobileLogo: Asset | null;
  footer: {
    headline: string;
    body: string;
    emailPrompt: string;
    legal: string;
  };
  contact: {
    endpoint: string;
  };
}
