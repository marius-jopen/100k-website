/**
 * The categories a project can be filed under, in the order the filter menu
 * lists them.
 *
 * One list, three consumers: Keystatic builds its select from it, the homepage
 * builds the filter menu from it, and `/tag/<value>/` gets one prerendered page
 * per entry — so the CMS value, the menu entry and the URL segment can never
 * drift apart.
 */
export interface ProjectTag {
  /** Stored in the entry, and used as the URL segment. */
  value: string;
  /** Shown in the CMS select. */
  label: string;
  /** The list's heading once the tag is chosen, and its entry in the menu. */
  headline: string;
  /** Editor guidance, collected into the CMS field's description. */
  description: string;
}

export const PROJECT_TAGS: ProjectTag[] = [
  {
    value: "culture",
    label: "Culture",
    headline: "Culture Projects",
    description: "art, music, magazines, labels, institutions of culture",
  },
  {
    value: "crypto",
    label: "Crypto",
    headline: "Crypto Projects",
    description: "web3, wallets, tokens, NFT platforms",
  },
  {
    value: "portfolio",
    label: "Portfolio",
    headline: "Portfolio Projects",
    description: "studios, agencies, architects, photographers, directors",
  },
  {
    value: "brand",
    label: "Brand",
    headline: "Brand Projects",
    description: "campaigns, takeovers and shops for brands",
  },
  {
    value: "product",
    label: "Product",
    headline: "Product Projects",
    description: "apps, plugins, tools and the sites that sell them",
  },
  {
    value: "business",
    label: "Business",
    headline: "Business Projects",
    description: "companies, agencies of the state, research, services",
  },
];

/** Heading and menu entry for the unfiltered list. */
export const ALL_PROJECTS_HEADLINE = "Selected Projects";
export const ALL_PROJECTS_LABEL = "All Projects";

/** What the filter button slides to on hover — the invitation to open it. */
export const PROJECT_FILTER_PROMPT = "Filter Projects";

export const findProjectTag = (value: string | null | undefined): ProjectTag | null =>
  PROJECT_TAGS.find((tag) => tag.value === value) ?? null;

/** `/` for the whole list, `/tag/<value>/` for one category. */
export const projectTagUrl = (value: string | null | undefined): string =>
  value ? `/tag/${value}/` : "/";

export const projectTagHeadline = (value: string | null | undefined): string =>
  findProjectTag(value)?.headline ?? ALL_PROJECTS_HEADLINE;
