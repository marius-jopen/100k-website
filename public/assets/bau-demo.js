/*
 * The demo websites' interactive parts: the request wizard, the quick
 * application and the before/after pairs. Nothing is sent anywhere; the page
 * says so next to every "thank you".
 */
(function () {
  const root = document.querySelector(".demo");
  if (!root) return;

  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

  // Inside the landing page's frame the banner would only repeat what the
  // page around it already says.
  if (window.self !== window.top) root.classList.add("is-embedded");

  /* ------------------------------------------------------------- Anchors */

  // In-page links scroll this document and only this document. Left to the
  // browser, a fragment jump inside a frame can drag the page around the
  // frame along with it.
  document.addEventListener("click", (event) => {
    const link = event.target.closest('a[href^="#"]');
    if (!link) return;
    const target = document.querySelector(link.getAttribute("href"));
    if (!target) return;
    event.preventDefault();
    window.scrollTo({ top: target.offsetTop - 70, behavior: "smooth" });
  });

  /* ------------------------------------------------------- Before / after */

  $$("[data-pair]").forEach((pair) => {
    pair.addEventListener("click", (event) => {
      const button = event.target.closest("[data-pair-state]");
      if (!button) return;
      pair.classList.toggle("show-before", button.dataset.pairState === "before");
      $$("[data-pair-state]", pair).forEach((other) => other.setAttribute("aria-selected", String(other === button)));
    });
  });

  /* ---------------------------------------------------------------- Chips */

  // A chip group answers one question; pressing one releases the others.
  const chipGroups = (scope) =>
    $$(".demo-chips[data-field]", scope).forEach((group) => {
      group.addEventListener("click", (event) => {
        const chip = event.target.closest(".demo-chip");
        if (!chip) return;
        $$(".demo-chip", group).forEach((other) => other.setAttribute("aria-pressed", String(other === chip)));
        group.dispatchEvent(new CustomEvent("answer", { bubbles: true, detail: { field: group.dataset.field, value: chip.textContent.trim() } }));
      });
    });

  /* --------------------------------------------------------------- Wizard */

  const wizard = $("[data-wizard]");
  if (wizard) {
    const steps = $$("[data-step]", wizard);
    const answers = {};
    let index = 0;
    const LAST = steps.length - 2; // the step before "done"

    const show = (next) => {
      index = Math.max(0, Math.min(steps.length - 1, next));
      steps.forEach((step, i) => {
        step.hidden = i !== index;
        if (i === index) {
          // Restart the entrance animation for each question.
          step.style.animation = "none";
          void step.offsetWidth;
          step.style.animation = "";
        }
      });
      $("[data-dots]", wizard).innerHTML = steps
        .slice(0, -1)
        .map((_, i) => `<span class="${i < index ? "is-done" : i === index ? "is-now" : ""}"></span>`)
        .join("");
      $("[data-back]", wizard).hidden = index === 0 || index === steps.length - 1;
    };

    chipGroups(wizard);
    // Choosing an answer is also "next": one tap per question.
    wizard.addEventListener("answer", (event) => {
      answers[event.detail.field] = event.detail.value;
      if (index < LAST) setTimeout(() => show(index + 1), 160);
    });
    $("[data-back]", wizard).addEventListener("click", () => show(index - 1));
    $("[data-send]", wizard).addEventListener("click", () => {
      $$("input[data-field]", wizard).forEach((input) => (answers[input.dataset.field] = input.value.trim()));
      const labels = { art: "Leistung", objekt: "Objekt", wann: "Start", ort: "Ort", telefon: "Telefon" };
      $("[data-summary]", wizard).innerHTML = Object.entries(labels)
        .filter(([key]) => answers[key])
        .map(([key, label]) => `<dt>${label}</dt><dd>${escapeHtml(answers[key])}</dd>`)
        .join("");
      show(steps.length - 1);
    });
    $("[data-restart]", wizard).addEventListener("click", () => {
      Object.keys(answers).forEach((key) => delete answers[key]);
      $$(".demo-chip", wizard).forEach((chip) => chip.setAttribute("aria-pressed", "false"));
      $$("input", wizard).forEach((input) => (input.value = ""));
      show(0);
    });
    show(0);
  }

  /* ---------------------------------------------------------------- Apply */

  const apply = $("[data-apply]");
  if (apply) {
    chipGroups(apply);
    $("[data-apply-send]", apply).addEventListener("click", () => {
      $(".demo-apply__done", apply).hidden = false;
    });
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  }
})();
