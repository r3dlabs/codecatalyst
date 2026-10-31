"use client";

import { useEffect, useState } from "react";

/** Pitch story: the problem and what CodeCatalyst does about it. */
export function StoryButton({ className = "btn btn--sm" }: { className?: string }) {
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
          <path d="M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z" />
          <path d="M9 9h5M9 13h5" />
        </svg>
        Story
      </button>
      {open && (
        <div className="overlay" role="dialog" aria-modal="true" aria-label="The story" onClick={() => setOpen(false)}>
          <div className="card story" onClick={(e) => e.stopPropagation()}>
            <div className="eyebrow">The Story</div>
            <h2 className="tour__title">The Compliance Crisis</h2>
            <p className="tour__body">
              Today, navigating complex regulatory codes, zoning laws, and building guidelines during the early design
              phase is fragmented across static PDFs, municipal publications, and manual checklists. Architects and
              project teams often discover critical compliance conflicts late in development, forcing costly redesigns,
              delayed approvals, and significant operational overhead.
            </p>
            <p className="tour__body">
              Every time a building code or planning regulation updates, design teams scramble to re-evaluating existing
              plans. Without a unified, code-aware system, identifying non-compliant spatial configurations or
              structural parameters relies on manual reviews, leaving projects exposed to blind spots and unexpected
              late-stage revisions.
            </p>
            <h2 className="tour__title story__sub">Enter CodeCatalyst</h2>
            <p className="tour__body">
              CodeCatalyst acts as an intelligent, code-aware design companion. Rather than performing retrospective
              compliance checks, CodeCatalyst dynamically surfaces changing regulatory codes, government mandates, and
              project-specific requirements directly within the early design workflow. By continuously aligning evolving
              spatial designs with active regulatory constraints, CodeCatalyst prevents costly late-stage redesigns and
              seamlessly coordinates design compliance across project stakeholders.
            </p>
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
