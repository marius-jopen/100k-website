/**
 * One source for every absolute URL and every machine-readable claim the site
 * makes about itself.
 *
 * Kept free of Astro and Keystatic imports on purpose: `astro.config.mjs` reads
 * `SITE_URL` from here, and the config is evaluated before either exists.
 */

/** Production origin. Canonical tags, the sitemap and OG URLs are built on it. */
export const SITE_URL = "https://100k.studio";

/** Absolute URL for a site-relative path, with the trailing slash pages carry. */
export const absoluteUrl = (path: string): string => {
  if (/^https?:\/\//.test(path)) return path;
  const clean = `/${path.replace(/^\/+/, "")}`;
  return new URL(clean, SITE_URL).href;
};

/**
 * The studio as an entity: name, where it is, who runs it, what it sells.
 *
 * This is the block an AI system reads to learn the company rather than infer
 * it from prose. The values mirror the footer's Impressum text — if one moves,
 * move the other.
 */
export const ORGANIZATION = {
  legalName: "100k Studio GmbH",
  name: "100k Studio",
  vatId: "DE342632737",
  email: "contact@100k.studio",
  founders: ["Armin Unruh", "Marius Jopen"],
  address: {
    street: "Mühlenstr. 8a",
    postalCode: "14167",
    city: "Berlin",
    country: "DE",
  },
  /** Plain-language services, in the words a client would search with. */
  services: [
    "Web development",
    "Web design",
    "Headless CMS development",
    "Custom CMS development",
    "Frontend development",
    "Backend development",
    "E-commerce development",
    "Salesforce integration",
    "CRM integration",
    "UX and UI design",
    "Web animation and scrollytelling",
  ],
} as const;

export interface OrganizationSchemaOptions {
  /** Absolute URL of the logo or share image, when one is configured. */
  image?: string | null;
  description: string;
}

export const organizationSchema = ({ image, description }: OrganizationSchemaOptions) => ({
  "@context": "https://schema.org",
  "@type": "ProfessionalService",
  "@id": `${SITE_URL}/#organization`,
  name: ORGANIZATION.name,
  legalName: ORGANIZATION.legalName,
  url: SITE_URL,
  description,
  email: ORGANIZATION.email,
  vatID: ORGANIZATION.vatId,
  ...(image ? { image, logo: image } : {}),
  address: {
    "@type": "PostalAddress",
    streetAddress: ORGANIZATION.address.street,
    postalCode: ORGANIZATION.address.postalCode,
    addressLocality: ORGANIZATION.address.city,
    addressCountry: ORGANIZATION.address.country,
  },
  founder: ORGANIZATION.founders.map((name) => ({ "@type": "Person", name })),
  knowsAbout: [...ORGANIZATION.services],
  areaServed: "Worldwide",
});

export interface ProjectSchemaOptions {
  name: string;
  headline: string;
  description: string;
  url: string;
  image?: string | null;
  /** The live site the work is for, when it is still online. */
  sameAs?: string;
  keywords: string[];
}

export const projectSchema = (project: ProjectSchemaOptions) => ({
  "@context": "https://schema.org",
  "@type": "CreativeWork",
  name: project.name,
  headline: project.headline,
  description: project.description,
  url: project.url,
  ...(project.image ? { image: project.image } : {}),
  ...(project.sameAs ? { sameAs: project.sameAs } : {}),
  keywords: project.keywords.join(", "),
  creator: { "@id": `${SITE_URL}/#organization` },
  provider: { "@id": `${SITE_URL}/#organization` },
});

/** Serialized for a `<script type="application/ld+json">` body. */
export const jsonLd = (schema: unknown): string =>
  JSON.stringify(schema).replaceAll("<", "\\u003c");
