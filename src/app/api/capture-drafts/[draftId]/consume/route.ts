import { supabaseAdmin } from "@/lib/supabase/admin";

import {
  captureDraftJson,
  captureDraftOptionsResponse,
} from "../../cors";

type RouteContext = {
  params: Promise<{ draftId: string }>;
};

type CaptureDraftConsumeRow = {
  consumed_at: string | null;
};

export function OPTIONS(request: Request) {
  return captureDraftOptionsResponse(request);
}

export async function POST(request: Request, context: RouteContext) {
  const { draftId } = await context.params;

  if (!draftId) {
    return captureDraftJson(
      request,
      { error: "Capture draft was not found." },
      { status: 404 },
    );
  }

  const consumedAt = new Date().toISOString();
  const updateResult = await supabaseAdmin
    .from("capture_drafts")
    .update({ consumed_at: consumedAt })
    .eq("token", draftId)
    .is("consumed_at", null)
    .select("consumed_at");

  if (updateResult.error) {
    return captureDraftJson(
      request,
      { error: "Could not mark capture draft as consumed." },
      { status: 500 },
    );
  }

  if ((updateResult.data ?? []).length > 0) {
    return captureDraftJson(request, { ok: true, consumed: true });
  }

  const lookupResult = await supabaseAdmin
    .from("capture_drafts")
    .select("consumed_at")
    .eq("token", draftId)
    .maybeSingle();

  if (lookupResult.error) {
    return captureDraftJson(
      request,
      { error: "Could not check capture draft." },
      { status: 500 },
    );
  }

  if (!lookupResult.data) {
    return captureDraftJson(
      request,
      { error: "Capture draft was not found." },
      { status: 404 },
    );
  }

  const row = lookupResult.data as CaptureDraftConsumeRow;

  if (row.consumed_at) {
    return captureDraftJson(request, {
      ok: true,
      consumed: true,
      alreadyConsumed: true,
    });
  }

  return captureDraftJson(
    request,
    { error: "Capture draft could not be consumed." },
    { status: 409 },
  );
}
