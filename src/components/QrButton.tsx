"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

/** Shows a QR code for the page the user is on, so a phone can open the same view. */
export function QrButton({ className = "btn btn--sm" }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [img, setImg] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    const href = window.location.href;
    setUrl(href);
    QRCode.toDataURL(href, { width: 280, margin: 1, color: { dark: "#13202b", light: "#ffffff" } }).then(setImg);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button className={className} type="button" onClick={() => setOpen(true)} aria-label="Show QR code for this page">
        <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden>
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <path d="M14 14h3v3h-3zM20 14v3M14 20h3M20 20h1" />
        </svg>
        QR
      </button>
      {open && (
        <div className="overlay" role="dialog" aria-modal="true" aria-label="QR code" onClick={() => setOpen(false)}>
          <div className="card tour" style={{ justifyItems: "center", textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
            <div className="eyebrow">Scan to open this page</div>
            {img ? <img src={img} width={280} height={280} alt={`QR code for ${url}`} style={{ borderRadius: 12 }} /> : <div style={{ height: 280 }} />}
            <div className="src__meta" style={{ wordBreak: "break-all", maxWidth: 320 }}>{url}</div>
            <div className="tour__foot" style={{ justifyContent: "center" }}>
              <button
                className="btn btn--sm"
                onClick={async () => {
                  await navigator.clipboard.writeText(url);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
              >
                {copied ? "Copied" : "Copy link"}
              </button>
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
