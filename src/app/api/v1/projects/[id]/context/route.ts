import { NextResponse } from "next/server";
import { applyContext } from "@/lib/store";
import { sanitizePatch } from "@/lib/rules";
import { checkKey, noStore } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = checkKey(req);
  if (denied) return denied;
  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const { patch, errors } = sanitizePatch(body.context);
  if (errors.length) return NextResponse.json({ error: errors }, { status: 400 });
  const eventId = typeof body.event_id === "string" ? body.event_id : undefined;
  return NextResponse.json(await applyContext(id, patch, eventId), noStore);
}
