"use client";

import { useMemo, useState } from "react";
import type { ContextField, ContextPatch, Item, RequirementsResponse } from "@/lib/types";
import { DISCLAIMER, FIELD_LABEL, GATE_FIELDS, STAGE_LABEL, projectSummary } from "@/lib/rules";
import { IconCopy, IconExternal, IconInfo, IconPrint } from "./icons";

const LABEL_TEXT: Record<Item["label"], string> = {
  applies_on_inputs: "Applies based on your inputs",
  may_apply_need_input: "May apply: need input",
  check_with_qp: "Check with QP or agency",
};

const fmtDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-SG", { day: "numeric", month: "short", year: "numeric" });

function Card({
  item,
  isNew,
  index,
  onAnswer,
}: {
  item: Item;
  isNew: boolean;
  index: number;
  onAnswer: (field: ContextField, value: string | null) => void;
}) {
  const s = item.source;
  const detail = s.exact_quote || s.note;
  return (
    <article
      className={`card req ${isNew ? "is-new" : ""} ${item.in_stage ? "" : "is-later"}`}
      style={{ animationDelay: `${Math.min(index, 6) * 55}ms` }}
    >
      <div className="req__top">
        <span className={`tag tag--${item.domain}`}>{item.domain}</span>
        <span className={`label label--${item.label}`}>{LABEL_TEXT[item.label]}</span>
        {isNew ? (
          <span className="badge-new">New</span>
        ) : !item.in_stage ? (
          <span className="badge-later">later stage</span>
        ) : (
          <span className="impact" title={`Redesign impact ${item.redesign_impact} of 3`} aria-label={`Redesign impact ${item.redesign_impact} of 3`}>
            {[1, 2, 3].map((n) => (
              <i key={n} className={n <= item.redesign_impact ? "on" : ""} />
            ))}
          </span>
        )}
      </div>

      <h3 className="req__title">{item.title}</h3>
      <p className="req__summary">{item.summary}</p>

      <div className="block">
        <div className="block__k">Why this appears</div>
        <div className="block__v">
          {item.why}
          {item.ask && (
            <div className="ask-chip">
              <b style={{ fontWeight: 600 }}>{item.ask.question}</b>
              {item.ask.field === "gls_site" ? (
                <>
                  <button className="btn btn--sm btn--coral" onClick={() => onAnswer("gls_site", "yes")}>Yes</button>
                  <button className="btn btn--sm" onClick={() => onAnswer("gls_site", "no")}>No</button>
                </>
              ) : (
                <span className="note">Answer it in the project context.</span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="block">
        <div className="block__k">Design prompt</div>
        <div className="block__v prompt">{item.design_prompt}</div>
      </div>

      <div className="block">
        <div className="block__k">Source</div>
        <div className="block__v">
          <div className="src">
            <span className="src__issuer">{s.issuer}</span>
            <span className="src__title">
              {s.title}
              {s.clause_ref ? `, ${s.clause_ref}` : ""}
            </span>
          </div>
          <div className="src" style={{ marginTop: 4 }}>
            <span className="src__meta">
              {s.edition} · checked {fmtDate(s.checked_at)}
              {!item.verified && " · clause not yet read in full"}
            </span>
            <a className="link" href={s.clause_url ?? s.url} target="_blank" rel="noreferrer">
              Open source <IconExternal />
            </a>
          </div>
          {detail && (
            <details className="more">
              <summary>Quote and notes</summary>
              {s.exact_quote && <blockquote className="quote">“{s.exact_quote}”</blockquote>}
              {s.note && <div className="note">{s.note}</div>}
            </details>
          )}
        </div>
      </div>
    </article>
  );
}

function buildChecklist(data: RequirementsResponse): string {
  const lines = [
    "CodeCatalyst: design guidance checklist",
    projectSummary(data.context),
    DISCLAIMER,
    "",
  ];
  data.items.forEach((i, n) => {
    lines.push(`${n + 1}. [${i.domain}] ${i.title} (${LABEL_TEXT[i.label]})`);
    lines.push(`   Why: ${i.why}`);
    lines.push(`   Check: ${i.design_prompt}`);
    lines.push(`   Source: ${i.source.title}${i.source.clause_ref ? `, ${i.source.clause_ref}` : ""}, ${i.source.edition}, checked ${i.source.checked_at}`);
    lines.push(`   ${i.source.clause_url ?? i.source.url}`);
    lines.push("");
  });
  const open = data.missing_fields.map((f) => `- ${FIELD_LABEL[f]}`);
  if (open.length) lines.push("Open questions for the QP meeting:", ...open);
  return lines.join("\n");
}

export function Guidance({
  data,
  draft,
  onAnswer,
  sample,
  onSample,
}: {
  data: RequirementsResponse | null;
  draft: ContextPatch;
  onAnswer: (field: ContextField, value: string | null) => void;
  sample?: { name: string; place: string; blurb: string };
  onSample?: () => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const [copied, setCopied] = useState(false);

  const { focus, rest, newIds } = useMemo(() => {
    const items = data?.items ?? [];
    const inStage = items.filter((i) => i.in_stage);
    const focus = inStage.slice(0, 5);
    const rest = items.filter((i) => !focus.includes(i));
    return { focus, rest, newIds: new Set(data?.diff.added ?? []) };
  }, [data]);

  if (!data?.ready) {
    const done = GATE_FIELDS.filter((f) => draft[f] !== undefined);
    return (
      <div className="stage__scroll">
        <div className="empty">
          <div className="mark mark--lg"><span /><span /><span /></div>
          <h2>Start with the project</h2>
          <p>
            Describe it in the bar above, or fill in the form. We pick the few Singapore requirements
            that matter at this stage, each with its official source.
          </p>
          {sample && onSample && (
            <div className="sample">
              <b>
                {sample.name} · {sample.place}
              </b>
              <span>{sample.blurb}</span>
              <button className="btn btn--sm" onClick={onSample}>
                Load this sample project
              </button>
            </div>
          )}
          <ul className="needs" aria-label="Required inputs">
            {GATE_FIELDS.map((f) => (
              <li key={f} className={done.includes(f) ? "done" : ""}>
                {done.includes(f) ? "✓ " : ""}
                {FIELD_LABEL[f]}
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  const { diff } = data;
  const hasDiff = diff.added.length + diff.removed.length + diff.changed.length > 0;
  const titleOf = (id: string) => data.items.find((i) => i.id === id);
  const stage = data.context.design_stage;
  const visible = showAll ? [...focus, ...rest] : focus;

  const copy = async () => {
    await navigator.clipboard.writeText(buildChecklist(data));
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <>
      <div className="stage__head">
        <div>
          <div className="eyebrow"><i>02</i> Guidance{stage ? ` · ${STAGE_LABEL[stage]}` : ""}</div>
          <h1 className="stage__title">{projectSummary(data.context) || "Your project"}</h1>
          <div className="stage__sub">
            {focus.length} for this stage{rest.length ? `, ${rest.length} more on request` : ""}. Ranked by what is costliest to change later.
          </div>
        </div>
        <div className="no-print" style={{ display: "flex", gap: 8 }}>
          <button className="btn btn--sm" onClick={copy}>
            <IconCopy /> {copied ? "Copied" : "Copy checklist"}
          </button>
          <button className="btn btn--sm btn--ghost" onClick={() => window.print()}>
            <IconPrint /> Print
          </button>
        </div>
      </div>

      <div className="stage__scroll">
        {hasDiff && (
          <section className="diff" key={data.revision} aria-live="polite">
            <div className="diff__top">
              <span className="tag tag--Submission" style={{ background: "var(--coral-soft)", color: "var(--coral)" }}>Changed</span>
              <span className="diff__title">
                {[
                  diff.added.length && `${diff.added.length} new`,
                  diff.removed.length && `${diff.removed.length} no longer triggered`,
                  diff.changed.length && `${diff.changed.length} updated`,
                ]
                  .filter(Boolean)
                  .join(", ")}
              </span>
              <span className="diff__rev">rev {diff.from_revision} → {data.revision}</span>
            </div>
            <ul className="diff__list">
              {diff.added.map((id) => (
                <li key={id}>
                  <span className="diff__sign add">+</span>
                  <span>
                    <b>{titleOf(id)?.title ?? id}</b> <span className="diff__why">{titleOf(id)?.why}</span>
                  </span>
                </li>
              ))}
              {data.removed_items.map((r) => (
                <li key={r.id}>
                  <span className="diff__sign rem">−</span>
                  <span><b>{r.title}</b> <span className="diff__why">no longer triggered by your inputs</span></span>
                </li>
              ))}
              {diff.changed.map((id) => (
                <li key={id}>
                  <span className="diff__sign chg">~</span>
                  <span>
                    <b>{titleOf(id)?.title ?? id}</b>{" "}
                    <span className="diff__why">now “{titleOf(id) ? LABEL_TEXT[titleOf(id)!.label] : ""}”</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="cards">
          {visible.map((item, i) => (
            <Card key={item.id} item={item} index={i} isNew={newIds.has(item.id)} onAnswer={onAnswer} />
          ))}
        </div>

        {rest.length > 0 && (
          <button className="btn showall no-print" onClick={() => setShowAll((s) => !s)}>
            {showAll ? "Show fewer" : `Show all (${focus.length + rest.length})`}
          </button>
        )}
      </div>

      <div className="stage__foot">
        <IconInfo />
        <span><b>{DISCLAIMER}</b></span>
      </div>
    </>
  );
}
