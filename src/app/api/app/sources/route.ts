import { NextResponse } from "next/server";
import { requirements, sources } from "@/lib/seed";
import { createDraft, listDrafts } from "@/lib/drafts";
import { extractCandidates, hasAi } from "@/lib/ai";
import { noStore } from "@/lib/api";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  const register = sources.map((s) => {
    const reqs = requirements.filter((r) => r.source_id === s.id);
    return {
      id: s.id,
      title: s.title,
      issuer: s.issuer,
      edition: s.edition,
      url: s.url,
      format: s.format,
      checked_at: s.checked_at,
      verified: reqs.length > 0 && reqs.every((r) => r.verification_status === "checked"),
      requirements: reqs.map((r) => r.title),
    };
  });
  return NextResponse.json({ register, drafts: await listDrafts(), ai: hasAi() }, noStore);
}

export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  const title = typeof b?.title === "string" ? b.title.trim().slice(0, 200) : "";
  if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });
  const issuer = ["BCA", "SCDF", "URA"].includes(b.issuer) ? b.issuer : "BCA";
  const url = typeof b.url === "string" && /^https?:\/\//.test(b.url) ? b.url.slice(0, 500) : null;
  const filename = typeof b.filename === "string" ? b.filename.slice(0, 200) : null;
  const excerpt = typeof b.excerpt === "string" ? b.excerpt.slice(0, 40000) : null;
  const candidates = excerpt ? await extractCandidates(excerpt) : [];
  const draft = await createDraft({
    title,
    issuer,
    url,
    filename,
    excerpt,
    candidates,
    status: candidates.length ? "drafted" : "uploaded",
  });
  return NextResponse.json(draft, noStore);
}
