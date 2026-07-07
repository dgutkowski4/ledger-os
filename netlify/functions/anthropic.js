const ALLOWED_MODELS = [
  "claude-sonnet-5",
  "claude-opus-4-8",
];
const MAX_TOKENS_CAP = 8000;

/* These are public values — real protection is the token check below + RLS */
const SUPABASE_URL = "https://dfgtpxrcchlczewcudso.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_YO9bUcflj0_VS9KTUKUtRA_N4-POQv5";

const corsHeaders = (origin) => ({
  "Access-Control-Allow-Origin":  origin || "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
});

const jsonError = (message, status, origin) =>
  Response.json({ error: { message } }, { status, headers: corsHeaders(origin) });

export default async (req) => {
  const origin = req.headers.get("origin") || "";

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return jsonError("API key not configured", 500, origin);
  }

  /* Require a signed-in Supabase user — protects the API key from anonymous use */
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) {
    return jsonError("Sign in required to use AI features", 401, origin);
  }

  let userRes;
  try {
    userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_PUBLISHABLE_KEY },
    });
  } catch (e) {
    return jsonError(`Auth check failed: ${e.message}`, 502, origin);
  }
  if (!userRes.ok) {
    return jsonError("Invalid or expired session — sign in again", 401, origin);
  }

  /* Optional allowlist: set ALLOWED_EMAILS (comma-separated) in Netlify env
     to restrict AI features to specific accounts */
  const user = await userRes.json();
  const allowed = (process.env.ALLOWED_EMAILS || "")
    .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (allowed.length && !allowed.includes((user.email || "").toLowerCase())) {
    return jsonError("This account is not allowed to use AI features", 403, origin);
  }

  let body;
  try { body = await req.json(); }
  catch { return jsonError("Bad Request", 400, origin); }

  if (!ALLOWED_MODELS.includes(body.model)) {
    return jsonError("Invalid model", 400, origin);
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
    return jsonError(`Upstream fetch failed: ${e.message}`, 502, origin);
  }

  const data = await res.json();
  return Response.json(data, {
    status: res.status,
    headers: corsHeaders(origin),
  });
};

export const config = { path: "/api/anthropic" };
