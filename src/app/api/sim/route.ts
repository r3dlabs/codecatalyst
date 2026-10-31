import { NextResponse } from "next/server";
import { applyContext, resetProject } from "@/lib/store";
import { noStore } from "@/lib/api";
import { SIM_SCRIPTS } from "@/lib/projects";

export const dynamic = "force-dynamic";

/**
 * Server-side stand-in for a Revit/Rhino plugin: it plays scripted model changes into the
 * same applyContext() path as PUT /api/v1/projects/{id}/context. Keeping it server-side means
 * DEMO_API_KEY never reaches the browser.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const id = typeof body.project === "string" ? body.project : "demo-office";
  if (body.action === "reset") return NextResponse.json(await resetProject(id), noStore);
  const n = Number(body.step);
  const step = SIM_SCRIPTS[id]?.[n];
  if (!step) return NextResponse.json({ error: "unknown step" }, { status: 400 });
  const run = typeof body.run === "string" ? body.run : "0";
  return NextResponse.json(await applyContext(id, step.context, `sim-${run}-${n}`, "simulated-revit"), noStore);
}
