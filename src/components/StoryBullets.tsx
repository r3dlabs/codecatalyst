"use client";

import { useEffect, useState } from "react";

const PROBLEM = [
  "Codes, zoning rules and guidelines are scattered across PDFs, circulars and manual checklists",
  "Conflicts surface late, forcing redesigns, delayed approvals and extra overhead",
  "Every code update sends teams back to re-evaluate their plans",
  "Manual reviews leave blind spots and late-stage surprises",
];
const SOLUTION = [
  "A code-aware design companion that works in the early design phase",
  "Shows the few requirements that matter at the current stage, each with its official source",
  "Re-runs as the design changes and highlights what is new",
  "Keeps project stakeholders working from the same list",
  "Rules select, AI explains, and a person verifies every source",
];

/** One-glance version of the pitch story. */
export function StoryBullets({ className = "btn btn--sm" }: { className?: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button className={className} type="button" onClick={() => setOpen(true)}>
        <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden>
          <path d="M9 6h11M9 12h11M9 18h11" />
          <path d="M4 6h.01M4 12h.01M4 18h.01" />
        </svg>
        Bullets
      </button>
      {open && (
        <div className="overlay" role="dialog" aria-modal="true" aria-label="The story in bullets" onClick={() => setOpen(false)}>
          <div className="card story" onClick={(e) => e.stopPropagation()}>
            <div className="eyebrow">The story in brief</div>
            <h2 className="tour__title">The problem</h2>
            <ul className="bul">
              {PROBLEM.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
            <h2 className="tour__title story__sub">CodeCatalyst</h2>
            <ul className="bul bul--on">
              {SOLUTION.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
            <div className="tour__foot">
              <span className="src__meta" style={{ marginRight: "auto" }}>Esc to close</span>
              <button className="btn btn--coral btn--sm" onClick={() => setOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
