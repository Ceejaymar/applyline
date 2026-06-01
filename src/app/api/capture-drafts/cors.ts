import { NextResponse } from "next/server";

export function captureDraftCorsHeaders(request: Request) {
  void request;

  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Origin": "*",
    Vary: "Origin",
  };

  return headers;
}

export function captureDraftOptionsResponse(request: Request) {
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
