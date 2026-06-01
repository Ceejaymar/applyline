import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase/admin";

import {
  captureDraftCorsHeaders,
  captureDraftOptionsResponse,
} from "../../cors";

type RouteContext = {
  params: Promise<{ draftId: string }>;
};

export function OPTIONS() {
  return captureDraftOptionsResponse();
}

export async function POST(_request: Request, context: RouteContext) {
  const { draftId } = await context.params;

  if (!draftId) {
    return NextResponse.json(
      { error: "Capture draft was not found." },
      { headers: captureDraftCorsHeaders, status: 404 },
    );
  }

  const { error } = await supabaseAdmin
    .from("capture_drafts")
    .update({ consumed_at: new Date().toISOString() })
    .eq("token", draftId);

  if (error) {
    return NextResponse.json(
      { error: "Could not mark capture draft as consumed." },
      { headers: captureDraftCorsHeaders, status: 500 },
    );
  }

  return NextResponse.json({ ok: true }, { headers: captureDraftCorsHeaders });
}
