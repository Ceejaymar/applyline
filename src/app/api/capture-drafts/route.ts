import { NextRequest } from "next/server";

import { captureDraftSchema } from "@/features/capture/capture-draft-schema";
import { supabaseAdmin } from "@/lib/supabase/admin";

import {
  captureDraftJson,
  captureDraftOptionsResponse,
} from "./cors";

const DRAFT_TTL_HOURS = 24;

function createDraftToken() {
  return `cap_${crypto.randomUUID()}_${crypto.randomUUID().replace(/-/g, "")}`;
}

function draftExpiresAt() {
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + DRAFT_TTL_HOURS);
  return expiresAt.toISOString();
}

function getDraftPayload(value: unknown) {
  const draft =
    typeof value === "object" && value !== null && "draft" in value
      ? (value as { draft: unknown }).draft
      : value;

  return draft;
}

function getBearerToken(request: NextRequest) {
  const authorization = request.headers.get("authorization") ?? "";
  const [scheme, token] = authorization.split(" ");

  return scheme?.toLowerCase() === "bearer" && token ? token : undefined;
}

function validateCaptureDraftRequest(request: NextRequest) {
  if (process.env.NODE_ENV === "development") {
    console.info("[capture-drafts] request origin", {
      origin: request.headers.get("origin") ?? "none",
    });
  }

  const token = getBearerToken(request);

  if (!token) {
    return captureDraftJson(
      request,
      { error: "Missing authorization token." },
      { status: 401 },
    );
  }

  const expectedToken = process.env.EXTENSION_BEARER_TOKEN;

  if (!expectedToken) {
    return captureDraftJson(
      request,
      { error: "Capture draft API is not configured." },
      { status: 500 },
    );
  }

  if (token !== expectedToken) {
    return captureDraftJson(
      request,
      { error: "Invalid authorization token." },
      { status: 403 },
    );
  }

  return undefined;
}

export function OPTIONS(request: NextRequest) {
  return captureDraftOptionsResponse(request);
}

export async function POST(request: NextRequest) {
  const validationResponse = validateCaptureDraftRequest(request);

  if (validationResponse) {
    return validationResponse;
  }

  const body = await request.json().catch(() => undefined);
  const parsedDraft = captureDraftSchema.safeParse(getDraftPayload(body));

  if (!parsedDraft.success) {
    return captureDraftJson(
      request,
      { error: "Invalid capture draft." },
      { status: 400 },
    );
  }

  const token = createDraftToken();
  const { error } = await supabaseAdmin.from("capture_drafts").insert({
    draft: parsedDraft.data,
    expires_at: draftExpiresAt(),
    source: "chrome-extension",
    token,
  });

  if (error) {
    return captureDraftJson(
      request,
      { error: "Could not create capture draft." },
      { status: 500 },
    );
  }

  return captureDraftJson(request, { draftId: token });
}
