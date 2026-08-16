/*
 * Streams the phone corner preview, one clip at a time.
 *
 * bunny-hls attaches every `data-hls` video that belongs to the current
 * breakpoint, and below 700px that was all ~20 phone slides at once: several MB
 * of HLS before a single pill has been reached, and more concurrent players
 * than a phone will decode. The slides carry `data-hls-manual` now — the same
 * escape the desktop spotlight uses — and are opened here instead: the one the
 * list is on plus its neighbour either side, so stepping through the list still
 * paints immediately.
 */
(function () {
  const PHONE_BREAKPOINT = 700;
  // Two either side, the radius the desktop spotlight keeps. One was enough
  // for stepping down the list a row at a time, but a flick moves three or
  // four rows at once and landed on a clip that had never been asked for.
  const PREFETCH_RADIUS = 2;

  const container = document.querySelector(".background-images-phone");
  if (!container) return;

  const slides = Array.from(container.querySelectorAll(":scope > a"));
  const videos = slides.map((slide) => slide.querySelector("video"));
  if (!videos.some(Boolean)) return;

  // Same index space as the slides: `data-ix` is a position in the full project
  // list, and a filter hides rows without removing them.
  const rows = Array.from(document.querySelectorAll(".projects-list > div"));

  const attached = new Set();
  let retryTimer = 0;

  const isPhone = () => window.innerWidth <= PHONE_BREAKPOINT;

  // Neighbours along the list as it stands — with a category filter on, the
  // project that follows is rarely the next slide.
  const prefetchIndices = (index) => {
    const visible = rows.length
      ? rows
        .map((row, rowIndex) => (row.classList.contains("is-filtered-out") ? -1 : rowIndex))
        .filter((rowIndex) => rowIndex >= 0)
      : slides.map((_slide, slideIndex) => slideIndex);

    const rank = visible.indexOf(index);
    if (rank === -1) return [index];

    const wanted = [];
    for (let offset = -PREFETCH_RADIUS; offset <= PREFETCH_RADIUS; offset += 1) {
      const neighbour = visible[rank + offset];
      if (neighbour !== undefined) wanted.push(neighbour);
    }

    return wanted;
  };

  const release = (index) => {
    attached.delete(index);
    const video = videos[index];
    if (!video) return;
    video.pause();
    window.detachBunnyHls?.(video);
  };

  const sync = () => {
    // bunny-hls is a bundled module, so on a cold load it may not have defined
    // its hooks yet. Nothing to attach with — come back for it.
    if (!window.attachBunnyHlsTo) {
      window.clearTimeout(retryTimer);
      retryTimer = window.setTimeout(sync, 100);
      return;
    }

    const activeIndex = slides.findIndex((slide) => slide.classList.contains("active"));

    if (!isPhone() || activeIndex === -1) {
      Array.from(attached).forEach(release);
      return;
    }

    const wanted = new Set(prefetchIndices(activeIndex));
    Array.from(attached).forEach((index) => {
      if (!wanted.has(index)) release(index);
    });

    wanted.forEach((index) => {
      const video = videos[index];
      if (!video) return;

      if (!attached.has(index)) {
        attached.add(index);
        window.attachBunnyHlsTo(video);
      }

      if (index === activeIndex) {
        video.play().catch(() => {});
        window.upgradeBunnyHlsQuality?.(video);
      } else {
        video.pause();
      }
    });
  };

  // `active` moves from slide to slide as the legacy scroll handler walks the
  // list — that is the only signal that the corner is showing something else.
  new MutationObserver(sync).observe(container, {
    attributeFilter: ["class"],
    attributes: true,
    subtree: true,
  });

  window.addEventListener("projectfilterchange", sync);
  window.addEventListener("resize", sync);
  sync();
})();
