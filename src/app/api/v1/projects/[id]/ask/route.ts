import { NextResponse } from "next/server";
import { getProject } from "@/lib/store";
import { ask, hasAi } from "@/lib/ai";
import { requirements } from "@/lib/seed";
import { noStore } from "@/lib/api";

export const dynamic = "force-dynamic";

const keywords = Object.fromEntries(requirements.map((r) => [r.id, r.keywords]));

export async function GET() {
  return NextResponse.json({ ai: hasAi() }, noStore);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const question = typeof body?.question === "string" ? body.question.trim().slice(0, 500) : "";
  if (!question) return NextResponse.json({ error: "question required" }, { status: 400 });
  const project = await getProject(id);
  if (!project.ready) {
    return NextResponse.json(
      { kind: "not_covered", ai: hasAi(), citations: [], answer: "Confirm the project context first, then ask about the results." },
      noStore,
    );
  }
  return NextResponse.json(await ask(question, project.items, keywords), noStore);
}
