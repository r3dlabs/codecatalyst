"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PROJECTS } from "@/lib/projects";
import { requirements, sources } from "@/lib/seed";
import { evalTrigger, FIELD_LABEL, projectSummary } from "@/lib/rules";
import type { Item, RequirementsResponse, ReviewState, Trigger } from "@/lib/types";
import { SourcesPanel } from "@/components/SourcesPanel";
import { DemoMonitor } from "@/components/DemoMonitor";
import { QrButton } from "@/components/QrButton";
import { StoryButton } from "@/components/StoryButton";
import { StoryBullets } from "@/components/StoryBullets";
import { extractContext } from "@/lib/extract";
import { IconBook, IconExternal } from "@/components/icons";

interface Candidate {
  title: string;
  domain: string;
  trigger_in_words: string;
  threshold_value: string | null;
  design_prompt: string;
  exact_quote: string;
  trigger: Trigger | null;
}
interface Draft {
  id: string;
  title: string;
  issuer: string;
  status: "uploaded" | "drafted" | "checked";
  checked_by: string | null;
  candidates: Candidate[];
}

const STAGES = [
  { n: "01", t: "Ingest", d: "Bring in codes and frameworks" },
  { n: "02", t: "Normalise", d: "AI drafts a structured rule" },
  { n: "03", t: "Match", d: "Controls selected for this project" },
  { n: "04", t: "Monitor", d: "Watch design changes" },
] as const;

const REVIEW_LABEL: Record<ReviewState, string> = {
  open: "Open",
  raised_with_qp: "Raised with QP",
  evidence_noted: "Evidence noted",
};

