// Senshin Marga enquiry relay (Cloudflare Worker).
// The website posts the contact form here; this Worker validates it and
// forwards it to the Zoho Flow webhook, which adds a row to Zoho Sheet.
// The webhook URL lives only in the ZOHO_FLOW_WEBHOOK_URL secret, never in
// the website's code.

const FIELDS = ["name", "company", "email", "phone", "service", "location", "message"];
const LIMITS = { name: 100, company: 120, email: 160, phone: 30, location: 100, service: 80, message: 3000 };
const SERVICES = new Set([
  "Japanese Interpretation",
  "Japanese Translation",
  "Staffing & Recruiting",
  "Corporate Training",
  "Cross-Cultural Consulting",
  "Educational Exchange Programs",
  "Business Facilitation",
  "Other"
]);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^[+()\-.\s\d]{6,30}$/;

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const allowed = (env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
    const originOk = allowed.includes(origin);
    const cors = {
      "Access-Control-Allow-Origin": originOk ? origin : "null",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
      "Vary": "Origin"
    };
    const reply = (status, body) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { ...cors, "Content-Type": "application/json" }
      });

    if (request.method === "OPTIONS") return new Response(null, { status: originOk ? 204 : 403, headers: cors });
    if (request.method !== "POST") return reply(405, { ok: false, error: "method_not_allowed" });
    if (!originOk) return reply(403, { ok: false, error: "origin_not_allowed" });
    if (!env.ZOHO_FLOW_WEBHOOK_URL) return reply(500, { ok: false, error: "not_configured" });

    let input;
    try {
      input = await request.json();
    } catch (_) {
      return reply(400, { ok: false, error: "invalid_json" });
    }

    // Honeypot: bots fill the hidden "website" field. Report success, store nothing.
    if (input && input.website) return reply(200, { ok: true });

    const d = {};
    for (const k of FIELDS) d[k] = String((input && input[k]) || "").trim();

    const invalid = [];
    if (!d.name) invalid.push("name");
    if (!EMAIL_RE.test(d.email)) invalid.push("email");
    if (d.phone && !PHONE_RE.test(d.phone)) invalid.push("phone");
    if (!SERVICES.has(d.service)) invalid.push("service");
    if (d.message.length < 10) invalid.push("message");
    for (const k of FIELDS) if (d[k].length > LIMITS[k] && !invalid.includes(k)) invalid.push(k);
    if (invalid.length) return reply(422, { ok: false, error: "invalid_fields", fields: invalid });

    const payload = new URLSearchParams({
      ...d,
      submitted_at: new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
      page: String((input && input.page) || "").slice(0, 300)
    });

    let upstream;
    try {
      upstream = await fetch(env.ZOHO_FLOW_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: payload,
        signal: AbortSignal.timeout(12000)
      });
    } catch (err) {
      console.error("Zoho Flow request failed", err);
      return reply(502, { ok: false, error: "upstream_unreachable" });
    }

    if (!upstream.ok) {
      console.error("Zoho Flow rejected the request", upstream.status, await upstream.text());
      return reply(502, { ok: false, error: "upstream_rejected" });
    }
    return reply(200, { ok: true });
  }
};
