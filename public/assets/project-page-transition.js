(function () {
  const overlay = document.querySelector(".project-page-transition");
  const projectPreview = overlay?.querySelector(".project-page-transition__project");
  const projectLinkSelector = [
    ".project-list-item",
    ".background-images a",
    ".background-images-phone a",
    ".next-project",
  ].join(", ");

  if (!overlay || !projectPreview || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  document.body.appendChild(overlay);

  let isReplayingClick = false;
  let isTransitioning = false;
  let preparedPostNodes = null;
  let preparedPostMediaReady = Promise.resolve();
  let projectContentStartScale = null;
  let visibleProjectId = document.body.dataset.type === "post"
    ? document.body.dataset.id
    : null;
  const rectangleMotionDuration = 400;
  const projectMotionDuration = 460;
  const projectEntryDelay = 100;
  const reverseRectangleDelay = Math.max(
    0,
    projectEntryDelay + projectMotionDuration - rectangleMotionDuration,
  );
  const transitionClasses = [
    "is-entering",
    "is-expanding",
    "is-project-entering",
    "is-project-switching",
    "is-project-switch-expanding",
    "is-closing",
    "is-preview-ready",
    "is-project-leaving",
    "is-collapsing",
    "is-fading",
  ];
  const scrollKeys = new Set(["ArrowDown", "ArrowUp", "End", "Home", "PageDown", "PageUp", " "]);

  const preventScroll = (event) => event.preventDefault();
  const preventScrollKey = (event) => {
    if (scrollKeys.has(event.key)) event.preventDefault();
  };

  const setScrollInputLocked = (isLocked) => {
    const method = isLocked ? "addEventListener" : "removeEventListener";

    window[method]("wheel", preventScroll, { capture: true, passive: false });
    window[method]("touchmove", preventScroll, { capture: true, passive: false });
    window[method]("keydown", preventScrollKey, { capture: true });
  };

  const wait = (duration) => new Promise((resolve) => window.setTimeout(resolve, duration));

  const waitForNextPaint = () => new Promise((resolve) => {
    window.requestAnimationFrame(() => window.requestAnimationFrame(resolve));
  });

  const projectColorAsRgba = (color, alpha = 0.4) => {
    if (typeof color !== "string") return `rgba(255, 255, 255, ${alpha})`;

    const hex = color.trim().replace(/^#/, "");
    const expandedHex = hex.length === 3
      ? hex.split("").map((character) => character + character).join("")
      : hex;

    if (!/^[0-9a-f]{6}$/i.test(expandedHex)) {
      return `rgba(255, 255, 255, ${alpha})`;
    }

    const value = Number.parseInt(expandedHex, 16);
    const red = value >> 16;
    const green = (value >> 8) & 255;
    const blue = value & 255;

    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
  };

  const setProjectTransitionColor = (project) => {
    overlay.style.setProperty(
      "--project-transition-color",
      projectColorAsRgba(project?.color),
    );
  };

  const waitForImageReady = (image) => new Promise((resolve) => {
    let completed = false;
    let fallback = 0;

    const complete = () => {
      if (completed) return;
      completed = true;
      image.removeEventListener("load", complete);
      image.removeEventListener("error", complete);
      window.clearTimeout(fallback);

      const decode = typeof image.decode === "function"
        ? image.decode().catch(() => {})
        : Promise.resolve();
      decode.then(resolve);
    };

    if (image.complete) {
      complete();
      return;
    }

    image.addEventListener("load", complete, { once: true });
    image.addEventListener("error", complete, { once: true });
    fallback = window.setTimeout(complete, 2000);
  });

  const waitForVideoReady = (video) => new Promise((resolve) => {
    let completed = false;
    let fallback = 0;

    const complete = () => {
      if (completed) return;
      completed = true;
      video.removeEventListener("loadeddata", complete);
      video.removeEventListener("error", complete);
      window.clearTimeout(fallback);
      resolve();
    };

    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      complete();
      return;
    }

    video.addEventListener("loadeddata", complete, { once: true });
    video.addEventListener("error", complete, { once: true });
    fallback = window.setTimeout(complete, 2000);
  });

  const waitForInitialProjectMedia = (root) => {
    const firstMedia = Array.from(root?.querySelectorAll("img, video") || [])
      .find((media) => !media.closest(".next-project"));

    if (firstMedia instanceof HTMLImageElement) {
      firstMedia.loading = "eager";
      return waitForImageReady(firstMedia);
    }
    if (firstMedia instanceof HTMLVideoElement) {
      firstMedia.preload = "auto";
      return waitForVideoReady(firstMedia);
    }
    return Promise.resolve();
  };

  const waitForVisibleProjectMedia = (root) => {
    const media = Array.from(root?.querySelectorAll("img, video") || [])
      .filter((item) => {
        const rect = item.getBoundingClientRect();
        const figure = item.closest(".static-grid-block");
        const figureOpacity = figure ? Number.parseFloat(getComputedStyle(figure).opacity) : 1;

        return rect.right > 0
          && rect.bottom > 0
          && rect.left < window.innerWidth
          && rect.top < window.innerHeight
          && figureOpacity > 0;
      });

    return Promise.all(media.map((item) => {
      if (item instanceof HTMLImageElement) return waitForImageReady(item);
      if (item instanceof HTMLVideoElement) return waitForVideoReady(item);
      return Promise.resolve();
    }));
  };

  const waitForTransition = (element, propertyName, fallbackDuration) => new Promise((resolve) => {
    let completed = false;
    const complete = () => {
      if (completed) return;
      completed = true;
      element.removeEventListener("transitionend", handleTransitionEnd);
      window.clearTimeout(fallback);
      resolve();
    };
    const handleTransitionEnd = (event) => {
      if (event.target === element && event.propertyName === propertyName) complete();
    };
    const fallback = window.setTimeout(complete, fallbackDuration);

    element.addEventListener("transitionend", handleTransitionEnd);
  });

  const commitPreparedPost = () => {
    if (!preparedPostNodes) return;

    const post = document.querySelector("#post");
    if (post) {
      post.replaceChildren(...preparedPostNodes);
      post.scrollTo(0, 0);
    }
    preparedPostNodes = null;
  };

  const prepareProjectEnhancements = (root) => {
    if (!(root instanceof Element)) return;

    document.dispatchEvent(new CustomEvent("prepare-project-enhancements", {
      detail: { root },
    }));
  };

  const resetOverlay = () => {
    commitPreparedPost();
    overlay.classList.remove(...transitionClasses);
    [
      "--project-transition-color",
      "--project-transition-height",
      "--project-transition-left",
      "--project-transition-top",
      "--project-transition-width",
      "--project-content-start-scale",
    ].forEach((property) => overlay.style.removeProperty(property));
    projectPreview.replaceChildren();
    setScrollInputLocked(false);
    document.documentElement.classList.remove("is-project-page-transitioning");
    document.body.classList.remove(
      "is-project-page-transitioning",
      "is-project-entry-transitioning",
      "is-project-to-project-transitioning",
      "is-project-toolbar-ready",
    );
    isTransitioning = false;
  };

  const cloneProjectIntoPreview = (post, scrollTop = 0) => {
    const fragment = document.createDocumentFragment();
    const scrollSnapshot = document.createElement("div");

    Array.from(post.children).forEach((child) => fragment.appendChild(child.cloneNode(true)));
    scrollSnapshot.className = "project-page-transition__scroll-snapshot";
    scrollSnapshot.appendChild(fragment);
    scrollSnapshot.style.transform = `translate3d(0, -${scrollTop}px, 0)`;
    projectPreview.replaceChildren(scrollSnapshot);
    projectPreview.scrollTop = 0;
    projectPreview.querySelectorAll("[id]").forEach((element) => element.removeAttribute("id"));
    prepareProjectEnhancements(projectPreview);
    projectPreview.querySelectorAll("video").forEach((video) => {
      video.muted = true;
      video.play().catch(() => {});
    });
  };

  const prepareProject = (link, initialScale = null) => {
    const post = document.querySelector("#post");
    const wasShowingPost = document.body.classList.contains("show-post");
    const outgoingPostNodes = wasShowingPost && post ? Array.from(post.childNodes) : null;
    const outgoingScrollTop = post?.scrollTop || 0;

    isReplayingClick = true;
    link.click();
    isReplayingClick = false;

    if (!post) return;

    prepareProjectEnhancements(post);
    post.scrollTo(0, 0);
    preparedPostMediaReady = waitForInitialProjectMedia(post);
    document.body.classList.remove("show-frontpage-animation", "show-post-animation");

    if (!wasShowingPost) {
      document.body.classList.remove("show-post");
      document.body.classList.add("show-frontpage");
    }

    cloneProjectIntoPreview(post);

    if (outgoingPostNodes) {
      preparedPostNodes = Array.from(post.childNodes);
      post.replaceChildren(...outgoingPostNodes);
      post.scrollTo(0, outgoingScrollTop);
    }

    if (Number.isFinite(initialScale)) {
      projectContentStartScale = initialScale;
    } else {
      const overlayRect = overlay.getBoundingClientRect();
      projectContentStartScale = Math.min(
        overlayRect.width * 0.88 / window.innerWidth,
        overlayRect.height * 0.88 / window.innerHeight,
      );
    }

    overlay.style.setProperty("--project-content-start-scale", String(projectContentStartScale));
  };

  const showPreparedProject = (projectId = null) => {
    commitPreparedPost();
    prepareProjectEnhancements(document.querySelector("#post"));
    document.body.classList.remove("show-frontpage", "show-frontpage-animation", "show-post-animation");
    document.body.classList.add("show-post");
    visibleProjectId = projectId == null ? visibleProjectId : String(projectId);
  };

  const setInitialRectangle = () => {
    const spotlightFrame = document.querySelector(".project-spotlight-frame");
    const spotlightRect = spotlightFrame?.getBoundingClientRect();
    const hasSpotlightRect = spotlightRect && spotlightRect.width > 0 && spotlightRect.height > 0;
    const spotlightRatio = hasSpotlightRect
      ? spotlightRect.width / spotlightRect.height
      : 2560 / 1446;
    let rectangleWidth = hasSpotlightRect
      ? spotlightRect.width
      : Math.min(window.innerWidth * 0.64, window.innerHeight * 0.64 * spotlightRatio);
    let rectangleHeight = rectangleWidth / spotlightRatio;

    if (!hasSpotlightRect && rectangleHeight > window.innerHeight * 0.85) {
      rectangleHeight = window.innerHeight * 0.85;
      rectangleWidth = rectangleHeight * spotlightRatio;
    }
    // The rectangle borrows the spotlight's *size*, but always grows from the
    // middle of the viewport — the preview box itself is right aligned, and
    // expanding from there read as lopsided.
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;

    overlay.style.setProperty("--project-transition-width", `${rectangleWidth}px`);
    overlay.style.setProperty("--project-transition-height", `${rectangleHeight}px`);
    overlay.style.setProperty("--project-transition-left", `${centerX - rectangleWidth / 2}px`);
    overlay.style.setProperty("--project-transition-top", `${centerY - rectangleHeight / 2}px`);

    return { height: rectangleHeight, width: rectangleWidth };
  };

  const startTransition = async (link) => {
    const isProjectToProjectTransition = document.body.classList.contains("show-post")
      && link.matches(".next-project");
    const projectIndex = Number(link.dataset.ix);
    const project = Number.isInteger(projectIndex)
      ? window.passedData?.everything?.projects?.[projectIndex]
      : null;

    overlay.classList.remove(...transitionClasses);
    const initialRectangle = setInitialRectangle();
    setScrollInputLocked(true);
    document.documentElement.classList.add("is-project-page-transitioning");
    document.body.classList.add("is-project-page-transitioning");
    document.body.classList.toggle(
      "is-project-entry-transitioning",
      !isProjectToProjectTransition,
    );
    document.body.classList.toggle(
      "is-project-to-project-transitioning",
      isProjectToProjectTransition,
    );

    if (isProjectToProjectTransition) {
      const initialScale = Math.min(
        initialRectangle.width * 0.88 / window.innerWidth,
        initialRectangle.height * 0.88 / window.innerHeight,
      );

      overlay.classList.add("is-project-switching");
      overlay.getBoundingClientRect();
      prepareProject(link, initialScale);
      projectPreview.getBoundingClientRect();

      const projectTransition = waitForTransition(
        projectPreview,
        "transform",
        projectMotionDuration + 100,
      );
      overlay.classList.add("is-project-switch-expanding");
      await Promise.all([projectTransition, preparedPostMediaReady]);

      showPreparedProject(project?.id);
      await waitForNextPaint();
      resetOverlay();
      return;
    }

    overlay.getBoundingClientRect();
    overlay.classList.add("is-entering");
    await waitForNextPaint();

    const expandTransition = waitForTransition(overlay, "width", rectangleMotionDuration + 110);
    overlay.classList.add("is-expanding");
    await wait(projectEntryDelay);

    const initialScale = Math.min(
      initialRectangle.width * 0.88 / window.innerWidth,
      initialRectangle.height * 0.88 / window.innerHeight,
    );
    prepareProject(link, initialScale);
    projectPreview.getBoundingClientRect();
    const projectTransition = waitForTransition(projectPreview, "transform", projectMotionDuration + 100);
    overlay.classList.add("is-project-entering");

    // Release the toolbar the moment the rectangle has filled the screen. It
    // used to wait on the content transition too (and originally on the first
    // image loading), which read as a second of dead time after the project
    // had visibly arrived.
    expandTransition.then(() => document.body.classList.add("is-project-toolbar-ready"));

    await Promise.all([expandTransition, projectTransition]);
    await preparedPostMediaReady;

    showPreparedProject(project?.id);
    await waitForNextPaint();
    resetOverlay();
  };

  const getProjectById = (projectId) => {
    const projects = window.passedData?.everything?.projects || [];

    return projects.find((project) => String(project.id) === String(projectId));
  };

  const getCurrentProject = () => {
    return getProjectById(window.history.state?.id);
  };

  const getCurrentProjectIndex = () => {
    const projects = window.passedData?.everything?.projects || [];
    const currentId = window.history.state?.id;

    return projects.findIndex((project) => String(project.id) === String(currentId));
  };

  const startReverseTransition = async (backButton, options = {}) => {
    const {
      currentProject: currentProjectOverride = null,
      historyAlreadyChanged = false,
    } = options;
    const post = document.querySelector("#post");
    const postShadow = document.querySelector("#post-shadow");
    const currentProject = currentProjectOverride || getCurrentProject();

    if (!post) {
      isReplayingClick = true;
      backButton.click();
      isReplayingClick = false;
      resetOverlay();
      return;
    }

    const outgoingScrollTop = post.scrollTop;

    overlay.classList.remove(...transitionClasses);
    const currentProjectIndex = currentProject
      ? (window.passedData?.everything?.projects || []).findIndex(
        (project) => String(project.id) === String(currentProject.id),
      )
      : getCurrentProjectIndex();
    post.scrollTop = outgoingScrollTop;
    cloneProjectIntoPreview(post, outgoingScrollTop);
    setScrollInputLocked(true);
    overlay.classList.add("is-closing");
    overlay.getBoundingClientRect();

    await waitForVisibleProjectMedia(projectPreview);
    await waitForNextPaint();

    document.documentElement.classList.add("is-project-page-transitioning");
    document.body.classList.add("is-project-page-transitioning");
    overlay.classList.add("is-preview-ready");
    overlay.getBoundingClientRect();

    if (!historyAlreadyChanged) {
      isReplayingClick = true;
      backButton.click();
      isReplayingClick = false;
    }
    document.body.classList.remove("show-post", "show-post-animation", "show-frontpage-animation");
    document.body.classList.add("show-frontpage");

    // The body scrollbar returns with the front page. Measure the Spotlight only
    // after that layout change has painted, otherwise the target can be shifted
    // by the scrollbar gutter or the restored front-page scroll position.
    await waitForNextPaint();
    if (currentProjectIndex >= 0) window.alignProjectSpotlightToIndex?.(currentProjectIndex);
    await waitForNextPaint();

    const initialRectangle = setInitialRectangle();
    const fallbackMidpointScale = Math.min(
      ((initialRectangle.width + window.innerWidth) / 2) * 0.88 / window.innerWidth,
      ((initialRectangle.height + window.innerHeight) / 2) * 0.88 / window.innerHeight,
    );

    overlay.style.setProperty(
      "--project-content-start-scale",
      String(projectContentStartScale ?? fallbackMidpointScale),
    );
    overlay.getBoundingClientRect();

    const projectTransition = waitForTransition(projectPreview, "transform", projectMotionDuration + 100);
    overlay.classList.add("is-project-leaving");
    await wait(reverseRectangleDelay);

    // Re-read the exact rendered frame immediately before the rectangle starts
    // collapsing, so late scrollbar/layout settling cannot leave an offset.
    setInitialRectangle();
    overlay.getBoundingClientRect();
    const collapseTransition = waitForTransition(overlay, "width", rectangleMotionDuration + 110);
    overlay.classList.add("is-collapsing");
    await Promise.all([projectTransition, collapseTransition]);

    if (historyAlreadyChanged) {
      post.replaceChildren();
      post.scrollTo(0, 0);
      document.title = window.passedData?.title || document.title;
    } else {
      postShadow?.dispatchEvent(new Event("transitionend"));
    }
    visibleProjectId = null;
    resetOverlay();
  };

  document.addEventListener("click", (event) => {
    if (isReplayingClick) return;
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const target = event.target;
    const backButton = target instanceof Element ? target.closest(".back-button") : null;

    if (backButton && document.body.classList.contains("show-post")) {
      event.preventDefault();
      event.stopImmediatePropagation();

      if (isTransitioning) return;
      isTransitioning = true;
      startReverseTransition(backButton).catch(resetOverlay);
      return;
    }

    const link = target instanceof Element ? target.closest(projectLinkSelector) : null;

    if (!(link instanceof HTMLAnchorElement) || !link.href) return;
    if (document.body.classList.contains("show-post") && !link.matches(".next-project")) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    if (isTransitioning) return;
    isTransitioning = true;
    startTransition(link).catch(resetOverlay);
  }, true);

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || event.repeat || event.defaultPrevented) return;

    if (document.body.classList.contains("show-client-modal")) {
      const closeButton = document.querySelector(".become-a-client-modal .close");
      if (closeButton instanceof HTMLElement) {
        event.preventDefault();
        closeButton.click();
      }
      return;
    }

    if (!document.body.classList.contains("show-post") || isTransitioning) return;

    const backButton = document.querySelector(".back-button");
    if (!(backButton instanceof HTMLElement)) return;

    event.preventDefault();
    backButton.click();
  });

  window.addEventListener("popstate", (event) => {
    if (
      !document.body.classList.contains("show-post")
      || event.state?.type !== "frontpage"
      || isTransitioning
    ) return;

    const backButton = document.querySelector(".back-button");
    if (!(backButton instanceof HTMLElement)) return;

    event.stopImmediatePropagation();
    isTransitioning = true;
    startReverseTransition(backButton, {
      currentProject: getProjectById(visibleProjectId),
      historyAlreadyChanged: true,
    }).catch(resetOverlay);
  }, true);

  window.addEventListener("pageshow", resetOverlay);
})();
