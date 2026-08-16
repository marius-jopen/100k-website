/*
 * Spotlight Scroll calculations adapted from the existing Lay Theme Carousel
 * preset in /Users/arminunruh/Documents/git/lay-react.
 */
(function () {
  const projectSpotlightOptions = {
    fadeProjectButtons: false,
    showGhostImages: false,
  };
  const spotlight = document.querySelector(".background-images.project-spotlight");
  const projectRows = Array.from(document.querySelectorAll(".projects-list > div"));

  if (!spotlight || !projectRows.length) return;

  const slides = Array.from(spotlight.querySelectorAll(":scope > a"));
  const projectButtons = projectRows.map((row) => row.querySelector(".project-list-item"));
  const projectDescriptions = projectRows.map((row) =>
    row.querySelector(".short-description")?.textContent?.trim() || "",
  );
  const frame = spotlight.querySelector(".project-spotlight-frame");
  const caption = spotlight.querySelector(".project-spotlight-caption");
  const projectListSection = spotlight.closest(".plist-wrap")?.querySelector(".plist-wrap-2");
  const stickyStage = spotlight.closest(".sticky");
  const projectActivationOffset = 350;
  const spotlightStepDecay = 0.82;
  const spotlightOpacityStep = 0.5;
  const spotlightStep = 50;
  const spotlightScale = 0.82;
  const projectButtonOpacityStep = 0.18;
  const projectButtonMinimumOpacity = 0.12;
  let projectRowTops = [];
  let spotlightFrame = 0;
  let currentFrameIndex = -1;
  let hoveredProjectIndex = -1;

  /*
   * A category filter hides rows without touching the slides — a slide is
   * addressed by its position in the full project list everywhere else on the
   * page — so the two are kept apart here: `activeIndices` is the rows still on
   * screen, in order, and everything that reads as a position in the list
   * (`getScrollPosition`, the stack, the row measurements) works in that space
   * and is translated back through it before touching a slide.
   */
  let activeIndices = [];
  let activeRankByIndex = new Map();

  const refreshActiveProjects = () => {
    activeIndices = projectRows
      .map((row, index) => (row.classList.contains("is-filtered-out") ? -1 : index))
      .filter((index) => index >= 0);
    activeRankByIndex = new Map(activeIndices.map((index, rank) => [index, rank]));
  };

  refreshActiveProjects();

  const getSpotlightStackOffset = (distance, step) => {
    if (distance <= 0) return 0;
    return step * (1 - Math.pow(spotlightStepDecay, distance)) / (1 - spotlightStepDecay);
  };

  const measureProjectRows = () => {
    projectRowTops = activeIndices.map(
      (index) => projectRows[index].getBoundingClientRect().top + window.scrollY,
    );

    if (!projectListSection || !projectRowTops.length) return;
    if (window.innerWidth <= 700) {
      projectListSection.style.removeProperty("padding-bottom");
      return;
    }

    const projectListWrap = projectListSection.closest(".plist-wrap");
    if (!projectListWrap) return;
    const currentPadding = parseFloat(window.getComputedStyle(projectListSection).paddingBottom) || 0;
    const contentBottom = projectListWrap.getBoundingClientRect().bottom + window.scrollY - currentPadding;
    const lastProjectTop = projectRowTops[projectRowTops.length - 1];
    const stickyHeight = stickyStage?.offsetHeight || window.innerHeight;
    const desiredStickyEnd = lastProjectTop - projectActivationOffset + stickyHeight;
    const releasePadding = Math.max(0, desiredStickyEnd - contentBottom);

    projectListSection.style.setProperty("padding-bottom", `${releasePadding}px`, "important");
  };

  const getScrollPosition = () => {
    if (!projectRowTops.length) return 0;

    const activationLine = window.scrollY + projectActivationOffset;

    if (activationLine <= projectRowTops[0]) return 0;
    if (activationLine >= projectRowTops[projectRowTops.length - 1]) return projectRowTops.length - 1;

    for (let index = 1; index < projectRowTops.length; index += 1) {
      if (activationLine <= projectRowTops[index]) {
        const previousTop = projectRowTops[index - 1];
        const distance = projectRowTops[index] - previousTop;
        const progress = distance > 0 ? (activationLine - previousTop) / distance : 0;
        return index - 1 + Math.min(Math.max(progress, 0), 1);
      }
    }

    return projectRowTops.length - 1;
  };

  /*
   * Frame media is kept alive per project index instead of being rebuilt on
   * every step. Two reasons:
   *
   *  - Rebuilding meant a brand new <video> with an empty buffer on each scroll
   *    tick, so the box went blank until the first fragment arrived.
   *  - The old code copied `currentSrc` off the hidden slide, which under
   *    hls.js is a MediaSource blob URL that cannot be attached to a second
   *    element at all.
   *
   * Now the neighbours on either side are warmed up in the background, and a
   * new index is only swapped in once it can actually paint a frame — until
   * then the previous project stays on screen.
   */
  // Two steps of lead in each direction (5 players at most). At 1 a clip only
  // started loading as it became the neighbour, which is roughly one scroll
  // step of warning — not enough at speed.
  const framePrefetchRadius = 2;
  const frameMediaByIndex = new Map();
  let pendingFrameIndex = -1;
  let frameQualityTimer = 0;

  const isFrameMediaReady = (media) =>
    media instanceof HTMLVideoElement
      ? media.readyState >= 2 /* HAVE_CURRENT_DATA */
      : media.complete && media.naturalWidth > 0;

  const createFrameMedia = (index) => {
    const sourceMedia = slides[index]?.querySelector("img, video");
    if (!sourceMedia) return null;

    if (sourceMedia instanceof HTMLVideoElement) {
      const video = document.createElement("video");
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.preload = "auto";
      video.setAttribute("muted", "");
      video.setAttribute("playsinline", "");
      // Take the Bunny sources, not the slide's resolved `src`. Deliberately no
      // `data-hls-manual` here: bunny-hls is a deferred module, so on first run
      // it may not have defined `attachBunnyHlsTo` yet, and its own initial
      // sweep needs to be allowed to pick these up.
      if (sourceMedia.dataset.hls) video.dataset.hls = sourceMedia.dataset.hls;
      if (sourceMedia.dataset.mp4) video.dataset.mp4 = sourceMedia.dataset.mp4;
      return video;
    }

    const image = document.createElement("img");
    image.alt = "";
    image.decoding = "async";
    image.sizes = `${Math.ceil(frame.getBoundingClientRect().width)}px`;
    const sourceSet = sourceMedia.getAttribute("srcset") || sourceMedia.dataset.srcset;
    if (sourceSet) image.srcset = sourceSet;
    const source =
      sourceMedia.currentSrc || sourceMedia.dataset.src || sourceMedia.getAttribute("src");
    if (source) image.src = source;
    return image;
  };

  const ensureFrameMedia = (index) => {
    if (index < 0 || index >= slides.length) return null;

    const cached = frameMediaByIndex.get(index);
    if (cached) return cached;

    const media = createFrameMedia(index);
    if (!media) return null;

    frameMediaByIndex.set(index, media);
    // Append before attaching: hls.js caps quality to the element's rendered
    // size, and a detached element measures zero.
    frame.appendChild(media);
    if (media instanceof HTMLVideoElement) window.attachBunnyHlsTo?.(media);
    return media;
  };

  const releaseFrameMedia = (index) => {
    const media = frameMediaByIndex.get(index);
    if (!media) return;

    frameMediaByIndex.delete(index);
    if (media instanceof HTMLVideoElement) {
      media.pause();
      window.detachBunnyHls?.(media);
    }
    media.remove();
  };

  const releaseAllFrameMedia = () => {
    Array.from(frameMediaByIndex.keys()).forEach(releaseFrameMedia);
    pendingFrameIndex = -1;
    currentFrameIndex = -1;
  };

  // Stand-in for a cold target: whichever cached clip is closest to the one we
  // actually want and already has a frame decoded.
  const showNearestReadyFrameMedia = (index) => {
    let nearestIndex = -1;
    let nearestDistance = Infinity;

    frameMediaByIndex.forEach((media, mediaIndex) => {
      if (!isFrameMediaReady(media)) return;

      const distance = Math.abs(mediaIndex - index);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = mediaIndex;
      }
    });

    if (nearestIndex === -1) return false;

    showFrameMedia(nearestIndex);
    return true;
  };

  // The two steps either side, counted along the list as it stands — with a
  // category filter on, the project that follows is rarely the next slide.
  const framePrefetchIndices = (index) => {
    const rank = activeRankByIndex.get(index);
    if (rank === undefined) return [index];

    const indices = [];
    for (let offset = -framePrefetchRadius; offset <= framePrefetchRadius; offset += 1) {
      const neighbour = activeIndices[rank + offset];
      if (neighbour !== undefined) indices.push(neighbour);
    }

    return indices;
  };

  const evictFrameMediaBeyondRadius = (index, { keepVisible = false } = {}) => {
    const keep = new Set(framePrefetchIndices(index));

    Array.from(frameMediaByIndex.keys()).forEach((cachedIndex) => {
      if (keepVisible && cachedIndex === currentFrameIndex) return;
      // Never drop the clip we are actively waiting on — tearing down its
      // player mid-load is what leaves the box with nothing to swap in.
      if (cachedIndex === pendingFrameIndex) return;
      if (!keep.has(cachedIndex)) releaseFrameMedia(cachedIndex);
    });
  };

  const showFrameMedia = (index) => {
    const media = frameMediaByIndex.get(index);
    // Bail rather than hide every layer: a late `loadeddata` can arrive for an
    // element that has since been evicted, and unhiding nothing is a blank box.
    if (!media) return;

    frameMediaByIndex.forEach((other, otherIndex) => {
      const isCurrent = otherIndex === index;
      other.classList.toggle("is-spotlight-visible", isCurrent);
      if (other instanceof HTMLVideoElement && !isCurrent) other.pause();
    });

    if (media instanceof HTMLVideoElement) {
      media.play().catch(() => {});
      // Now that it is the one on screen, spend the bandwidth on it. Re-checked
      // shortly after, by which point its own fragments have refined the
      // estimate that decides how far it can climb.
      window.upgradeBunnyHlsQuality?.(media);
      window.clearTimeout(frameQualityTimer);
      frameQualityTimer = window.setTimeout(() => {
        if (frameMediaByIndex.get(currentFrameIndex) === media) {
          window.upgradeBunnyHlsQuality?.(media);
        }
      }, 2000);
    }

    slides.forEach((slide, slideIndex) => {
      slide.classList.toggle("is-spotlight-frame-source", slideIndex === index);
    });

    frame.dataset.spotlightIndex = String(index);
    if (caption) caption.textContent = projectDescriptions[index] || "";
    currentFrameIndex = index;
    pendingFrameIndex = -1;

    // The outgoing project was held back from eviction while it was the only
    // thing on screen; now that something else is painted it can go.
    evictFrameMediaBeyondRadius(index);
  };

  const syncSpotlightFrame = (index) => {
    if (!frame || index < 0 || index >= slides.length) return;

    // Drop players that scrolled out of reach before opening new ones, so at
    // most a handful of clips ever compete for bandwidth. The visible one is
    // spared even on a long jump — it is the fallback that keeps the box full.
    evictFrameMediaBeyondRadius(index, { keepVisible: true });
    framePrefetchIndices(index).forEach(ensureFrameMedia);

    if (index === currentFrameIndex || index === pendingFrameIndex) return;

    const media = ensureFrameMedia(index);
    if (!media) return;

    if (isFrameMediaReady(media)) {
      showFrameMedia(index);
      return;
    }

    // Still buffering. Never paint an empty box: keep whatever is already on
    // screen, and if nothing is, borrow the closest clip that has buffered.
    if (currentFrameIndex === -1) showNearestReadyFrameMedia(index);

    // Swap in the real one once it has a frame to show — unless scrolling or
    // hovering has moved on by then.
    pendingFrameIndex = index;

    const reveal = () => {
      stopWaiting();
      // Re-check identity: the cache entry may have been released and rebuilt
      // while this element was loading.
      if (pendingFrameIndex === index && frameMediaByIndex.get(index) === media) {
        showFrameMedia(index);
      }
    };
    const abandon = () => {
      stopWaiting();
      if (pendingFrameIndex === index) pendingFrameIndex = -1;
    };
    const stopWaiting = () => {
      media.removeEventListener("loadeddata", reveal);
      media.removeEventListener("load", reveal);
      media.removeEventListener("error", abandon);
    };

    media.addEventListener("loadeddata", reveal);
    media.addEventListener("load", reveal);
    media.addEventListener("error", abandon);
  };

  const updateProjectButtonOpacities = (scrollPosition) => {
    projectButtons.forEach((button, index) => {
      if (!button) return;

      if (!projectSpotlightOptions.fadeProjectButtons) {
        button.style.setProperty("--project-list-opacity", "1");
        return;
      }

      const rank = activeRankByIndex.get(index);
      if (rank === undefined) return;

      const distance = Math.abs(rank - scrollPosition);
      const opacity = Math.max(
        projectButtonMinimumOpacity,
        1 - distance * projectButtonOpacityStep,
      );

      button.style.setProperty("--project-list-opacity", opacity.toFixed(3));
    });
  };

  const updateSpotlightSlideScales = () => {
    spotlightFrame = 0;
    const scrollPosition = getScrollPosition();
    updateProjectButtonOpacities(scrollPosition);

    if (window.innerWidth <= 700 || !activeIndices.length) {
      slides.forEach((slide) => {
        slide.classList.remove("is-spotlight-frame-source", "has-spotlight-shadow");
      });
      // The frame is hidden below the breakpoint and `.background-images-phone`
      // takes over, so shut the desktop players down rather than leave them
      // streaming behind a `display: none`.
      releaseAllFrameMedia();
      return;
    }

    const spotlightWidth = slides[activeIndices[0]].offsetWidth;
    const spotlightHalfWidth = spotlightWidth / 2;
    const spotlightCenter = spotlight.clientWidth / 2;

    slides.forEach((slide, index) => {
      const rank = activeRankByIndex.get(index);

      // Filtered out of the list, so it has no place in the stack.
      if (rank === undefined) {
        slide.style.setProperty("--project-spotlight-scale", 0);
        slide.style.setProperty("--project-spotlight-opacity", 0);
        slide.style.pointerEvents = "none";
        slide.classList.remove("has-spotlight-shadow");
        return;
      }

      const distance = rank - scrollPosition;
      const absoluteDistance = Math.abs(distance);
      const scale = Math.pow(spotlightScale, absoluteDistance);
      const opacity = Math.pow(spotlightOpacityStep, absoluteDistance);
      const visualWidth = slide.offsetWidth * scale;
      const stackOffset = getSpotlightStackOffset(absoluteDistance, spotlightStep);
      let desiredCenter = spotlightCenter;

      if (distance > 0) {
        desiredCenter += spotlightHalfWidth + stackOffset - visualWidth / 2;
      } else if (distance < 0) {
        desiredCenter -= spotlightHalfWidth + stackOffset - visualWidth / 2;
      }

      const visualLeft = desiredCenter - visualWidth / 2;
      const visualRight = desiredCenter + visualWidth / 2;
      let clipInset = "inset(0)";

      if (scale > 0 && distance > 0 && visualLeft < spotlightCenter - spotlightHalfWidth) {
        clipInset = `inset(0 0 0 ${(spotlightCenter - spotlightHalfWidth - visualLeft) / scale}px)`;
      } else if (scale > 0 && distance < 0 && visualRight > spotlightCenter + spotlightHalfWidth) {
        clipInset = `inset(0 ${(visualRight - spotlightCenter - spotlightHalfWidth) / scale}px 0 0)`;
      }

      slide.style.setProperty("--project-spotlight-scale", scale);
      slide.style.setProperty(
        "--project-spotlight-opacity",
        projectSpotlightOptions.showGhostImages ? opacity : 0,
      );
      slide.style.setProperty("--project-spotlight-translate-x", `${desiredCenter - spotlightCenter}px`);
      slide.style.setProperty("--project-spotlight-clip", clipInset);
      slide.style.pointerEvents = projectSpotlightOptions.showGhostImages ? "" : "none";
      slide.classList.toggle(
        "has-spotlight-shadow",
        projectSpotlightOptions.showGhostImages && absoluteDistance <= 3,
      );
    });

    activeIndices
      .map((index, rank) => ({ index, distance: Math.abs(rank - scrollPosition) }))
      .sort((a, b) => b.distance - a.distance)
      .forEach((item, stackIndex) => {
        slides[item.index].style.zIndex = String(stackIndex + 1);
      });

    // Hovering a project in the list takes precedence over the scroll position,
    // so an incoming scroll frame does not yank the preview back.
    syncSpotlightFrame(
      hoveredProjectIndex >= 0
        ? hoveredProjectIndex
        : activeIndices[Math.floor(scrollPosition + 0.0001)],
    );
  };

  const scheduleSpotlightUpdate = () => {
    if (spotlightFrame) return;
    spotlightFrame = window.requestAnimationFrame(updateSpotlightSlideScales);
  };

  const refreshSpotlightLayout = () => {
    measureProjectRows();
    // Deliberately does NOT reset `currentFrameIndex`. This runs on `load`,
    // `resize` and `fonts.ready`; clearing it made the very next sync treat a
    // populated frame as empty and swap in a clip that had not buffered yet —
    // which is exactly the blank box. The cache makes a re-sync a no-op anyway.
    scheduleSpotlightUpdate();
  };

  window.alignProjectSpotlightToIndex = (index) => {
    // Called with a project's place in the full list — the project that is
    // being returned from, which a filter may have since taken off screen.
    const rank = activeRankByIndex.get(Math.max(Number(index) || 0, 0)) ?? 0;

    measureProjectRows();
    if (!projectRowTops.length) return;

    const projectIndex = Math.min(rank, projectRowTops.length - 1);
    window.scrollTo(0, Math.max(0, projectRowTops[projectIndex] - projectActivationOffset));
    updateSpotlightSlideScales();
  };

  /*
   * The category menu previews what a filter would hold: hovering an entry
   * puts one of its projects in the frame. It goes through the same channel a
   * hovered row does, so it takes the same precedence over the scroll position
   * and is given up again the same way.
   */
  window.previewProjectSpotlight = (index) => {
    const projectIndex = Number(index);

    if (window.innerWidth <= 700) return;
    if (!Number.isInteger(projectIndex) || projectIndex < 0 || projectIndex >= slides.length) return;

    hoveredProjectIndex = projectIndex;
    syncSpotlightFrame(projectIndex);
  };

  window.clearProjectSpotlightPreview = () => {
    if (hoveredProjectIndex < 0) return;
    hoveredProjectIndex = -1;
    scheduleSpotlightUpdate();
  };

  // Gives up the claim without pulling the frame back: what was last pointed
  // at stays on screen, and the scroll position takes over again at the next
  // frame it asks for — the way the list leaves its highlight where it was.
  window.releaseProjectSpotlightPreview = () => {
    hoveredProjectIndex = -1;
  };

  // The category filter hides rows; the spotlight follows the ones that are
  // left, and re-measures because the list has just changed height.
  window.addEventListener("projectfilterchange", () => {
    refreshActiveProjects();
    hoveredProjectIndex = -1;
    refreshSpotlightLayout();
  });

  // The legacy app already moves the `.hover` highlight down the list on
  // mouseenter; this makes the preview follow it. Leaving a row hands control
  // back to the scroll position.
  projectButtons.forEach((button, index) => {
    if (!button) return;

    button.addEventListener("mouseenter", () => {
      if (window.innerWidth <= 700) return;
      hoveredProjectIndex = index;
      syncSpotlightFrame(index);
    });

    button.addEventListener("mouseleave", () => {
      if (hoveredProjectIndex !== index) return;
      hoveredProjectIndex = -1;
      scheduleSpotlightUpdate();
    });
  });

  window.addEventListener("scroll", scheduleSpotlightUpdate, { passive: true });
  window.addEventListener("resize", refreshSpotlightLayout);
  window.addEventListener("load", refreshSpotlightLayout, { once: true });
  frame?.addEventListener("click", () => slides[currentFrameIndex]?.click());
  document.fonts?.ready.then(refreshSpotlightLayout);

  measureProjectRows();
  updateSpotlightSlideScales();
})();
