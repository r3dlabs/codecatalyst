"use client";

import { useState } from "react";
import { PROJECTS, SIM_SCRIPTS } from "@/lib/projects";
import { IconReset } from "@/components/icons";

export default function Simulator() {
  const [project, setProject] = useState(PROJECTS[0].id);
  const [done, setDone] = useState(0);
  const [run, setRun] = useState(() => String(Date.now()));
  const [busy, setBusy] = useState(false);
  const steps = SIM_SCRIPTS[project];

  const post = async (body: object) => {
    setBusy(true);
    try {
      await fetch("/api/sim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project, run, ...body }),
      });
    } finally {
      setBusy(false);
    }
  };
  const next = async () => {
    if (done >= steps.length) return;
    await post({ step: done });
    setDone(done + 1);
  };
  const reset = async () => {
    await post({ action: "reset" });
    setDone(0);
    setRun(String(Date.now()));
  };
  const pick = (id: string) => {
    setProject(id);
    setDone(0);
    setRun(String(Date.now()));
  };

  return (
    <main className="sim">
      <div className="card sim__card">
        <span className="sim__tag">Simulated design tool</span>
        <h1>Revit, played back</h1>
        <p>Stands in for a Revit or Rhino plugin. Each step sends model changes to the same API a real plugin would call.</p>
        <div className="seg" role="group" aria-label="Project" style={{ marginBottom: 14 }}>
          {PROJECTS.map((p) => (
            <button key={p.id} className={p.id === project ? "is-active" : ""} onClick={() => pick(p.id)}>
              {p.name}
            </button>
          ))}
        </div>
        <ol className="steps">
          {steps.map((s, i) => (
            <li key={s.title} className={i < done ? "is-done" : i === done ? "is-next" : ""}>
              <i>{i + 1}</i>
              <div>
                <b>{s.title}</b>
                <span>{s.detail}</span>
              </div>
              <span>{i < done ? "sent" : i === done ? "next" : ""}</span>
            </li>
          ))}
        </ol>
        <div className="sim__actions">
          <button className="btn btn--coral" onClick={next} disabled={busy || done >= steps.length}>
            {done >= steps.length ? "Scenario complete" : `Next step: ${steps[done].title}`}
          </button>
          <button className="btn" onClick={reset} disabled={busy}>
            <IconReset /> Reset
          </button>
        </div>
        <div className="sim__foot">
          Open the{" "}
          <a href={`/?project=${project}`} target="_blank">
            CodeCatalyst app
          </a>{" "}
          or the{" "}
          <a href={`/pipeline?project=${project}`} target="_blank">
            pipeline view
          </a>{" "}
          beside this window. They pick up each change within about 2 seconds.
        </div>
      </div>
    </main>
  );
}
