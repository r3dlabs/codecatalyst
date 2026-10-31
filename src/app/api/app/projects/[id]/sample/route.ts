import { NextResponse } from "next/server";
import { applyContext, getProject } from "@/lib/store";
import { projectMeta } from "@/lib/projects";
import { noStore } from "@/lib/api";

export const dynamic = "force-dynamic";

/** Loads the fictional customer's starting model, only if the project is still empty. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const meta = projectMeta(id);
  if (!meta) return NextResponse.json({ error: "unknown project" }, { status: 404 });
  const current = await getProject(id);
  if (current.revision > 0) return NextResponse.json(current, noStore);
  return NextResponse.json(await applyContext(id, meta.sample, undefined, "sample"), noStore);
}
