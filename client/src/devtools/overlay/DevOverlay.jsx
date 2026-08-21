import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useHoverTarget, labelForElement } from "./useHoverTarget.js";
import AnnotationPopover from "./AnnotationPopover.jsx";
import AdminAnnotationMarkers from "./AdminAnnotationMarkers.jsx";
import { submitAnnotation } from "../devApi.js";

/* ================================================================== */
/* LEGO BLOCK — mounted once (only while dev mode is authenticated AND  */
/* the overlay toggle is on). Three jobs:                               */
/*  1. Hover: glowing outline over whatever container the cursor is     */
/*     over (see useHoverTarget.js for the detection heuristic).        */
/*  2. Ctrl/Cmd+click: stops the real app's own click handler from      */
/*     firing (capture-phase stopPropagation) and opens a small comment */
/*     box, submitting straight to data/routes/annotations.js. When the */
/*     logged-in dev user is ALSO admin-verified, every note they write */
/*     is automatically flagged as an action item — no extra click.     */
/*  3. Admin-only: persistent (not hover-only) markers on every open     */
/*     comment on the current screen, see AdminAnnotationMarkers.jsx.    */
/* ================================================================== */

export default function DevOverlay({ active, route, isAdmin, onSubmitted }) {
  const target = useHoverTarget(active);
  const [popover, setPopover] = useState(null); // { x, y, label } | null
  const [markersRefreshKey, setMarkersRefreshKey] = useState(0);

  useEffect(() => {
    if (!active) return;
    function onClickCapture(e) {
      if (!(e.ctrlKey || e.metaKey)) return;
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (!el || el.closest(".dev-overlay-ignore")) return;
      e.preventDefault();
      e.stopPropagation();
      setPopover({ x: e.clientX, y: e.clientY, label: labelForElement(target || el) });
    }
    window.addEventListener("click", onClickCapture, true);
    return () => window.removeEventListener("click", onClickCapture, true);
  }, [active, target]);

  if (!active) return null;

  const rect = target?.getBoundingClientRect();

  async function submit(comment) {
    // כשמי שכותב מאומת גם כמנהל, ההערה שלו הופכת אוטומטית לפריט פעולה —
    // "כל מה שאני כותב הופך לפעולה", בלי צעד נוסף.
    await submitAnnotation({ route, targetLabel: popover.label, comment, actionRequested: isAdmin });
    setPopover(null);
    setMarkersRefreshKey((k) => k + 1);
    onSubmitted?.();
  }

  return createPortal(
    <div className="dev-overlay-ignore">
      <style>{CSS}</style>
      {rect && (
        <div
          className="dev-overlay-highlight"
          style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }}
        />
      )}
      {popover && (
        <AnnotationPopover
          x={popover.x}
          y={popover.y}
          label={popover.label}
          isAdmin={isAdmin}
          onCancel={() => setPopover(null)}
          onSubmit={submit}
        />
      )}
      <AdminAnnotationMarkers isAdmin={isAdmin} route={route} refreshKey={markersRefreshKey} />
    </div>,
    document.body
  );
}

const CSS = `
.dev-overlay-highlight{
  position:fixed; pointer-events:none; z-index:99999; border-radius:8px;
  border:2px solid var(--dev);
  box-shadow:0 0 0 3px color-mix(in srgb, var(--dev) 28%, transparent),
             0 0 18px color-mix(in srgb, var(--dev) 50%, transparent);
  transition:top .06s ease, left .06s ease, width .06s ease, height .06s ease;
}
.dev-annotate-popover{
  position:fixed; z-index:100000; width:290px; background:var(--panel); border:1px solid var(--dev);
  border-radius:10px; padding:10px; display:flex; flex-direction:column; gap:8px; box-shadow:var(--shadow-md);
  animation:devAnnotateIn .12s ease;
}
@keyframes devAnnotateIn{ from{ opacity:0; transform:translateY(4px); } to{ opacity:1; transform:translateY(0); } }
.dev-annotate-popover-label{
  font-family:var(--font-mono); font-size:10.5px; color:var(--dev); text-transform:uppercase; letter-spacing:.04em;
}
.dev-annotate-popover-admin-hint{
  font-size:11px; color:#2F8FCE; background:color-mix(in srgb, #2F8FCE 12%, transparent);
  border-radius:6px; padding:4px 8px;
}
.dev-annotate-popover textarea{
  width:100%; background:var(--bg); border:1px solid var(--line); border-radius:7px; padding:7px 9px;
  font-size:12.5px; font-family:var(--font-sans); color:var(--text); resize:vertical;
}
.dev-annotate-popover textarea:focus{ outline:none; border-color:var(--dev); }
.dev-annotate-popover-actions{ display:flex; justify-content:flex-end; gap:8px; }
.dev-annotate-btn{
  border:none; border-radius:7px; padding:6px 12px; font-family:var(--font-sans); font-weight:700; font-size:12px;
  cursor:pointer; background:var(--panel-raised); color:var(--text-dim);
}
.dev-annotate-btn-primary{ background:var(--dev); color:#fff; }
.dev-annotate-btn:disabled{ opacity:.5; cursor:not-allowed; }
`;
