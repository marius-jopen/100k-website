/**
 * The contact form's endpoint.
 *
 * The site is a static bundle, so there is nowhere in it to keep a secret —
 * this is a Vercel function, which Vercel picks up from `api/` whatever the
 * build produces. It exists to hold the Static Forms key: the browser posts
 * here, this posts on with the key attached.
 *
 * The form is submitted by the legacy bundle through `jQuery.post`, so the
 * body arrives form-encoded with the fields it collects — budget comes as the
 * label the reader chose rather than its value, which is what belongs in an
 * email.
 *
 * Set `STATIC_FORM_API_KEY` in the Vercel project for this to do anything.
 */
const STATIC_FORMS_ENDPOINT = "https://api.staticforms.dev/submit";

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ message: "Method not allowed." });
  }

  const apiKey = process.env.STATIC_FORM_API_KEY;

  if (!apiKey) {
    return response.status(500).json({ message: "The contact form is not configured yet." });
  }

  const body = readBody(request);
  const email = String(body.email ?? "").trim();
  const name = String(body.name ?? "").trim();
  const message = String(body.message ?? "").trim();
  const budget = String(body.budget ?? "").trim();

  if (!email || !message) {
    return response.status(400).json({ message: "An email address and a message are needed." });
  }

  try {
    const result = await fetch(STATIC_FORMS_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        apiKey,
        subject: `Become a Client — ${name || email}`,
        replyTo: email,
        name,
        email,
        budget,
        message,
      }),
    });

    const payload = await result.json().catch(() => null);

    if (!result.ok) {
      return response.status(result.status).json({
        message: payload?.message ?? "The message could not be sent. Please try again.",
      });
    }

    return response.status(200).json({
      message: payload?.message ?? "Thank you for your message.",
    });
  } catch (error) {
    return response.status(502).json({
      message: error instanceof Error ? error.message : "The message could not be sent.",
    });
  }
}

/** Vercel parses JSON and form bodies; a string is what is left of the rest. */
function readBody(request) {
  const { body } = request;

  if (!body) return {};
  if (typeof body === "object") return body;

  try {
    return JSON.parse(body);
  } catch {
    return Object.fromEntries(new URLSearchParams(body));
  }
}
