import { NextResponse } from "next/server";
import { listDrafts, markChecked } from "@/lib/drafts";
import { noStore } from "@/lib/api";

export const dynamic = "force-dynamic";

/** Marks a draft as checked by a named person. Checked drafts are queued for seeding; they do not change live results. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = await req.json().catch(() => null);
  const by = typeof b?.checked_by === "string" ? b.checked_by.trim().slice(0, 80) : "";
  if (!by) return NextResponse.json({ error: "checked_by required" }, { status: 400 });
  const draft = (await listDrafts()).find((d) => d.id === id);
  if (!draft || draft.candidates.length === 0) {
    return NextResponse.json({ error: "nothing to check: no drafted rows with quotes" }, { status: 400 });
  }
  return NextResponse.json(await markChecked(id, by), noStore);
}
