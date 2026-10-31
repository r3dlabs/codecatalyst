import type {
  Op,
  WatchRow,
  Context,
  ContextField,
  ContextPatch,
  Diff,
  Item,
  Label,
  Leaf,
  Requirement,
  Source,
  Trigger,
} from "./types";

export const DISCLAIMER =
  "Design guidance only. Not a compliance determination. Confirm with your Qualified Person and the relevant agency.";

export const GATE_FIELDS: ContextField[] = [
  "work_type",
  "primary_use",
  "gfa_m2",
  "habitable_height_m",
  "design_stage",
];

export const ALL_FIELDS: ContextField[] = [
  "work_type",
  "primary_use",
  "gfa_m2",
  "storeys",
  "habitable_height_m",
  "gls_site",
  "design_stage",
];

type Tri = "yes" | "no" | "unknown";

function isMissing(v: unknown): boolean {
  return v === undefined || v === null;
}

function evalLeaf(leaf: Leaf, ctx: ContextPatch): { result: Tri; missing: ContextField[] } {
  const actual = ctx[leaf.field];
  if (isMissing(actual)) return { result: "unknown", missing: [leaf.field] };
  let ok: boolean;
  switch (leaf.op) {
    case ">=": ok = (actual as number) >= (leaf.value as number); break;
    case ">": ok = (actual as number) > (leaf.value as number); break;
    case "<=": ok = (actual as number) <= (leaf.value as number); break;
    case "<": ok = (actual as number) < (leaf.value as number); break;
    case "==": ok = actual === leaf.value; break;
    case "!=": ok = actual !== leaf.value; break;
    case "in": ok = (leaf.value as string[]).includes(actual as string); break;
  }
  return { result: ok ? "yes" : "no", missing: [] };
}

/** Three-valued evaluation: a missing input is "unknown", never "no". */
export function evalTrigger(t: Trigger, ctx: ContextPatch): { result: Tri; missing: ContextField[] } {
  if ("field" in t) return evalLeaf(t, ctx);
  const kids = ("all" in t ? t.all : t.any).map((k) => evalTrigger(k, ctx));
  const missing = [...new Set(kids.flatMap((k) => k.missing))];
  if ("all" in t) {
    if (kids.some((k) => k.result === "no")) return { result: "no", missing: [] };
    return { result: kids.some((k) => k.result === "unknown") ? "unknown" : "yes", missing };
  }
  if (kids.some((k) => k.result === "yes")) return { result: "yes", missing: [] };
  return { result: kids.some((k) => k.result === "unknown") ? "unknown" : "no", missing };
}

export interface Evaluated {
  requirement: Requirement;
  label: Label;
  missing: ContextField[];
  inStage: boolean;
}

/** Pure: which requirements apply (or may apply) for this project context. */
export function evaluate(ctx: ContextPatch, reqs: Requirement[]): Evaluated[] {
  const out: Evaluated[] = [];
  for (const requirement of reqs) {
    const { result, missing } = evalTrigger(requirement.trigger, ctx);
    if (result === "no") continue;
    const label: Label =
      result === "unknown" ? "may_apply_need_input" : requirement.label_default;
    const stage = ctx.design_stage;
    out.push({
      requirement,
      label,
      missing,
      // An unknown stage keeps everything in view rather than hiding items.
      inStage: isMissing(stage) ? true : requirement.stages.includes(stage!),
    });
  }
  return out;
}

export function isReady(ctx: ContextPatch): boolean {
  return GATE_FIELDS.every((f) => ctx[f] !== undefined);
}

export function missingFields(ctx: ContextPatch): ContextField[] {
  return ALL_FIELDS.filter((f) => isMissing(ctx[f]));
}

