(function () {
  const desktopMediaQuery = window.matchMedia("(min-width: 701px)");
  const carouselSelector = ".project-media-carousel";
  const gridSelector = ".static-project-grid";
  const mediaBoundaryOffset = 2;
  let updateFrame = 0;

  const getProjectScroller = (element) => element.closest("#post");

  const getMediaAspectRatio = (media) => {
    const attributeWidth = Number(media.getAttribute("width"));
    const attributeHeight = Number(media.getAttribute("height"));
    const intrinsicWidth = media instanceof HTMLVideoElement
      ? media.videoWidth
      : media.naturalWidth;
    const intrinsicHeight = media instanceof HTMLVideoElement
      ? media.videoHeight
      : media.naturalHeight;
    const width = intrinsicWidth || attributeWidth;
    const height = intrinsicHeight || attributeHeight;

    return width > 0 && height > 0 ? width / height : 0;
  };

  const syncLandscapeMediaRatios = (carousel) => {
    const mediaEntries = Array.from(carousel.querySelectorAll(".static-grid-block"))
      .map((figure) => {
        const media = figure.querySelector("img, video");

        if (!(media instanceof HTMLImageElement || media instanceof HTMLVideoElement)) {
          return null;
        }

        const ratio = getMediaAspectRatio(media);
        const hasIntrinsicDimensions = media instanceof HTMLVideoElement
          ? media.videoWidth > 0 && media.videoHeight > 0
          : media.complete && media.naturalWidth > 0 && media.naturalHeight > 0;

        if (!hasIntrinsicDimensions && media.dataset.carouselRatioPending !== "true") {
          media.dataset.carouselRatioPending = "true";
          media.addEventListener(
            media instanceof HTMLVideoElement ? "loadedmetadata" : "load",
            () => {
              delete media.dataset.carouselRatioPending;
              syncLandscapeMediaRatios(carousel);
              scheduleCarouselUpdate();
            },
            { once: true },
          );
        }

        return { figure, ratio };
      })
      .filter(Boolean);
    const referenceEntry = mediaEntries.find(({ ratio }) => ratio > 1);

    if (!referenceEntry) {
      carousel.style.removeProperty("--project-media-landscape-width");
      carousel.style.removeProperty("--project-media-landscape-height");
      mediaEntries.forEach(({ figure }) => {
        figure.classList.remove("is-project-media-landscape");
      });
      return;
    }

    const referenceRatio = referenceEntry.ratio;
    const availableWidth = Math.min(window.innerWidth * 0.86, 1200);
    const availableHeight = window.innerHeight * 0.74;
    const mediaWidth = Math.min(availableWidth, availableHeight * referenceRatio);
    const mediaHeight = mediaWidth / referenceRatio;

    carousel.style.setProperty("--project-media-landscape-width", `${mediaWidth}px`);
    carousel.style.setProperty("--project-media-landscape-height", `${mediaHeight}px`);
    carousel.dataset.landscapeMediaRatio = referenceRatio.toFixed(6);
    mediaEntries.forEach(({ figure, ratio }) => {
      figure.classList.toggle("is-project-media-landscape", ratio > 1);
    });
  };

  const getCarouselTop = (carousel, scroller) => {
    const carouselRect = carousel.getBoundingClientRect();
    const scrollerRect = scroller.getBoundingClientRect();

    return carouselRect.top - scrollerRect.top + scroller.scrollTop;
  };

  const setActiveMedia = (carousel, activeIndex, isVisible) => {
    const figures = Array.from(carousel.querySelectorAll(".static-grid-block"));
    const nextIndex = Math.min(Math.max(activeIndex, 0), figures.length - 1);

    figures.forEach((figure, index) => {
      const isActive = index === nextIndex;
      figure.classList.toggle("is-project-media-active", isActive);
      figure.setAttribute("aria-hidden", String(!isActive));

      figure.querySelectorAll("video").forEach((video) => {
        if (!(video instanceof HTMLVideoElement)) return;

        video.dataset.carouselPlaybackReady = "true";
        video.muted = true;
        video.loop = true;
        video.playsInline = true;

        if (isActive && isVisible) {
          if (video.paused) video.play().catch(() => {});
        } else {
          video.pause();
        }
      });
    });

    carousel.dataset.activeMediaIndex = String(nextIndex);
    syncFlipFaceSize(carousel, figures[nextIndex]);
  };

  // The info side of the flip is sized to whichever media is showing, so the
  // back face reads as the back of that same rounded box. `offsetWidth/Height`
  // rather than `getBoundingClientRect`, because the box is inside the rotating
  // wrapper and its client rect is squashed mid-animation.
  const syncFlipFaceSize = (carousel, activeFigure) => {
    const media = activeFigure?.querySelector("img, video");
    if (!(media instanceof HTMLElement)) return;

    const width = media.offsetWidth;
    const height = media.offsetHeight;
    if (!width || !height) return;

    carousel.style.setProperty("--project-media-flip-width", `${width}px`);
    carousel.style.setProperty("--project-media-flip-height", `${height}px`);
  };

  const setMediaIndicators = (
    carousel,
    activeIndex,
    activeProgress,
    isVisible,
    hasMediaProgress,
  ) => {
    const indicators = Array.from(
      carousel.querySelectorAll(".project-media-carousel__indicator"),
    );

    indicators.forEach((indicator, index) => {
      const isActive = index === activeIndex;
      const progress = isActive ? Math.min(Math.max(activeProgress, 0), 1) : 0;

      indicator.classList.toggle("is-active", isActive);
      indicator.classList.toggle("is-progressing", isActive && hasMediaProgress);
      indicator.setAttribute("aria-current", isActive ? "true" : "false");
      indicator.style.setProperty(
        "--project-media-indicator-fill",
        `${(progress - 1) * 100}%`,
      );
    });

    const indicatorList = carousel.querySelector(".project-media-carousel__indicators");
    if (indicatorList instanceof HTMLElement) {
      indicatorList.classList.toggle("is-visible", isVisible);
    }
  };

  const positionMediaIndicators = (carousel, activeIndex) => {
    const stickyStage = carousel.querySelector(".project-media-carousel__sticky");
    const indicatorList = carousel.querySelector(".project-media-carousel__indicators");
    const figures = Array.from(carousel.querySelectorAll(".static-grid-block"));
    const activeFigure = figures[activeIndex];

    if (
      !(stickyStage instanceof HTMLElement)
      || !(indicatorList instanceof HTMLElement)
      || !(activeFigure instanceof HTMLElement)
    ) return;

    const stickyRect = stickyStage.getBoundingClientRect();
    const mediaRect = activeFigure.getBoundingClientRect();
    const indicatorHeight = indicatorList.offsetHeight;
    const freeAreaTop = Math.min(
      Math.max(mediaRect.bottom, stickyRect.top),
      stickyRect.bottom,
    );
    const freeAreaCenter = freeAreaTop + ((stickyRect.bottom - freeAreaTop) / 2);
    const minTop = (indicatorHeight / 2) + 8;
    const maxTop = stickyRect.height - (indicatorHeight / 2) - 8;
    const relativeTop = Math.min(
      Math.max(freeAreaCenter - stickyRect.top, minTop),
      maxTop,
    );

    indicatorList.style.top = `${relativeTop}px`;
  };

  const scrollToMedia = (carousel, mediaIndex) => {
    const scroller = getProjectScroller(carousel);
    const figures = Array.from(carousel.querySelectorAll(".static-grid-block"));

    if (
      !(scroller instanceof HTMLElement)
      || mediaIndex < 0
      || mediaIndex >= figures.length
    ) return;

    const stepDistance = Number(carousel.dataset.stepDistance) || 1;
    const carouselTop = getCarouselTop(carousel, scroller);
    const targetScrollTop = carouselTop
      + (mediaIndex * stepDistance)
      + mediaBoundaryOffset;

    scroller.scrollTop = targetScrollTop;
    updateCarousel(carousel);
  };

  const scrollToGridMedia = (figure) => {
    const scroller = getProjectScroller(figure);

    if (!(scroller instanceof HTMLElement)) return;

    const scrollerRect = scroller.getBoundingClientRect();
    const figureRect = figure.getBoundingClientRect();

    scroller.scrollTop += figureRect.top
      - scrollerRect.top
      + mediaBoundaryOffset;
  };

  const advanceToNextMedia = (figure) => {
    const scroller = getProjectScroller(figure);
    const carousel = figure.closest(carouselSelector);

    if (!(scroller instanceof HTMLElement)) return;

    if (carousel instanceof HTMLElement) {
      const activeIndex = Number(carousel.dataset.activeMediaIndex) || 0;
      const lastIndex = carousel.querySelectorAll(".static-grid-block").length - 1;

      // Past the last slide there is nothing left to step to, so carry on to
      // the end of the project — the next-project section.
      if (activeIndex >= lastIndex) {
        scroller.scrollTo({ top: scroller.scrollHeight, behavior: "smooth" });
        return;
      }

      scrollToMedia(carousel, activeIndex + 1);
      return;
    }

    const grid = figure.closest(gridSelector);
    const figures = Array.from(grid?.querySelectorAll(".static-grid-block") || []);
    const figureIndex = figures.indexOf(figure);
    const nextFigure = figures[figureIndex + 1];

    if (!(nextFigure instanceof HTMLElement)) return;

    scrollToGridMedia(nextFigure);
  };

  const moveToAdjacentMedia = (direction) => {
    const scroller = document.querySelector("#post");

    if (!(scroller instanceof HTMLElement)) return false;

    const carousel = scroller.querySelector(carouselSelector);
    if (carousel instanceof HTMLElement) {
      const figures = Array.from(carousel.querySelectorAll(".static-grid-block"));
      const activeIndex = Number(carousel.dataset.activeMediaIndex) || 0;
      const targetIndex = activeIndex + direction;

      if (targetIndex >= 0 && targetIndex < figures.length) {
        scrollToMedia(carousel, targetIndex);
      }
      return figures.length > 0;
    }

    const figures = Array.from(
      scroller.querySelectorAll(`${gridSelector} .static-grid-block`),
    );
    if (!figures.length) return false;

    const scrollerTop = scroller.getBoundingClientRect().top;
    let activeIndex = 0;

    figures.forEach((figure, index) => {
      if (figure.getBoundingClientRect().top <= scrollerTop + mediaBoundaryOffset) {
        activeIndex = index;
      }
    });

    const targetFigure = figures[activeIndex + direction];
    if (targetFigure instanceof HTMLElement) scrollToGridMedia(targetFigure);

    return true;
  };

  const measureCarousel = (carousel) => {
    const figures = Array.from(carousel.querySelectorAll(".static-grid-block"));
    const stepDistance = Math.min(Math.max(window.innerHeight * 0.62, 280), 620);
    const scrollDistance = Math.max(figures.length, 1) * stepDistance;

    carousel.style.setProperty(
      "--project-media-carousel-height",
      `${window.innerHeight + scrollDistance}px`,
    );
    carousel.dataset.stepDistance = String(stepDistance);
  };

  const updateCarousel = (carousel) => {
    const scroller = getProjectScroller(carousel);
    const figures = Array.from(carousel.querySelectorAll(".static-grid-block"));

    if (!(scroller instanceof HTMLElement) || !figures.length) return;

    const stepDistance = Number(carousel.dataset.stepDistance) || 1;
    const carouselTop = getCarouselTop(carousel, scroller);
    const scrollPosition = Math.max((scroller.scrollTop - carouselTop) / stepDistance, 0);
    const mediaPosition = scrollPosition;
    const activeIndex = Math.min(Math.floor(mediaPosition + 0.0001), figures.length - 1);
    const activeProgress = Math.min(Math.max(mediaPosition - activeIndex, 0), 1);
    const hasMediaProgress = mediaPosition > 0.0001;
    const stickyStage = carousel.querySelector(".project-media-carousel__sticky");
    const stickyRect = stickyStage?.getBoundingClientRect();
    const scrollerRect = scroller.getBoundingClientRect();
    const isVisible = Boolean(
      stickyRect
      && stickyRect.bottom > scrollerRect.top
      && stickyRect.top < scrollerRect.bottom,
    );

    setActiveMedia(carousel, activeIndex, isVisible);
    setMediaIndicators(
      carousel,
      activeIndex,
      activeProgress,
      isVisible,
      hasMediaProgress,
    );
    positionMediaIndicators(carousel, activeIndex);
  };

  const updateCarousels = () => {
    updateFrame = 0;
    document.querySelectorAll(`#post ${carouselSelector}`).forEach(updateCarousel);
  };

  const scheduleCarouselUpdate = () => {
    if (!updateFrame) updateFrame = window.requestAnimationFrame(updateCarousels);
  };

  const createCarousel = (grid) => {
    const figures = Array.from(grid.querySelectorAll(".static-grid-block"));

    if (!figures.length || grid.closest(carouselSelector)) return;

    const carousel = document.createElement("div");
    const stickyStage = document.createElement("div");
    const indicatorList = document.createElement("div");
    // `flipper` holds the two faces: the gallery grid, and an empty back the
    // project info modal is moved into when it is first opened.
    const flipper = document.createElement("div");
    const backFace = document.createElement("div");

    carousel.className = "project-media-carousel";
    stickyStage.className = "project-media-carousel__sticky";
    indicatorList.className = "project-media-carousel__indicators";
    indicatorList.setAttribute("aria-hidden", "true");
    flipper.className = "project-media-carousel__flip";
    backFace.className = "project-media-carousel__back";

    figures.forEach((figure, index) => {
      const indicator = document.createElement("span");
      const label = figure.querySelector("figcaption")?.textContent?.trim();

      indicator.className = "project-media-carousel__indicator";
      indicator.setAttribute("aria-label", label || `Media ${index + 1}`);
      indicator.setAttribute("aria-current", index === 0 ? "true" : "false");
      indicator.style.setProperty("--project-media-indicator-fill", "-100%");
      indicatorList.appendChild(indicator);
    });

    grid.before(carousel);
    flipper.appendChild(grid);
    flipper.appendChild(backFace);
    stickyStage.appendChild(flipper);
    stickyStage.appendChild(indicatorList);
    carousel.appendChild(stickyStage);
    grid.dataset.projectMediaCarouselReady = "true";

    figures.forEach((figure, index) => {
      figure.classList.toggle("is-project-media-active", index === 0);
      figure.setAttribute("aria-hidden", String(index !== 0));
    });

    if ("ResizeObserver" in window) {
      const mediaResizeObserver = new ResizeObserver(scheduleCarouselUpdate);

      figures.forEach((figure) => mediaResizeObserver.observe(figure));
      carousel.projectMediaResizeObserver = mediaResizeObserver;
    }

    syncLandscapeMediaRatios(carousel);
    measureCarousel(carousel);
    setActiveMedia(carousel, 0, false);
  };

  /* ------------------------------------------------- flipped-card backdrop */

  /**
   * Behind the flipped info card, this project's own media crossfades as a
   * blurred wash instead of a flat white panel.
   *
   * Stills only: a stack of muted looping videos behind a blur would cost far
   * more than it shows, so videos contribute their Bunny poster frame.
   */
  const buildFlipBackdrop = (carousel) => {
    if (carousel.querySelector(":scope > .project-media-carousel__sticky > .project-media-carousel__morph")) {
      return;
    }

    const figures = Array.from(carousel.querySelectorAll(".static-grid-block"));
    const sources = figures
      .map((figure) => {
        const media = figure.querySelector("img, video");
        if (media instanceof HTMLImageElement) return media.currentSrc || media.src;
        if (media instanceof HTMLVideoElement) return media.getAttribute("poster");
        return null;
      })
      .filter(Boolean);

    if (!sources.length) return;

    const morph = document.createElement("div");
    morph.className = "project-media-carousel__morph";
    morph.setAttribute("aria-hidden", "true");

    sources.forEach((source, index) => {
      const layer = document.createElement("div");
      layer.className = "project-media-carousel__morph-layer";
      layer.style.backgroundImage = `url("${source}")`;
      if (index === 0) layer.classList.add("is-active");
      morph.appendChild(layer);
    });

    const stickyStage = carousel.querySelector(".project-media-carousel__sticky");
    // First child so it sits behind the flipper without needing a z-index war.
    stickyStage?.prepend(morph);
    carousel.morphLayerCount = sources.length;
  };

  const startFlipMorph = (carousel) => {
    const layers = Array.from(
      carousel.querySelectorAll(".project-media-carousel__morph-layer"),
    );
    if (layers.length < 2) return;

    window.clearInterval(carousel.morphTimer);
    let index = layers.findIndex((layer) => layer.classList.contains("is-active"));
    if (index < 0) index = 0;

    carousel.morphTimer = window.setInterval(() => {
      layers[index].classList.remove("is-active");
      index = (index + 1) % layers.length;
      layers[index].classList.add("is-active");
    }, 4200);
  };

  const stopFlipMorph = (carousel) => {
    window.clearInterval(carousel.morphTimer);
    carousel.morphTimer = 0;
  };

  // Called from SiteShell when the card turns, so the crossfade only runs while
  // it is actually on screen.
  window.setProjectFlipMorphActive = (isActive) => {
    document.querySelectorAll(`#post ${carouselSelector}`).forEach((carousel) => {
      if (isActive) {
        buildFlipBackdrop(carousel);
        startFlipMorph(carousel);
      } else {
        stopFlipMorph(carousel);
      }
    });
  };

  const removeCarousel = (carousel) => {
    const grid = carousel.querySelector(
      `:scope > .project-media-carousel__sticky > .project-media-carousel__flip > ${gridSelector}`,
    );

    if (!(grid instanceof HTMLElement)) return;

    carousel.projectMediaResizeObserver?.disconnect();
    carousel.before(grid);

    // Dropping below the desktop breakpoint tears the carousel down, so hand the
    // info modal back to the project flow instead of destroying it with the
    // flip's back face.
    const infoModal = carousel.querySelector(".project-info-modal");
    if (infoModal instanceof HTMLElement) {
      grid.before(infoModal);
      infoModal.classList.remove("is-open");
      infoModal.setAttribute("aria-hidden", "true");
    }
    // The contact form is borrowed from the body while flipped — hand it back
    // before this subtree disappears.
    window.restoreContactModal?.();
    stopFlipMorph(carousel);

    carousel.classList.remove("is-info-flipped");
    document.body.classList.remove(
      "show-project-info-modal",
      "show-project-info-flip",
      "show-project-contact-flip",
      "show-client-modal",
    );
    grid.removeAttribute("data-project-media-carousel-ready");
    grid.querySelectorAll(".static-grid-block").forEach((figure) => {
      figure.classList.remove("is-project-media-active", "is-project-media-landscape");
      figure.removeAttribute("aria-hidden");
      figure.querySelectorAll("video").forEach((video) => {
        if (video instanceof HTMLVideoElement) {
          video.removeAttribute("data-carousel-playback-ready");
        }
      });
    });
    carousel.remove();
  };

  const enhanceProjectMediaCarousels = (root = document) => {
    if (!(root instanceof Element || root instanceof Document)) return;

    if (!desktopMediaQuery.matches) {
      root.querySelectorAll(carouselSelector).forEach(removeCarousel);
      return;
    }

    root.querySelectorAll(gridSelector).forEach(createCarousel);
    root.querySelectorAll(carouselSelector).forEach((carousel) => {
      syncLandscapeMediaRatios(carousel);
      measureCarousel(carousel);
    });
    scheduleCarouselUpdate();
  };

  window.enhanceProjectMediaCarousels = enhanceProjectMediaCarousels;

  const projectScroller = document.querySelector("#post");

  projectScroller?.addEventListener("scroll", scheduleCarouselUpdate, { passive: true });
  projectScroller?.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;

    const figure = event.target.closest("img, video")?.closest(".static-grid-block");
    if (!(figure instanceof HTMLElement)) return;

    advanceToNextMedia(figure);
  });
  document.addEventListener("keydown", (event) => {
    if (event.repeat || event.defaultPrevented) return;

    const direction = {
      ArrowDown: 1,
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -1,
    }[event.key];
    const target = event.target;
    const isEditing = target instanceof HTMLElement
      && (target.isContentEditable || target.matches("input, select, textarea"));
    const hasOpenModal = document.body.classList.contains("show-client-modal")
      || document.body.classList.contains("show-project-info-modal");

    if (
      !direction
      || !document.body.classList.contains("show-post")
      || isEditing
      || hasOpenModal
      || event.altKey
      || event.ctrlKey
      || event.metaKey
      || event.shiftKey
    ) return;

    if (moveToAdjacentMedia(direction)) event.preventDefault();
  });
  window.addEventListener("resize", () => {
    enhanceProjectMediaCarousels(document);
    const post = document.querySelector("#post");
    if (post) {
      document.dispatchEvent(new CustomEvent("prepare-project-enhancements", {
        detail: { root: post },
      }));
    }
    scheduleCarouselUpdate();
  });
})();
