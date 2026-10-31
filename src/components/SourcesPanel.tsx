"use client";

import { useCallback, useEffect, useState } from "react";
import { IconExternal } from "./icons";

interface Candidate {
  title: string;
  domain: string;
  trigger_in_words: string;
  threshold_value: string | null;
  design_prompt: string;
  exact_quote: string;
}
interface Draft {
  id: string;
  title: string;
  issuer: string;
  url: string | null;
  filename: string | null;
  candidates: Candidate[];
  status: "uploaded" | "drafted" | "checked";
  checked_by: string | null;
}
interface Reg {
  id: string;
  title: string;
  issuer: string;
  edition: string;
  url: string;
  verified: boolean;
}

const STATUS: Record<Draft["status"], string> = {
  uploaded: "Uploaded",
  drafted: "Drafted, needs check",
  checked: "Checked",
};
const TEXT_EXT = /\.(txt|md|csv|json|html?)$/i;
const EMPTY = { title: "", issuer: "BCA", url: "", excerpt: "", filename: "" };

export function SourcesPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [register, setRegister] = useState<Reg[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [ai, setAi] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState(EMPTY);
  const [checker, setChecker] = useState("");

  const load = useCallback(async () => {
    const d = await fetch("/api/app/sources", { cache: "no-store" }).then((r) => r.json());
    setRegister(d.register);
    setDrafts(d.drafts);
    setAi(d.ai);
  }, []);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const pickFile = async (f?: File) => {
    if (!f) return;
    const base = f.name.replace(/\.[^.]+$/, "");
    if (TEXT_EXT.test(f.name)) {
      const text = await f.text();
      setForm((x) => ({ ...x, filename: f.name, excerpt: text.slice(0, 40000), title: x.title || base }));
      setMsg("");
    } else {
      setForm((x) => ({ ...x, filename: f.name, title: x.title || base }));
      setMsg("PDF and spreadsheet text can't be read in the browser. Paste the relevant clause text below, or save the link only.");
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(ai && form.excerpt ? "Drafting candidate rows…" : "");
    try {
      const res = await fetch("/api/app/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "failed");
      setMsg(
        d.candidates.length
          ? `${d.candidates.length} candidate rows drafted. Review the quotes, then check them.`
          : form.excerpt
            ? "No rows could be drafted with verbatim quotes. Add rows manually per the research handoff."
            : "Saved as link only. Paste clause text to draft rows.",
      );
      setForm(EMPTY);
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const check = async (id: string) => {
    const res = await fetch(`/api/app/sources/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checked_by: checker }),
    });
    if (res.ok) await load();
    else setMsg((await res.json()).error || "Could not mark checked");
  };

  const count = (s: Draft["status"]) => drafts.filter((d) => d.status === s).length;
  const PIPE = [
    { n: "1", t: "Upload", d: "Add the document or clause text", c: drafts.length },
    { n: "2", t: "Draft", d: ai ? "AI proposes rows with verbatim quotes" : "AI drafting is off", c: count("drafted") },
    { n: "3", t: "Check", d: "A named person confirms against the source", c: count("checked") },
    { n: "4", t: "Seed", d: "Checked rows join the register below", c: register.filter((r) => r.verified).length },
  ];

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Sources">
      <div className="card sources">
        <div className="sources__head">
          <div>
            <div className="eyebrow">
              <i>00</i> Sources
            </div>
            <h2 className="tour__title" style={{ margin: "4px 0 2px" }}>
              Codes and frameworks
            </h2>
            <div className="panel__sub">
              Raw documents come in here first. Nothing reaches the guidance until a named person has checked it.
            </div>
          </div>
          <button className="btn btn--ghost btn--sm" onClick={onClose}>
            Close
          </button>
        </div>

        <ol className="pipe">
          {PIPE.map((p) => (
            <li key={p.n}>
              <i>{p.n}</i>
              <div>
                <b>{p.t}</b>
                <span>{p.d}</span>
              </div>
              <em>{p.c}</em>
            </li>
          ))}
        </ol>

        <div className="sources__grid">
          <form className="sources__col" onSubmit={submit}>
            <div className="section-label">Add a source</div>
            <input
              className="input"
              placeholder="Title, e.g. Fire Code 2023, Cl. 3.10"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
            <div className="grid2" style={{ margin: "8px 0" }}>
              <select
                className="select"
                value={form.issuer}
                onChange={(e) => setForm({ ...form, issuer: e.target.value })}
                aria-label="Issuer"
              >
                <option>BCA</option>
                <option>SCDF</option>
                <option>URA</option>
              </select>
              <input
                className="input"
                placeholder="Official URL"
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
              />
            </div>
            <label className="drop">
              <input
                type="file"
                accept=".txt,.md,.csv,.json,.html,.htm,.pdf,.xlsx"
                onChange={(e) => pickFile(e.target.files?.[0])}
              />
              <b>{form.filename || "Choose a file"}</b>
              <span>Text, Markdown, CSV, JSON or HTML are read here. For PDF or Excel, paste the clause text below.</span>
            </label>
            <textarea
              className="input"
              rows={7}
              style={{ height: "auto", padding: 10, marginTop: 8, resize: "vertical" }}
              placeholder="Paste the clause or table text to draft rows from…"
              value={form.excerpt}
              onChange={(e) => setForm({ ...form, excerpt: e.target.value })}
            />
            <button className="btn btn--coral btn--block" style={{ marginTop: 10 }} disabled={busy || !form.title}>
              {busy ? "Working…" : ai ? "Add and draft rows" : "Add source"}
            </button>
            {msg && (
              <div className="field__hint" role="status">
                {msg}
              </div>
            )}
          </form>

          <div className="sources__col">
            <div className="section-label">Intake queue</div>
            {drafts.length === 0 && (
              <div className="note">Nothing uploaded yet. Added sources appear here with their drafted rows.</div>
            )}
            {drafts.map((d) => (
              <div key={d.id} className="draft">
                <div className="req__top">
                  <span className="src__issuer">{d.issuer}</span>
                  <b>{d.title}</b>
                  <span
                    className={`label ${d.status === "checked" ? "label--applies_on_inputs" : d.status === "drafted" ? "label--may_apply_need_input" : ""}`}
                    style={{ marginLeft: "auto" }}
                  >
                    {STATUS[d.status]}
                  </span>
                </div>
                {d.url && (
                  <a className="src__meta" href={d.url} target="_blank" rel="noreferrer">
                    {d.url} <IconExternal />
                  </a>
                )}
                {d.candidates.map((c, i) => (
                  <div key={i} className="cand">
                    <div>
                      <span className={`tag tag--${c.domain}`}>{c.domain}</span> <b>{c.title}</b>
                      {c.threshold_value ? <span className="src__meta"> · {c.threshold_value}</span> : null}
                    </div>
                    <div className="note">{c.trigger_in_words}</div>
                    <blockquote className="quote">“{c.exact_quote}”</blockquote>
                    <div className="note">Prompt: {c.design_prompt}</div>
                  </div>
                ))}
                {d.status === "drafted" && (
                  <div className="checkrow">
                    <input
                      className="input"
                      placeholder="Your name (required)"
                      value={checker}
                      onChange={(e) => setChecker(e.target.value)}
                    />
                    <button className="btn btn--primary" disabled={!checker.trim()} onClick={() => check(d.id)}>
                      Mark checked
                    </button>
                  </div>
                )}
                {d.status === "checked" && (
                  <div className="note">
                    Checked by {d.checked_by}. Queued for seeding; live results still read the register below.
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="section-label" style={{ marginTop: 20 }}>
          Register in use ({register.length})
        </div>
        <div className="reg">
          {register.map((r) => (
            <a key={r.id} className="reg__row" href={r.url} target="_blank" rel="noreferrer">
              <span className="src__issuer">{r.issuer}</span>
              <span>
                <b>{r.title}</b>
                <span className="src__meta"> · {r.edition}</span>
              </span>
              <span className={`label ${r.verified ? "label--applies_on_inputs" : "label--check_with_qp"}`}>
                {r.verified ? "Checked" : "Link only, no figures"}
              </span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
