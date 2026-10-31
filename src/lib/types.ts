export type WorkType = "new_erection" | "major_aa" | "minor_aa";
export type PrimaryUse =
  | "office"
  | "retail"
  | "residential"
  | "landed"
  | "hotel"
  | "healthcare"
  | "education"
  | "industrial"
  | "mixed";
export type DesignStage = "concept" | "design_gateway" | "construction_gateway";
export type GlsSite = "yes" | "no";

/** A key that is absent = not answered yet. `null` = explicitly unknown. */
export interface Context {
  work_type: WorkType | null;
  primary_use: PrimaryUse | null;
  gfa_m2: number | null;
  storeys: number | null;
  habitable_height_m: number | null;
  gls_site: GlsSite | null;
  design_stage: DesignStage | null;
}
export type ContextPatch = Partial<Context>;
export type ContextField = keyof Context;

export type Domain =
  | "Fire"
  | "Accessibility"
  | "Sustainability"
  | "Planning"
  | "Submission"
  | "Buildability";

export type Label = "applies_on_inputs" | "may_apply_need_input" | "check_with_qp";
export type Op = ">=" | ">" | "<=" | "<" | "==" | "!=" | "in";

export interface Leaf {
  field: ContextField;
  op: Op;
  value: number | string | string[];
}
export type Trigger = Leaf | { all: Trigger[] } | { any: Trigger[] };

export interface Source {
  id: string;
  title: string;
  issuer: "BCA" | "SCDF" | "URA";
  edition: string;
  url: string;
  clause_ref: string | null;
  clause_url: string | null;
  format: "html" | "pdf" | "xlsx" | "csv" | "api";
  checked_at: string;
  checked_by: string;
  exact_quote: string | null;
  note: string | null;
}

export interface Requirement {
  id: string;
  title: string;
  domain: Domain;
  summary: string;
  design_prompt: string;
  redesign_impact: 1 | 2 | 3;
  stages: DesignStage[];
  trigger: Trigger;
  label_default: "applies_on_inputs" | "check_with_qp";
  source_id: string;
  verification_status: "checked" | "unchecked";
  /** Extra retrieval words for the companion. Not shown to users. */
  keywords: string;
}

export interface Item {
  id: string;
  title: string;
  domain: Domain;
  label: Label;
  summary: string;
  why: string;
  design_prompt: string;
  redesign_impact: 1 | 2 | 3;
  in_stage: boolean;
  /** For conditional items: the input that is missing and why it matters. */
  ask: { field: ContextField; question: string } | null;
  verified: boolean;
  source: {
    title: string;
    issuer: string;
    edition: string;
    url: string;
    clause_ref: string | null;
    clause_url: string | null;
    checked_at: string;
    exact_quote: string | null;
    note: string | null;
  };
}

export interface Diff {
  from_revision: number;
  added: string[];
  removed: string[];
  changed: string[];
}

export interface RequirementsResponse {
  project_id: string;
  revision: number;
  disclaimer: string;
  ready: boolean;
  context: Partial<Context>;
  missing_fields: ContextField[];
  unlocks: Partial<Record<ContextField, string>>;
  items: Item[];
  /** Titles of items that left the list in the last diff. */
  removed_items: { id: string; title: string }[];
  diff: Diff;
  history: HistoryEntry[];
  reviews: Record<string, Review>;
  watch: WatchRow[];
}

export type ReviewState = "open" | "raised_with_qp" | "evidence_noted";
export interface Review {
  state: ReviewState;
  note: string;
  at: string;
}
export interface HistoryEntry {
  revision: number;
  at: string;
  source: string;
  changed: { field: ContextField; from: unknown; to: unknown }[];
  added: string[];
  removed: string[];
  updated: string[];
}
/** Distance between a checked threshold and the current design input. Not a verdict. */
export interface WatchRow {
  id: string;
  title: string;
  field: ContextField;
  label: string;
  op: Op;
  threshold: number;
  unit: string;
  current: number | null;
  crossed: boolean | null;
}
