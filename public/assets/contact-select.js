/*
 * The budget field's own menu.
 *
 * A native select is drawn by the browser at the field's size, and this field
 * is set in 40px type — the menu came out taller than the window. The select
 * itself stays: it is what holds the answer and what the form sends. This
 * drives it from a list the page can style.
 */
(function () {
  const field = document.querySelector("[data-contact-select]");
  if (!field) return;

  const select = field.querySelector("select");
  const button = field.querySelector(".contact-select__button");
  const list = field.querySelector(".contact-select__list");
  const options = Array.from(field.querySelectorAll(".contact-select__option"));

  if (!select || !button || !list || !options.length) return;

  let isOpen = false;
  let activeIndex = Math.max(options.findIndex((option) => option.dataset.value === select.value), 0);

  const setActive = (index) => {
    activeIndex = Math.min(Math.max(index, 0), options.length - 1);
    options.forEach((option, at) => option.classList.toggle("is-active", at === activeIndex));
    options[activeIndex].scrollIntoView({ block: "nearest" });
  };

  const setOpen = (open) => {
    isOpen = open;
    field.classList.toggle("is-open", open);
    button.setAttribute("aria-expanded", String(open));
    if (open) setActive(options.findIndex((option) => option.dataset.value === select.value));
  };

  const choose = (index) => {
    const option = options[index];
    if (!option) return;

    select.value = option.dataset.value;
    // The legacy script listens on the form's fields; the select is changed
    // here by script, which fires nothing of its own.
    select.dispatchEvent(new Event("input", { bubbles: true }));
    select.dispatchEvent(new Event("change", { bubbles: true }));

    button.textContent = option.textContent;
    options.forEach((entry) => entry.setAttribute("aria-selected", String(entry === option)));
    setOpen(false);
    button.focus({ preventScroll: true });
  };

  button.addEventListener("click", () => setOpen(!isOpen));

  // The select is the thing that holds the answer, and it is also reset from
  // the outside when the form is opened again — so the label follows it.
  select.addEventListener("change", () => {
    const option = options.find((entry) => entry.dataset.value === select.value) ?? options[0];
    button.textContent = option.textContent;
    options.forEach((entry) => entry.setAttribute("aria-selected", String(entry === option)));
  });

  options.forEach((option, index) => {
    option.addEventListener("click", () => choose(index));
    option.addEventListener("mouseenter", () => setActive(index));
  });

  field.addEventListener("keydown", (event) => {
    const keys = ["ArrowDown", "ArrowUp", "Home", "End", "Enter", " ", "Escape", "Tab"];
    if (!keys.includes(event.key)) return;

    if (!isOpen) {
      if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        setOpen(true);
      }
      return;
    }

    if (event.key === "Tab") {
      setOpen(false);
      return;
    }

    event.preventDefault();

    if (event.key === "Escape") setOpen(false);
    else if (event.key === "Enter" || event.key === " ") choose(activeIndex);
    else if (event.key === "ArrowDown") setActive(activeIndex + 1);
    else if (event.key === "ArrowUp") setActive(activeIndex - 1);
    else if (event.key === "Home") setActive(0);
    else if (event.key === "End") setActive(options.length - 1);
  });

  document.addEventListener("click", (event) => {
    if (!isOpen) return;
    if (event.target instanceof Element && event.target.closest("[data-contact-select]")) return;
    setOpen(false);
  });

  // Closing the form leaves the menu open behind it otherwise.
  new MutationObserver(() => {
    if (isOpen && !document.body.classList.contains("show-client-modal")) setOpen(false);
  }).observe(document.body, { attributeFilter: ["class"], attributes: true });

  button.textContent = options[activeIndex]?.textContent ?? button.textContent;
})();
