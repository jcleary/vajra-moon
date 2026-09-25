const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };

const json = (body, status = 200, extra = {}) =>
  new Response(JSON.stringify(body), { status, headers: { ...JSON_HEADERS, ...extra } });

// Public read endpoint is called from the static site on another origin.
const PUBLIC_CORS = { "access-control-allow-origin": "*" };

function validDate(s) {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + "T00:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

async function authorised(request, env) {
  const header = request.headers.get("authorization") || "";
  const given = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!env.ADMIN_PASSPHRASE || !given) return false;
  // Hash both sides so the comparison is fixed-length and constant-time.
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(given)),
    crypto.subtle.digest("SHA-256", enc.encode(env.ADMIN_PASSPHRASE)),
  ]);
  return crypto.subtle.timingSafeEqual(a, b);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "");
    const method = request.method;

    if (method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: { ...PUBLIC_CORS, "access-control-allow-methods": "GET, OPTIONS", "access-control-max-age": "86400" },
      });
    }

    // Public: dates only (no reasons), upcoming only.
    if (path === "/api/exclusions" && method === "GET") {
      const { results } = await env.DB.prepare(
        "SELECT date FROM exclusions WHERE date >= date('now', '-1 day') ORDER BY date"
      ).all();
      return json({ dates: results.map((r) => r.date) }, 200, {
        ...PUBLIC_CORS,
        "cache-control": "public, max-age=60",
      });
    }

    // Everything below needs the passphrase.
    if (path.startsWith("/api/admin") || (path.startsWith("/api/exclusions") && method !== "GET")) {
      if (!(await authorised(request, env))) return json({ error: "Unauthorised" }, 401);
    }

    // Admin: full list including reasons and past entries.
    if (path === "/api/admin/exclusions" && method === "GET") {
      const { results } = await env.DB.prepare("SELECT date, reason FROM exclusions ORDER BY date").all();
      return json({ exclusions: results }, 200, { "cache-control": "no-store" });
    }

    if (path === "/api/exclusions" && method === "POST") {
      let body;
      try { body = await request.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
      const date = body && body.date;
      const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 200) : "";
      if (!validDate(date)) return json({ error: "date must be YYYY-MM-DD" }, 400);
      await env.DB.prepare(
        "INSERT INTO exclusions (date, reason) VALUES (?1, ?2) ON CONFLICT(date) DO UPDATE SET reason = excluded.reason"
      ).bind(date, reason).run();
      return json({ date, reason }, 201);
    }

    const del = path.match(/^\/api\/exclusions\/(\d{4}-\d{2}-\d{2})$/);
    if (del && method === "DELETE") {
      if (!validDate(del[1])) return json({ error: "Invalid date" }, 400);
      await env.DB.prepare("DELETE FROM exclusions WHERE date = ?1").bind(del[1]).run();
      return json({ deleted: del[1] });
    }

    return json({ error: "Not found" }, 404);
  },
};
