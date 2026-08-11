import { config, collection, singleton, fields } from "@keystatic/core";

/**
 * Images and videos are handled differently on purpose.
 *
 * Images are real files in `public/images`, edited with `fields.image` — so the
 * CMS shows a thumbnail, accepts drag-and-drop, and needs no width/height/mime
 * bookkeeping. Videos are not files at all: they live in Bunny Stream and are
 * played from an HLS playlist, so they stay as entries in the `videos`
 * collection, keyed by their Bunny GUID.
 */
const imageField = (label: string, description?: string) =>
  fields.image({
    label,
    description,
    directory: "public/images",
    publicPath: "/images/",
  });

const videoField = (label: string) =>
  fields.text({
    label,
    description:
      "Bunny Stream video ID (the GUID from the library), or a full player URL — the id is read out of it.",
  });

/** Backgrounds and grid blocks can be either, so the editor picks which. */
const mediaField = (label: string, description?: string) =>
  fields.conditional(
    fields.select({
      label,
      description,
      options: [
        { label: "Image", value: "image" },
        { label: "Video", value: "video" },
      ],
      defaultValue: "image",
    }),
    {
      image: imageField(label),
      video: videoField(label),
    },
  );

const creditFields = fields.object(
  {
    label: fields.text({ label: "Label", defaultValue: "" }),
    value: fields.text({ label: "Value", defaultValue: "" }),
  },
  {
    label: "Credit",
  },
);

/**
 * Only what the page actually renders. Playback flags are gone because every
 * project video is rendered muted/looping/inline regardless; spacing and
 * alignment knobs are gone because the stylesheet owns that.
 */
const gridBlockFields = fields.object(
  {
    asset: mediaField("Asset"),
    caption: fields.text({ label: "Caption", defaultValue: "" }),
  },
  {
    label: "Grid block",
  },
);

export default config({
  storage: { kind: "local" },
  ui: {
    brand: { name: "100k Studio" },
    navigation: {
      Website: ["site"],
      Work: ["projects"],
    },
  },
  collections: {
    projects: collection({
      label: "Projects",
      path: "content/projects/*",
      format: { data: "json" },
      slugField: "title",
      columns: ["title", "shortDescription"],
      entryLayout: "form",
      schema: {
        title: fields.slug({
          name: {
            label: "Title",
            description: "Shown in the project list on the homepage.",
            validation: { isRequired: true },
          },
          slug: {
            label: "Slug",
            description: "URL segment, e.g. /tede/",
          },
        }),
        displayTitle: fields.text({
          label: "Display title",
          description: "Headline shown on the project page itself.",
          validation: { isRequired: true },
        }),
        shortDescription: fields.text({
          label: "Short description",
          defaultValue: "",
        }),
        description: fields.text({
          label: "Description",
          description:
            "Plain text. Leave a blank line between paragraphs; a single line break stays a line break.",
          multiline: true,
          defaultValue: "",
        }),
        externalUrl: fields.text({ label: "Website URL", defaultValue: "" }),
        featuredImage: imageField("Featured image"),
        desktopBackground: mediaField(
          "Desktop background",
          "Shown behind the project list on desktop.",
        ),
        mobileBackground: mediaField(
          "Mobile background",
          "Shown behind the project list on phones.",
        ),
        credits: fields.array(creditFields, {
          label: "Credits",
          itemLabel: (props) => props.fields.label.value || "Credit",
        }),
        // Gutters and frame margins are stylesheet constants, not content —
        // every project used the same values and nothing read the rest.
        layout: fields.object(
          {
            blocks: fields.array(gridBlockFields, {
              label: "Blocks",
              itemLabel: (props) =>
                props.fields.caption.value || props.fields.asset.discriminant,
            }),
          },
          { label: "Media" },
        ),
      },
    }),

  },

  singletons: {
    site: singleton({
      label: "Homepage & footer",
      path: "content/site",
      format: { data: "json" },
      entryLayout: "form",
      schema: {
        name: fields.text({
          label: "Site name",
          defaultValue: "100k Studio – Web Development and Design",
          validation: { isRequired: true },
        }),
        // Drag to reorder — this is the order the homepage list and the project
        // spotlight use. Anything missing from the list falls in alphabetically
        // at the end, so a newly created project is never invisible.
        projectOrder: fields.array(
          fields.relationship({ label: "Project", collection: "projects" }),
          {
            label: "Project order",
            description: "Drag to set the order projects appear on the homepage.",
            itemLabel: (props) => props.value ?? "Project",
          },
        ),
        clients: fields.array(imageField("Client logo"), {
          label: "Client logos",
          itemLabel: (props) => props.value?.filename ?? "Logo",
        }),
        servicesIntro: fields.text({
          label: "Services intro",
          multiline: true,
          defaultValue: "",
        }),
        services: fields.array(
          fields.object(
            {
              title: fields.text({ label: "Title", validation: { isRequired: true } }),
              services: fields.array(fields.text({ label: "Service" }), {
                label: "Services",
                itemLabel: (props) => props.value ?? "Service",
              }),
              image: imageField("Image"),
            },
            { label: "Service card" },
          ),
          {
            label: "Service cards",
            itemLabel: (props) => props.fields.title.value || "Service card",
          },
        ),
        webglBackgrounds: fields.array(imageField("Background"), {
          label: "WebGL backgrounds",
          description: "The first five are used for the homepage slideshow.",
          itemLabel: (props) => props.value?.filename ?? "Background",
        }),
        mobileLogo: imageField("Mobile logo"),
        footer: fields.object(
          {
            headline: fields.text({ label: "Headline", multiline: true, defaultValue: "" }),
            body: fields.text({ label: "Body", multiline: true, defaultValue: "" }),
            emailPrompt: fields.text({ label: "Email prompt", multiline: true, defaultValue: "" }),
            legal: fields.text({ label: "Legal", multiline: true, defaultValue: "" }),
          },
          {
            label: "Footer",
            description:
              "Plain text. Leave a blank line between paragraphs; a single line break stays a line break.",
          },
        ),
        contact: fields.object(
          {
            endpoint: fields.text({ label: "Form endpoint", defaultValue: "/contact.php" }),
          },
          { label: "Contact form" },
        ),
      },
    }),
  },
});
