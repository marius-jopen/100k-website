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
    uniform float cornerRadius;
    uniform float cover;
    uniform float progress;
    uniform float power;
    varying vec2 vUv;

    // Cover mode flips the comparison: the image is scaled to fill the frame
    // and the overhang is cropped, instead of fitting inside it.
    vec2 containedSize(vec2 textureSize) {
      float frameAspect = resolution.x / resolution.y;
      float textureAspect = textureSize.x / textureSize.y;

      if ((textureAspect > frameAspect) != (cover > 0.5)) {
        return vec2(resolution.x, resolution.x / textureAspect);
      }

      return vec2(resolution.y * textureAspect, resolution.y);
    }

    // Contained images sit against the bottom left of the frame; a covering
    // one is centred, so it crops evenly from both sides.
    vec2 containUv(vec2 uv, vec2 textureSize) {
      vec2 fittedSize = containedSize(textureSize) / resolution;
      if (cover > 0.5) return (uv - 0.5) / fittedSize + 0.5;
      return uv / fittedSize;
    }

    float roundedMask(vec2 uv, vec2 textureSize) {
      // A covering image runs past every edge of the frame, so it has no
      // corner of its own to round.
      if (cover > 0.5) return 1.0;
      vec2 fittedSize = containedSize(textureSize);
      float radius = min(cornerRadius, min(fittedSize.x, fittedSize.y) * 0.5);
      vec2 point = (uv - 0.5) * fittedSize;
      vec2 distanceToCorner = abs(point) - (fittedSize * 0.5 - radius);
      float signedDistance = length(max(distanceToCorner, 0.0))
        + min(max(distanceToCorner.x, distanceToCorner.y), 0.0)
        - radius;

      return 1.0 - smoothstep(-1.0, 1.0, signedDistance);
    }

    void main() {
      vec2 fromUv = containUv(vUv, fromSize);
      vec2 toUv = containUv(vUv, toSize);
      vec4 backgroundColor = vec4(0.0);
      vec4 fromImage = texture2D(fromTexture, clamp(fromUv, 0.0, 1.0));
      vec4 toImage = texture2D(toTexture, clamp(toUv, 0.0, 1.0));

      fromImage.rgb *= 0.97;
      toImage.rgb *= 0.97;

      vec4 fromColor = mix(backgroundColor, fromImage, roundedMask(fromUv, fromSize));
      vec4 toColor = mix(backgroundColor, toImage, roundedMask(toUv, toSize));
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
      alpha: true,
      antialias: false,
      powerPreference: "high-performance",
      preserveDrawingBuffer: true,
    });

    // `data-fit="cover"` fills the frame edge to edge instead of fitting the
    // image inside it — for a slideshow that is the background of a box.
    const cover = slideshow.dataset.fit === "cover";

    if (!gl) {
      canvas.style.backgroundImage = `url("${sources[0]}")`;
      canvas.style.backgroundColor = "transparent";
      canvas.style.backgroundPosition = cover ? "center" : "left bottom";
      canvas.style.backgroundRepeat = "no-repeat";
      canvas.style.backgroundSize = cover ? "cover" : "contain";
      canvas.style.filter = "brightness(0.97)";
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
      cornerRadius: gl.getUniformLocation(program, "cornerRadius"),
      cover: gl.getUniformLocation(program, "cover"),
      fromSize: gl.getUniformLocation(program, "fromSize"),
      fromTexture: gl.getUniformLocation(program, "fromTexture"),
      power: gl.getUniformLocation(program, "power"),
      progress: gl.getUniformLocation(program, "progress"),
      resolution: gl.getUniformLocation(program, "resolution"),
      toSize: gl.getUniformLocation(program, "toSize"),
      toTexture: gl.getUniformLocation(program, "toTexture"),
    };

    gl.uniform1i(uniforms.fromTexture, 0);
    gl.uniform1i(uniforms.toTexture, 1);
    gl.uniform1f(uniforms.power, 5);
    gl.uniform1f(uniforms.cover, cover ? 1 : 0);

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
      const cornerRadius = parseFloat(getComputedStyle(slideshow).borderTopLeftRadius) || 0;
      gl.uniform1f(uniforms.cornerRadius, cornerRadius * 0.5 * dpr);
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
