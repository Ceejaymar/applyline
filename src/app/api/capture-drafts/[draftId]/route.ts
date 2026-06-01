import { captureDraftSchema } from "@/features/capture/capture-draft-schema";
import { supabaseAdmin } from "@/lib/supabase/admin";

import {
  captureDraftJson,
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

export function OPTIONS(request: Request) {
  return captureDraftOptionsResponse(request);
}

export async function GET(request: Request, context: RouteContext) {
  const { draftId } = await context.params;

  if (!draftId) {
    return captureDraftJson(
      request,
      { error: "Capture draft was not found." },
      { status: 404 },
    );
  }

  const { data, error } = await supabaseAdmin
    .from("capture_drafts")
    .select("draft,expires_at,consumed_at")
    .eq("token", draftId)
    .maybeSingle();

  if (error) {
    return captureDraftJson(
      request,
      { error: "Could not load capture draft." },
      { status: 500 },
    );
  }

  if (!data) {
    return captureDraftJson(
      request,
      { error: "Capture draft was not found." },
      { status: 404 },
    );
  }

  const row = data as CaptureDraftRow;

  if (row.consumed_at || isExpired(row.expires_at)) {
    return captureDraftJson(
      request,
      { error: "Capture draft has expired or was already used." },
      { status: 410 },
    );
  }

  const parsedDraft = captureDraftSchema.safeParse(row.draft);

  if (!parsedDraft.success) {
    return captureDraftJson(
      request,
      { error: "Capture draft could not be read." },
      { status: 410 },
    );
  }

  return captureDraftJson(request, { draft: parsedDraft.data });
}
