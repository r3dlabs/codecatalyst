"use client";

import { useEffect, useState } from "react";
import type { ContextField, ContextPatch, RequirementsResponse } from "@/lib/types";
import { FIELD_LABEL, GATE_FIELDS, UNLOCK_TEXT, USE_LABEL, projectSummary } from "@/lib/rules";
import { IconInfo } from "./icons";

interface Props {
  draft: ContextPatch;
  server: RequirementsResponse | null;
  live: boolean;
  pendingExtract: boolean;
  gateDone: number;
  onChange: (patch: ContextPatch) => void;
  onConfirm: () => void;
}

function Field({
  field,
  draft,
  onChange,
  children,
  optional,
}: {
  field: ContextField;
  draft: ContextPatch;
  onChange: Props["onChange"];
  children: React.ReactNode;
  optional?: boolean;
}) {
  const unknown = draft[field] === null;
  const unanswered = draft[field] === undefined;
  return (
    <div className="field">
      <div className="field__row">
        <span className="field__label">
          {FIELD_LABEL[field]}
          {optional && <small>optional</small>}
        </span>
        <button
          type="button"
          className={`field__unknown ${unknown ? "is-on" : ""}`}
          aria-pressed={unknown}
          onClick={() => onChange({ [field]: unknown ? undefined : null } as ContextPatch)}
        >
          Unknown
        </button>
      </div>
      {children}
      {(unknown || unanswered) && UNLOCK_TEXT[field] && (
        <div className="field__hint">
          {unknown ? <b>Unknown. </b> : null}
          {UNLOCK_TEXT[field]}.
        </div>
      )}
    </div>
  );
}

function NumField({
  value,
  unit,
  label,
  step,
  onValue,
}: {
  value: number | null | undefined;
  unit: string;
  label: string;
  step?: number;
  onValue: (v: number | null) => void;
}) {
  const [text, setText] = useState(value == null ? "" : String(value));
  useEffect(() => {
    // Only adopt outside changes (simulator, extraction); keep what the user is typing.
    if (value != null && Number(text) !== value) setText(String(value));
    if (value == null && text !== "" && Number.isNaN(Number(text))) setText("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <div className="input-wrap">
      <input
        className="input"
        inputMode="decimal"
        aria-label={label}
        step={step}
        placeholder="—"
        value={text}
        onChange={(e) => {
          const t = e.target.value.replace(/[^\d.]/g, "");
          setText(t);
          if (t === "") return onValue(null);
          const n = Number(t);
          if (Number.isFinite(n)) onValue(n);
        }}
      />
      <span>{unit}</span>
    </div>
  );
}

function Seg<T extends string>({
  value,
  options,
  onPick,
  label,
}: {
  value: T | null | undefined;
  options: { id: T; label: string }[];
  onPick: (v: T) => void;
  label: string;
}) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          className={value === o.id ? "is-active" : ""}
          aria-pressed={value === o.id}
          onClick={() => onPick(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function ContextForm({ draft, server, live, pendingExtract, gateDone, onChange, onConfirm }: Props) {
  const summary = projectSummary(draft);
  const open = (server?.ready ? server.missing_fields : []).filter((f) => UNLOCK_TEXT[f]);

  return (
    <>
      <div className="panel__head">
        <div className="eyebrow"><i>01</i> Project context</div>
        <div className="panel__title">Tell us about the project</div>
        <div className="panel__sub">
          {live ? "Edits re-run the rules and show what changed." : "Set these first. Guidance appears once confirmed."}
        </div>
      </div>

      <div className="panel__body">
        <div className="summary" aria-live="polite">
          <div className={`summary__text ${summary ? "" : "is-empty"}`}>
            {summary || "Describe the project above or fill in the form."}
          </div>
          <div className="summary__meta">
            {gateDone}/{GATE_FIELDS.length} required inputs
            {draft.gls_site === "yes" ? " · GLS site" : draft.gls_site === "no" ? " · Not a GLS site" : ""}
          </div>
        </div>

        {pendingExtract && (
          <div className="notice" role="status">
            <IconInfo />
            <span>Extracted from your description. Check each field, then confirm before any results appear.</span>
          </div>
        )}

        <Field field="work_type" draft={draft} onChange={onChange}>
          <Seg
            label="Work type"
            value={draft.work_type}
            onPick={(v) => onChange({ work_type: v })}
            options={[
              { id: "new_erection", label: "New erection" },
              { id: "major_aa", label: "Major A&A" },
              { id: "minor_aa", label: "Minor A&A" },
            ]}
          />
        </Field>

        <Field field="primary_use" draft={draft} onChange={onChange}>
          <select
            className="select"
            aria-label="Primary use"
            value={draft.primary_use ?? ""}
            onChange={(e) => onChange({ primary_use: (e.target.value || undefined) as ContextPatch["primary_use"] })}
          >
            <option value="" disabled>
              Select a use…
            </option>
            {Object.entries(USE_LABEL).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </Field>

        <div className="grid2">
          <Field field="gfa_m2" draft={draft} onChange={onChange}>
            <NumField label="GFA" unit="m²" value={draft.gfa_m2} onValue={(v) => onChange({ gfa_m2: v })} />
          </Field>
          <Field field="storeys" draft={draft} onChange={onChange}>
            <NumField label="Storeys" unit="no." value={draft.storeys} onValue={(v) => onChange({ storeys: v })} />
          </Field>
        </div>

        <Field field="habitable_height_m" draft={draft} onChange={onChange}>
          <NumField
            label="Habitable height"
            unit="m"
            step={0.1}
            value={draft.habitable_height_m}
            onValue={(v) => onChange({ habitable_height_m: v })}
          />
        </Field>

        <Field field="gls_site" draft={draft} onChange={onChange} optional>
          <Seg
            label="Government Land Sales site"
            value={draft.gls_site}
            onPick={(v) => onChange({ gls_site: v })}
            options={[
              { id: "yes", label: "Yes" },
              { id: "no", label: "No" },
            ]}
          />
        </Field>

        <Field field="design_stage" draft={draft} onChange={onChange}>
          <Seg
            label="Design stage"
            value={draft.design_stage}
            onPick={(v) => onChange({ design_stage: v })}
            options={[
              { id: "concept", label: "Concept" },
              { id: "design_gateway", label: "Design Gateway" },
              { id: "construction_gateway", label: "Construction" },
            ]}
          />
        </Field>

        {!live && (
          <button
            type="button"
            className="btn btn--coral btn--block"
            disabled={gateDone < GATE_FIELDS.length}
            onClick={onConfirm}
          >
            {pendingExtract ? "Confirm fields & show guidance" : "Show guidance"}
          </button>
        )}
        {!live && gateDone < GATE_FIELDS.length && (
          <div className="field__hint" style={{ textAlign: "center", marginTop: 8 }}>
            Answer each required input, or mark it Unknown.
          </div>
        )}

        {live && open.length > 0 && (
          <>
            <div className="section-label">Still open</div>
            {open.map((f) => (
              <div key={f} className="field__hint" style={{ marginBottom: 6 }}>
                <b>{FIELD_LABEL[f]}</b> — {UNLOCK_TEXT[f]}
              </div>
            ))}
          </>
        )}
      </div>
    </>
  );
}
