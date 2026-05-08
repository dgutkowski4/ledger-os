const ALLOWED_MODELS = [
  "claude-sonnet-4-20250514",
  "claude-opus-4-20250514",
];
const MAX_TOKENS_CAP = 4000;

const corsHeaders = (origin) => ({
  "Access-Control-Allow-Origin":  origin || "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
});

export default async (req) => {
  const origin = req.headers.get("origin") || "";

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response("API key not configured", { status: 500, headers: corsHeaders(origin) });
  }

  let body;
  try { body = await req.json(); }
  catch { return new Response("Bad Request", { status: 400 }); }

  if (!ALLOWED_MODELS.includes(body.model)) {
    return new Response("Invalid model", { status: 400 });
  }
  body.max_tokens = Math.min(body.max_tokens ?? 1000, MAX_TOKENS_CAP);

  let res;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    return new Response(`Upstream fetch failed: ${e.message}`, { status: 502, headers: corsHeaders(origin) });
  }

  const data = await res.json();
  return Response.json(data, {
    status: res.status,
    headers: corsHeaders(origin),
  });
};

export const config = { path: "/api/anthropic" };
