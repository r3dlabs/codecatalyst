"use client";

import { useEffect, useMemo, useState } from "react";
import { DEMO_START, MONITOR_EVENTS, type Channel, type Criticality } from "@/lib/demo-monitor";
import { requirements } from "@/lib/seed";

const CRIT: Criticality[] = ["Critical", "High", "Medium", "Low"];
const titleOf = (id: string) => requirements.find((r) => r.id === id)?.title ?? id;
const dateOf = (day: number) => {
  const d = new Date(`${DEMO_START}T00:00:00`);
  d.setDate(d.getDate() + day);
  return d.toLocaleDateString("en-SG", { day: "numeric", month: "short" });
};

export function DemoMonitor({ signal = 0 }: { signal?: number }) {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [filter, setFilter] = useState<"all" | Channel>("all");
  const total = MONITOR_EVENTS.length;

  // The guided demo run bumps `signal` to restart the playback.
  useEffect(() => {
    if (signal > 0) {
      setStep(0);
      setPlaying(true);
    }
  }, [signal]);

  useEffect(() => {
    if (!playing) return;
    if (step >= total) {
      setPlaying(false);
      return;
    }
    const id = setTimeout(() => setStep((s) => s + 1), 1800 / speed);
    return () => clearTimeout(id);
  }, [playing, step, speed, total]);

  const seen = MONITOR_EVENTS.slice(0, step);
  const resolved = new Set(seen.map((e) => e.resolves).filter(Boolean));
  const rows = useMemo(
    () =>
      seen
        .map((e) => ({ ...e, status: resolved.has(e.id) ? ("Closed" as const) : e.status }))
        .filter((e) => filter === "all" || e.channel === filter),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [step, filter],
  );
  const live = rows.filter((r) => r.status !== "Closed");
  const sorted = [...rows].sort((a, b) => Number(a.status === "Closed") - Number(b.status === "Closed") || a.priority - b.priority || b.day - a.day);
  const day = step === 0 ? 0 : MONITOR_EVENTS[step - 1].day;

  return (
    <div className="card pl__card">
      <div className="req__top">
        <div className="section-label" style={{ margin: 0 }}>Monitoring playback</div>
        <span className="label label--may_apply_need_input">Demo data, simulated</span>
        <span className="src__meta" style={{ marginLeft: "auto" }}>{step === 0 ? "Not started" : `Day ${day} · ${dateOf(day)}`}</span>
      </div>
      <div className="note">
        Two channels feed one log: telemetry synced from the design model and manual audits. Every item carries a priority and a criticality.
        Observations are flags for review, not a compliance status.
      </div>

      <div className="pb">
        <button className="btn btn--coral btn--sm" onClick={() => { if (step >= total) setStep(0); setPlaying((p) => !p); }}>
          {playing ? "Pause" : step >= total ? "Replay" : step === 0 ? "Play" : "Resume"}
        </button>
        <button className="btn btn--sm" disabled={step >= total} onClick={() => { setPlaying(false); setStep((s) => Math.min(total, s + 1)); }}>Step</button>
        <button className="btn btn--sm btn--ghost" onClick={() => { setPlaying(false); setStep(0); }}>Restart</button>
        <input type="range" min={0} max={total} value={step} onChange={(e) => { setPlaying(false); setStep(Number(e.target.value)); }} aria-label="Playback position" className="pb__range" />
        <div className="seg" role="group" aria-label="Speed">
          {[1, 2, 4].map((s) => (
            <button key={s} className={speed === s ? "is-active" : ""} onClick={() => setSpeed(s)}>{s}×</button>
          ))}
        </div>
      </div>

      <div className="mon">
        <div className="mon__stats">
          <div><b>{seen.filter((e) => e.channel === "telemetry").length}</b><span>telemetry signals</span></div>
          <div><b>{seen.filter((e) => e.channel === "audit").length}</b><span>manual audits</span></div>
          <div><b>{live.length}</b><span>items open or raised</span></div>
        </div>
        <div className="matrix" aria-label="Open items by priority and criticality">
          <div className="matrix__corner" />
          {[1, 2, 3].map((p) => <div key={p} className="matrix__h">P{p}</div>)}
          {CRIT.map((c) => (
            <div key={c} style={{ display: "contents" }}>
              <div className="matrix__r">{c}</div>
              {[1, 2, 3].map((p) => {
                const n = live.filter((r) => r.priority === p && r.criticality === c).length;
                return <div key={p} className={`matrix__c ${n ? `on c-${c}` : ""}`}>{n || ""}</div>;
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="seg" role="group" aria-label="Channel" style={{ maxWidth: 320 }}>
        {(["all", "telemetry", "audit"] as const).map((f) => (
          <button key={f} className={filter === f ? "is-active" : ""} onClick={() => setFilter(f)}>
            {f === "all" ? "All" : f === "telemetry" ? "Telemetry" : "Manual audit"}
          </button>
        ))}
      </div>

      <div className="log">
        {sorted.length === 0 && <div className="note">Press Play to replay four weeks of the Tan Residence design.</div>}
        {sorted.map((e) => (
          <div key={e.id} className={`log__row ${e.status === "Closed" ? "is-closed" : ""}`}>
            <span className={`pr pr--${e.priority}`}>P{e.priority}</span>
            <span className={`crit crit--${e.criticality}`}>{e.criticality}</span>
            <div>
              <div><b>{titleOf(e.control)}</b> <span className="src__issuer">{e.channel === "telemetry" ? "TELEMETRY" : "AUDIT"}</span></div>
              <div className="note">{e.observation}</div>
              <div className="src__meta">{dateOf(e.day)} · owner: {e.owner}</div>
            </div>
            <span className={`label ${e.status === "Closed" ? "label--applies_on_inputs" : e.status === "Open" ? "label--may_apply_need_input" : "label--check_with_qp"}`}>{e.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
