import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Zap, Loader2, GitPullRequest, CheckCircle2, XCircle } from "lucide-react";
import { fetchAnnotations, requestAnnotationAction } from "../devApi.js";
import { useKeepInViewport } from "../useKeepInViewport.js";
import DrawingOverlay from "./DrawingOverlay.jsx";

/* ================================================================== */
/* LEGO BLOCK — admin-only, always-on (not hover-triggered) indicator    */
/* for every comment (open OR resolved) on the current screen. One dot   */
/* per element, grouped by targetLabel. Three interaction tiers:         */
/*  - idle: small, quiet — doesn't clutter the page.                     */
/*  - hover: grows, and the main element + any secondary/linked          */
/*    elements from that group's comments outline on the live page       */
/*    (same jynx-purple/dev-amber split CommentsPanel.jsx uses for       */
/*    primary vs. secondary), so you see what a comment is actually      */
/*    pointing at without opening anything.                              */
/*  - click: opens the detail card (comment text, status, "Action"/      */
/*    "View PR" as relevant) — same as before, just reached differently. */
/* A group with only resolved comments (nothing open) renders as a       */
/* smaller, static, unanimated dot — kept visible as a quiet history      */
/* marker rather than disappearing outright once closed.                 */
/* Gated on two independent things: isAdmin (who can ever see this) and   */
/* `active` (the toolbar's dedicated show/hide toggle, see                */
/* DevAuthGate.jsx's "Target" icon — separate from the hover-glow         */
/* overlay toggle, since someone might want one without the other).       */
/* ================================================================== */

const STATUS_COLOR = { none: "var(--red)", queued: "var(--jynx)", in_progress: "var(--jynx)", pr_opened: "var(--green)", done: "var(--green)", failed: "var(--dev)" };
const STATUS_ICON = { queued: Loader2, in_progress: Loader2, pr_opened: GitPullRequest, done: CheckCircle2, failed: XCircle };
// סדר-עדיפות לצביעת הנקודה כשכמה הערות עם סטטוסים שונים חולקות אלמנט אחד —
// "נכשל" קודם לכל (דורש תשומת לב), אחריו "בתהליך" (קורה עכשיו, כדאי לדעת),
// אחריו "לא טופל" (ממתין להחלטה), ולבסוף "PR/בוצע" (הכי פחות דחוף).
const STATUS_PRIORITY = { failed: 0, queued: 1, in_progress: 1, none: 2, pr_opened: 3, done: 3 };
// אנימציה ייחודית לכל סטטוס — לא רק "פועם/לא" אחיד, כדי שהמצב יהיה קריא
// ממבט חטוף גם בלי לקרוא טקסט: אדום נושם לאט (ממתין, לא דחוף), סגול-jynx
// דופק מהר (קורה עכשיו), ענבר מרעיד (נכשל, דורש תשומת לב), ירוק זוהר לאט
// (גמור, אין למה למהר).
const STATUS_ANIM = { none: "marker-anim-none", queued: "marker-anim-active", in_progress: "marker-anim-active", failed: "marker-anim-failed", pr_opened: "marker-anim-done", done: "marker-anim-done" };

function groupStatus(list) {
  return list.reduce((best, a) => {
    const s = a.actionStatus || "none";
    return STATUS_PRIORITY[s] < STATUS_PRIORITY[best] ? s : best;
  }, "done");
}

