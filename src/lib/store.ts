import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { requirements, sources } from "./seed";
import {
  DISCLAIMER,
  diffSnapshots,
  evaluate,
  isReady,
  missingFields,
  snapshot,
  thresholdWatch,
  toItems,
  UNLOCK_TEXT,
} from "./rules";
import type {
  ContextField,
  ContextPatch,
  Diff,
  HistoryEntry,
  Label,
  RequirementsResponse,
  Review,
} from "./types";

export interface ProjectRow {
  id: string;
  context: ContextPatch;
  revision: number;
  snapshot: Record<string, Label> | null;
  diff: Diff;
  event_ids: string[];
  history: HistoryEntry[];
  reviews: Record<string, Review>;
}

const emptyDiff = (from = 0): Diff => ({ from_revision: from, added: [], removed: [], changed: [] });
const blank = (id: string): ProjectRow => ({
  id,
  context: {},
  revision: 0,
  snapshot: null,
  diff: emptyDiff(),
  event_ids: [],
  history: [],
  reviews: {},
});

/* The UI and the simulator share one row per project. Supabase when configured;
   otherwise (or if the table is missing) an in-process map so the demo still runs. */
const g = globalThis as unknown as { __cc_mem?: Map<string, ProjectRow>; __cc_warned?: boolean };
const mem = (g.__cc_mem ??= new Map<string, ProjectRow>());

let client: SupabaseClient | null | undefined;
function db(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  client = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
  return client;
}

function warn(msg: string) {
  if (!g.__cc_warned) {
    console.warn(`[store] ${msg}; using in-memory state`);
    g.__cc_warned = true;
  }
}

async function load(id: string): Promise<ProjectRow> {
  const sb = db();
  if (sb) {
    const { data, error } = await sb.from("projects").select("*").eq("id", id).maybeSingle();
    if (!error) return data ? (data as ProjectRow) : blank(id);
    warn(error.message);
  }
  return mem.get(id) ?? blank(id);
}

async function save(row: ProjectRow): Promise<void> {
  const sb = db();
  if (sb) {
    const { error } = await sb
      .from("projects")
      .upsert({ ...row, updated_at: new Date().toISOString() });
    if (!error) return;
    warn(error.message);
  }
  mem.set(row.id, row);
}

export function view(row: ProjectRow): RequirementsResponse {
  const evaluated = evaluate(row.context, requirements);
  const ready = isReady(row.context);
  const items = ready ? toItems(evaluated, row.context, sources, new Set(row.diff.added)) : [];
  const unlocks: RequirementsResponse["unlocks"] = {};
  const missing = missingFields(row.context);
  for (const f of missing) if (UNLOCK_TEXT[f]) unlocks[f] = UNLOCK_TEXT[f];
  const removed_items = row.diff.removed.map((id) => ({
    id,
    title: requirements.find((r) => r.id === id)?.title ?? id,
  }));
  return {
    project_id: row.id,
    revision: row.revision,
    disclaimer: DISCLAIMER,
    ready,
    context: row.context,
    missing_fields: missing,
    unlocks,
    items,
    removed_items,
    diff: row.diff,
    history: (row.history ?? []).slice(-30),
    reviews: row.reviews ?? {},
    watch: ready ? thresholdWatch(row.context, requirements) : [],
  };
}

export async function getProject(id: string): Promise<RequirementsResponse> {
  return view(await load(id));
}

export async function getRow(id: string): Promise<ProjectRow> {
  return load(id);
}

export async function applyContext(
  id: string,
  patch: ContextPatch,
  eventId?: string,
  source = "web",
): Promise<RequirementsResponse> {
  const row = await load(id);
  if (eventId && row.event_ids.includes(eventId)) return view(row); // repeated event: ignored
  const context = { ...row.context, ...patch };
  const same = JSON.stringify(sortKeys(context)) === JSON.stringify(sortKeys(row.context));
  const event_ids = eventId ? [...row.event_ids, eventId].slice(-50) : row.event_ids;
  if (same) {
    if (eventId) await save({ ...row, event_ids });
    return view(row);
  }
  const ready = isReady(context);
  const next = ready ? snapshot(evaluate(context, requirements)) : null;
  const diff = diffSnapshots(row.snapshot, next, row.revision);
  const changed = (Object.keys(context) as ContextField[])
    .filter((f) => JSON.stringify(context[f]) !== JSON.stringify(row.context[f]))
    .map((f) => ({ field: f, from: row.context[f] ?? null, to: context[f] ?? null }));
  const entry: HistoryEntry = {
    revision: row.revision + 1,
    at: new Date().toISOString(),
    source,
    changed,
    added: diff.added,
    removed: diff.removed,
    updated: diff.changed,
  };
  const updated: ProjectRow = {
    id,
    context,
    revision: row.revision + 1,
    snapshot: next,
    diff,
    event_ids,
    history: [...(row.history ?? []), entry].slice(-60),
    reviews: row.reviews ?? {},
  };
  await save(updated);
  return view(updated);
}

export async function setReview(id: string, reqId: string, review: Review): Promise<RequirementsResponse> {
  const row = await load(id);
  await save({ ...row, reviews: { ...row.reviews, [reqId]: review } });
  return view({ ...row, reviews: { ...row.reviews, [reqId]: review } });
}

export async function resetProject(id: string): Promise<RequirementsResponse> {
  const row = blank(id);
  await save(row);
  return view(row);
}

function sortKeys(o: object) {
  return Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));
}
