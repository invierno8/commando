import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useHoverTarget, labelForElement, findTarget } from "./useHoverTarget.js";
import AnnotationPopover from "./AnnotationPopover.jsx";
import AdminAnnotationMarkers from "./AdminAnnotationMarkers.jsx";
import DrawingCanvas from "./DrawingCanvas.jsx";
import DrawingOverlay from "./DrawingOverlay.jsx";
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
/*  3. Persistent (not hover-only) markers on every open comment on the  */
/*     current screen — visible to isAdmin and to a "Jynx commenter"     */
/*     grant alike (jynx-mth4g9g5xnga), see AdminAnnotationMarkers.jsx;  */
/*     the "Action" trigger inside a marker's detail card stays          */
/*     isAdmin-only, since it kicks off the real automated PR pipeline.  */
/* ================================================================== */

// טוקן טקסט משני בתוך המשפט — "[→ תווית]" — ראו submit() למטה: זה מה שנשלח
// בפועל לשרת כ-secondaryTargets, מנותח מחדש מתוך הטקסט עצמו בזמן השליחה (לא
// ממערך נפרד), כך שמחיקת הטוקן מהטקסט = הסרת הקישור, בדיוק כמו כל טקסט אחר.
function parseSecondaryTargetsFromComment(comment) {
  const found = [];
  for (const m of comment.matchAll(/\[→\s*([^\]]+?)\s*\]/g)) {
    if (m[1] && !found.includes(m[1])) found.push(m[1]);
  }
  return found.slice(0, 10);
}

