/*
 * Service-card slideshows reuse the ColourDistance transition from the
 * existing project-list WebGL background.
 */
(function () {
  const slideshows = document.querySelectorAll(".service-webgl-slideshow");

  if (!slideshows.length) return;

  const vertexShaderSource = `
    attribute vec2 position;
    varying vec2 vUv;

    void main() {
      vUv = position * 0.5 + 0.5;
      gl_Position = vec4(position, 0.0, 1.0);
    }
  `;

  const fragmentShaderSource = `
    precision mediump float;

    uniform sampler2D fromTexture;
    uniform sampler2D toTexture;
    uniform vec2 resolution;
    uniform vec2 fromSize;
    uniform vec2 toSize;
    uniform float progress;
    uniform float power;
    uniform float zoom;
    varying vec2 vUv;

    vec2 coverUv(vec2 uv, vec2 textureSize) {
      float frameAspect = resolution.x / resolution.y;
      float textureAspect = textureSize.x / textureSize.y;
      vec2 scale = vec2(1.0);

      if (textureAspect > frameAspect) {
        scale.x = frameAspect / textureAspect;
      } else {
        scale.y = textureAspect / frameAspect;
      }

      return (uv - 0.5) * (scale / zoom) + 0.5;
    }

    void main() {
      vec4 fromColor = texture2D(fromTexture, coverUv(vUv, fromSize));
      vec4 toColor = texture2D(toTexture, coverUv(vUv, toSize));
      float colorStep = step(distance(fromColor, toColor), progress);

      gl_FragColor = mix(
        mix(fromColor, toColor, colorStep),
        toColor,
        pow(progress, power)
      );
    }
  `;

  const compileShader = (gl, type, source) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      gl.deleteShader(shader);
      return null;
    }

    return shader;
  };

  const createProgram = (gl) => {
    const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);

    if (!vertexShader || !fragmentShader) return null;

    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      return null;
    }

    return program;
  };

  const loadImage = (source) => new Promise((resolve) => {
    const image = new Image();

    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = source;
  });

  const easeInOutCubic = (value) => (
    value < 0.5
      ? 4 * value * value * value
      : 1 - Math.pow(-2 * value + 2, 3) / 2
  );

  const createSlideshow = async (slideshow) => {
    if (slideshow.dataset.serviceWebglReady === "true") return;
    slideshow.dataset.serviceWebglReady = "true";

    const canvas = slideshow.querySelector("canvas.service-webgl-canvas");
    const sources = Array.from(slideshow.querySelectorAll(".lay-webgl-slide img"))
      .map((image) => image.getAttribute("src"))
      .filter(Boolean);

    if (!(canvas instanceof HTMLCanvasElement) || !sources.length) return;

    const gl = canvas.getContext("webgl", {
      alpha: false,
      antialias: false,
      powerPreference: "high-performance",
      preserveDrawingBuffer: true,
    });

    if (!gl) {
      canvas.style.backgroundImage = `url("${sources[0]}")`;
      slideshow.classList.add("lay-webgl-reveal");
      return;
    }

    const program = createProgram(gl);
    if (!program) return;

    const images = (await Promise.all(sources.map(loadImage))).filter(Boolean);
    if (!images.length) return;

    const textures = images.map((image) => {
      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        image,
      );

      return {
        height: image.naturalHeight,
        texture,
        width: image.naturalWidth,
      };
    });

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );

    gl.useProgram(program);
    const positionLocation = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    const uniforms = {
      fromSize: gl.getUniformLocation(program, "fromSize"),
      fromTexture: gl.getUniformLocation(program, "fromTexture"),
      power: gl.getUniformLocation(program, "power"),
      progress: gl.getUniformLocation(program, "progress"),
      resolution: gl.getUniformLocation(program, "resolution"),
      toSize: gl.getUniformLocation(program, "toSize"),
      toTexture: gl.getUniformLocation(program, "toTexture"),
      zoom: gl.getUniformLocation(program, "zoom"),
    };

    gl.uniform1i(uniforms.fromTexture, 0);
    gl.uniform1i(uniforms.toTexture, 1);
    gl.uniform1f(uniforms.power, 5);
    gl.uniform1f(uniforms.zoom, 1.3);

    const transitionDuration = Number(slideshow.dataset.transitionspeed) || 3000;
    const autoplaySpeed = Number(slideshow.dataset.autoplayspeed) || 1800;
    const autoplayDelay = Number(slideshow.dataset.autoplaydelay) || 0;
    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const state = {
      inView: false,
      reducedMotion: reducedMotionQuery.matches,
      visible: !document.hidden,
    };
    let fromIndex = textures.length - 1;
    let toIndex = 0;
    let transitionProgress = 1;
    let lastFrameTime = null;
    let animationFrame = 0;
    let autoplayTimer = 0;
    let hasStarted = false;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(Math.round(rect.width * dpr), 1);
      const height = Math.max(Math.round(rect.height * dpr), 1);

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      gl.viewport(0, 0, width, height);
      gl.uniform2f(uniforms.resolution, width, height);
    };

    const render = () => {
      const from = textures[fromIndex];
      const to = textures[toIndex];

      resize();
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, from.texture);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, to.texture);
      gl.uniform2f(uniforms.fromSize, from.width, from.height);
      gl.uniform2f(uniforms.toSize, to.width, to.height);
      gl.uniform1f(uniforms.progress, easeInOutCubic(transitionProgress));
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    };

    const shouldAnimate = () => (
      state.inView
      && state.visible
      && !state.reducedMotion
      && textures.length > 1
    );

    const scheduleNext = (delay) => {
      window.clearTimeout(autoplayTimer);
      autoplayTimer = 0;
      if (!shouldAnimate()) return;
      // A hovered pill owns the morph until the pointer leaves.
      if (slideshow.serviceSlidePinned) return;

      autoplayTimer = window.setTimeout(() => {
        autoplayTimer = 0;
        fromIndex = toIndex;
        toIndex = (toIndex + 1) % textures.length;
        transitionProgress = 0;
        lastFrameTime = null;
        hasStarted = true;
        animationFrame = window.requestAnimationFrame(animate);
      }, delay);
    };

    const animate = (currentTime) => {
      animationFrame = 0;
      if (!shouldAnimate()) return;

      if (lastFrameTime !== null) {
        transitionProgress = Math.min(
          transitionProgress + (currentTime - lastFrameTime) / transitionDuration,
          1,
        );
      }
      lastFrameTime = currentTime;
      render();

      if (transitionProgress < 1) {
        animationFrame = window.requestAnimationFrame(animate);
      } else {
        lastFrameTime = null;
        scheduleNext(autoplaySpeed);
      }
    };

    const syncPlayback = () => {
      if (!shouldAnimate()) {
        window.clearTimeout(autoplayTimer);
        autoplayTimer = 0;
        if (animationFrame) window.cancelAnimationFrame(animationFrame);
        animationFrame = 0;
        lastFrameTime = null;
        render();
        return;
      }

      if (transitionProgress < 1) {
        if (!animationFrame) animationFrame = window.requestAnimationFrame(animate);
      } else if (!autoplayTimer) {
        scheduleNext(hasStarted ? autoplaySpeed : autoplayDelay);
      }
    };

    render();
    slideshow.classList.add("lay-webgl-reveal");

    /**
     * Jump the morph straight to one slide, used when a service pill is
     * hovered. Autoplay is suspended for as long as a pill holds it, and
     * `releaseSlide` hands control back.
     */
    let pinnedIndex = -1;

    slideshow.showServiceSlide = (index) => {
      if (!Number.isInteger(index) || index < 0 || index >= textures.length) return;
      if (index === toIndex && transitionProgress >= 1) {
        pinnedIndex = index;
        slideshow.serviceSlidePinned = true;
        return;
      }

      pinnedIndex = index;
      slideshow.serviceSlidePinned = true;
      window.clearTimeout(autoplayTimer);
      autoplayTimer = 0;
      fromIndex = toIndex;
      toIndex = index;
      transitionProgress = 0;
      lastFrameTime = null;
      hasStarted = true;
      if (!animationFrame) animationFrame = window.requestAnimationFrame(animate);
    };

    slideshow.releaseServiceSlide = () => {
      if (pinnedIndex === -1) return;
      pinnedIndex = -1;
      slideshow.serviceSlidePinned = false;
      syncPlayback();
    };

    const observer = new IntersectionObserver(([entry]) => {
      state.inView = entry.isIntersecting;
      syncPlayback();
    });
    observer.observe(slideshow);

    const resizeObserver = new ResizeObserver(render);
    resizeObserver.observe(slideshow);
    document.fonts?.ready.then(render);

    reducedMotionQuery.addEventListener("change", (event) => {
      state.reducedMotion = event.matches;
      syncPlayback();
    });

    document.addEventListener("visibilitychange", () => {
      state.visible = !document.hidden;
      syncPlayback();
    });
  };

  slideshows.forEach(createSlideshow);

  /* ---------------------------------------------------- hover-driven morph */

  // Hovering a service pill pushes that pill's image into its card's morph.
  // Delegated, because the pills are static markup rendered by Astro.
  document.querySelectorAll(".gallery-view .gallery-item-view").forEach((card) => {
    const slideshow = card.querySelector(".service-webgl-slideshow");
    if (!slideshow) return;

    card.querySelectorAll(".descr span.service[data-service-slide]").forEach((pill) => {
      const index = Number(pill.dataset.serviceSlide);
      if (!Number.isInteger(index)) return;

      pill.addEventListener("pointerenter", () => {
        slideshow.showServiceSlide?.(index);
      });
    });

    // Leaving the card as a whole resumes autoplay — moving between two pills
    // must not blink back to the rotation in between.
    card.addEventListener("pointerleave", () => {
      slideshow.releaseServiceSlide?.();
    });
  });
})();
