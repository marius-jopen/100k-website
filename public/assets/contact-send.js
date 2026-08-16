/*
 * Sending the contact form.
 *
 * The legacy bundle sends it too: it builds a body of four fields by hand,
 * posts, and says thank you on the way out — before any answer has come back.
 * That was fine against a PHP script that always took the message. It is not
 * fine now: the form goes through Static Forms, whose free tier stops at 500 a
 * month and turns the rest away, and the honeypot field it filters on would
 * never have been in a body assembled by hand.
 *
 * So this takes the click first — a capture listener on the document, which
 * runs before the one bound to the button — and sends the form itself.
 */
(function () {
  const modal = document.querySelector(".become-a-client-modal");
  const form = modal?.querySelector("form");
  const status = form?.querySelector(".contact-status");

  if (!modal || !form) return;

  const endpoint = form.getAttribute("action") || "/api/contact";
  let isSending = false;

  const setStatus = (message) => {
    if (status) status.textContent = message ?? "";
  };

  const send = async () => {
    if (isSending || modal.classList.contains("fields-not-filled")) return;

    isSending = true;
    modal.classList.add("is-sending");
    setStatus("");

    const body = new FormData(form);
    // The label rather than the value: "50.000€-100.000€" is what belongs in
    // an email, `50k-100k` is what belongs in a form.
    const select = form.querySelector("select");
    if (select) body.set("budget", select.options[select.selectedIndex]?.text ?? "");

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { Accept: "application/json" },
        body: new URLSearchParams(body),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setStatus(payload?.message || "That did not go through. Please try again.");
        return;
      }

      modal.classList.add("message-sent");
    } catch {
      setStatus("That did not go through — check your connection and try again.");
    } finally {
      isSending = false;
      modal.classList.remove("is-sending");
    }
  };

  // Before the legacy handler, which is bound to the button itself.
  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (!target.closest(".become-a-client-modal form .send-button")) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    send();
  }, true);

  // A sent form used to stay sent: the thank-you is what the next visitor to
  // the form would find. Opening it again starts over.
  const reset = () => {
    if (!modal.classList.contains("message-sent")) return;

    modal.classList.remove("message-sent");
    modal.classList.add("fields-not-filled");
    form.reset();
    // The budget's own menu reads the select rather than the other way round.
    form.querySelector("select")?.dispatchEvent(new Event("change", { bubbles: true }));
    setStatus("");
  };

  new MutationObserver(() => {
    if (document.body.classList.contains("show-client-modal")) reset();
  }).observe(document.body, { attributeFilter: ["class"], attributes: true });
})();
