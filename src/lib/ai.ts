import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { Item } from "./types";
import { validateTrigger } from "./rules";
import { requirements } from "./seed";

/** The only module that talks to an LLM. Rules select requirements; this only explains them. */
const MODEL = "claude-sonnet-5-5";

export type AskKind = "answer" | "not_covered" | "declined" | "unavailable";
export interface Citation {
  id: string;
  title: string;
  source_title: string;
  url: string;
}
export interface AskResult {
  kind: AskKind;
  answer: string;
  citations: Citation[];
  ai: boolean;
}

const VERDICT_QUESTION =
  /complian|\bcompl(y|ies)\b|\b(pass|fail|approv|skip|ignore|bypass|exempt|waive)\w*|meets? (the )?(code|requirements?|regulations?|rules?)|\b(allowed|permitted|legal)\b|is (it|my design|this) (ok|okay|fine|good|enough|safe)/i;

const VERDICT_OUTPUT =
  /\b(complian\w*|complies|comply|pass(ed|es)?|fail(s|ed|ure)?|approved?|satisf(y|ies|ied)|meets? the (code|requirements?))\b/i;

const STOP = new Set(
  "a an and are as at be by can do does for from how i in is it my of on or our should so that the their there this to we what when where which who why will with would you your about look now need needs have has".split(
    " ",
  ),
);

const stem = (w: string) => w.replace(/(ing|es|s)$/, "");
const tokens = (s: string) =>
  s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 1 && !STOP.has(w))
    .map(stem);

