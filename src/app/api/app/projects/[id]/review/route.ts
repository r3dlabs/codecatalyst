import { NextResponse } from "next/server";
import { setReview } from "@/lib/store";
import { requirements } from "@/lib/seed";
import { noStore } from "@/lib/api";

export const dynamic = "force-dynamic";

const STATES = ["open", "raised_with_qp", "evidence_noted"] as const;

/** Tracks where the team is on a control. This is a to-do state, not a compliance status. */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = await req.json().catch(() => null);
  if (!requirements.some((r) => r.id === b?.requirement_id) || !STATES.includes(b?.state)) {
    return NextResponse.json({ error: "invalid review" }, { status: 400 });
  }
  const note = typeof b.note === "string" ? b.note.slice(0, 300) : "";
  return NextResponse.json(
    await setReview(id, b.requirement_id, { state: b.state, note, at: new Date().toISOString() }),
    noStore,
  );
}