const fmt = (v: unknown) => (v === null || v === undefined ? "unknown" : typeof v === "number" ? v.toLocaleString("en-SG") : String(v));
const ago = (iso: string) => new Date(iso).toLocaleTimeString("en-SG", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

function verdict(t: Trigger | null, ctx: RequirementsResponse["context"]): { text: string; cls: string } {
  if (!t) return { text: "No rule to test", cls: "" };
  const r = evalTrigger(t, ctx).result;
  return r === "yes"
    ? { text: "Triggered by this project", cls: "label--applies_on_inputs" }
    : r === "unknown"
      ? { text: "Needs input", cls: "label--may_apply_need_input" }
      : { text: "Not triggered", cls: "" };
}

export default function Pipeline() {
  const [project, setProject] = useState(PROJECTS[0].id);
  const [stage, setStage] = useState(0);
  const [data, setData] = useState<RequirementsResponse | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [aiOn, setAiOn] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [notesAi, setNotesAi] = useState<boolean | null>(null);
  const [changeText, setChangeText] = useState<{ text: string; ai: boolean } | null>(null);
  const [busy, setBusy] = useState("");

  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("project");
    if (p && PROJECTS.some((x) => x.id === p)) setProject(p);
    const s = Number(new URLSearchParams(window.location.search).get("stage"));
    if (s >= 1 && s <= 4) setStage(s - 1);
  }, []);

  const loadSources = useCallback(async () => {
    const d = await fetch("/api/app/sources", { cache: "no-store" }).then((r) => r.json());
    setDrafts(d.drafts);
    setAiOn(d.ai);
  }, []);
  useEffect(() => {
    void loadSources();
  }, [loadSources, sourcesOpen]);

  // Poll the project every 2 s so design-tool events show up here too.
  useEffect(() => {
    let stop = false;
    setData(null);
    setNotes({});
    setNotesAi(null);
    setChangeText(null);
    const tick = async () => {
      try {
        const r = await fetch(`/api/v1/projects/${project}/requirements`, { cache: "no-store" });
        if (r.ok && !stop) setData((await r.json()) as RequirementsResponse);
      } catch {}
    };
    void tick();
    const id = setInterval(tick, 2000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [project]);

  const meta = PROJECTS.find((p) => p.id === project)!;
  const ready = Boolean(data?.ready);
  const ctx = data?.context ?? {};

  const loadSample = async () => {
    setBusy("sample");
    const r = await fetch(`/api/app/projects/${project}/sample`, { method: "POST" });
    if (r.ok) setData((await r.json()) as RequirementsResponse);
    setBusy("");
  };

  const [upMsg, setUpMsg] = useState("");
  const [desc, setDesc] = useState("");

  /** Reads a project description or file, sets the project context, then asks for recommendations. */
  const analyse = async (file?: File) => {
    setBusy("upload");
    let text = desc;
    let patch: Record<string, unknown> = {};
    if (file && /.(txt|md|csv|json|html?)$/i.test(file.name)) text = await file.text();
    if (text) patch = extractContext(text);
    const demo = !text || Object.keys(patch).length === 0;
    if (demo) patch = { ...meta.sample }; // demo mode: layout parsing is simulated
    for (const f of ["work_type", "primary_use", "gfa_m2", "storeys", "habitable_height_m", "gls_site", "design_stage"]) if (!(f in patch)) patch[f] = null;
    const r = await fetch(`/api/app/projects/${project}/context`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ context: patch }) });
    if (r.ok) {
      setData((await r.json()) as RequirementsResponse);
      setUpMsg(demo ? `Demo mode: ${file ? file.name : "the description"} was analysed with simulated layout parsing, using the sample model.` : `Read ${file ? file.name : "your description"} and filled in the fields it mentions. Others stay unknown.`);
      await explain();
    }
    setBusy("");
  };

  const explain = async () => {
    setBusy("match");
    const r = await fetch(`/api/app/projects/${project}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "match" }),
    });
    if (r.ok) {
      const d = await r.json();
      setNotes(d.notes);
      setNotesAi(d.ai);
    }
    setBusy("");
  };

  const summarise = async () => {
    setBusy("change");
    const r = await fetch(`/api/app/projects/${project}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "change" }),
    });
    if (r.ok) {
      const d = await r.json();
      setChangeText({ text: d.summary, ai: d.ai });
    }
    setBusy("");
  };

  const review = async (id: string, state: ReviewState, note: string) => {
    const r = await fetch(`/api/app/projects/${project}/review`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requirement_id: id, state, note }),
    });
    if (r.ok) setData((await r.json()) as RequirementsResponse);
  };

  const applicable = useMemo(() => new Set((data?.items ?? []).map((i) => i.id)), [data]);
  const notTriggered = requirements.filter((r) => !applicable.has(r.id));
  const proposed = drafts.flatMap((d) => d.candidates.filter((c) => c.trigger).map((c) => ({ d, c })));
  const sourceOf = (id: string) => sources.find((s) => s.id === id);
  const lastEntry = data?.history[data.history.length - 1];

  /* ---------- guided demo run: Back / Play / Next across all four stages ---------- */
  const T = "tan-kembangan";
  const [run, setRun] = useState(-1);
  const [auto, setAuto] = useState(false);
  const [working, setWorking] = useState(false);
  const [playSignal, setPlaySignal] = useState(0);
  const post = (url: string, body?: object) =>
    fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const DEMO_CLAUSE =
    "Environmental sustainability requirements apply to the following. All new buildings with a gross floor area of 5,000m2 or more. Additions or extensions to existing buildings that involve increasing the GFA by 5,000m2 or more. Major retrofitting to existing buildings with a GFA of 5,000m2 or more.";
  const STEPS: { stage: number; title: string; text: string; dwell: number; act?: () => Promise<void> }[] = [
    { stage: 0, title: "Ingest: the source register", text: "Official codes and circulars are the starting point. Each one keeps its issuer, edition and check date.", dwell: 5000 },
    {
      stage: 0, title: "Ingest: add a clause", text: "A BCA clause is pasted in. AI drafts candidate rows and each quote must appear word for word.", dwell: 4000,
      act: async () => {
        const have = (await fetch("/api/app/sources", { cache: "no-store" }).then((r) => r.json())).drafts.some((d: Draft) => d.title.startsWith("Demo clause"));
        if (!have) await post("/api/app/sources", { title: "Demo clause: BCA environmental sustainability scope", issuer: "BCA", url: "https://www1.bca.gov.sg/sustainability/legislation-on-environmental-sustainability-for-buildings/new-buildings-and-existing-buildings-undergoing-major-additions-and-alterations/", excerpt: DEMO_CLAUSE });
        await loadSources();
      },
    },
    { stage: 1, title: "Normalise: clause to structured rule", text: "Raw wording on the left, a machine-readable rule on the right. A person still checks it before it can show a figure.", dwell: 7000 },
    {
      stage: 2, title: "Match: meet the customer", text: "Tan Residence is a fictional landed house in Kembangan. Loading its starting model.", dwell: 3500,
      act: async () => {
        await post("/api/sim", { action: "reset", project: T });
        const r = await post("/api/app/projects/" + T + "/sample");
        if (r.ok) setData((await r.json()) as RequirementsResponse);
      },
    },
    {
      stage: 2, title: "Match: AI recommends controls", text: "Rules pick the controls. AI adds a project-specific note to each, and the frameworks to work from are listed above.", dwell: 7000,
      act: async () => {
        const r = await post("/api/app/projects/" + T + "/notes", { kind: "match" });
        if (r.ok) { const d = await r.json(); setNotes(d.notes); setNotesAi(d.ai); }
      },
    },
    {
      stage: 3, title: "Monitor: a design change arrives", text: "The design tool reports a third storey and attic. The history records what changed.", dwell: 4500,
      act: async () => { await post("/api/sim", { project: T, run: "demo" + Date.now(), step: 1 }); },
    },
    {
      stage: 3, title: "Monitor: AI summarises the change", text: "A short note on what the change touches and what to re-check first.", dwell: 5500,
      act: async () => {
        const r = await post("/api/app/projects/" + T + "/notes", { kind: "change" });
        if (r.ok) { const d = await r.json(); setChangeText({ text: d.summary, ai: d.ai }); }
      },
    },
    {
      stage: 3, title: "Monitor: telemetry and audits", text: "Four simulated weeks replay. Telemetry and manual audits land in one log with priority and criticality.", dwell: 21000,
      act: async () => { setPlaySignal((n) => n + 1); },
    },
    { stage: 3, title: "End to end complete", text: "Ingest, normalise, match and monitor. Design guidance only; nothing here is a compliance determination.", dwell: 0 },
  ];
  const actRef = useRef<() => Promise<void>>(async () => {});
  actRef.current = async () => {
    const s = STEPS[run];
    if (!s) return;
    setStage(s.stage);
    if (project !== T) setProject(T);
    setWorking(true);
    try { await s.act?.(); } finally { setWorking(false); }
  };
  useEffect(() => {
    if (run >= 0) void actRef.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run]);
  // Auto-advance once the step has finished and has been on screen long enough.
  useEffect(() => {
    if (!auto || run < 0 || working) return;
    if (run >= STEPS.length - 1) { setAuto(false); return; }
    const id = setTimeout(() => setRun((r) => r + 1), STEPS[run].dwell);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, run, working]);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("demo") === "1") { setProject(T); setRun(0); setAuto(true); }
  }, []);

  return (
    <div className="pl">
      <header className="topbar">
        <div className="brand">
          <div className="mark"><span /><span /><span /></div>
          <div className="brand__name">CodeCatalyst</div>
          <div className="brand__sep" />
          <span className="pill project">
            <select className="pill__select" value={project} onChange={(e) => setProject(e.target.value)} aria-label="Project">
              {PROJECTS.map((p) => (
                <option key={p.id} value={p.id}>{p.name} · {p.place}</option>
              ))}
            </select>
          </span>
        </div>
        <nav className="stages" aria-label="Pipeline stage">
          {STAGES.map((s, i) => (
            <button key={s.n} className={i === stage ? "is-active" : ""} onClick={() => setStage(i)}>
              <i>{s.n}</i>{s.t}
            </button>
          ))}
        </nav>
        <div className="topbar__spacer" />
        <a className="btn btn--sm" href={`/?project=${project}`}>Back to guidance</a>
        <a className="btn btn--sm btn--ghost" href="/simulator" target="_blank">Simulator</a>
        <QrButton />
        <StoryButton />
        <StoryBullets />
      </header>

      <main className="pl__main">
        <div className="pl__intro">
          <div className="eyebrow"><i>{STAGES[stage].n}</i> {STAGES[stage].t}</div>
          <h1 className="stage__title">{STAGES[stage].d}</h1>
          <div className="stage__sub">
            Rules select what applies. AI drafts, explains and summarises, and a named person checks the sources.
            Nothing here is a compliance determination.
          </div>
        </div>

        {/* ---------- 1 INGEST ---------- */}
        {stage === 0 && (
          <section className="pl__grid">
            <div className="card pl__card">
              <div className="section-label">Intake</div>
              <p className="note">
                Official codes and circulars come in first, as links, clause text or files. Each source keeps its issuer,
                edition and the date it was checked.
              </p>
              <div className="pl__stats">
                <div><b>{sources.length}</b><span>sources in the register</span></div>
                <div><b>{sources.filter((s) => requirements.some((r) => r.source_id === s.id && r.verification_status === "checked")).length}</b><span>checked, can show figures</span></div>
                <div><b>{drafts.length}</b><span>uploads in the queue</span></div>
              </div>
              <button className="btn btn--coral" onClick={() => setSourcesOpen(true)}><IconBook /> Upload or paste a source</button>
              <div className="field__hint">
                Text, Markdown, CSV, JSON and HTML are read in the browser. For PDF or Excel, paste the clause text or save the link only.
              </div>
            </div>
            <div className="card pl__card">
              <div className="section-label">Register</div>
              <div className="reg">
                {sources.map((s) => {
                  const ok = requirements.some((r) => r.source_id === s.id && r.verification_status === "checked");
                  return (
                    <a key={s.id} className="reg__row" href={s.url} target="_blank" rel="noreferrer">
                      <span className="src__issuer">{s.issuer}</span>
                      <span><b>{s.title}</b><span className="src__meta"> · {s.format} · {s.edition}</span></span>
                      <span className={`label ${ok ? "label--applies_on_inputs" : "label--check_with_qp"}`}>{ok ? "Checked" : "Link only"}</span>
                    </a>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* ---------- 2 NORMALISE ---------- */}
        {stage === 1 && (
          <section className="pl__stack">
            <div className="card pl__card">
              <div className="section-label">AI-drafted rows from your uploads {aiOn ? "" : "(AI is off)"}</div>
              {proposed.length === 0 && drafts.every((d) => d.candidates.length === 0) && (
                <div className="note">
                  Nothing drafted yet. Upload clause text in Stage 1 and the rows appear here, each with a quote that is verified word for word.
                </div>
              )}
              {drafts.flatMap((d) =>
                d.candidates.map((c, i) => {
                  const v = verdict(c.trigger, ctx);
                  return (
                    <div className="norm" key={`${d.id}-${i}`}>
                      <div className="norm__raw">
                        <div className="block__k">Raw clause · {d.issuer} · {d.title}</div>
                        <blockquote className="quote">“{c.exact_quote}”</blockquote>
                      </div>
                      <div className="norm__arrow" aria-hidden>→</div>
                      <div className="norm__out">
                        <div className="block__k">Normalised</div>
                        <div><span className={`tag tag--${c.domain}`}>{c.domain}</span> <b>{c.title}</b></div>
                        <div className="note">{c.trigger_in_words}</div>
                        <pre className="json">{c.trigger ? JSON.stringify(c.trigger, null, 1) : "No machine-readable rule found. A person needs to write the trigger."}</pre>
                        <div className="req__top">
                          <span className={`label ${v.cls}`}>{v.text}</span>
                          <span className="label">{d.status === "checked" ? `Checked by ${d.checked_by}` : "Draft, needs check"}</span>
                        </div>
                      </div>
                    </div>
                  );
                }),
              )}
            </div>
            <div className="card pl__card">
              <div className="section-label">Normalised records in use ({requirements.length})</div>
              {requirements.map((r) => {
                const s = sourceOf(r.source_id)!;
                const v = verdict(r.trigger, ctx);
                return (
                  <div className="norm" key={r.id}>
                    <div className="norm__raw">
                      <div className="block__k">Raw · {s.issuer} · {s.clause_ref ?? s.title}</div>
                      {r.verification_status === "checked" && s.exact_quote ? (
                        <blockquote className="quote">“{s.exact_quote}”</blockquote>
                      ) : (
                        <div className="note">Link only. The clause has not been read in full, so no wording or figures are stored.</div>
                      )}
                    </div>
                    <div className="norm__arrow" aria-hidden>→</div>
                    <div className="norm__out">
                      <div className="block__k">Normalised</div>
                      <div><span className={`tag tag--${r.domain}`}>{r.domain}</span> <b>{r.title}</b></div>
                      <pre className="json">{JSON.stringify(r.trigger, null, 1)}</pre>
                      <div className="req__top">
                        <span className={`label ${r.verification_status === "checked" ? "label--applies_on_inputs" : "label--check_with_qp"}`}>
                          {r.verification_status === "checked" ? "Checked" : "Unchecked"}
                        </span>
                        {ready && <span className={`label ${v.cls}`}>{v.text}</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ---------- 3 MATCH ---------- */}
        {stage === 2 && (
          <section className="pl__stack">
            <div className="card pl__card cust">
              <div>
                <div className="eyebrow">Customer</div>
                <h2 className="tour__title" style={{ margin: "4px 0" }}>{meta.name} · {meta.place}</h2>
                <p className="note" style={{ maxWidth: "62ch" }}>{meta.blurb}</p>
                <div className="summary__text" style={{ fontSize: 16 }}>{projectSummary(ctx) || "No project data yet."}</div>
              </div>
              {!ready && (
                <button className="btn btn--coral" disabled={busy === "sample"} onClick={loadSample}>Load sample project</button>
              )}
              {ready && (
                <button className="btn" disabled={busy === "match"} onClick={explain}>
                  {busy === "match" ? "Explaining…" : aiOn ? "Explain for this project (AI)" : "Show stored explanations"}
                </button>
              )}
            </div>

            <div className="card pl__card">
              <div className="section-label">Upload the project</div>
              <p className="note">Add a description or a layout file (IFC, DWG, PDF, image or text). Text is read for the fields it mentions. Other formats run in demo mode with simulated parsing.</p>
              <label className="drop">
                <input type="file" onChange={(e) => analyse(e.target.files?.[0])} />
                <b>Choose a layout or description file</b>
                <span>e.g. tan-residence-floorplans.ifc</span>
              </label>
              <textarea className="input" rows={3} style={{ height: "auto", padding: 10, resize: "vertical" }} placeholder="Or describe the building, e.g. New 2-storey landed house, 420 m² GFA, 9 m habitable height, concept stage" value={desc} onChange={(e) => setDesc(e.target.value)} />
              <div className="pb">
                <button className="btn btn--coral" disabled={busy === "upload"} onClick={() => analyse()}>{busy === "upload" ? "Analysing…" : "Analyse and recommend"}</button>
                {upMsg && <span className="note" role="status">{upMsg}</span>}
              </div>
            </div>

            {ready && (
              <div className="card pl__card">
                <div className="section-label">Frameworks to work from</div>
                <div className="fw">
                  {Object.entries(data!.items.reduce<Record<string, number>>((m, i) => ({ ...m, [i.source.title]: (m[i.source.title] ?? 0) + 1 }), {})).map(([t, n]) => (<span key={t}>{t}<em>{n}</em></span>))}
                </div>
              </div>
            )}

            {ready && (
              <div className="card pl__card">
                <div className="section-label">Controls that apply or may apply ({data!.items.length})</div>
                {notesAi === false && <div className="field__hint">AI is off or unavailable, so the stored summaries are shown.</div>}
                {data!.items.map((i: Item) => (
                  <div className="match" key={i.id}>
                    <div className="req__top">
                      <span className={`tag tag--${i.domain}`}>{i.domain}</span>
                      <b>{i.title}</b>
                      <span className={`label label--${i.label}`} style={{ marginLeft: "auto" }}>
                        {i.label === "applies_on_inputs" ? "Applies based on your inputs" : i.label === "may_apply_need_input" ? "May apply: need input" : "Check with QP or agency"}
                      </span>
                    </div>
                    <div className="note">Why: {i.why}</div>
                    {notes[i.id] && <div className="ainote"><span>{notesAi ? "AI note" : "Stored"}</span> {notes[i.id]}</div>}
                    <a className="src__meta link" href={i.source.clause_url ?? i.source.url} target="_blank" rel="noreferrer">
                      {i.source.issuer} · {i.source.title} <IconExternal />
                    </a>
                  </div>
                ))}
              </div>
            )}

            {ready && (
              <div className="card pl__card">
                <div className="section-label">Not triggered for this project ({notTriggered.length})</div>
                <div className="note" style={{ marginBottom: 6 }}>Stored controls whose triggers this project does not meet. Missing inputs would show above as “May apply”, never here.</div>
                {notTriggered.map((r) => (
                  <div key={r.id} className="match match--quiet">
                    <span className={`tag tag--${r.domain}`}>{r.domain}</span> {r.title}
                  </div>
                ))}
              </div>
            )}

            {ready && proposed.length > 0 && (
              <div className="card pl__card">
                <div className="section-label">Proposed from ingest, not in live guidance ({proposed.length})</div>
                {proposed.map(({ d, c }, i) => {
                  const v = verdict(c.trigger, ctx);
                  return (
                    <div key={i} className="match match--quiet">
                      <span className={`tag tag--${c.domain}`}>{c.domain}</span> {c.title}
                      <span className={`label ${v.cls}`} style={{ marginLeft: 8 }}>{v.text}</span>
                      <span className="src__meta"> · {d.status === "checked" ? `checked by ${d.checked_by}` : "draft"}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* ---------- 4 MONITOR ---------- */}
        {stage === 3 && (
          <section className="pl__stack">
            {project === "tan-kembangan" ? <DemoMonitor signal={playSignal} /> : <div className="card pl__card note">The playback uses the Tan Residence sample. Switch project to see it.</div>}
            {!ready ? (
              <div className="card pl__card cust">
                <div className="note">Load a project first so there is a design to watch.</div>
                <button className="btn btn--coral" onClick={loadSample}>Load sample project</button>
              </div>
            ) : (
              <>
                <div className="card pl__card">
                  <div className="section-label">Thresholds being watched</div>
                  <div className="note" style={{ marginBottom: 8 }}>
                    Checked figures only. This shows where the current design sits against each one. It is not a status or a verdict.
                  </div>
                  {data!.watch.map((w, i) => {
                    const pct = w.current === null ? 0 : Math.min(100, (w.current / w.threshold) * 100);
                    return (
                      <div className="watch" key={`${w.id}-${i}`}>
                        <div className="watch__top">
                          <b>{w.label}</b>
                          <span className="src__meta">
                            {w.current === null ? "unknown" : `${fmt(w.current)} ${w.unit}`} · threshold {w.op} {fmt(w.threshold)} {w.unit}
                          </span>
                          <span className={`label ${w.crossed ? "label--applies_on_inputs" : ""}`} style={{ marginLeft: "auto" }}>
                            {w.crossed === null ? "Needs input" : w.crossed ? "Threshold reached" : "Below threshold"}
                          </span>
                        </div>
                        <div className="bar"><i style={{ width: `${pct}%` }} className={w.crossed ? "on" : ""} /></div>
                        <div className="src__meta">{w.title}</div>
                      </div>
                    );
                  })}
                </div>

                <div className="card pl__card">
                  <div className="req__top">
                    <div className="section-label" style={{ margin: 0 }}>Latest change</div>
                    <button className="btn btn--sm" style={{ marginLeft: "auto" }} disabled={busy === "change"} onClick={summarise}>
                      {busy === "change" ? "Summarising…" : aiOn ? "Summarise (AI)" : "Summarise"}
                    </button>
                  </div>
                  {changeText ? (
                    <div className="ainote" style={{ marginTop: 8 }}><span>{changeText.ai ? "AI note" : "Stored"}</span> {changeText.text}</div>
                  ) : (
                    <div className="note" style={{ marginTop: 6 }}>
                      {lastEntry ? "Summarise what the last change touches and what to re-check." : "No changes yet. Edit the model or play the simulator."}
                    </div>
                  )}
                </div>

                <div className="card pl__card">
                  <div className="section-label">Design change history · rev {data!.revision}</div>
                  <ol className="tl">
                    {[...data!.history].reverse().map((h) => (
                      <li key={h.revision}>
                        <div className="tl__head">
                          <b>rev {h.revision}</b>
                          <span className="src__issuer">{h.source}</span>
                          <span className="src__meta">{ago(h.at)}</span>
                        </div>
                        <div className="tl__chips">
                          {h.changed.map((c, i) => (
                            <span key={i} className="chip">{FIELD_LABEL[c.field]}: {fmt(c.from)} → {fmt(c.to)}</span>
                          ))}
                        </div>
                        {(h.added.length > 0 || h.removed.length > 0 || h.updated.length > 0) && (
                          <div className="note">
                            {h.added.length > 0 && <>New: {h.added.map((id) => requirements.find((r) => r.id === id)?.title).join("; ")}. </>}
                            {h.removed.length > 0 && <>No longer triggered: {h.removed.map((id) => requirements.find((r) => r.id === id)?.title).join("; ")}. </>}
                            {h.updated.length > 0 && <>Updated: {h.updated.map((id) => requirements.find((r) => r.id === id)?.title).join("; ")}.</>}
                          </div>
                        )}
                      </li>
                    ))}
                    {data!.history.length === 0 && <li className="note">No changes recorded.</li>}
                  </ol>
                </div>

                <div className="card pl__card">
                  <div className="section-label">Review tracker</div>
                  <div className="note" style={{ marginBottom: 8 }}>
                    Where the team is on each control. A to-do state for coordination with your Qualified Person, not a compliance status.
                  </div>
                  {data!.items.map((i) => {
                    const rv = data!.reviews[i.id];
                    return (
                      <div className="rv" key={i.id}>
                        <div><span className={`tag tag--${i.domain}`}>{i.domain}</span> <b>{i.title}</b></div>
                        <select className="select" value={rv?.state ?? "open"} onChange={(e) => review(i.id, e.target.value as ReviewState, rv?.note ?? "")} aria-label={`Review state for ${i.title}`}>
                          {(Object.keys(REVIEW_LABEL) as ReviewState[]).map((s) => <option key={s} value={s}>{REVIEW_LABEL[s]}</option>)}
                        </select>
                        <input className="input" placeholder="Note (optional)" defaultValue={rv?.note ?? ""} key={`${i.id}-${rv?.at ?? ""}`} onBlur={(e) => e.target.value !== (rv?.note ?? "") && review(i.id, rv?.state ?? "open", e.target.value)} />
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </section>
        )}
      </main>

      {run < 0 ? (
        <div className="demo-start-wrap"><QrButton className="btn" /><StoryButton className="btn" /><StoryBullets className="btn" /><button className="demo-start" onClick={() => { setProject(T); setRun(0); setAuto(true); }}>▶ Play the demo end to end</button></div>
      ) : (
        <div className="demo-bar" role="region" aria-label="Guided demo">
          <div className="demo-bar__dots" aria-hidden>
            {STEPS.map((_, i) => <i key={i} className={i === run ? "on" : i < run ? "done" : ""} />)}
          </div>
          <div className="demo-bar__text">
            <span>Step {run + 1} of {STEPS.length}{working ? " · working…" : ""}</span>
            <b>{STEPS[run].title}</b>
            <em>{STEPS[run].text}</em>
          </div>
          <div className="demo-bar__btns">
            <button className="btn btn--sm" disabled={run === 0} onClick={() => { setAuto(false); setRun((r) => Math.max(0, r - 1)); }}>Back</button>
            <button className="btn btn--sm btn--coral" onClick={() => { if (run >= STEPS.length - 1) { setRun(0); setAuto(true); } else setAuto((a) => !a); }}>
              {run >= STEPS.length - 1 ? "Replay" : auto ? "Pause" : "Play"}
            </button>
            <button className="btn btn--sm" disabled={run >= STEPS.length - 1} onClick={() => { setAuto(false); setRun((r) => r + 1); }}>Next</button>
            <button className="btn btn--sm btn--ghost" onClick={() => { setAuto(false); setRun(-1); }}>Exit</button>
          </div>
        </div>
      )}
      <SourcesPanel open={sourcesOpen} onClose={() => setSourcesOpen(false)} />
    </div>
  );
}
