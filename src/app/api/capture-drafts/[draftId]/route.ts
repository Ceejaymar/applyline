import { NextResponse } from "next/server";

import { captureDraftSchema } from "@/features/capture/capture-draft-schema";
import { supabaseAdmin } from "@/lib/supabase/admin";

import {
  captureDraftCorsHeaders,
  captureDraftOptionsResponse,
} from "../cors";

type RouteContext = {
  params: Promise<{ draftId: string }>;
};

type CaptureDraftRow = {
  consumed_at: string | null;
  draft: unknown;
  expires_at: string;
};

function isExpired(value: string) {
  return new Date(value).getTime() <= Date.now();
}

export function OPTIONS() {
  return captureDraftOptionsResponse();
}

export async function GET(_request: Request, context: RouteContext) {
  const { draftId } = await context.params;

  if (!draftId) {
    return NextResponse.json(
      { error: "Capture draft was not found." },
      { headers: captureDraftCorsHeaders, status: 404 },
    );
  }

  const { data, error } = await supabaseAdmin
    .from("capture_drafts")
    .select("draft,expires_at,consumed_at")
    .eq("token", draftId)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json(
      { error: "Capture draft was not found." },
      { headers: captureDraftCorsHeaders, status: 404 },
    );
  }

  const row = data as CaptureDraftRow;

  if (row.consumed_at || isExpired(row.expires_at)) {
    return NextResponse.json(
      { error: "Capture draft has expired or was already used." },
      { headers: captureDraftCorsHeaders, status: 410 },
    );
  }

  const parsedDraft = captureDraftSchema.safeParse(row.draft);

  if (!parsedDraft.success) {
    return NextResponse.json(
      { error: "Capture draft could not be read." },
      { headers: captureDraftCorsHeaders, status: 410 },
    );
  }

  return NextResponse.json(
    { draft: parsedDraft.data },
    { headers: captureDraftCorsHeaders },
  );
}
