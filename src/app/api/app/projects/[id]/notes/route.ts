import { NextResponse } from "next/server";
import { getProject } from "@/lib/store";
import { requirements } from "@/lib/seed";
import { affectedBy } from "@/lib/rules";
import { changeNote, matchNotes } from "@/lib/ai";
import { noStore } from "@/lib/api";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * AI-written, per-project explanations. The rules have already chosen the controls;
 * these notes only explain them, and fall back to stored text when AI is off.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = await req.json().catch(() => null);
  const p = await getProject(id);
  if (!p.ready) return NextResponse.json({ error: "project not confirmed yet" }, { status: 400 });

  if (b?.kind === "match") {
    return NextResponse.json(await matchNotes(p.context, p.items), noStore);
  }
  const last = p.history[p.history.length - 1];
  const fields = last?.changed.map((c) => c.field) ?? [];
  const touched = affectedBy(fields, requirements).map((r) => r.id);
  const items = p.items.filter((i) => touched.includes(i.id));
  return NextResponse.json(await changeNote(last ?? null, items), noStore);
}
