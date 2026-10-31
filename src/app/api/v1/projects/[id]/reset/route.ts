import { NextResponse } from "next/server";
import { resetProject } from "@/lib/store";
import { checkKey, noStore } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = checkKey(req);
  if (denied) return denied;
  const { id } = await params;
  return NextResponse.json(await resetProject(id), noStore);
}