export default function DevOverlay({ active, route, isAdmin, canJynxChrome, markersOn, drawMode, drawColor, onSubmitted }) {
  // canJynxChrome (isAdmin OR a per-user canJynxComment grant, combined
  // upstream in DevAuthGate.jsx) קובע אם מותר לגלוש בכלל על ה-UI של Jynx
  // עצמו (.jynx-chrome) — ראו useHoverTarget.js. משתמשי-פיתוח רגילים בלי
  // ההרשאה הזו אף פעם לא רואים הילה שם. isAdmin עצמו נשאר נפרד — עדיין שולט
  // על ברירת-המחדל של "פעולה" בהערות על האפליקציה. AdminAnnotationMarkers
  // (הסימונים הקבועים) מקבל גם isAdmin וגם canJynxChrome עכשיו: הראשון
  // שולט רק על כפתור "פעולה" בכרטיס הפרטים, השני שולט אם הסימונים בכלל
  // מוצגים — ראו jynx-mth4g9g5xnga (נקודות-הסטטוס נפתחו לג'ינקס-קומנטר).
  const target = useHoverTarget(active, canJynxChrome);
  const [popover, setPopover] = useState(null); // { x, y, label, secondaryTargets: [], isJynxMeta } | null
  const [markersRefreshKey, setMarkersRefreshKey] = useState(0);
  const isJynxHover = !!target?.closest(".jynx-chrome");
  // "בוחר יעד משני" עכשיו הוא פשוט: יש popover פתוח. אין יותר שלב-ביניים של
  // כפתור "+ קשר אלמנט נוסף" — ברגע שהתגובה פתוחה, Ctrl/Cmd+קליק על אלמנט
  // תקין מוסיף אותו כיעד משני מיד (ראו AnnotationPopover.jsx להזרקת הטוקן
  // לטקסט). קליק רגיל (בלי Ctrl/Cmd) לא נלכד בכלל, כדי שאפשר עדיין ללחוץ על
  // כפתורים/אלמנטים באפליקציה מתחת בזמן שהתגובה פתוחה בלי שזה ייחשב כקישור.
  const pickingSecondary = !!popover;

  useEffect(() => {
    if (!active) return;
    // הפופאובר עצמו (ה-textarea, "תישלח כפעולה" וכו') נפתח קרוב מאוד לנקודת
    // הקליק שפתחה אותו — ולעיתים קרובות ממש מעל האלמנט שרוצים לקשר כיעד משני
    // (בעיקר במשוב Jynx-meta על הסרגל עצמו, שבו הפופאובר נפתח ממש מעל שאר
    // כפתורי הסרגל). elementFromPoint() היה מחזיר את הפופאובר עצמו במקרה כזה
    // (הכי עליון ב-z-index בנקודה הזו) ותופס אותו כ"לא יעד תקין"
    // (.dev-overlay-ignore) בלי להגיע בכלל לאלמנט האמיתי מתחתיו. elementsFromPoint
    // נותן את כל הערימה בנקודה הזו — מדלגים על כל שכבות ה-overlay עצמו (הפופאובר,
    // ההילה, הסימונים) ולוקחים את האלמנט האמיתי הראשון מתחתיהן.
    function realElementAtPoint(x, y) {
      const stack = document.elementsFromPoint(x, y);
      return stack.find((n) => !n.closest(".dev-overlay-ignore")) || null;
    }
    function onClickCapture(e) {
      const el = realElementAtPoint(e.clientX, e.clientY);

      // popover פתוח: Ctrl/Cmd+קליק על אלמנט תקין (לא חלק מה-UI של ה-overlay
      // עצמו) מוסיף אותו כיעד משני לתגובה הפתוחה מיד — בלי לסגור אותה ובלי
      // לתת לקליק להגיע לאפליקציה האמיתית מתחתיו — כך אפשר להצביע על "לאן
      // להעביר" במקום לתאר את זה במילים. קליק בלי Ctrl/Cmd מוחזק לא נלכד כאן
      // בכלל (מדלג ישר החוצה), כדי לא להפריע ללחיצה רגילה על כפתורים וכו' של
      // האפליקציה האמיתית בזמן שהתגובה פתוחה.
      if (popover) {
        if (!(e.ctrlKey || e.metaKey)) return;
        if (!el) return;
        if (el.closest(".jynx-chrome") && !canJynxChrome) return;
        e.preventDefault();
        e.stopPropagation();
        const lbl = labelForElement(target || el);
        setPopover((p) => {
          if (!p) return p;
          if (p.secondaryTargets.includes(lbl) || lbl === p.label) return p;
          return { ...p, secondaryTargets: [...p.secondaryTargets, lbl] };
        });
        return;
      }

      if (!(e.ctrlKey || e.metaKey)) return;
      if (!el) return;
      // Jynx-chrome (ה-FAB/סרגל/פאנל ניהול עצמם) — משוב עליהם נכנס לתור
      // נפרד לגמרי (jynx-feedback, ראו submit() למטה); רק מי שיש לו
      // canJynxChrome (מנהל, או משתמש-פיתוח עם canJynxComment) רואה אותו
      // בכלל בתור useHoverTarget למעלה, אז כאן זו רק בדיקת-הגנה כפולה.
      const isJynx = !!el.closest(".jynx-chrome");
      if (isJynx && !canJynxChrome) return;
      e.preventDefault();
      e.stopPropagation();
      setPopover({ x: e.clientX, y: e.clientY, label: labelForElement(target || el), secondaryTargets: [], isJynxMeta: isJynx });
    }
    function onKeyDown(e) {
      if (e.key === "Escape" && popover) setPopover(null);
    }
    window.addEventListener("click", onClickCapture, true);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("click", onClickCapture, true);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [active, target, popover, canJynxChrome]);

  // ציור מוכן (Ctrl/Cmd+גרירה, ראו DrawingCanvas.jsx) — פותח את אותה קופסת
  // תגובה בדיוק כמו Ctrl/Cmd+קליק רגיל, רק עם drawing מצורף על ה-popover
  // עצמו (לא state נפרד) כדי ש-submit() למטה ישלח אותו יחד עם התגובה.
  // תמיד app-comment רגיל, לא Jynx-meta — ציור על סרגל/פאנל של Jynx עצמו
  // אינו נתמך כרגע.
  function handleDrawingComplete({ drawing, targetEl, screenX, screenY }) {
    // findTarget() (לא רק labelForElement על האלמנט הגולמי) — בלי זה, ציור
    // על אלמנט כמו כרטיס קטלוג היה מתייג לפי ה-<button> הפנימי (flex, עוצר
    // מעבר-יחיד) במקום ה-wrapper המתויג בפועל, בדיוק הבאג שתועד ותוקן
    // ב-useHoverTarget.js עבור ה-hover הרגיל.
    const resolved = targetEl ? findTarget(targetEl) : null;
    setPopover({
      x: screenX, y: screenY, label: labelForElement(resolved || targetEl || document.body),
      secondaryTargets: [], isJynxMeta: false, drawing,
    });
  }

  if (!active) return null;

  const rect = target?.getBoundingClientRect();

  async function submit(comment, actionOn, attachment) {
    const secondaryTargets = parseSecondaryTargetsFromComment(comment);
    if (popover.isJynxMeta) {
      // משוב על Jynx עצמו — תור נפרד לגמרי מהמשוב על האפליקציה (ראו
      // data/routes/jynx-feedback.js). כמו במשוב הרגיל, כפתור "יישלח כפעולה"
      // נותן למנהל לבחור אם זו הערה בלבד או שהיא תיכנס לתור הפעולות. מאז
      // 2026-08-21 לא רק המנהל כותב לכאן — גם משתמש-פיתוח עם canJynxComment
      // (ראו למעלה), אבל זה תמיד אותו תור אחד בדיוק. אין תמיכה בקובץ מצורף
      // כאן בכוונה — AnnotationPopover.jsx לא מציג את הבורר הזה כשisJynxMeta,
      // אז attachment תמיד undefined בנתיב הזה.
      await submitJynxFeedback({
        route, targetLabel: popover.label, comment, actionRequested: actionOn,
        secondaryTargets,
      });
    } else {
      // כפתור "יישלח כפעולה" ב-AnnotationPopover.jsx נותן למנהל שליטה
      // מפורשת (ברירת מחדל דלוקה, אבל ניתן לכיבוי); למשתמש-פיתוח רגיל
      // (לא מנהל) זה תמיד false בלי קשר למה שהתקבל.
      await submitAnnotation({
        route, targetLabel: popover.label, comment, actionRequested: isAdmin && actionOn,
        secondaryTargets,
        attachment: attachment?.dataUrl || null, attachmentName: attachment?.name || null,
        drawing: popover.drawing || null,
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
          className={
            "dev-overlay-highlight" +
            (pickingSecondary ? " dev-overlay-highlight-secondary" : isJynxHover ? " dev-overlay-highlight-jynx" : "")
          }
          style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }}
        />
      )}
      {popover?.drawing && <DrawingOverlay drawing={popover.drawing} />}
      {popover && (
        <AnnotationPopover
          x={popover.x}
          y={popover.y}
          label={popover.label}
          secondaryTargets={popover.secondaryTargets}
          isAdmin={isAdmin}
          isJynxMeta={popover.isJynxMeta}
          hasDrawing={!!popover.drawing}
          onCancel={() => setPopover(null)}
          onSubmit={submit}
        />
      )}
      <AdminAnnotationMarkers isAdmin={isAdmin} canView={canJynxChrome} active={markersOn} route={route} refreshKey={markersRefreshKey} />
      <DrawingCanvas active={drawMode && !popover} onComplete={handleDrawingComplete} color={drawColor} />
    </div>,
    document.body
  );
}

