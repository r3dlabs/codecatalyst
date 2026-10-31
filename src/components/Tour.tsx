"use client";

import { useEffect, useState } from "react";

const STEPS = [
  {
    n: "00",
    title: "Welcome to CodeCatalyst",
    body: "Describe a Singapore project and see the few code requirements that matter at the current design stage, each with its official source. Rules choose what applies. AI only explains.",
    note: "Design guidance only. It never gives a determination on a design.",
  },
  {
    n: "01",
    title: "Sources come first",
    body: "Codes and frameworks are added in Sources before anything reaches a designer. Upload or paste a document, let AI draft candidate rows with exact quotes, then a named person checks them. Only checked records can show a number.",
    action: "Open Sources",
  },
  {
    n: "02",
    title: "Set the project context",
    body: "Describe the project in the top bar or use the form. Work type, use, GFA, height and design stage are required, and you can mark any of them Unknown. Confirm the fields before results appear.",
  },
  {
    n: "03",
    title: "Read the focused guidance",
    body: "At most five items for your stage, ranked by what is costliest to change later. Each shows why it appears, a design prompt and the official source. “May apply” means we need one more input, and it is never dropped.",
  },
  {
    n: "04",
    title: "Watch what changes",
    body: "Edit any field, or play the design-tool simulator, and the rules re-run. A banner lists what is new or no longer triggered, with the threshold that was crossed. Try adding two floors.",
    link: { href: "/simulator", label: "Open simulator" },
  },
  {
    n: "05",
    title: "Ask the companion",
    body: "Questions are answered only from the sources on your cards. Out-of-scope questions get “not covered” and where to check. A request for a verdict on your design is declined and redirected to what to check.",
  },
];

const KEY = "cc-tour-v1";

export const tourSeen = () => {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return true;
  }
};

export function Tour({
  open,
  onClose,
  onOpenSources,
}: {
  open: boolean;
  onClose: () => void;
  onOpenSources: () => void;
}) {
  const [i, setI] = useState(0);

  const finish = () => {
    try {
      localStorage.setItem(KEY, "1");
    } catch {}
    onClose();
  };

  useEffect(() => {
    if (open) setI(0);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;
  const s = STEPS[i];
  const last = i === STEPS.length - 1;

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Walkthrough">
      <div className="card tour">
        <div className="eyebrow">
          <i>{s.n}</i> Walkthrough · {i + 1} of {STEPS.length}
        </div>
        <h2 className="tour__title">{s.title}</h2>
        <p className="tour__body">{s.body}</p>
        {s.note && <p className="tour__note">{s.note}</p>}
        {s.action && (
          <button
            className="btn"
            onClick={() => {
              finish();
              onOpenSources();
            }}
          >
            {s.action}
          </button>
        )}
        {s.link && (
          <a className="btn" href={s.link.href} target="_blank" rel="noreferrer">
            {s.link.label}
          </a>
        )}
        <div className="tour__foot">
          <div className="dots" aria-hidden>
            {STEPS.map((_, n) => (
              <i key={n} className={n === i ? "on" : n < i ? "done" : ""} />
            ))}
          </div>
          <button className="btn btn--ghost btn--sm" onClick={finish}>
            Skip
          </button>
          {i > 0 && (
            <button className="btn btn--sm" onClick={() => setI(i - 1)}>
              Back
            </button>
          )}
          <button className="btn btn--coral btn--sm" onClick={() => (last ? finish() : setI(i + 1))}>
            {last ? "Start" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