/** Conditional or newly triggered first, then highest redesign impact. */
export function rank(list: Evaluated[], newIds: ReadonlySet<string> = new Set()): Evaluated[] {
  const tier = (e: Evaluated) =>
    e.label === "may_apply_need_input" || newIds.has(e.requirement.id) ? 0 : 1;
  return [...list].sort(
    (a, b) =>
      tier(a) - tier(b) ||
      b.requirement.redesign_impact - a.requirement.redesign_impact ||
      a.requirement.title.localeCompare(b.requirement.title),
  );
}

export function diffSnapshots(
  prev: Record<string, Label> | null,
  next: Record<string, Label> | null,
  fromRevision: number,
): Diff {
  const empty: Diff = { from_revision: fromRevision, added: [], removed: [], changed: [] };
  if (!prev || !next) return empty;
  return {
    from_revision: fromRevision,
    added: Object.keys(next).filter((id) => !(id in prev)),
    removed: Object.keys(prev).filter((id) => !(id in next)),
    changed: Object.keys(next).filter((id) => id in prev && prev[id] !== next[id]),
  };
}

export function snapshot(list: Evaluated[]): Record<string, Label> {
  return Object.fromEntries(list.map((e) => [e.requirement.id, e.label]));
}

/* ---------- plain-language "why this appears" ---------- */

export const FIELD_LABEL: Record<ContextField, string> = {
  work_type: "Work type",
  primary_use: "Primary use",
  gfa_m2: "GFA",
  storeys: "Storeys",
  habitable_height_m: "Habitable height",
  gls_site: "Government Land Sales site",
  design_stage: "Design stage",
};

export const WORK_TYPE_LABEL: Record<string, string> = {
  new_erection: "New erection",
  major_aa: "Major A&A",
  minor_aa: "Minor A&A",
};
export const USE_LABEL: Record<string, string> = {
  office: "Office",
  retail: "Retail",
  residential: "Residential (flats)",
  landed: "Landed house",
  hotel: "Hotel",
  healthcare: "Healthcare",
  education: "Education",
  industrial: "Industrial",
  mixed: "Mixed",
};
export const STAGE_LABEL: Record<string, string> = {
  concept: "Concept",
  design_gateway: "Preparing Design Gateway",
  construction_gateway: "Preparing Construction Gateway",
};

const OP_WORD: Record<string, string> = {
  ">=": "at or above",
  ">": "above",
  "<=": "at or below",
  "<": "below",
};

const fmtNum = (n: number) => n.toLocaleString("en-SG", { maximumFractionDigits: 1 });

function fmtValue(field: ContextField, v: unknown): string {
  if (typeof v === "number") {
    if (field === "gfa_m2") return `${fmtNum(v)} m²`;
    if (field === "habitable_height_m") return `${fmtNum(v)} m`;
    return fmtNum(v);
  }
  if (field === "work_type") return WORK_TYPE_LABEL[v as string] ?? String(v);
  if (field === "primary_use") return USE_LABEL[v as string] ?? String(v);
  if (field === "gls_site") return v === "yes" ? "a Government Land Sales site" : "not a Government Land Sales site";
  return String(v);
}

function leaves(t: Trigger): Leaf[] {
  if ("field" in t) return [t];
  return ("all" in t ? t.all : t.any).flatMap(leaves);
}

/**
 * Builds the "why" sentence from the inputs that satisfied the trigger.
 * Figures are only written when the record is `checked`.
 */
export function explain(req: Requirement, ctx: ContextPatch): string {
  const parts: string[] = [];
  for (const leaf of leaves(req.trigger)) {
    if (evalLeaf(leaf, ctx).result !== "yes") continue;
    const actual = ctx[leaf.field];
    if (typeof leaf.value === "number") {
      if (req.verification_status !== "checked") continue;
      parts.push(
        `${FIELD_LABEL[leaf.field]} ${fmtValue(leaf.field, actual)} is ${OP_WORD[leaf.op]} ${fmtValue(leaf.field, leaf.value)}`,
      );
    } else if (leaf.op === "in") {
      parts.push(`${FIELD_LABEL[leaf.field]} is ${fmtValue(leaf.field, actual)}`);
    } else if (leaf.op === "==") {
      parts.push(
        leaf.field === "gls_site"
          ? `Site is ${fmtValue(leaf.field, actual)}`
          : `${FIELD_LABEL[leaf.field]} is ${fmtValue(leaf.field, actual)}`,
      );
    }
  }
  if (parts.length) return parts.join(" and ");
  return req.verification_status === "checked"
    ? "Matches your project inputs."
    : "Your project type is within this clause's general scope. Check the clause for the exact trigger.";
}

