/* Keeps the project list, its highlighted pill and the cached media preview in sync. */
(function () {
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
  let projectRowTops = [];
  let spotlightFrame = 0;
  let currentFrameIndex = -1;
  let hoveredProjectIndex = -1;
  let pointerMovedSinceScroll = true;

  /*
   * A category filter hides rows without touching the slides — a slide is
   * addressed by its position in the full project list everywhere else on the
   * page — so the two are kept apart here: `activeIndices` is the rows still on
   * screen, in order, and everything that reads as a position in the list
   * (the active row, prefetching and row measurements) works in that space
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

  // Find the last project that crossed the activation line. The old carousel
  // needed a fractional position for scaling dozens of ghost cards; the
  // single-frame design only needs one discrete row, so a binary search avoids
  // walking the whole list on every scroll frame.
  const getActiveRank = () => {
    if (!projectRowTops.length) return 0;

    const activationLine = window.scrollY + projectActivationOffset;

    if (activationLine <= projectRowTops[0]) return 0;
    if (activationLine >= projectRowTops[projectRowTops.length - 1]) return projectRowTops.length - 1;

    let low = 0;
    let high = projectRowTops.length - 1;

    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      if (projectRowTops[middle] <= activationLine) low = middle;
      else high = middle - 1;
    }

    return low;
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
  const videoPosterByIndex = new Map();
  let pendingFrameIndex = -1;
  let frameQualityTimer = 0;

  const isFrameMediaReady = (media) =>
    media instanceof HTMLVideoElement
      ? media.readyState >= 2 /* HAVE_CURRENT_DATA */
        || media.dataset.spotlightPosterReady === "true"
      : media.complete && media.naturalWidth > 0;

  const ensureVideoPoster = (index, priority = "low") => {
    const cached = videoPosterByIndex.get(index);
    if (cached) {
      if (priority === "high") cached.fetchPriority = "high";
      return cached;
    }

    const sourceVideo = slides[index]?.querySelector("[data-spotlight-video][data-poster]");
    const source = sourceVideo?.dataset.poster;
    if (!source) return null;

    const poster = new Image();
    poster.alt = "";
    poster.decoding = "async";
    poster.fetchPriority = priority;
    poster.src = source;
    videoPosterByIndex.set(index, poster);
    return poster;
  };

  /*
   * The frame is sized from whatever it is showing, so a portrait clip gets a
   * portrait box instead of being cropped into a landscape one. Only ever read
   * off media that `isFrameMediaReady` has cleared — before that a video
   * reports 0×0 — and only at swap time: an hls.js quality upgrade changes
   * `videoWidth` mid-playback, and re-reading it there would twitch the box for
   * the rounding difference between two renditions of the same source.
   */
  const frameMediaRatio = (media) => {
    const width = media instanceof HTMLVideoElement
      ? media.videoWidth || Number(media.dataset.spotlightWidth)
      : media.naturalWidth;
    const height = media instanceof HTMLVideoElement
      ? media.videoHeight || Number(media.dataset.spotlightHeight)
      : media.naturalHeight;

    return width > 0 && height > 0 ? width / height : 0;
  };

  const createFrameMedia = (index) => {
    const sourceMedia = slides[index]?.querySelector("img, [data-spotlight-video]");
    if (!sourceMedia) return null;

    if (sourceMedia.matches("[data-spotlight-video]")) {
      const video = document.createElement("video");
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.preload = "auto";
      video.setAttribute("muted", "");
      video.setAttribute("playsinline", "");
      if (sourceMedia.dataset.width) video.dataset.spotlightWidth = sourceMedia.dataset.width;
      if (sourceMedia.dataset.height) video.dataset.spotlightHeight = sourceMedia.dataset.height;

      const poster = ensureVideoPoster(index, "high");
      if (poster) {
        video.poster = poster.src;
        const markPosterReady = () => {
          video.dataset.spotlightPosterReady = "true";
          video.dispatchEvent(new Event("spotlightposterload"));
        };

        if (poster.complete && poster.naturalWidth > 0) markPosterReady();
        else poster.addEventListener("load", markPosterReady, { once: true });
      }

      // Take the Bunny sources from the metadata element. Deliberately no
      // `data-hls-manual` here: bunny-hls is a deferred module, so on first run
      // its own initial sweep may need to pick this real player up.
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

  // Target first, then the two steps either side along the visible list. This
  // lets the requested clip claim the network before its warm neighbours.
  const framePrefetchIndices = (index) => {
    const rank = activeRankByIndex.get(index);
    if (rank === undefined) return [index];

    const indices = [index];
    for (let distance = 1; distance <= framePrefetchRadius; distance += 1) {
      const next = activeIndices[rank + distance];
      const previous = activeIndices[rank - distance];
      if (next !== undefined) indices.push(next);
      if (previous !== undefined) indices.push(previous);
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

    // Reshape the box in the same frame the new clip is revealed. Doing it any
    // earlier would squash the outgoing clip, which is deliberately left on
    // screen while the incoming one is still buffering.
    const ratio = frameMediaRatio(media);
    if (ratio) {
      spotlight.style.setProperty("--project-spotlight-media-ratio", ratio.toFixed(4));
    }

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
    // Most scroll frames remain within the same project row. Do no cache,
    // media or DOM work until the discrete project selection actually changes.
    if (index === currentFrameIndex) return;

    const cachedMedia = frameMediaByIndex.get(index);
    if (index === pendingFrameIndex && cachedMedia) {
      // Keep the missed-load-event safeguard without reprising the full cache
      // sweep on every scroll frame while this target is buffering.
      if (isFrameMediaReady(cachedMedia)) showFrameMedia(index);
      return;
    }

    // Drop players that scrolled out of reach before opening new ones, so at
    // most a handful of clips ever compete for bandwidth. The visible one is
    // spared even on a long jump — it is the fallback that keeps the box full.
    evictFrameMediaBeyondRadius(index, { keepVisible: true });
    framePrefetchIndices(index).forEach(ensureFrameMedia);

    const media = ensureFrameMedia(index);
    if (!media) return;

    // Check readiness before the pending-index shortcut. A cached image can
    // finish decoding between its load event and the next scroll frame; the
    // old order kept returning early forever in that case.
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
      media.removeEventListener("spotlightposterload", reveal);
      media.removeEventListener("load", reveal);
      media.removeEventListener("error", abandon);
    };

    media.addEventListener("loadeddata", reveal);
    media.addEventListener("spotlightposterload", reveal);
    media.addEventListener("load", reveal);
    media.addEventListener("error", abandon);
  };

  const syncProjectButtonHighlight = (index) => {
    const nextButton = projectButtons[index];
    if (!nextButton) return;

    const highlightedButton = document.querySelector(
      ".projects-list .project-list-item.hover",
    );
    if (highlightedButton === nextButton) return;

    highlightedButton?.classList.remove("hover");
    nextButton.classList.add("hover");
  };

  const updateSpotlight = () => {
    spotlightFrame = 0;

    if (window.innerWidth <= 700 || !activeIndices.length) {
      // The frame is hidden below the breakpoint and `.background-images-phone`
      // takes over, so shut the desktop players down rather than leave them
      // streaming behind a `display: none`.
      releaseAllFrameMedia();
      return;
    }

    const activeProjectIndex = hoveredProjectIndex >= 0
      ? hoveredProjectIndex
      : activeIndices[getActiveRank()];
    syncProjectButtonHighlight(activeProjectIndex);
    syncSpotlightFrame(activeProjectIndex);
  };

  const scheduleSpotlightUpdate = () => {
    if (spotlightFrame) return;
    spotlightFrame = window.requestAnimationFrame(updateSpotlight);
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
    updateSpotlight();
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
  // mouseenter; this makes the preview follow it. The last hovered row keeps
  // control while the pointer crosses a gap between pills, so neither the
  // highlight nor the media flickers back to the scroll position. Scrolling
  // explicitly clears the hover farther below.
  projectButtons.forEach((button, index) => {
    if (!button) return;

    button.addEventListener("mouseenter", () => {
      if (window.innerWidth <= 700) return;
      // Scrolling can move a new pill underneath a stationary pointer without
      // producing a reliable mouseleave. Only a real pointer move may take
      // control away from the scroll position again.
      if (!pointerMovedSinceScroll) return;
      hoveredProjectIndex = index;
      syncProjectButtonHighlight(index);
      syncSpotlightFrame(index);
    });
  });

  window.addEventListener("pointermove", () => {
    pointerMovedSinceScroll = true;
  }, { passive: true });
  window.addEventListener("scroll", () => {
    pointerMovedSinceScroll = false;
    hoveredProjectIndex = -1;
    scheduleSpotlightUpdate();
  }, { passive: true });
  window.addEventListener("resize", refreshSpotlightLayout);
  window.addEventListener("load", refreshSpotlightLayout, { once: true });
  // Posters are small stills, so warming all of them after the page load gives
  // every video an instant scroll-state preview without opening dozens of HLS
  // players. The clips themselves remain limited to the nearby media cache.
  window.addEventListener("load", () => {
    slides.forEach((_, index) => ensureVideoPoster(index));
  }, { once: true });
  frame?.addEventListener("click", () => slides[currentFrameIndex]?.click());
  document.fonts?.ready.then(refreshSpotlightLayout);

  measureProjectRows();
  updateSpotlight();
})();
