import { NextResponse } from "next/server";

const DEFAULT_ALLOWED_ORIGINS = [
  "https://applyline.vercel.app",
  "http://localhost:3000",
];

function allowedOrigins() {
  const configuredOrigins =
    process.env.EXTENSION_ALLOWED_ORIGINS?.split(",")
      .map((origin) => origin.trim())
      .filter(Boolean) ?? [];

  return new Set([...DEFAULT_ALLOWED_ORIGINS, ...configuredOrigins]);
}

export function isAllowedCaptureDraftOrigin(request: Request) {
  const origin = request.headers.get("origin");

  return !origin || allowedOrigins().has(origin);
}

export function captureDraftCorsHeaders(request: Request) {
  const origin = request.headers.get("origin");
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    Vary: "Origin",
  };

  if (origin && allowedOrigins().has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return headers;
}

export function captureDraftOptionsResponse(request: Request) {
  if (!isAllowedCaptureDraftOrigin(request)) {
    return new Response(null, {
      headers: captureDraftCorsHeaders(request),
      status: 403,
    });
  }

  return new Response(null, {
    headers: captureDraftCorsHeaders(request),
    status: 204,
  });
}

export function captureDraftJson(
  request: Request,
  body: unknown,
  init?: ResponseInit,
) {
  return NextResponse.json(body, {
    ...init,
    headers: {
      ...captureDraftCorsHeaders(request),
      ...init?.headers,
    },
  });
}