export function hasAi(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export function retrieve(question: string, items: Item[], keywords: Record<string, string>): Item[] {
  const q = new Set(tokens(question));
  if (q.size === 0) return [];
  return items
    .map((item) => {
      const hay = new Set(
        tokens(`${item.title} ${item.domain} ${item.summary} ${item.design_prompt} ${keywords[item.id] ?? ""}`),
      );
      let score = 0;
      for (const w of q) if (hay.has(w)) score += 1;
      return { item, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || b.item.redesign_impact - a.item.redesign_impact)
    .filter((x, _, all) => x.score >= Math.ceil(all[0].score * 0.6))
    .slice(0, 3)
    .map((x) => x.item);
}

const cite = (i: Item): Citation => ({
  id: i.id,
  title: i.title,
  source_title: `${i.source.title}${i.source.clause_ref ? `, ${i.source.clause_ref}` : ""}`,
  url: i.source.clause_url ?? i.source.url,
});

function whereToCheck(question: string): string {
  const q = question.toLowerCase();
  if (/fire|evacuat|sprinkler|stair|exit|escape/.test(q)) return "SCDF (Fire Code 2023)";
  if (/plot ratio|setback|zoning|height limit|gfa|planning|submission|gateway/.test(q)) return "URA (development control and CORENET X circulars)";
  if (/green|energy|sustainab|accessib|buildab|structur/.test(q)) return "BCA (codes and Green Mark pages)";
  return "the relevant agency (BCA, SCDF or URA) and your Qualified Person";
}

function promptList(list: Item[]): string {
  return list.map((i) => `• ${i.title}: ${i.design_prompt}`).join("\n");
}

export async function ask(
  question: string,
  items: Item[],
  keywords: Record<string, string>,
): Promise<AskResult> {
  const ai = hasAi();
  if (VERDICT_QUESTION.test(question)) {
    const top = items.slice(0, 3);
    return {
      kind: "declined",
      ai,
      answer:
        "I can't give a determination on your design. That sits with your Qualified Person and the relevant agency." +
        (top.length ? `\n\nWhat to check now:\n${promptList(top)}` : ""),
      citations: top.map(cite),
    };
  }

  const hits = retrieve(question, items, keywords);
  if (hits.length === 0) {
    return {
      kind: "not_covered",
      ai,
      answer: `The records for this project don't cover that question. Check with ${whereToCheck(question)}.`,
      citations: [],
    };
  }

  const stored: AskResult = {
    kind: "unavailable",
    ai: false,
    answer: `AI explanation is unavailable, so these are the stored prompts for the closest records:\n${promptList(hits)}`,
    citations: hits.map(cite),
  };
  if (!ai) return stored;

  try {
    const client = new Anthropic();
    const records = hits.map((i) => ({
      id: i.id,
      title: i.title,
      why_it_appears: i.why,
      summary: i.summary,
      design_prompt: i.design_prompt,
      source: `${i.source.title}${i.source.clause_ref ? `, ${i.source.clause_ref}` : ""}, ${i.source.edition}`,
      quote: i.source.exact_quote,
    }));
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 500,
      system:
        "You help a building designer in Singapore see which stored design records are relevant. " +
        "Answer ONLY from the records provided. Never add figures, clauses or rules that are not in them. " +
        "Never say whether a design complies, passes, fails or is approved. If the records do not answer the question, say so. " +
        "Be brief (under 120 words) and practical. " +
        'Reply as JSON only: {"answer": string, "cited": string[]} where cited lists the record ids you used.',
      messages: [{ role: "user", content: JSON.stringify({ question, records }) }],
    });
    const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    const parsed = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
    const cited = (Array.isArray(parsed.cited) ? parsed.cited : []).filter((id: string) =>
      hits.some((h) => h.id === id),
    );
    if (typeof parsed.answer !== "string" || cited.length === 0 || VERDICT_OUTPUT.test(parsed.answer)) {
      return stored;
    }
    return {
      kind: "answer",
      ai: true,
      answer: parsed.answer.trim(),
      citations: hits.filter((h) => cited.includes(h.id)).map(cite),
    };
  } catch (err) {
    console.warn("[ai] falling back to stored prompts:", err instanceof Error ? err.message : err);
    return stored;
  }
}

function numbersInQuote(t: unknown, quote: string): boolean {
  const q = quote.replace(/,/g, "");
  const nums: number[] = [];
  const walk = (x: unknown) => {
    if (!x || typeof x !== "object") return;
    const o = x as Record<string, unknown>;
    if (typeof o.value === "number") nums.push(o.value);
    for (const k of [...((o.all as unknown[]) ?? []), ...((o.any as unknown[]) ?? [])]) walk(k);
  };
  walk(t);
  return nums.every((n) => q.includes(String(n)));
}

const DOMAINS = ["Fire", "Accessibility", "Sustainability", "Planning", "Submission", "Buildability"];

/**
 * Drafts candidate requirement rows from pasted source text. Every quote must appear
 * verbatim in the text or the row is dropped, so nothing is invented. A person still checks each row.
 */
export async function extractCandidates(text: string): Promise<import("./drafts").Candidate[]> {
  if (!hasAi()) return [];
  const body = text.slice(0, 12000);
  try {
    const res = await new Anthropic().messages.create({
      model: MODEL,
      max_tokens: 1500,
      system:
        "You draft candidate design-stage requirements from an official building code excerpt. " +
        "Only include items that change early design decisions (massing, core, site layout, submission route). " +
        "Never invent figures. exact_quote must be copied character for character from the excerpt. " +
        "Never say whether a design complies. Reply with a JSON array only, up to 6 items, each with the keys: " +
        `title, domain (one of ${DOMAINS.join(", ")}), trigger_in_words, threshold_value (string or null), design_prompt (one question), exact_quote, trigger. ` +
        `trigger is a machine-readable rule or null if the text does not state one. Leaf: {"field","op","value"}; combine with {"all":[...]} or {"any":[...]}. ` +
        `Fields: gfa_m2, storeys, habitable_height_m (numbers; ops >= > <= < ==); work_type (new_erection|major_aa|minor_aa), ` +
        `primary_use (office|retail|residential|landed|hotel|healthcare|education|industrial|mixed), gls_site (yes|no), ` +
        `design_stage (concept|design_gateway|construction_gateway) (ops == != in with a list). Only use numbers that appear in the quote.`,
      messages: [{ role: "user", content: body }],
    });
    const out = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    const arr = JSON.parse(out.slice(out.indexOf("["), out.lastIndexOf("]") + 1));
    const norm = (s: string) => s.replace(/\s+/g, " ").trim();
    const haystack = norm(body);
    return (Array.isArray(arr) ? arr : [])
      .filter((c) => c && typeof c.title === "string" && typeof c.exact_quote === "string" && haystack.includes(norm(c.exact_quote)))
      .map((c) => ({
        title: c.title.slice(0, 140),
        domain: DOMAINS.includes(c.domain) ? c.domain : "Planning",
        trigger_in_words: String(c.trigger_in_words ?? "").slice(0, 300),
        threshold_value: c.threshold_value == null ? null : String(c.threshold_value).slice(0, 60),
        design_prompt: String(c.design_prompt ?? "").slice(0, 300),
        exact_quote: norm(c.exact_quote).slice(0, 400),
        // A trigger is kept only if it validates and every number in it appears in the quote.
        trigger: validateTrigger(c.trigger) && numbersInQuote(c.trigger, norm(c.exact_quote)) ? c.trigger : null,
      }));
  } catch (err) {
    console.warn("[ai] candidate drafting failed:", err instanceof Error ? err.message : err);
    return [];
  }
}

/* ---------- per-project notes (stages 3 and 4) ---------- */
import type { Context, HistoryEntry } from "./types";
import { FIELD_LABEL, projectSummary } from "./rules";

export interface NotesResult {
  ai: boolean;
  notes: Record<string, string>;
  summary?: string;
}

const VERDICT_WORDS = /\b(complian\w*|complies|comply|pass(ed|es)?|fail(s|ed|ure)?|approved?|satisf(y|ies|ied))\b/i;

async function jsonFromClaude(system: string, payload: unknown, max = 900): Promise<Record<string, unknown> | null> {
  if (!hasAi()) return null;
  try {
    const res = await new Anthropic().messages.create({
      model: MODEL,
      max_tokens: max,
      system,
      messages: [{ role: "user", content: JSON.stringify(payload) }],
    });
    const out = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    return JSON.parse(out.slice(out.indexOf("{"), out.lastIndexOf("}") + 1));
  } catch (err) {
    console.warn("[ai] notes failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

/** One short project-specific line per matched control. Falls back to the stored summary. */
export async function matchNotes(ctx: Partial<Context>, items: Item[]): Promise<NotesResult> {
  const stored = Object.fromEntries(items.map((i) => [i.id, i.summary]));
  const out = await jsonFromClaude(
    "You explain why stored building-code controls matter for one specific project. Use only the records given. " +
      "For each record write one sentence (under 35 words) tied to this project's inputs and what the designer could act on now. " +
      "Never add figures or clauses that are not in the record. Never say whether the design complies, passes or fails. " +
      'Reply as JSON only: {"notes": {"<record id>": "<sentence>"}}.',
    {
      project: projectSummary(ctx),
      records: items.map((i) => ({ id: i.id, title: i.title, why: i.why, summary: i.summary, design_prompt: i.design_prompt })),
    },
  );
  const notes = (out?.notes ?? null) as Record<string, string> | null;
  if (!notes) return { ai: false, notes: stored };
  const clean: Record<string, string> = {};
  for (const i of items) {
    const n = notes[i.id];
    clean[i.id] = typeof n === "string" && n && !VERDICT_WORDS.test(n) ? n : stored[i.id];
  }
  return { ai: true, notes: clean };
}

/** A short note on what the latest design change touches. Deterministic fallback lists the prompts. */
export async function changeNote(entry: HistoryEntry | null, touched: Item[]): Promise<NotesResult> {
  if (!entry || entry.changed.length === 0) {
    return { ai: false, notes: {}, summary: "No design change recorded yet. Edit the model or play the simulator to see what it touches." };
  }
  const what = entry.changed.map((c) => `${FIELD_LABEL[c.field]}: ${fmt(c.from)} → ${fmt(c.to)}`).join("; ");
  const fallback =
    `Changed: ${what}. ` +
    (touched.length ? `Re-check: ${touched.map((i) => i.title).join("; ")}.` : "No stored control reads these inputs.");
  const out = await jsonFromClaude(
    "You summarise what a design change means for a designer's open items. Use only the records given. " +
      "Write at most 60 words: what changed, which records it touches, and the first thing to re-check. Refer to records by title, never by id. " +
      "No new figures. Never say whether the design complies, passes or fails. " +
      'Reply as JSON only: {"summary": "<text>"}.',
    {
      change: what,
      newly_triggered: entry.added.map(titleOf),
      no_longer_triggered: entry.removed.map(titleOf),
      touched: touched.map((i) => ({ id: i.id, title: i.title, design_prompt: i.design_prompt })),
    },
    400,
  );
  const s = out?.summary;
  if (typeof s !== "string" || !s || VERDICT_WORDS.test(s)) return { ai: false, notes: {}, summary: fallback };
  return { ai: true, notes: {}, summary: s };
}

const titleOf = (id: string) => requirements.find((r) => r.id === id)?.title ?? id;

function fmt(v: unknown): string {
  return v === null || v === undefined ? "unknown" : String(v);
}
