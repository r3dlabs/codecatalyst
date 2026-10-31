"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ContextField, ContextPatch, RequirementsResponse } from "@/lib/types";
import { ALL_FIELDS, GATE_FIELDS, STAGE_LABEL } from "@/lib/rules";
import { extractContext } from "@/lib/extract";
import { ContextForm } from "./ContextForm";
import { Guidance } from "./Guidance";
import { Companion } from "./Companion";
import { PROJECTS } from "@/lib/projects";
import { IconBook, IconReset } from "./icons";
import { Tour, tourSeen } from "./Tour";
import { SourcesPanel } from "./SourcesPanel";
import { QrButton } from "./QrButton";
import { StoryButton } from "./StoryButton";
import { StoryBullets } from "./StoryBullets";

const STAGES = [
  { id: "concept", n: "01", label: "Concept" },
  { id: "design_gateway", n: "02", label: "Design" },
  { id: "construction_gateway", n: "03", label: "Construction" },
] as const;

export function Workspace() {
  const [PROJECT, setProject] = useState(PROJECTS[0].id);
  const [server, setServer] = useState<RequirementsResponse | null>(null);
  const [draft, setDraft] = useState<ContextPatch>({});
  const [pendingExtract, setPendingExtract] = useState(false);
  const [online, setOnline] = useState(true);
  const [command, setCommand] = useState("");
  const commandRef = useRef<HTMLInputElement>(null);
  const [tourOpen, setTourOpen] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  useEffect(() => {
    if (!tourSeen()) setTourOpen(true);
    const p = new URLSearchParams(window.location.search).get("project");
    if (p && PROJECTS.some((x) => x.id === p)) setProject(p);
  }, []);

  const switchProject = (id: string) => {
    seenRevision.current = -1;
    pending.current = {};
    setServer(null);
    setDraft({});
    setProject(id);
    window.history.replaceState(null, "", id === PROJECTS[0].id ? "/" : `/?project=${id}`);
  };

  const loadSample = async () => {
    const res = await fetch(`/api/app/projects/${PROJECT}/sample`, { method: "POST" });
    if (res.ok) accept((await res.json()) as RequirementsResponse);
  };

  const seenRevision = useRef(-1);
  const inflight = useRef(0);
  const pending = useRef<ContextPatch>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const live = Boolean(server?.ready) && !pendingExtract;

  const accept = useCallback((data: RequirementsResponse) => {
    if (data.revision === seenRevision.current) return;
    seenRevision.current = data.revision;
    setServer(data);
    setDraft(data.context);
    setPendingExtract(false);
  }, []);

  // Poll every 2 s so changes from the simulated design tool show up on screen.
  useEffect(() => {
    let stop = false;
    const tick = async () => {
      if (inflight.current > 0 || pending.current && Object.keys(pending.current).length) return;
      try {
        const res = await fetch(`/api/v1/projects/${PROJECT}/requirements`, { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as RequirementsResponse;
        if (!stop && inflight.current === 0) accept(data);
        setOnline(true);
      } catch {
        setOnline(false);
      }
    };
    tick();
    const id = setInterval(tick, 2000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [accept, PROJECT]);

  const write = useCallback(
    async (patch: ContextPatch) => {
      inflight.current += 1;
      try {
        const res = await fetch(`/api/app/projects/${PROJECT}/context`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ context: patch }),
        });
        if (res.ok) {
          const data = (await res.json()) as RequirementsResponse;
          seenRevision.current = data.revision;
          setServer(data);
          setPendingExtract(false);
        }
      } finally {
        inflight.current -= 1;
      }
    },
    [PROJECT],
  );

  const change = useCallback(
    (patch: ContextPatch) => {
      setDraft((d) => ({ ...d, ...patch }));
      if (!live) return;
      pending.current = { ...pending.current, ...patch };
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        const out = pending.current;
        pending.current = {};
        void write(out);
      }, 450);
    },
    [live, write],
  );

  const confirm = useCallback(() => {
    const full: ContextPatch = {};
    for (const f of ALL_FIELDS) (full as Record<string, unknown>)[f] = draft[f] ?? null;
    void write(full);
  }, [draft, write]);

  const answerField = useCallback(
    (field: ContextField, value: string | number | null) => change({ [field]: value } as ContextPatch),
    [change],
  );

  const reset = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    pending.current = {};
    const res = await fetch("/api/sim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reset", project: PROJECT }),
    });
    if (res.ok) {
      seenRevision.current = -1;
      accept((await res.json()) as RequirementsResponse);
      setCommand("");
    }
  }, [accept, PROJECT]);

  const submitCommand = (e: React.FormEvent) => {
    e.preventDefault();
    const found = extractContext(command);
    if (Object.keys(found).length === 0) return;
    setDraft((d) => ({ ...d, ...found }));
    setPendingExtract(true);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        commandRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const gateDone = GATE_FIELDS.filter((f) => draft[f] !== undefined).length;

  return (
    <>
      <div className={`loader ${server ? "is-done" : ""}`}>
        <div className="mark mark--lg"><span /><span /><span /></div>
        <div className="loader__title">CodeCatalyst</div>
        <div className="loader__status">{online ? "Loading project…" : "Waiting for the server…"}</div>
      </div>

      <div className="app">
        <header className="topbar">
          <div className="brand">
            <div className="mark"><span /><span /><span /></div>
            <div className="brand__name">CodeCatalyst</div>
            <div className="brand__sep" />
            <span className="pill project">
              <span className={`pill__dot ${online ? "" : "is-off"}`} />
              <select className="pill__select" value={PROJECT} onChange={(e) => switchProject(e.target.value)} aria-label="Project">
                {PROJECTS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {p.place}
                  </option>
                ))}
              </select>
            </span>
          </div>

          <form className="command" onSubmit={submitCommand} autoComplete="off">
            <span className="command__logo">✦</span>
            <input
              ref={commandRef}
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder="Describe the project… e.g. “New 5-storey office, about 4,800 m² GFA, 22 m habitable height, concept stage”"
              aria-label="Describe the project"
            />
            <kbd>⌘K</kbd>
          </form>

          <nav className="stages" aria-label="Design stage">
            {STAGES.map((s) => (
              <button
                key={s.id}
                type="button"
                title={STAGE_LABEL[s.id]}
                className={draft.design_stage === s.id ? "is-active" : ""}
                onClick={() => change({ design_stage: s.id })}
              >
                <i>{s.n}</i>
                {s.label}
              </button>
            ))}
          </nav>

          <div className="topbar__spacer" />
          <span className="src__meta" style={{ fontFamily: "var(--mono)", fontSize: 11 }}>
            {server ? `rev ${server.revision}` : ""}
          </span>
          <a className="btn btn--sm" href={`/pipeline?project=${PROJECT}`}>
            Pipeline
          </a>
          <a className="btn btn--sm btn--coral" href="/pipeline?project=tan-kembangan&demo=1">
            ▶ Play demo
          </a>
          <QrButton />
          <StoryButton />
          <StoryBullets />
          <button className="btn btn--sm" type="button" onClick={() => setSourcesOpen(true)}>
            <IconBook /> Sources
          </button>
          <button className="btn btn--sm btn--ghost" type="button" onClick={() => setTourOpen(true)} title="Walkthrough" aria-label="Walkthrough">
            ?
          </button>
          <button className="btn btn--sm btn--ghost" type="button" onClick={reset} title="Reset demo">
            <IconReset /> Reset
          </button>
        </header>

        <aside className="panel panel--left">
          <ContextForm
            draft={draft}
            server={server}
            live={live}
            pendingExtract={pendingExtract}
            gateDone={gateDone}
            onChange={change}
            onConfirm={confirm}
          />
        </aside>

        <main className="stage">
          <Guidance data={server} draft={draft} onAnswer={answerField} sample={PROJECTS.find((p) => p.id === PROJECT)} onSample={loadSample} />
        </main>

        <aside className="panel panel--right">
          <Companion projectId={PROJECT} ready={Boolean(server?.ready)} revision={server?.revision ?? 0} />
        </aside>
      </div>

      <Tour open={tourOpen} onClose={() => setTourOpen(false)} onOpenSources={() => setSourcesOpen(true)} />
      <SourcesPanel open={sourcesOpen} onClose={() => setSourcesOpen(false)} />
    </>
  );
}
