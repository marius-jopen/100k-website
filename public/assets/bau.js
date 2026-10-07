/*
 * The construction landing page: the logo row, the demo showcase and the
 * contact form.
 */
(function () {
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const select = (buttons, isActive) =>
    buttons.forEach((button) => button.setAttribute("aria-selected", isActive(button) ? "true" : "false"));

  /* ------------------------------------------------------- Logo rotation */

  // One logo at a time, every few seconds, so the row never flickers as a
  // whole; the newcomer is always one that is not on screen.
  const logoList = $("[data-logos]");
  const logoPool = $("[data-logo-pool]");
  if (logoList && logoPool && !reduceMotion) {
    const pool = Array.from(logoPool.content.children);
    const slots = $$("li", logoList);
    let next = 0;
    if (pool.length > slots.length) {
      setInterval(() => {
        const slot = slots[next % slots.length];
        next += 1;
        const showing = new Set(slots.map((li) => li.querySelector("[data-logo]:not(.is-out)")?.dataset.logo));
        const candidates = pool.filter((logo) => !showing.has(logo.dataset.logo));
        const incoming = candidates[Math.floor(Math.random() * candidates.length)].cloneNode(true);
        const outgoing = slot.querySelector("[data-logo]:not(.is-out)");
        outgoing?.classList.replace("is-in", "is-out");
        setTimeout(() => outgoing?.remove(), 600);
        slot.appendChild(incoming);
        requestAnimationFrame(() => requestAnimationFrame(() => incoming.classList.add("is-in")));
      }, 3000);
    }
  }

  /* ------------------------------------------------------------ Showcase */

  const show = $("[data-show]");
  if (show) {
    const frame = $("[data-frame]", show);
    const view = $("[data-view]", show);
    const browser = $(".bau-browser", show);

    // The frame shows a desktop at 1440px or a phone at 390px, whichever is
    // chosen, scaled to the room there is.
    const narrow = () => matchMedia("(max-width: 700px)").matches;
    const fit = () => {
      const natural = show.dataset.device === "phone" || narrow() ? 390 : 1440;
      const scale = view.clientWidth / natural;
      frame.style.width = `${natural}px`;
      frame.style.height = `${view.clientHeight / scale}px`;
      frame.style.transform = `scale(${scale})`;
    };
    new ResizeObserver(fit).observe(view);
    fit();
    let current = $$("[data-demo]").find((button) => button.getAttribute("aria-selected") === "true")?.dataset.demo;

    const inner = () => {
      try {
        return frame.contentDocument;
      } catch {
        return null;
      }
    };

    /* ----------------------------------------------------------- Tour */

    // A cursor of our own walks the visitor through the site: it scrolls
    // to each section, clicks through the request form, applies for a job.
    // It stops the moment the visitor's own pointer enters the frame, and
    // starts again when a different site is chosen.
    const cursor = document.createElement("div");
    cursor.className = "bau-cursor";
    cursor.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3l14 8.5-6.2 1.6L9.4 19z" fill="#fff" stroke="#000" stroke-width="1.5" stroke-linejoin="round"/></svg>';
    view.appendChild(cursor);

    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    let tour = 0; // bumped to cancel a running tour

    const scaleOf = () => view.clientWidth / (show.dataset.device === "phone" ? 390 : 1440);

    const moveTo = async (element) => {
      const rect = element.getBoundingClientRect();
      const scale = scaleOf();
      const x = (rect.left + Math.min(rect.width / 2, 60)) * scale;
      const y = (rect.top + rect.height / 2) * scale;
      cursor.style.transform = `translate(${x}px, ${y}px)`;
      await sleep(650);
    };

    const press = async (element) => {
      if (!element) return;
      await moveTo(element);
      cursor.classList.add("is-down");
      await sleep(120);
      element.click();
      cursor.classList.remove("is-down");
      await sleep(500);
    };

    const type = async (input, text) => {
      await moveTo(input);
      input.focus({ preventScroll: true });
      for (const char of text) {
        input.value += char;
        await sleep(45);
      }
      input.dispatchEvent(new Event("input", { bubbles: true }));
      await sleep(300);
    };

    // Never `scrollIntoView` across the frame: it scrolls every ancestor,
    // this page included, and the visitor is yanked up to the frame.
    const scrollInside = (doc, selector) => {
      const target = doc.querySelector(selector);
      if (target) doc.defaultView.scrollTo({ top: target.offsetTop - 70, behavior: "smooth" });
    };

    // Reaching a section the way a visitor would: by the link in the site's
    // own header. Where that link is hidden (the phone), by scrolling.
    const goTo = async (doc, selector) => {
      const link = doc.querySelector(`.demo-nav a[href="${selector}"]`);
      if (link && link.offsetParent) await press(link);
      else scrollInside(doc, selector);
      await sleep(900);
    };

    const runTour = async () => {
      const id = ++tour;
      const alive = () => id === tour;
      const doc = inner();
      if (!doc || reduceMotion) return;
      await sleep(1200);
      if (!alive()) return;
      cursor.classList.add("is-visible");
      cursor.style.transform = `translate(${view.clientWidth * 0.5}px, ${view.clientHeight * 0.6}px)`;

      const pair = doc.querySelector("#start [data-pair-state='before']");
      if (pair) {
        await press(pair);
        if (!alive()) return;
        await sleep(700);
        await press(doc.querySelector("#start [data-pair-state='after']"));
      } else {
        await sleep(600);
      }
      if (!alive()) return;

      await goTo(doc, "#leistungen");
      if (!alive()) return;
      await sleep(900);
      await goTo(doc, "#referenzen");
      if (!alive()) return;
      const refPair = doc.querySelector("#referenzen [data-pair-state='before']");
      if (refPair) {
        await press(refPair);
        if (!alive()) return;
        await sleep(600);
      } else {
        await sleep(1100);
      }

      // The call to action in the header is what a visitor would press.
      await press(doc.querySelector(".demo-header .demo-btn--primary"));
      if (!alive()) return;
      await sleep(700);
      const wizard = doc.querySelector("[data-wizard]");
      const chip = (field, index) => wizard.querySelectorAll(`[data-field="${field}"] .demo-chip`)[index];
      for (const [field, index] of [["art", 0], ["objekt", 1], ["wann", 0]]) {
        await press(chip(field, index));
        if (!alive()) return;
      }
      await type(wizard.querySelector('[data-field="ort"]'), "50937 Köln");
      if (!alive()) return;
      await type(wizard.querySelector('[data-field="telefon"]'), "0170 000 00 00");
      if (!alive()) return;
      await press(wizard.querySelector("[data-send]"));
      if (!alive()) return;
      await sleep(1600);

      await goTo(doc, "#karriere");
      if (!alive()) return;
      await press(doc.querySelector('[data-apply] [data-field="beruf"] .demo-chip'));
      if (!alive()) return;
      await type(doc.querySelector('[data-apply] [data-field="telefon"]'), "0170 000 00 00");
      if (!alive()) return;
      await press(doc.querySelector("[data-apply-send]"));
      if (!alive()) return;
      await sleep(1400);

      cursor.classList.remove("is-visible");
    };

    const stopTour = () => {
      tour += 1;
      cursor.classList.remove("is-visible");
    };

    // The visitor's own pointer takes over; ours steps aside for good on
    // this site.
    view.addEventListener("pointerenter", stopTour);
    view.addEventListener("touchstart", stopTour, { passive: true });

    frame.addEventListener("load", () => {
      if (seen) runTour();
    });

    // Not before the frame is on screen: a tour nobody watches is noise.
    let seen = false;
    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver(
        (entries) => {
          if (!entries.some((entry) => entry.isIntersecting)) return;
          observer.disconnect();
          seen = true;
          runTour();
        },
        { threshold: 0.5 },
      );
      observer.observe(view);
    } else {
      seen = true;
    }

    $$("[data-demo]").forEach((button) =>
      button.addEventListener("click", () => {
        if (button.dataset.demo === current) return;
        stopTour();
        current = button.dataset.demo;
        select($$("[data-demo]"), (other) => other === button);
        $('[data-bind="domain"]', show).textContent = `www.muster-${current}.de`;
        $("[data-open]", show).href = `/bau/demo/${current}/`;
        frame.src = `/bau/demo/${current}/`;
      }),
    );
    // The frame is sized here rather than by aspect-ratio, so a change of
    // device can animate: the frame closes in on the desktop site, then the
    // site reflows to its phone layout once the frame has arrived.
    const layout = (device) => {
      const phone = device === "phone" || narrow();
      const width = phone ? Math.min(390, show.clientWidth) : show.clientWidth;
      browser.style.width = `${width}px`;
      view.style.height = `${phone ? (width * 17) / 9 : (width * 11) / 16}px`;
    };
    let deviceTimer = 0;
    $$("[data-device]").forEach((button) =>
      button.addEventListener("click", () => {
        if (button.dataset.device === show.dataset.device) return;
        select($$("[data-device]"), (other) => other === button);
        layout(button.dataset.device);
        clearTimeout(deviceTimer);
        deviceTimer = setTimeout(() => {
          show.dataset.device = button.dataset.device;
          fit();
        }, reduceMotion ? 0 : 720);
      }),
    );
    window.addEventListener("resize", () => layout(show.dataset.device));
    // A desktop site shrunk to a phone is unreadable, and the switch is
    // hidden at that width, so a phone sees the phone layout.
    if (narrow()) show.dataset.device = "phone";
    layout(show.dataset.device);
    fit();
  }

  /* ---------------------------------------------------------------- Hero */

  // A little play in the empty hero: where the pointer has been, a piece of
  // the trade appears and fades away again. Behind the words, never in front
  // of them, and never for anyone who asked for less motion.
  const hero = $(".bau-hero");
  if (hero && !reduceMotion && matchMedia("(hover: hover) and (pointer: fine) and (min-width: 701px)").matches) {
    const PIECES = ["🏗️", "🚜", "🧱", "👷", "🔨", "🪣", "🚧", "🏠", "⛏️", "🪜", "🧰", "🪚"];
    let settle = 0;
    let lastX = -1e9;
    let lastY = -1e9;
    let previous = "";

    const place = (x, y) => {
      const box = hero.getBoundingClientRect();
      let piece = previous;
      while (piece === previous) piece = PIECES[Math.floor(Math.random() * PIECES.length)];
      previous = piece;
      const drop = document.createElement("span");
      drop.className = "bau-drop";
      drop.textContent = piece;
      // Near the pointer, not on it: a little scatter, a little size.
      drop.style.left = `${x - box.left + Math.round(Math.random() * 80 - 40)}px`;
      drop.style.top = `${y - box.top + Math.round(Math.random() * 80 - 40)}px`;
      drop.style.fontSize = `${Math.round(72 + Math.random() * 56)}px`;
      drop.style.setProperty("--spin", `${Math.round(Math.random() * 24 - 12)}deg`);
      hero.appendChild(drop);
      drop.addEventListener("animationend", () => drop.remove());
      lastX = x;
      lastY = y;
    };

    // A piece appears where the pointer comes to rest, the moment it does —
    // not along the way, and not twice in the same place.
    hero.addEventListener("pointermove", (event) => {
      clearTimeout(settle);
      settle = setTimeout(() => {
        if (Math.hypot(event.clientX - lastX, event.clientY - lastY) < 70) return;
        place(event.clientX, event.clientY);
      }, 90);
    });
    hero.addEventListener("pointerenter", (event) => place(event.clientX, event.clientY));
  }

  /* ----------------------------------------------------------- Features */

  const panel = $("[data-features-panel]");
  if (panel) {
    const buttons = $$("[data-feature]", panel);
    let index = 0;
    let auto = 0;
    const timers = [];
    const later = (fn, ms) => timers.push(setTimeout(fn, ms));
    const escapeHtml = (value) =>
      String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);

    // Types `text` into `target`, one or two characters a tick, then calls
    // `done`. Everything a scene does is scheduled through `later`, so a
    // change of scene can clear it all at once.
    const typeText = (target, text, done, step = 1, tick = 60) => {
      if (reduceMotion) {
        target.textContent = text;
        done?.();
        return;
      }
      let count = 0;
      target.textContent = "";
      const go = () => {
        count = Math.min(text.length, count + step);
        target.textContent = text.slice(0, count);
        if (count < text.length) later(go, tick);
        else done?.();
      };
      go();
    };

    const SCENES = {
      // The search is typed, then the map comes alive.
      google: (vis) => {
        const box = $("[data-search]", vis);
        later(() => typeText(box, box.dataset.search, () => {
          later(() => vis.classList.add("is-entered"), 350);
          later(() => vis.classList.add("is-ready"), 650);
        }, 1, 70), 500);
      },
      // The assistant's answer is typed out, the firm marked once written.
      ki: (vis) => {
        const target = $("[data-type]", vis);
        const sources = $(".bau-vis__sources", vis);
        const full = target.dataset.type;
        const marked = escapeHtml(full).replace("Muster Abbruch GmbH", "<mark>Muster Abbruch GmbH</mark>");
        target.classList.add("is-typing");
        later(() => typeText(target, full, () => {
          target.innerHTML = marked;
          target.classList.remove("is-typing");
          sources.classList.add("is-visible");
        }, 2, 18), 600);
      },
      anfrage: (vis) => later(() => vis.classList.add("is-ready"), 100),
      // The request, the change on the site, the reply.
      betreuung: (vis) => {
        const msgs = $$(".bau-vis__msg", vis);
        later(() => msgs[0].classList.add("is-visible"), 300);
        later(() => $('[data-care="reference"]', vis).classList.add("is-visible"), 1900);
        later(() => msgs[1].classList.add("is-visible"), 2600);
      },
    };

    // Back to the still picture, so the scene can play again next time.
    const reset = (vis) => {
      vis.classList.remove("is-ready", "is-seen", "is-entered");
      $$("[data-mail]", vis).forEach((row) => row.classList.toggle("is-on", row.dataset.mail === "site"));
      $$("[data-mailpane]", vis).forEach((pane) => (pane.hidden = pane.dataset.mailpane !== "site"));
      $$(".is-on, .is-visible, .is-down, .is-typing", vis).forEach((el) => el.classList.remove("is-on", "is-visible", "is-down", "is-typing"));
      $$("[data-search], [data-type], [data-apply-phone]", vis).forEach((el) => (el.textContent = ""));
    };

    // On a narrow screen the stage moves under the entry it belongs to;
    // otherwise it stays beside the list, where it started.
    const stage = $(".bau-features__stage", panel);
    const stageHome = stage.parentElement;
    const placeStage = () => {
      if (matchMedia("(max-width: 1000px)").matches) buttons[index].closest("li").appendChild(stage);
      else if (stage.parentElement !== stageHome) stageHome.appendChild(stage);
    };
    addEventListener("resize", placeStage);

    const pick = (next) => {
      index = (next + buttons.length) % buttons.length;
      buttons.forEach((button, i) => button.setAttribute("aria-current", String(i === index)));
      placeStage();
      timers.splice(0).forEach(clearTimeout);
      $$("[data-vis]", panel).forEach((vis) => {
        const show = vis.dataset.vis === buttons[index].dataset.feature;
        if (show === !vis.hidden) return;
        vis.hidden = !show;
        reset(vis);
        if (show) SCENES[vis.dataset.vis]?.(vis);
      });
    };

    // The inbox opens whichever mail is chosen.
    panel.addEventListener("click", (event) => {
      const row = event.target.closest("[data-mail]");
      if (!row) return;
      const vis = row.closest("[data-vis]");
      vis.classList.add("is-seen");
      $$("[data-mail]", vis).forEach((other) => other.classList.toggle("is-on", other === row));
      $$("[data-mailpane]", vis).forEach((pane) => (pane.hidden = pane.dataset.mailpane !== row.dataset.mail));
      // A chosen mail stops the pages turning.
      chosen = true;
      clearInterval(auto);
    });

    // The reference's before/after follows the pointer across it.
    const wipe = $("[data-wipe]", panel);
    wipe?.addEventListener("pointermove", (event) => {
      const box = wipe.getBoundingClientRect();
      wipe.style.setProperty("--split", `${Math.max(0, Math.min(100, ((event.clientX - box.left) / box.width) * 100))}%`);
    });
    // Turns the pages by itself while nobody chooses; a click ends that,
    // also when it comes before the turning has begun.
    let chosen = false;
    const cycle = () => {
      if (reduceMotion || chosen) return;
      auto = setInterval(() => pick(index + 1), 8500);
    };
    buttons.forEach((button, i) =>
      button.addEventListener("click", () => {
        chosen = true;
        clearInterval(auto);
        pick(i);
      }),
    );
    // The first scene plays once the stage is in view — checked on scroll
    // rather than observed, which proved unreliable here — and the pages
    // turn from then on.
    let started = false;
    const start = () => {
      if (started) return;
      const rect = panel.getBoundingClientRect();
      if (rect.top > innerHeight * 0.75 || rect.bottom < 0) return;
      started = true;
      removeEventListener("scroll", start);
      SCENES[buttons[index].dataset.feature]?.($(`[data-vis="${buttons[index].dataset.feature}"]`, panel));
      cycle();
    };
    addEventListener("scroll", start, { passive: true });
    later(start, 300);
    buttons.forEach((button, i) => button.setAttribute("aria-current", String(i === 0)));
    placeStage();
    $$("[data-vis]", panel).forEach((vis) => {
      vis.hidden = vis.dataset.vis !== buttons[0].dataset.feature;
      reset(vis);
    });
  }

  /* ---------------------------------------------------------------- FAQ */

  // <details> opens in one frame; the answer is given a height to grow and
  // shrink through instead.
  $$(".bau-faq details").forEach((details) => {
    const summary = $("summary", details);
    const answer = $("p", details);
    if (!summary || !answer) return;
    let busy = false;
    summary.addEventListener("click", (event) => {
      event.preventDefault();
      if (busy || reduceMotion) {
        if (!busy) details.open = !details.open;
        return;
      }
      busy = true;
      if (details.open) {
        const from = answer.offsetHeight;
        answer.animate([{ height: `${from}px`, opacity: 1 }, { height: "0px", opacity: 0 }], { duration: 260, easing: "ease" })
          .onfinish = () => {
            details.open = false;
            busy = false;
          };
      } else {
        details.open = true;
        const to = answer.offsetHeight;
        answer.animate([{ height: "0px", opacity: 0 }, { height: `${to}px`, opacity: 1 }], { duration: 320, easing: "cubic-bezier(0.2, 0, 0.2, 1)" })
          .onfinish = () => (busy = false);
      }
    });
  });

  /* ------------------------------------------------------------ Contact */

  const form = $("[data-contact]");
  if (form) {
    const status = $(".bau-form__status", form);

    $$("[data-package]").forEach((link) =>
      link.addEventListener("click", () => {
        form.elements.package.value = link.dataset.package;
        status.textContent = `Paket „${link.dataset.package}“ ist vorgemerkt.`;
      }),
    );

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (form.classList.contains("is-sending")) return;
      form.classList.add("is-sending");
      status.textContent = "";

      const body = new FormData(form);
      body.set("subject", `Website-Check Bau — ${String(body.get("company") || body.get("name")).trim()}`);

      try {
        const response = await fetch(form.action, {
          method: "POST",
          headers: { Accept: "application/json" },
          body: new URLSearchParams(body),
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          status.textContent = payload?.message || "Das hat nicht geklappt. Bitte versuchen Sie es noch einmal.";
          return;
        }
        form.classList.add("is-sent");
        form.innerHTML = `<h3>Danke, ist angekommen.</h3><p>Wir melden uns innerhalb von zwei Werktagen telefonisch.</p>`;
      } catch {
        status.textContent = "Keine Verbindung. Bitte versuchen Sie es noch einmal.";
      } finally {
        form.classList.remove("is-sending");
      }
    });
  }
})();