export const UNLOCK_TEXT: Partial<Record<ContextField, string>> = {
  gls_site: "Decides which Green Mark standard applies",
  storeys: "Decides whether single-storey submission routes are in scope",
  habitable_height_m: "Decides which fire provisions apply",
  gfa_m2: "Decides submission route and sustainability requirements",
  primary_use: "Decides use-specific fire and planning provisions",
  work_type: "Decides which requirements are in scope",
  design_stage: "Decides which items are shown first",
};

const ASK_QUESTION: Partial<Record<ContextField, string>> = {
  gls_site: "Is this a Government Land Sales site?",
  storeys: "How many storeys does the design have?",
  habitable_height_m: "What is the habitable height in metres?",
  gfa_m2: "What is the gross floor area in m²?",
  primary_use: "What is the primary use?",
  work_type: "What is the work type?",
  design_stage: "Which design stage are you at?",
};

export function toItems(
  evaluated: Evaluated[],
  ctx: ContextPatch,
  sources: Source[],
  newIds?: ReadonlySet<string>,
): Item[] {
  const byId = new Map(sources.map((s) => [s.id, s]));
  return rank(evaluated, newIds).map((e) => {
    const r = e.requirement;
    const s = byId.get(r.source_id);
    if (!s) throw new Error(`No source record for ${r.id}`); // no source, no output
    const field = e.missing[0];
    const conditional = e.label === "may_apply_need_input" && field;
    return {
      id: r.id,
      title: r.title,
      domain: r.domain,
      label: e.label,
      summary: r.summary,
      why: conditional
        ? `${FIELD_LABEL[field]} is not answered yet, so this cannot be ruled in or out.`
        : explain(r, ctx),
      design_prompt: r.design_prompt,
      redesign_impact: r.redesign_impact,
      in_stage: e.inStage,
      ask: conditional ? { field, question: ASK_QUESTION[field] ?? `Provide ${FIELD_LABEL[field]}.` } : null,
      verified: r.verification_status === "checked",
      source: {
        title: s.title,
        issuer: s.issuer,
        edition: s.edition,
        url: s.url,
        clause_ref: s.clause_ref,
        clause_url: s.clause_url,
        checked_at: s.checked_at,
        exact_quote: r.verification_status === "checked" ? s.exact_quote : null,
        note: s.note,
      },
    };
  });
}

/** Field values that a PUT may carry. Anything else is rejected. */
const ENUMS: Partial<Record<ContextField, string[]>> = {
  work_type: ["new_erection", "major_aa", "minor_aa"],
  primary_use: Object.keys(USE_LABEL),
  gls_site: ["yes", "no"],
  design_stage: ["concept", "design_gateway", "construction_gateway"],
};

export function sanitizePatch(input: unknown): { patch: ContextPatch; errors: string[] } {
  const patch: Record<string, unknown> = {};
  const errors: string[] = [];
  if (typeof input !== "object" || input === null) return { patch: {}, errors: ["context must be an object"] };
  for (const [k, v] of Object.entries(input)) {
    if (!ALL_FIELDS.includes(k as ContextField)) {
      errors.push(`unknown field ${k}`);
      continue;
    }
    if (v === null) {
      patch[k] = null;
    } else if (ENUMS[k as ContextField]) {
      if (typeof v === "string" && ENUMS[k as ContextField]!.includes(v)) patch[k] = v;
      else errors.push(`invalid value for ${k}`);
    } else if (typeof v === "number" && Number.isFinite(v) && v >= 0) {
      patch[k] = v;
    } else {
      errors.push(`invalid value for ${k}`);
    }
  }
  return { patch: patch as ContextPatch, errors };
}