export default function AdminAnnotationMarkers({ isAdmin, active, route, refreshKey }) {
  const [items, setItems] = useState([]);
  const [tick, setTick] = useState(0);
  const [openLabel, setOpenLabel] = useState(null);

  useEffect(() => {
    if (!isAdmin || !active) return;
    let cancelled = false;
    // כל ההערות על המסך הזה, לא רק הפתוחות — כדי שגם הערות שנסגרו יישארו
    // כנקודת-היסטוריה קטנה (ראו קיבוץ groupStatus/allResolved למטה), לא
    // ייעלמו לגמרי ברגע שהן resolved.
    fetchAnnotations().then((all) => {
      if (cancelled) return;
      setItems(all.filter((a) => a.route === route && a.targetLabel));
    });
    return () => { cancelled = true; };
  }, [isAdmin, active, route, refreshKey]);

  useEffect(() => {
    if (!isAdmin || !active) return;
    function onLayoutChange() { setTick((t) => t + 1); }
    window.addEventListener("scroll", onLayoutChange, true);
    window.addEventListener("resize", onLayoutChange);
    const id = setInterval(onLayoutChange, 1500); // תופס גם שינויי layout שלא קשורים לגלילה/resize
    return () => {
      window.removeEventListener("scroll", onLayoutChange, true);
      window.removeEventListener("resize", onLayoutChange);
      clearInterval(id);
    };
  }, [isAdmin, active]);

  // סוגר את הכרטיס הפתוח בכל קליק מחוץ לנקודות/לכרטיס עצמו — בלי זה הוא
  // היה נשאר פתוח לתמיד עד קליק נוסף על אותה נקודה בדיוק.
  useEffect(() => {
    if (!openLabel) return;
    function onDocClick(e) {
      if (!e.target.closest?.(".admin-marker-dot-wrap")) setOpenLabel(null);
    }
    window.addEventListener("click", onDocClick, true);
    return () => window.removeEventListener("click", onDocClick, true);
  }, [openLabel]);

  const grouped = useMemo(() => {
    void tick; // תלות מכוונת — רק כדי לגרום לחישוב מחדש בטיק
    if (!isAdmin || !active) return [];
    const byLabel = new Map();
    items.forEach((a) => {
      if (!byLabel.has(a.targetLabel)) byLabel.set(a.targetLabel, []);
      byLabel.get(a.targetLabel).push(a);
    });
    const out = [];
    byLabel.forEach((list, label) => {
      const el = document.querySelector(`[data-devblock="${CSS.escape(label)}"]`);
      if (el) out.push({ label, list, rect: el.getBoundingClientRect() });
    });
    return out;
  }, [items, tick, isAdmin, active]);

  async function triggerAction(id) {
    setItems((prev) => prev.map((a) => (a.id === id ? { ...a, actionStatus: "queued" } : a)));
    await requestAnnotationAction(id);
  }

  if (!isAdmin || !active || grouped.length === 0) return null;

  return createPortal(
    <div className="dev-overlay-ignore">
      <style>{CSS_TEXT}</style>
      {grouped.map(({ label, list, rect }) => (
        <AdminMarkerDot
          key={label}
          label={label}
          list={list}
          rect={rect}
          open={openLabel === label}
          onToggle={() => setOpenLabel((cur) => (cur === label ? null : label))}
          onAction={triggerAction}
        />
      ))}
    </div>,
    document.body
  );
}

