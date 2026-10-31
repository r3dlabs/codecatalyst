import { NextResponse } from "next/server";
import { applyContext } from "@/lib/store";
import { sanitizePatch } from "@/lib/rules";
import { noStore } from "@/lib/api";

export const dynamic = "force-dynamic";

/** Same-origin write path for the web UI. The demo has no login, so no key is needed here. */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const { patch, errors } = sanitizePatch(body?.context);
  if (errors.length) return NextResponse.json({ error: errors }, { status: 400 });
  return NextResponse.json(await applyContext(id, patch), noStore);
}
