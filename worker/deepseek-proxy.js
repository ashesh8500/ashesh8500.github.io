/**
 * Cloudflare Worker — DeepSeek API Proxy for asheshkaji.com
 *
 * Browser → this worker → api.deepseek.com
 *
 * The DEEPSEEK_API_KEY is injected as a Cloudflare secret (never exposed to client).
 * SSE streaming is passed through transparently.
 * Rate limited per IP to prevent abuse.
 */

// ── Rate limit config ──
const RATE_LIMIT_WINDOW = 60_000;          // 1 minute
const RATE_LIMIT_MAX    = 15;              // requests per window per IP
const ALLOWED_ORIGIN    = "https://asheshkaji.com";

// ── Helper: send JSON error ──
function jsonErr(status, msg) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    },
  });
}

// ── Simple in-memory rate limiter (KV-backed) ──
async function checkRateLimit(env, clientIP) {
  // Use a Durable Object or KV in production; for a personal site,
  // a simple KV-backed counter with TTL is sufficient.
  const key = `rl:${clientIP}`;
  const now = Date.now();

  let record;
  try {
    const raw = await env.RATE_LIMITER.get(key);
    record = raw ? JSON.parse(raw) : { entries: [] };
  } catch {
    record = { entries: [] };
  }

  // Drop expired entries
  record.entries = record.entries.filter(function (t) {
    return now - t < RATE_LIMIT_WINDOW;
  });

  if (record.entries.length >= RATE_LIMIT_MAX) {
    return false; // blocked
  }

  record.entries.push(now);
  await env.RATE_LIMITER.put(key, JSON.stringify(record), {
    expirationTtl: Math.ceil(RATE_LIMIT_WINDOW / 1000) + 30,
  });

  return true;
}

// ══════════════════════════════════════════════════════
//  Request handler
// ══════════════════════════════════════════════════════
export default {
  async fetch(request, env, ctx) {
    // ── CORS preflight ──
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    // ── Method guard ──
    if (request.method !== "POST") {
      return jsonErr(405, "POST only — DeepSeek proxy");
    }

    // ── Rate limit ──
    const clientIP = request.headers.get("CF-Connecting-IP") || "unknown";
    const allowed = await checkRateLimit(env, clientIP);
    if (!allowed) {
      return jsonErr(429, "Rate limit hit (15 req/min). Please wait.");
    }

    // ── Forward to DeepSeek ──
    const body = await request.text();

    let deepseekResp;
    try {
      deepseekResp = await fetch(
        "https://api.deepseek.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
            "Content-Type": "application/json",
          },
          body,
        }
      );
    } catch (err) {
      return jsonErr(502, `DeepSeek unreachable: ${err.message}`);
    }

    // ── Stream the SSE response back to the browser ──
    const contentType =
      deepseekResp.headers.get("Content-Type") || "text/event-stream";

    return new Response(deepseekResp.body, {
      status: deepseekResp.status,
      headers: {
        "Content-Type": contentType,
        "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  },
};
