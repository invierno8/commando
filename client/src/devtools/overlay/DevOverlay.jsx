import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useHoverTarget, labelForElement } from "./useHoverTarget.js";
import AnnotationPopover from "./AnnotationPopover.jsx";
import AdminAnnotationMarkers from "./AdminAnnotationMarkers.jsx";
import { submitAnnotation, submitJynxFeedback } from "../devApi.js";

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
  // isAdmin גם קובע אם מותר לגלוש בכלל על ה-UI של Jynx עצמו (.jynx-chrome) —
  // ראו useHoverTarget.js. משתמשי-פיתוח רגילים אף פעם לא רואים הילה שם.
  const target = useHoverTarget(active, isAdmin);
  const [popover, setPopover] = useState(null); // { x, y, label, secondaryTargets: [], isJynxMeta } | null
  const [pickingSecondary, setPickingSecondary] = useState(false);
  const [markersRefreshKey, setMarkersRefreshKey] = useState(0);
  const isJynxHover = !!target?.closest(".jynx-chrome");

  useEffect(() => {
    if (!active) return;
    function onClickCapture(e) {
      const el = document.elementFromPoint(e.clientX, e.clientY);

      // מצב "בחירת יעד משני": כל קליק (בלי צורך ב-Ctrl) על אלמנט מודגש
      // מוסיף אותו כ-yed משני ל-popover הפתוח, בלי לסגור אותו ובלי לתת
      // לקליק להגיע לאפליקציה האמיתית — כך אפשר להצביע על "לאן להעביר"
      // במקום לתאר את זה במילים.
      if (pickingSecondary) {
        if (!el || el.closest(".dev-overlay-ignore")) return;
        if (el.closest(".jynx-chrome") && !isAdmin) return;
        e.preventDefault();
        e.stopPropagation();
        const lbl = labelForElement(target || el);
        setPopover((p) => {
          if (!p) return p;
          if (p.secondaryTargets.includes(lbl) || lbl === p.label) return p;
          return { ...p, secondaryTargets: [...p.secondaryTargets, lbl] };
        });
        setPickingSecondary(false);
        return;
      }

      if (!(e.ctrlKey || e.metaKey)) return;
      if (!el || el.closest(".dev-overlay-ignore")) return;
      // Jynx-chrome (ה-FAB/סרגל/פאנל ניהול עצמם) — משוב עליהם נכנס לתור
      // נפרד לגמרי (jynx-feedback, ראו submit() למטה), ורק המנהל רואה אותו
      // בכלל בתור useHoverTarget למעלה, אז כאן זו רק בדיקת-הגנה כפולה.
      const isJynx = !!el.closest(".jynx-chrome");
      if (isJynx && !isAdmin) return;
      e.preventDefault();
      e.stopPropagation();
      setPopover({ x: e.clientX, y: e.clientY, label: labelForElement(target || el), secondaryTargets: [], isJynxMeta: isJynx });
    }
    function onKeyDown(e) {
      if (e.key === "Escape" && pickingSecondary) setPickingSecondary(false);
    }
    window.addEventListener("click", onClickCapture, true);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("click", onClickCapture, true);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [active, target, pickingSecondary, isAdmin]);

  if (!active) return null;

  const rect = target?.getBoundingClientRect();

  async function submit(comment, actionOn) {
    if (popover.isJynxMeta) {
      // משוב על Jynx עצמו — תור נפרד לגמרי מהמשוב על האפליקציה (ראו
      // data/routes/jynx-feedback.js), תמיד "פעולה" כי רק המנהל כותב לכאן.
      await submitJynxFeedback({ route, targetLabel: popover.label, comment, secondaryTargets: popover.secondaryTargets });
    } else {
      // כפתור "יישלח כפעולה" ב-AnnotationPopover.jsx נותן למנהל שליטה
      // מפורשת (ברירת מחדל דלוקה, אבל ניתן לכיבוי); למשתמש-פיתוח רגיל
      // (לא מנהל) זה תמיד false בלי קשר למה שהתקבל.
      await submitAnnotation({
        route, targetLabel: popover.label, comment, actionRequested: isAdmin && actionOn,
        secondaryTargets: popover.secondaryTargets,
      });
    }
    setPopover(null);
    setMarkersRefreshKey((k) => k + 1);
    onSubmitted?.();
  }

  return createPortal(
    <div className="dev-overlay-ignore">
      <style>{CSS}</style>
      {rect && (
        <div
          className={"dev-overlay-highlight" + (isJynxHover ? " dev-overlay-highlight-jynx" : "")}
          style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }}
        />
      )}
      {popover && (
        <AnnotationPopover
          x={popover.x}
          y={popover.y}
          label={popover.label}
          secondaryTargets={popover.secondaryTargets}
          pickingSecondary={pickingSecondary}
          isAdmin={isAdmin}
          isJynxMeta={popover.isJynxMeta}
          onCancel={() => { setPickingSecondary(false); setPopover(null); }}
          onSubmit={submit}
          onAddSecondary={() => setPickingSecondary(true)}
          onRemoveSecondary={(lbl) => setPopover((p) => p && { ...p, secondaryTargets: p.secondaryTargets.filter((t) => t !== lbl) })}
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
  border:2px solid var(--jynx);
  box-shadow:0 0 0 3px color-mix(in srgb, var(--jynx) 28%, transparent),
             0 0 18px color-mix(in srgb, var(--jynx) 50%, transparent);
  transition:top .06s ease, left .06s ease, width .06s ease, height .06s ease;
}
.dev-overlay-highlight-jynx{
  border-color:var(--dev);
  box-shadow:0 0 0 3px color-mix(in srgb, var(--dev) 28%, transparent),
             0 0 18px color-mix(in srgb, var(--dev) 50%, transparent);
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
.dev-annotate-action-toggle{
  display:inline-flex; align-items:center; gap:5px; align-self:flex-start; border:1px solid var(--line);
  background:none; color:var(--text-dim); border-radius:20px; padding:4px 10px; font-size:11px; font-weight:700;
  cursor:pointer; font-family:var(--font-sans);
}
.dev-annotate-action-toggle.on{ border-color:#2F8FCE; color:#2F8FCE; background:color-mix(in srgb, #2F8FCE 12%, transparent); }
.dev-annotate-popover-jynx{ border-color:var(--dev); }
.dev-annotate-popover-label-jynx{ color:var(--dev); }
.dev-annotate-popover-jynx-hint{
  font-size:11px; color:var(--dev); background:color-mix(in srgb, var(--dev) 14%, transparent);
  border-radius:6px; padding:4px 8px;
}
.dev-annotate-popover-jynx textarea:focus{ border-color:var(--dev); }
.dev-annotate-popover-jynx .dev-annotate-btn-primary{ background:var(--dev); }
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

.dev-annotate-secondary-block{ display:flex; flex-direction:column; gap:6px; }
.dev-annotate-secondary-chips{ display:flex; flex-wrap:wrap; gap:5px; }
.dev-annotate-secondary-chip{
  display:inline-flex; align-items:center; gap:5px; background:color-mix(in srgb, var(--dev) 12%, transparent);
  border:1px solid var(--dev); color:var(--dev); border-radius:20px; padding:3px 8px; font-size:11px; font-family:var(--font-mono);
}
.dev-annotate-secondary-chip button{
  background:none; border:none; color:inherit; cursor:pointer; font-size:13px; line-height:1; padding:0;
}
.dev-annotate-add-secondary-btn{
  align-self:flex-start; background:none; border:1px dashed var(--line); color:var(--text-dim); border-radius:7px;
  padding:5px 9px; font-size:11.5px; font-family:var(--font-sans); cursor:pointer;
}
.dev-annotate-add-secondary-btn:hover{ border-color:var(--dev); color:var(--dev); }
.dev-annotate-picking-hint{
  font-size:11.5px; color:var(--dev); background:color-mix(in srgb, var(--dev) 10%, transparent);
  border-radius:6px; padding:5px 9px; animation:devAdminPulse 1.2s ease-in-out infinite;
}
@keyframes devAdminPulse{ 50%{ opacity:.55; } }
`;
