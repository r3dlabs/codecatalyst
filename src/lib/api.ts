import "server-only";
import { NextResponse } from "next/server";

/** Write calls from the simulated design tool carry a shared demo key. */
export function checkKey(req: Request): NextResponse | null {
  const expected = process.env.DEMO_API_KEY;
  if (!expected) return null; // open in local dev when no key is configured
  if (req.headers.get("x-api-key") === expected) return null;
  return NextResponse.json({ error: "missing or invalid x-api-key" }, { status: 401 });
}

export const noStore = { headers: { "Cache-Control": "no-store" } };
