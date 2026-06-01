import { NextRequest, NextResponse } from "next/server";

import {
  captureDraftSchema,
} from "@/features/capture/capture-draft-schema";
import { supabaseAdmin } from "@/lib/supabase/admin";

import { captureDraftCorsHeaders, captureDraftOptionsResponse } from "./cors";

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

export function OPTIONS() {
  return captureDraftOptionsResponse();
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => undefined);
  const parsedDraft = captureDraftSchema.safeParse(getDraftPayload(body));

  if (!parsedDraft.success) {
    return NextResponse.json(
      { error: "Invalid capture draft." },
      { headers: captureDraftCorsHeaders, status: 400 },
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
    return NextResponse.json(
      { error: "Could not create capture draft." },
      { headers: captureDraftCorsHeaders, status: 500 },
    );
  }

  return NextResponse.json(
    { draftId: token },
    { headers: captureDraftCorsHeaders },
  );
}
