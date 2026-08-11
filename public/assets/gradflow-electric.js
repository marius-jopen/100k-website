/*
 * Silk gradient adapted from meerbahadin/gradflow (MIT).
 * https://github.com/meerbahadin/gradflow
 */
(function () {
  const canvases = document.querySelectorAll("canvas[data-gradflow-electric]");

  if (!canvases.length) return;

  const config = {
    color1: { r: 14, g: 82, b: 255 },
    color2: { r: 130, g: 220, b: 255 },
    color3: { r: 61, g: 159, b: 255 },
    speed: 0.4,
    scale: 0.6,
    type: "silk",
    noise: 0.16,
  };

  const vertexShaderSource = `
    attribute vec2 position;
    varying vec2 vUv;

    void main() {
      vUv = position * 0.5 + 0.5;
      gl_Position = vec4(position, 0.0, 1.0);
    }
  `;

  const fragmentShaderSource = `
    #ifdef GL_FRAGMENT_PRECISION_HIGH
      precision highp float;
    #else
      precision mediump float;
    #endif

    uniform float u_time;
    uniform vec3 u_color1;
    uniform vec3 u_color2;
    uniform vec3 u_color3;
    uniform float u_speed;
    uniform float u_scale;
    uniform float u_noise;
    uniform vec2 u_resolution;
    varying vec2 vUv;

    float noise(vec2 st) {
      return fract(sin(dot(st, vec2(12.9898, 78.233))) * 43758.5453);
    }

    vec3 silkGradient(vec2 uv, float time) {
      vec2 fragCoord = uv * u_resolution;
      vec2 invResolution = 1.0 / u_resolution.xy;
      vec2 centeredUv = (fragCoord * 2.0 - u_resolution.xy) * invResolution;

      centeredUv *= u_scale;

      float dampening = 1.0 / (1.0 + u_scale * 0.1);
      float d = -time * u_speed * 0.5;
      float a = 0.0;

      for (float i = 0.0; i < 8.0; ++i) {
        a += cos(i - d - a * centeredUv.x) * dampening;
        d += sin(centeredUv.y * i + a) * dampening;
      }

      d += time * u_speed * 0.5;

      vec3 patterns = vec3(
        cos(centeredUv.x * d + a) * 0.5 + 0.5,
        cos(centeredUv.y * a + d) * 0.5 + 0.5,
        cos((centeredUv.x + centeredUv.y) * (d + a) * 0.5) * 0.5 + 0.5
      );

      vec3 color1Mix = mix(u_color1, u_color2, patterns.x);
      vec3 color2Mix = mix(u_color2, u_color3, patterns.y);
      vec3 color3Mix = mix(u_color3, u_color1, patterns.z);

      vec3 finalColor = mix(color1Mix, color2Mix, patterns.z);
      finalColor = mix(finalColor, color3Mix, patterns.x * 0.5);

      vec3 originalPattern = vec3(
        cos(centeredUv * vec2(d, a)) * 0.6 + 0.4,
        cos(a + d) * 0.5 + 0.5
      );
      originalPattern = cos(originalPattern * cos(vec3(d, a, 2.5)) * 0.5 + 0.5);

      return mix(finalColor, originalPattern * finalColor, 0.3);
    }

    void main() {
      vec2 uv = vUv;
      float time = u_time * u_speed;
      vec3 color = silkGradient(uv, time);
      float grain = noise(uv * 200.0 + time * 0.1);
      color *= 1.0 - u_noise * 0.4 + u_noise * grain * 0.4;

      gl_FragColor = vec4(color, 1.0);
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

  const createGradient = (canvas) => {
    const gl = canvas.getContext("webgl", {
      alpha: false,
      antialias: false,
      powerPreference: "high-performance",
    });

    if (!gl) return;

    const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);

    if (!vertexShader || !fragmentShader) return;

    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      return;
    }

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
      time: gl.getUniformLocation(program, "u_time"),
      resolution: gl.getUniformLocation(program, "u_resolution"),
    };

    const normalizeColor = ({ r, g, b }) => [r / 255, g / 255, b / 255];

    gl.uniform3f(gl.getUniformLocation(program, "u_color1"), ...normalizeColor(config.color1));
    gl.uniform3f(gl.getUniformLocation(program, "u_color2"), ...normalizeColor(config.color2));
    gl.uniform3f(gl.getUniformLocation(program, "u_color3"), ...normalizeColor(config.color3));
    gl.uniform1f(gl.getUniformLocation(program, "u_speed"), config.speed);
    gl.uniform1f(gl.getUniformLocation(program, "u_scale"), config.scale);
    gl.uniform1f(gl.getUniformLocation(program, "u_noise"), config.noise);

    const state = {
      inView: true,
      reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      visible: !document.hidden,
    };
    let elapsed = 0;
    let lastFrameTime = null;
    let animationFrame = 0;
    const serviceCard = canvas.closest(".gallery-item-view");
    const textCutouts = Array.from(serviceCard?.querySelectorAll("canvas[data-service-title-cutout]") || [])
      .map((cutoutCanvas) => ({
        cutoutCanvas,
        cutoutContext: cutoutCanvas.getContext("2d"),
        element: cutoutCanvas.parentElement,
        text: cutoutCanvas.dataset.serviceTitleCutout || "",
      }))
      .filter(({ cutoutContext, element, text }) => cutoutContext && element && text);

    const resize = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const pixelWidth = Math.max(Math.round(width * dpr), 1);
      const pixelHeight = Math.max(Math.round(height * dpr), 1);

      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
      }

      gl.viewport(0, 0, pixelWidth, pixelHeight);
      gl.uniform2f(uniforms.resolution, width, height);
    };

    const renderTextCutout = ({ cutoutCanvas, cutoutContext, element, text }) => {
      const sourceRect = canvas.getBoundingClientRect();
      const titleRect = cutoutCanvas.getBoundingClientRect();
      if (!sourceRect.width || !sourceRect.height || !titleRect.width || !titleRect.height) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const pixelWidth = Math.max(Math.round(titleRect.width * dpr), 1);
      const pixelHeight = Math.max(Math.round(titleRect.height * dpr), 1);

      if (cutoutCanvas.width !== pixelWidth || cutoutCanvas.height !== pixelHeight) {
        cutoutCanvas.width = pixelWidth;
        cutoutCanvas.height = pixelHeight;
      }

      const sourceScaleX = canvas.width / sourceRect.width;
      const sourceScaleY = canvas.height / sourceRect.height;
      const sourceX = (titleRect.left - sourceRect.left) * sourceScaleX;
      const sourceY = (titleRect.top - sourceRect.top) * sourceScaleY;
      const sourceWidth = titleRect.width * sourceScaleX;
      const sourceHeight = titleRect.height * sourceScaleY;
      const titleStyle = window.getComputedStyle(element);
      const fontSize = Number.parseFloat(titleStyle.fontSize) || 16;

      cutoutContext.setTransform(1, 0, 0, 1, 0, 0);
      cutoutContext.clearRect(0, 0, pixelWidth, pixelHeight);
      cutoutContext.setTransform(dpr, 0, 0, dpr, 0, 0);
      cutoutContext.fillStyle = "#000";
      cutoutContext.font = `${titleStyle.fontStyle} ${titleStyle.fontWeight} ${fontSize}px ${titleStyle.fontFamily}`;
      cutoutContext.textAlign = "center";
      cutoutContext.textBaseline = "alphabetic";
      const centeringMetrics = cutoutContext.measureText("Wa");
      const glyphAscent = centeringMetrics.actualBoundingBoxAscent || fontSize * 0.75;
      const glyphDescent = centeringMetrics.actualBoundingBoxDescent || 0;
      const titleBaseline = (titleRect.height + glyphAscent - glyphDescent) / 2;
      cutoutContext.fillText(text, titleRect.width / 2, titleBaseline);
      cutoutContext.globalCompositeOperation = "source-in";
      cutoutContext.drawImage(
        canvas,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        0,
        0,
        titleRect.width,
        titleRect.height,
      );
      cutoutContext.globalCompositeOperation = "source-over";
      element.classList.add("has-canvas-cutout");
    };

    const render = () => {
      resize();
      gl.uniform1f(uniforms.time, elapsed);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      textCutouts.forEach(renderTextCutout);
    };

    const animate = (currentTime) => {
      if (lastFrameTime !== null) {
        elapsed += (currentTime - lastFrameTime) / 1000;
      }
      lastFrameTime = currentTime;
      render();
      animationFrame = window.requestAnimationFrame(animate);
    };

    const sync = () => {
      const shouldAnimate = state.inView && state.visible && !state.reducedMotion;

      if (shouldAnimate && !animationFrame) {
        lastFrameTime = null;
        animationFrame = window.requestAnimationFrame(animate);
      } else if (!shouldAnimate && animationFrame) {
        window.cancelAnimationFrame(animationFrame);
        animationFrame = 0;
        render();
      }
    };

    const observer = new IntersectionObserver(([entry]) => {
      state.inView = entry.isIntersecting;
      sync();
    });
    observer.observe(canvas);

    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedMotionQuery.addEventListener("change", (event) => {
      state.reducedMotion = event.matches;
      sync();
    });

    document.addEventListener("visibilitychange", () => {
      state.visible = !document.hidden;
      sync();
    });

    const resizeObserver = new ResizeObserver(render);
    resizeObserver.observe(canvas);
    render();
    sync();
  };

  canvases.forEach(createGradient);
})();
