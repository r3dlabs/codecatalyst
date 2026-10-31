import { NextResponse } from "next/server";
import { getProject } from "@/lib/store";
import { noStore } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return NextResponse.json(await getProject(id), noStore);
}