const CSS = `
.jynx-drawing-live, .jynx-drawing-overlay{
  position:fixed; inset:0; width:100%; height:100%; pointer-events:none; z-index:99994;
}
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
.dev-overlay-highlight-secondary{
  border-color:#2F8FCE;
  box-shadow:0 0 0 3px color-mix(in srgb, #2F8FCE 28%, transparent),
             0 0 18px color-mix(in srgb, #2F8FCE 50%, transparent);
}
.dev-annotate-popover{
  position:fixed; z-index:100000; width:290px; background:var(--panel); border:1px solid var(--dev);
  border-radius:10px; padding:10px; display:flex; flex-direction:column; gap:8px; box-shadow:var(--shadow-md);
  animation:devAnnotateIn .12s ease;
}
@keyframes devAnnotateIn{ from{ opacity:0; transform:translateY(4px); } to{ opacity:1; transform:translateY(0); } }
.dev-annotate-popover-head{ display:flex; align-items:center; gap:6px; }
.dev-annotate-popover-grip{
  display:flex; align-items:center; flex:0 0 auto; color:var(--text-dim); cursor:grab; touch-action:none;
}
.dev-annotate-popover-grip:active{ cursor:grabbing; }
.dev-annotate-popover-grip:hover{ color:var(--dev); }
.dev-annotate-popover-label{
  flex:1; font-family:var(--font-mono); font-size:10.5px; color:var(--dev); text-transform:uppercase; letter-spacing:.04em;
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
.dev-annotate-popover-drawing-hint{
  font-size:11px; color:var(--jynx); background:color-mix(in srgb, var(--jynx) 12%, transparent);
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

.dev-annotate-relogin-link{
  background:none; border:none; color:var(--dev); font-weight:700; font-size:11px; text-decoration:underline;
  cursor:pointer; padding:0;
}
.dev-annotate-relogin-box{ display:flex; gap:6px; }
.dev-annotate-relogin-box input{
  flex:1; background:var(--bg); border:1px solid var(--line); border-radius:7px; padding:6px 8px;
  font-size:12px; color:var(--text); font-family:var(--font-sans);
}
.dev-annotate-relogin-box input:focus{ outline:none; border-color:var(--dev); }
.dev-annotate-relogin-box button{
  border:none; border-radius:7px; padding:6px 12px; font-family:var(--font-sans); font-weight:700; font-size:12px;
  cursor:pointer; background:var(--dev); color:#fff;
}
.dev-annotate-relogin-box button:disabled{ opacity:.5; cursor:not-allowed; }

/* רמז "עדיין בוחר יעדים" — תמיד גלוי כל עוד ה-popover פתוח (אין יותר כפתור
   "+ קשר אלמנט נוסף" נפרד — Ctrl/Cmd+קליק על אלמנט תקין בעמוד מוסיף תג
   לטקסט; קליק רגיל בלי Ctrl/Cmd עובר כרגיל לאפליקציה מתחת). */
.dev-annotate-picking-hint{
  font-size:11.5px; color:var(--dev); background:color-mix(in srgb, var(--dev) 10%, transparent);
  border-radius:6px; padding:5px 9px; animation:devAdminPulse 1.2s ease-in-out infinite;
}
@keyframes devAdminPulse{ 50%{ opacity:.55; } }

.dev-annotate-attachment-block{ display:flex; }
.dev-annotate-attachment-preview{
  display:flex; align-items:center; gap:7px; background:var(--bg); border:1px solid var(--line);
  border-radius:7px; padding:5px 8px; max-width:100%;
}
.dev-annotate-attachment-preview img{
  width:32px; height:32px; object-fit:cover; border-radius:5px; flex:none;
}
.dev-annotate-attachment-file{
  display:inline-flex; align-items:center; gap:5px; font-size:11.5px; color:var(--text-dim);
  overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
}
.dev-annotate-attachment-preview button{
  background:none; border:none; color:var(--text-dim); cursor:pointer; font-size:14px; line-height:1;
  padding:0; margin-inline-start:auto; flex:none;
}
.dev-annotate-attachment-preview button:hover{ color:var(--red); }
`;