export function projectSummary(ctx: ContextPatch): string {
  const bits: string[] = [];
  const wt = ctx.work_type ? (ctx.work_type === "new_erection" ? "New" : WORK_TYPE_LABEL[ctx.work_type]) : null;
  const use = ctx.primary_use ? USE_LABEL[ctx.primary_use].toLowerCase() : null;
  if (wt || use) bits.push([wt, use].filter(Boolean).join(" ").replace(/^./, (c) => c.toUpperCase()));
  if (ctx.gfa_m2 != null) bits.push(`${fmtNum(ctx.gfa_m2)} m²`);
  if (ctx.storeys != null) bits.push(`${ctx.storeys} storey${ctx.storeys === 1 ? "" : "s"}`);
  if (ctx.habitable_height_m != null) bits.push(`${fmtNum(ctx.habitable_height_m)} m habitable height`);
  return bits.join(", ");
}

export type { Context };

/* ---------- trigger validation (for AI-drafted rows) ---------- */

const OPS: Op[] = [">=", ">", "<=", "<", "==", "!=", "in"];
const NUMERIC_FIELDS: ContextField[] = ["gfa_m2", "storeys", "habitable_height_m"];

/** Accepts only triggers built from known fields, ops and value types. Anything else is rejected. */
export function validateTrigger(t: unknown, depth = 0): t is Trigger {
  if (!t || typeof t !== "object" || depth > 4) return false;
  const o = t as Record<string, unknown>;
  if ("all" in o || "any" in o) {
    const list = (o.all ?? o.any) as unknown;
    return Array.isArray(list) && list.length > 0 && list.length <= 8 && list.every((k) => validateTrigger(k, depth + 1));
  }
  if (!ALL_FIELDS.includes(o.field as ContextField) || !OPS.includes(o.op as Op)) return false;
  const field = o.field as ContextField;
  if (o.op === "in") {
    return Array.isArray(o.value) && o.value.length > 0 && o.value.every((v) => typeof v === "string" && (ENUMS[field] ?? []).includes(v));
  }
  if (NUMERIC_FIELDS.includes(field)) return typeof o.value === "number" && Number.isFinite(o.value) && (o.op as string) !== "in";
  return typeof o.value === "string" && (ENUMS[field] ?? []).includes(o.value) && (o.op === "==" || o.op === "!=");
}

export function triggerFields(t: Trigger): ContextField[] {
  return [...new Set(leaves(t).map((l) => l.field))];
}

const UNIT: Partial<Record<ContextField, string>> = { gfa_m2: "m²", habitable_height_m: "m", storeys: "" };

/** Numeric thresholds on checked records, with where the current design sits against each. */
export function thresholdWatch(ctx: ContextPatch, reqs: Requirement[]): WatchRow[] {
  const rows: WatchRow[] = [];
  for (const r of reqs) {
    if (r.verification_status !== "checked") continue;
    for (const leaf of leaves(r.trigger)) {
      if (typeof leaf.value !== "number") continue;
      const cur = ctx[leaf.field];
      const res = evalLeaf(leaf, ctx).result;
      rows.push({
        id: r.id,
        title: r.title,
        field: leaf.field,
        label: FIELD_LABEL[leaf.field],
        op: leaf.op,
        threshold: leaf.value,
        unit: UNIT[leaf.field] ?? "",
        current: typeof cur === "number" ? cur : null,
        crossed: res === "unknown" ? null : res === "yes",
      });
    }
  }
  return rows;
}

/** Controls whose triggers read any of these fields. Used to say what a design change touches. */
export function affectedBy(fields: ContextField[], reqs: Requirement[]): Requirement[] {
  return reqs.filter((r) => triggerFields(r.trigger).some((f) => fields.includes(f)));
}
