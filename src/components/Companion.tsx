"use client";

import { useEffect, useRef, useState } from "react";
import { IconBook, IconSend } from "./icons";

interface Citation { id: string; title: string; source_title: string; url: string }
interface Reply { kind: "answer" | "not_covered" | "declined" | "unavailable"; answer: string; citations: Citation[]; ai: boolean }
type Msg = { role: "user"; text: string } | ({ role: "bot" } & Reply) | { role: "typing" };

const SUGGESTIONS = [
  "What should I look at for the core now?",
  "Is my design compliant?",
  "What is the plot ratio limit for this site?",
];

export function Companion({ projectId, ready, revision }: { projectId: string; ready: boolean; revision: number }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [q, setQ] = useState("");
  const [ai, setAi] = useState<boolean | null>(null);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/v1/projects/${projectId}/ask`).then((r) => r.json()).then((d) => setAi(Boolean(d.ai))).catch(() => setAi(false));
  }, [projectId]);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs]);
  // A reset starts a fresh conversation.
  useEffect(() => { if (revision === 0) setMsgs([]); }, [revision]);

  const send = async (text: string) => {
    const question = text.trim();
    if (!question || !ready) return;
    setQ("");
    setMsgs((m) => [...m, { role: "user", text: question }, { role: "typing" }]);
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const reply = (await res.json()) as Reply;
      setAi(reply.ai);
      setMsgs((m) => [...m.filter((x) => x.role !== "typing"), { role: "bot", ...reply }]);
    } catch {
      setMsgs((m) => [
        ...m.filter((x) => x.role !== "typing"),
        { role: "bot", kind: "not_covered", ai: false, citations: [], answer: "The companion could not be reached. Try again in a moment." },
      ]);
    }
  };

  return (
    <>
      <div className="panel__head">
        <div className="eyebrow"><i>03</i> Ask</div>
        <div className="panel__title">Companion</div>
        <div className="panel__sub">Answers only from the sources shown on your cards.</div>
      </div>

      <div className="chat" aria-live="polite">
        {msgs.length === 0 && (
          <div className="chat__empty">
            <h3>Ask about the results</h3>
            <p>{ready ? "Try one of these, or ask your own." : "Confirm the project context first, then ask about the results."}</p>
            <div className="suggest">
              {SUGGESTIONS.map((s) => (
                <button key={s} disabled={!ready} onClick={() => send(s)}>{s}</button>
              ))}
            </div>
          </div>
        )}
        {msgs.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="msg msg--user">{m.text}</div>
          ) : m.role === "typing" ? (
            <div key={i} className="msg msg--bot"><span className="typing"><i /><i /><i /></span></div>
          ) : (
            <div key={i} className={`msg msg--bot ${m.kind === "declined" ? "is-declined" : m.kind === "not_covered" ? "is-notcovered" : ""}`}>
              {m.answer}
              {m.citations.length > 0 && (
                <div className="cites">
                  {m.citations.map((c) => (
                    <a key={c.id} className="cite" href={c.url} target="_blank" rel="noreferrer">
                      <IconBook /> <span><b>{c.title}</b> · {c.source_title}</span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          ),
        )}
        <div ref={end} />
      </div>

      <div className="compose">
        <form onSubmit={(e) => { e.preventDefault(); void send(q); }}>
          <input className="input" value={q} onChange={(e) => setQ(e.target.value)} disabled={!ready} placeholder="Ask about these requirements…" aria-label="Ask the companion" />
          <button className="btn btn--primary" type="submit" disabled={!ready || !q.trim()} aria-label="Send"><IconSend /></button>
        </form>
        <div className="compose__note">
          {ai === false ? "AI explanations are off. Showing stored design prompts with their sources." : "Guidance only. It will not give a compliance determination."}
        </div>
      </div>
    </>
  );
}
