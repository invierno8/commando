import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Zap, Loader2, GitPullRequest, CheckCircle2, XCircle } from "lucide-react";
import { fetchAnnotations, requestAnnotationAction } from "../devApi.js";
import { useKeepInViewport } from "../useKeepInViewport.js";

/* ================================================================== */
/* LEGO BLOCK — admin-only, always-on (not hover-triggered) indicator    */
/* for every open comment on the current screen. Originally an always-   */
/* visible dashed border + floating text banner per comment — dropped    */
/* for a small colored dot instead (same corner-badge idea as            */
/* CommentsPanel.jsx's CommentDot, but status-colored and click-to-open   */
/* rather than hover-only, since this one also carries the action        */
/* trigger). One dot per element, grouped by targetLabel — an element    */
/* with several open comments gets one dot with a count, not several     */
/* overlapping badges.                                                    */
/*                                                                        */
/* Dot color = the most urgent status among that element's comments:      */
/*  failed (red-orange) > queued/in_progress (jynx purple, pulsing) >     */
/*  none (red, unactioned) > pr_opened/done (green, code-side complete).  */
/* Clicking a dot opens a small detail card listing each comment, its     */
/* status, and (for unactioned ones) the "Action" trigger — replacing     */
/* what used to always be visible on the page.                            */
/* ================================================================== */

const STATUS_COLOR = { none: "var(--red)", queued: "var(--jynx)", in_progress: "var(--jynx)", pr_opened: "var(--green)", done: "var(--green)", failed: "var(--dev)" };
const STATUS_ICON = { queued: Loader2, in_progress: Loader2, pr_opened: GitPullRequest, done: CheckCircle2, failed: XCircle };
// סדר-עדיפות לצביעת הנקודה כשכמה הערות עם סטטוסים שונים חולקות אלמנט אחד —
// "נכשל" קודם לכל (דורש תשומת לב), אחריו "בתהליך" (קורה עכשיו, כדאי לדעת),
// אחריו "לא טופל" (ממתין להחלטה), ולבסוף "PR/בוצע" (הכי פחות דחוף).
const STATUS_PRIORITY = { failed: 0, queued: 1, in_progress: 1, none: 2, pr_opened: 3, done: 3 };

function groupStatus(list) {
  return list.reduce((best, a) => {
    const s = a.actionStatus || "none";
    return STATUS_PRIORITY[s] < STATUS_PRIORITY[best] ? s : best;
  }, "done");
}

export default function AdminAnnotationMarkers({ isAdmin, route, refreshKey }) {
  const [items, setItems] = useState([]);
  const [tick, setTick] = useState(0);
  const [openLabel, setOpenLabel] = useState(null);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    fetchAnnotations().then((all) => {
      if (cancelled) return;
      setItems(all.filter((a) => !a.resolved && a.route === route && a.targetLabel));
    });
    return () => { cancelled = true; };
  }, [isAdmin, route, refreshKey]);

  useEffect(() => {
    if (!isAdmin) return;
    function onLayoutChange() { setTick((t) => t + 1); }
    window.addEventListener("scroll", onLayoutChange, true);
    window.addEventListener("resize", onLayoutChange);
    const id = setInterval(onLayoutChange, 1500); // תופס גם שינויי layout שלא קשורים לגלילה/resize
    return () => {
      window.removeEventListener("scroll", onLayoutChange, true);
      window.removeEventListener("resize", onLayoutChange);
      clearInterval(id);
    };
  }, [isAdmin]);

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
    if (!isAdmin) return [];
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
  }, [items, tick, isAdmin]);

  async function triggerAction(id) {
    setItems((prev) => prev.map((a) => (a.id === id ? { ...a, actionStatus: "queued" } : a)));
    await requestAnnotationAction(id);
  }

  if (!isAdmin || grouped.length === 0) return null;

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
  const status = groupStatus(list);
  const color = STATUS_COLOR[status];
  const pulsing = status === "queued" || status === "in_progress";
  const detailRef = useRef(null);
  useKeepInViewport(detailRef, open, 8, [list.length]);

  return (
    <div className="admin-marker-dot-wrap" style={{ top: rect.top - 8, left: rect.left + rect.width - 8 }}>
      <button
        type="button"
        className={"admin-marker-dot" + (pulsing ? " pulsing" : "")}
        style={{ background: color }}
        onClick={onToggle}
        title={`${list.length} open comment${list.length > 1 ? "s" : ""} — click for details`}
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
                    {a.actionStatus === "failed" ? "Failed" : a.actionStatus === "in_progress" ? "In progress" : a.actionStatus === "queued" ? "Queued" : a.actionStatus === "pr_opened" ? "PR opened" : a.actionStatus === "done" ? "Done" : "Open"}
                  </span>
                  {a.actionPrUrl && (
                    <a href={a.actionPrUrl} target="_blank" rel="noreferrer" className="admin-marker-detail-pr">View PR</a>
                  )}
                </div>
                <p className="admin-marker-detail-comment">{a.comment}</p>
                <span className="admin-marker-detail-meta">{a.authorName}</span>
                {!hasAction && (
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
  );
}

const CSS_TEXT = `
.admin-marker-dot-wrap{ position:fixed; z-index:99998; }
.admin-marker-dot{
  width:18px; height:18px; border-radius:50%; border:2px solid var(--panel); color:#fff;
  display:flex; align-items:center; justify-content:center; font-size:10px; font-weight:700;
  box-shadow:var(--shadow-sm); cursor:pointer; font-family:var(--font-sans); padding:0;
}
.admin-marker-dot.pulsing{ animation:adminMarkerPulse 1.4s ease-in-out infinite; }
@keyframes adminMarkerPulse{
  0%, 100% { box-shadow:0 0 0 0 color-mix(in srgb, var(--jynx) 55%, transparent); }
  50% { box-shadow:0 0 0 6px color-mix(in srgb, var(--jynx) 0%, transparent); }
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
.admin-marker-detail-meta{ font-size:10px; color:var(--text-dim); }
.admin-marker-action-btn{
  align-self:flex-start; display:inline-flex; align-items:center; gap:4px; background:var(--jynx); color:#fff;
  border:none; border-radius:12px; padding:3px 9px; font-size:10.5px; font-weight:700; cursor:pointer;
}
.admin-marker-action-btn:hover{ filter:brightness(1.08); }
.admin-marker-spin{ animation:adminMarkerSpin 1s linear infinite; }
@keyframes adminMarkerSpin{ to{ transform:rotate(360deg); } }
`;
