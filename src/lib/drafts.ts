import "server-only";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

export interface Candidate {
  title: string;
  domain: string;
  trigger_in_words: string;
  threshold_value: string | null;
  design_prompt: string;
  exact_quote: string;
  /** Normalised, machine-readable rule. Null when the text states none or it failed validation. */
  trigger: import("./types").Trigger | null;
}
export interface Draft {
  id: string;
  title: string;
  issuer: string;
  url: string | null;
  filename: string | null;
  excerpt: string | null;
  candidates: Candidate[];
  status: "uploaded" | "drafted" | "checked";
  checked_by: string | null;
  checked_at: string | null;
  created_at: string;
}

const g = globalThis as unknown as { __cc_drafts?: Draft[] };
const mem = (g.__cc_drafts ??= []);

const sb = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
};

export async function listDrafts(): Promise<Draft[]> {
  const c = sb();
  if (c) {
    const { data, error } = await c.from("source_drafts").select("*").order("created_at", { ascending: false });
    if (!error) return data as Draft[];
  }
  return [...mem].reverse();
}

export async function createDraft(
  d: Pick<Draft, "title" | "issuer" | "url" | "filename" | "excerpt" | "candidates" | "status">,
): Promise<Draft> {
  const row = { ...d, id: randomUUID(), checked_by: null, checked_at: null, created_at: new Date().toISOString() } as Draft;
  const c = sb();
  if (c) {
    const { data, error } = await c.from("source_drafts").insert(row).select().single();
    if (!error) return data as Draft;
  }
  mem.push(row);
  return row;
}

export async function markChecked(id: string, by: string): Promise<Draft | null> {
  const patch = { status: "checked" as const, checked_by: by, checked_at: new Date().toISOString() };
  const c = sb();
  if (c) {
    const { data, error } = await c.from("source_drafts").update(patch).eq("id", id).select().maybeSingle();
    if (!error && data) return data as Draft;
  }
  const hit = mem.find((x) => x.id === id);
  if (!hit) return null;
  Object.assign(hit, patch);
  return hit;
}
