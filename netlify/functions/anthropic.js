const ALLOWED_MODELS = [
  "claude-sonnet-4-20250514",
  "claude-opus-4-20250514",
];
const MAX_TOKENS_CAP = 4000;

export default async (req) => {
  const origin = req.headers.get("origin") || "";
  if (origin !== process.env.ALLOWED_ORIGIN) {
    return new Response("Forbidden", { status: 403 });
  }

  const token = req.headers.get("x-app-token");
  if (!token || token !== process.env.APP_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let body;
  try { body = await req.json(); }
  catch { return new Response("Bad Request", { status: 400 }); }

  if (!ALLOWED_MODELS.includes(body.model)) {
    return new Response("Invalid model", { status: 400 });
  }
  body.max_tokens = Math.min(body.max_tokens ?? 1000, MAX_TOKENS_CAP);

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  return Response.json(data, {
    status: res.status,
    headers: { "Access-Control-Allow-Origin": origin },
  });
};

export const config = { path: "/api/anthropic" };
