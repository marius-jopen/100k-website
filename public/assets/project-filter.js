/*
 * The category filter behind the "Selected Projects" heading.
 *
 * Every category is also a prerendered page (`/tag/<value>/`), so the menu is
 * made of real links: without this script they navigate, with it the click is
 * caught and the list is filtered where it stands, the heading is relabelled
 * and the URL is pushed — so a filtered list stays shareable either way.
 */
(function () {
  const filter = document.querySelector(".project-filter");
  const list = document.querySelector(".projects-list");

  if (!filter || !list) return;

  const toggle = filter.querySelector(".project-filter__toggle");
  const menu = filter.querySelector(".project-filter__menu");
  const options = Array.from(filter.querySelectorAll(".project-filter__option"));
  const rows = Array.from(list.children).filter((row) => row instanceof HTMLElement);

  if (!toggle || !menu || !options.length || !rows.length) return;

  const currentLabel = toggle.querySelector(".lay-button-effect__text--current");
  // The button is sized off both of its labels at once, so the heading swaps
  // in there too — otherwise a longer category name would be clipped.
  const sizerLabel = toggle.querySelector(".project-filter__sizer-text");
  const phoneBackgrounds = document.querySelector(".background-images-phone");

  let activeTag = filter.dataset.activeTag || "";
  let isMenuOpen = false;

  const isVisible = (row) => !row.classList.contains("is-filtered-out");
  const optionFor = (tag) =>
    options.find((option) => (option.dataset.tag || "") === tag) || options[0];

  /* --------------------------------------------------------- the list */

  // The legacy app highlights whichever project is level with this line and
  // hands the phone its background; it reads every row it found at startup,
  // including the ones a filter has since hidden. Rather than fight it, the
  // same rule is applied over the rows that are actually on screen — on the
  // same scroll frame, so only the corrected state is ever painted.
  const activationLine = () => (window.innerWidth < 700 ? 270 : 350);

  const showPhoneBackground = (index) => {
    // Above the breakpoint these are hidden and the spotlight owns the preview,
    // so there is nothing to swap and nothing to spend a video player on.
    if (window.innerWidth > 700) return;
    if (!phoneBackgrounds || !Number.isInteger(index)) return;

    const slides = Array.from(phoneBackgrounds.children);
    const target = slides[index];
    if (!target || target.classList.contains("active")) return;

    slides.forEach((slide) => {
      slide.classList.toggle("active", slide === target);
      if (slide === target) return;
      const video = slide.querySelector("video");
      if (video && video.pause) video.pause();
    });

    const video = target.querySelector("video");
    const playback = video && video.play && video.play();
    if (playback && playback.catch) playback.catch(() => {});
  };

  // `force` is for the moment the filter changes, including the one that clears
  // it: the highlight has to be put back on a row that is still on screen
  // before the legacy app is handed the unfiltered list again.
  const syncHighlightedRow = (force) => {
    // Unfiltered, every row the legacy app knows about is on screen and its own
    // bookkeeping is right — so leave it alone.
    if (!activeTag && !force) return;

    const visible = rows.filter(isVisible);
    if (!visible.length) return;

    const line = activationLine();
    let current = visible[0];
    visible.forEach((row) => {
      if (row.getBoundingClientRect().top < line) current = row;
    });

    const link = current.querySelector(".project-list-item");
    if (!link) return;

    const highlighted = Array.from(list.querySelectorAll(".project-list-item.hover"));
    if (highlighted.length !== 1 || highlighted[0] !== link) {
      highlighted.forEach((element) => element.classList.remove("hover"));
      link.classList.add("hover");
    }

    showPhoneBackground(Number(link.dataset.ix));
  };

  let syncFrame = 0;
  const requestHighlightSync = () => {
    if (syncFrame) return;
    syncFrame = window.requestAnimationFrame(() => {
      syncFrame = 0;
      syncHighlightedRow();
    });
  };

  /* ------------------------------------------------------- the filter */

  const applyTag = (tag) => {
    activeTag = tag;
    filter.dataset.activeTag = tag;

    rows.forEach((row) => {
      row.classList.toggle("is-filtered-out", Boolean(tag) && row.dataset.tag !== tag);
    });

    const option = optionFor(tag);
    const headline = option.dataset.headline || option.textContent.trim();

    options.forEach((entry) => entry.classList.toggle("is-active", entry === option));
    setHighlightedOption(option);
    if (currentLabel) currentLabel.textContent = headline;
    if (sizerLabel) sizerLabel.textContent = headline;

    syncHighlightedRow(true);
    // The spotlight keeps its own map of the list and has to re-measure.
    window.dispatchEvent(new CustomEvent("projectfilterchange", { detail: { tag } }));
  };

  const urlFor = (tag) => optionFor(tag).getAttribute("href") || "/";

  const tagFromLocation = () => {
    const match = window.location.pathname.match(/^\/tag\/([^/]+)\/?$/);
    return match && options.some((option) => option.dataset.tag === match[1]) ? match[1] : "";
  };

  // Leaving a project by the toolbar's Back sends the legacy app to
  // `passedData.url`, so that has to be the filtered address rather than "/".
  const rememberFrontpageUrl = (tag) => {
    if (window.passedData) window.passedData.url = urlFor(tag);
  };

  const selectTag = (tag) => {
    if (tag !== activeTag) {
      applyTag(tag);
      rememberFrontpageUrl(tag);
      // The same state shape the legacy app pushes for the front page: its own
      // popstate handler reads `type` off it and would throw on a bare state.
      window.history.pushState({ id: 0, type: "frontpage" }, "", urlFor(tag));
    }

    setMenuOpen(false);
  };

  /* ---------------------------------------------- the category preview */

  /*
   * Hovering a category shows one of its projects in the spotlight, so the
   * menu says what it holds rather than only naming it.
   *
   * The project is drawn once per page and kept: hovering the same category
   * again brings back the one already on screen instead of streaming another
   * video. Which one it is does not matter, only that it stops changing.
   */
  const previewByTag = new Map();

  const previewIndexFor = (tag) => {
    if (previewByTag.has(tag)) return previewByTag.get(tag);

    const candidates = rows
      .filter((row) => !tag || row.dataset.tag === tag)
      .map((row) => Number(row.querySelector(".project-list-item")?.dataset.ix))
      .filter((index) => Number.isInteger(index));
    const index = candidates.length
      ? candidates[Math.floor(Math.random() * candidates.length)]
      : -1;

    previewByTag.set(tag, index);
    return index;
  };

  // The black pill, exactly as the list carries it: one at a time, following
  // the pointer and staying where it was left.
  const setHighlightedOption = (option) => {
    options.forEach((entry) => entry.classList.toggle("is-highlighted", entry === option));
  };

  options.forEach((option) => {
    const highlight = () => {
      setHighlightedOption(option);
      const index = previewIndexFor(option.dataset.tag || "");
      if (index >= 0) window.previewProjectSpotlight?.(index);
    };

    option.addEventListener("mouseenter", highlight);
    option.addEventListener("focus", highlight);
  });

  // Handed back on the way out of the menu rather than out of an entry, so
  // crossing the gap between two of them changes nothing.
  menu.addEventListener("mouseleave", () => {
    setHighlightedOption(optionFor(activeTag));
    window.clearProjectSpotlightPreview?.();
  });

  /* --------------------------------------------------------- the menu */

  function setMenuOpen(open) {
    isMenuOpen = open;
    // A menu that closes under the pointer never gets its `mouseleave`, so the
    // preview and the highlight are handed back here as well.
    if (!open) {
      window.clearProjectSpotlightPreview?.();
      setHighlightedOption(optionFor(activeTag));
    }
    filter.classList.toggle("is-filter-open", open);
    toggle.setAttribute("aria-expanded", String(open));
  }

  toggle.addEventListener("click", (event) => {
    event.preventDefault();
    setMenuOpen(!isMenuOpen);
  });

  menu.addEventListener("click", (event) => {
    const option = event.target instanceof Element
      ? event.target.closest(".project-filter__option")
      : null;

    if (!option) return;
    // Cmd/ctrl/middle click opens the category's own page, as any link would.
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    event.preventDefault();
    selectTag(option.dataset.tag || "");
  });

  // A click anywhere else closes the menu and does nothing more — it hangs over
  // the list, and the click that dismisses it must not also open whichever
  // project happens to be underneath. Caught before the page transition's own
  // handler, which is registered by a later script.
  document.addEventListener("click", (event) => {
    if (!isMenuOpen) return;

    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest(".project-filter")) return;

    setMenuOpen(false);

    // The logo is its own destination rather than part of the list the menu
    // covers, so that click is worth more than dismissing the menu.
    if (target?.closest(".introtext, .mobile-logo")) return;

    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !isMenuOpen) return;
    setMenuOpen(false);
    toggle.focus({ preventScroll: true });
  });

  // The logo is the way home: the whole list, from the top, however far into a
  // category the reader had got.
  document.querySelectorAll(".introtext, .mobile-logo").forEach((logo) => {
    logo.addEventListener("click", () => {
      if (document.body.classList.contains("show-post")) return;

      selectTag("");
      window.scrollTo(0, 0);
    });
  });

  window.addEventListener("popstate", () => {
    const tag = tagFromLocation();
    if (tag !== activeTag) applyTag(tag);
    rememberFrontpageUrl(tag);
    setMenuOpen(false);
  });

  // The legacy app puts the highlight on the first row during its own startup,
  // whether or not the filter left that one on screen — and it publishes
  // `passedData` after this file has run, so the front page's address is only
  // ours to set from here on.
  const claimFrontpageState = () => {
    rememberFrontpageUrl(activeTag);
    syncHighlightedRow(true);
  };

  window.addEventListener("scroll", requestHighlightSync, { passive: true });
  window.addEventListener("resize", requestHighlightSync);
  window.addEventListener("load", claimFrontpageState);
  document.addEventListener("DOMContentLoaded", claimFrontpageState);

  // Hands the menu to this script: the stylesheet's keyboard-only fallback,
  // which is what opens it with JavaScript off, gets out of the way.
  filter.classList.add("is-filter-enhanced");
  setMenuOpen(false);
  claimFrontpageState();
})();