function AdminMarkerDot({ label, list, rect, open, onToggle, onAction }) {
  const openItems = list.filter((a) => !a.resolved);
  const allResolved = openItems.length === 0;
  const status = groupStatus(allResolved ? list : openItems);
  const color = STATUS_COLOR[status];
  const anim = allResolved ? "" : STATUS_ANIM[status];
  const [hovered, setHovered] = useState(false);
  const detailRef = useRef(null);
  useKeepInViewport(detailRef, open, 8, [list.length]);

  // יעדים משניים לצורך ההילה בהובר — איחוד secondaryTargets מכל ההערות
  // בקבוצה הזו (יכולות להיות כמה הערות שונות על אותו אלמנט, כל אחת עם
  // יעדים משניים משלה), מחושב רק כשבאמת מרחפים, לא בכל רינדור.
  const secondaryRects = useMemo(() => {
    if (!hovered) return [];
    const labels = [...new Set(list.flatMap((a) => a.secondaryTargets || []))];
    return labels
      .map((l) => document.querySelector(`[data-devblock="${CSS.escape(l)}"]`))
      .filter(Boolean)
      .map((el) => el.getBoundingClientRect());
  }, [hovered, list]);

  return (
    <>
      {hovered && (
        <>
          <div
            className="admin-marker-highlight"
            style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }}
          />
          {secondaryRects.map((r, i) => (
            <div
              key={i}
              className="admin-marker-highlight admin-marker-highlight-secondary"
              style={{ top: r.top, left: r.left, width: r.width, height: r.height }}
            />
          ))}
          {list.filter((a) => a.drawing).map((a) => <DrawingOverlay key={a.id} drawing={a.drawing} />)}
        </>
      )}
      <div
        className="admin-marker-dot-wrap"
        style={{ top: rect.top - 8, left: rect.left + rect.width - 8 }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <button
          type="button"
          className={"admin-marker-dot" + (anim ? " " + anim : "") + (allResolved ? " admin-marker-dot-quiet" : "") + ((hovered || open) ? " admin-marker-dot-grown" : "")}
          style={{ background: color }}
          onClick={onToggle}
          title={`${list.length} comment${list.length > 1 ? "s" : ""}${allResolved ? " (resolved)" : ""} — click for details`}
        >
          {list.length > 1 ? list.length : ""}
        </button>
        {open && (
          <div ref={detailRef} className="admin-marker-detail jynx-ui">
            {list.map((a) => {
              const StatusIcon = STATUS_ICON[a.actionStatus];
              const hasAction = a.actionStatus && a.actionStatus !== "none";
              return (
                <div key={a.id} className="admin-marker-detail-item">
                  <div className="admin-marker-detail-head">
                    <span className="admin-marker-detail-status" style={{ color: STATUS_COLOR[a.actionStatus || "none"] }}>
                      {StatusIcon && <StatusIcon size={11} className={a.actionStatus === "queued" || a.actionStatus === "in_progress" ? "admin-marker-spin" : ""} />}
                      {a.resolved ? "Resolved" : a.actionStatus === "failed" ? "Failed" : a.actionStatus === "in_progress" ? "In progress" : a.actionStatus === "queued" ? "Queued" : a.actionStatus === "pr_opened" ? "PR opened" : a.actionStatus === "done" ? "Done" : "Open"}
                    </span>
                    {a.actionPrUrl && (
                      <a href={a.actionPrUrl} target="_blank" rel="noreferrer" className="admin-marker-detail-pr">View PR</a>
                    )}
                  </div>
                  <p className="admin-marker-detail-comment">{a.comment}</p>
                  {a.drawing && <span className="admin-marker-detail-drawing">✏️ has a drawing — hover the dot to see it</span>}
                  <span className="admin-marker-detail-meta">{a.authorName}</span>
                  {!hasAction && !a.resolved && (
                    <button type="button" className="admin-marker-action-btn" onClick={() => onAction(a.id)} title="Run the automated agent on this comment">
                      <Zap size={11} /> Action
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

const CSS_TEXT = `
.admin-marker-highlight{
  position:fixed; pointer-events:none; z-index:99995; border-radius:8px; border:2px solid var(--jynx);
  box-shadow:0 0 0 3px color-mix(in srgb, var(--jynx) 28%, transparent),
             0 0 18px color-mix(in srgb, var(--jynx) 50%, transparent);
  transition:top .1s ease, left .1s ease, width .1s ease, height .1s ease;
}
.admin-marker-highlight-secondary{
  border-color:var(--dev);
  box-shadow:0 0 0 3px color-mix(in srgb, var(--dev) 28%, transparent),
             0 0 18px color-mix(in srgb, var(--dev) 50%, transparent);
}
.admin-marker-dot-wrap{ position:fixed; z-index:99998; }
.admin-marker-dot{
  width:11px; height:11px; border-radius:50%; border:2px solid var(--panel); color:#fff;
  display:flex; align-items:center; justify-content:center; font-size:9px; font-weight:700;
  box-shadow:var(--shadow-sm); cursor:pointer; font-family:var(--font-sans); padding:0;
  transition:width .14s ease, height .14s ease, transform .14s ease;
}
.admin-marker-dot-grown{ width:19px; height:19px; font-size:10px; transform:translate(-4px,-4px); }
.admin-marker-dot-quiet{ opacity:.5; }
/* אדום, "ממתין" — נשימה איטית, לא דחוף. */
.marker-anim-none{ animation:markerBreatheNone 2.6s ease-in-out infinite; }
@keyframes markerBreatheNone{
  0%, 100% { box-shadow:0 0 0 0 color-mix(in srgb, var(--red) 45%, transparent); }
  50% { box-shadow:0 0 0 5px color-mix(in srgb, var(--red) 0%, transparent); }
}
/* סגול-jynx, "קורה עכשיו" — דופק מהר יותר, ה"קסם". בכוונה רק box-shadow, לא
   transform: הגדילה-בהובר (admin-marker-dot-grown) כבר משתמשת ב-transform,
   ושתי הגדרות transform על אותו אלמנט לא מצטרפות אלא דורסות זו את זו —
   ניסיון קודם עם scale() כאן גרם לנקודה "לקפוץ" כל עוד שתיהן פעילות ביחד
   (וגם נתפס כ"לא יציב" ע"י בדיקת stability של Playwright בבדיקה שהרצתי). */
.marker-anim-active{ animation:markerPulseActive 1.1s ease-in-out infinite; }
@keyframes markerPulseActive{
  0%, 100% { box-shadow:0 0 0 0 color-mix(in srgb, var(--jynx) 60%, transparent); }
  50% { box-shadow:0 0 0 6px color-mix(in srgb, var(--jynx) 0%, transparent); }
}
/* ענבר, "נכשל" — הבהוב חד וקצבי (לא תזוזה — אותה סיבה כמו למעלה), קצב מהיר
   ובולט יותר מהנשימה האיטית של "none", כדי לתפוס עין בלי להיות מעצבן. */
.marker-anim-failed{ animation:markerFlickerFailed .9s ease-in-out infinite; }
@keyframes markerFlickerFailed{
  0%, 100% { box-shadow:0 0 0 0 color-mix(in srgb, var(--dev) 70%, transparent); opacity:1; }
  50% { box-shadow:0 0 0 5px color-mix(in srgb, var(--dev) 0%, transparent); opacity:.75; }
}
/* ירוק, "גמור" — זוהר איטי, בלי מתח. */
.marker-anim-done{ animation:markerGlowDone 2.4s ease-in-out infinite; }
@keyframes markerGlowDone{
  0%, 100% { box-shadow:0 0 0 0 color-mix(in srgb, var(--green) 40%, transparent); }
  50% { box-shadow:0 0 6px 2px color-mix(in srgb, var(--green) 35%, transparent); }
}
.admin-marker-detail{
  position:absolute; top:22px; left:0; width:250px; max-width:70vw; max-height:60vh; overflow-y:auto;
  background:var(--panel); border:1px solid var(--jynx); border-radius:10px; padding:8px;
  display:flex; flex-direction:column; gap:8px; box-shadow:var(--shadow-md); animation:devAnnotateIn .12s ease;
}
.admin-marker-detail-item{ display:flex; flex-direction:column; gap:3px; }
.admin-marker-detail-item + .admin-marker-detail-item{ border-top:1px solid var(--line); padding-top:8px; }
.admin-marker-detail-head{ display:flex; align-items:center; justify-content:space-between; gap:6px; }
.admin-marker-detail-status{ display:inline-flex; align-items:center; gap:4px; font-size:10.5px; font-weight:700; text-transform:uppercase; letter-spacing:.02em; }
.admin-marker-detail-pr{ font-size:10.5px; color:var(--jynx); text-decoration:underline; }
.admin-marker-detail-comment{ margin:0; font-size:12px; color:var(--text); }
.admin-marker-detail-drawing{ font-size:10.5px; color:var(--jynx); }
.admin-marker-detail-meta{ font-size:10px; color:var(--text-dim); }
.admin-marker-action-btn{
  align-self:flex-start; display:inline-flex; align-items:center; gap:4px; background:var(--jynx); color:#fff;
  border:none; border-radius:12px; padding:3px 9px; font-size:10.5px; font-weight:700; cursor:pointer;
}
.admin-marker-action-btn:hover{ filter:brightness(1.08); }
.admin-marker-spin{ animation:adminMarkerSpin 1s linear infinite; }
@keyframes adminMarkerSpin{ to{ transform:rotate(360deg); } }
`;
