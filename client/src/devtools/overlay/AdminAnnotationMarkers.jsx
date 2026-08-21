import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Zap, Loader2, GitPullRequest, CheckCircle2, XCircle } from "lucide-react";
import { fetchAnnotations, requestAnnotationAction } from "../devApi.js";

/* ================================================================== */
/* LEGO BLOCK — admin-only, always-on (not hover-triggered) markers on   */
/* the live page for every open comment on the current screen. A        */
/* different color from the hover-glow (red = needs attention, blue =   */
/* action already queued/running, green = PR opened) so it reads as a    */
/* distinct signal, not a repeat of the hover highlight. Each marker     */
/* carries a small "Action" trigger — clicking it queues the comment     */
/* for the automated cloud-agent routine (see FORCLAUDE.md).             */
/* ================================================================== */

const STATUS_COLOR = { none: "var(--red)", queued: "#2F8FCE", in_progress: "#2F8FCE", pr_opened: "var(--green)", done: "var(--green)", failed: "var(--red)" };
const STATUS_ICON = { queued: Loader2, in_progress: Loader2, pr_opened: GitPullRequest, done: CheckCircle2, failed: XCircle };

export default function AdminAnnotationMarkers({ isAdmin, route, refreshKey }) {
  const [items, setItems] = useState([]);
  const [tick, setTick] = useState(0);

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

  const placed = useMemo(() => {
    void tick; // תלות מכוונת — רק כדי לגרום לחישוב מחדש בטיק
    if (!isAdmin) return [];
    return items
      .map((a) => {
        const el = document.querySelector(`[data-devblock="${CSS.escape(a.targetLabel)}"]`);
        if (!el) return null;
        return { annotation: a, rect: el.getBoundingClientRect() };
      })
      .filter(Boolean);
  }, [items, tick, isAdmin]);

  async function triggerAction(id) {
    setItems((prev) => prev.map((a) => (a.id === id ? { ...a, actionStatus: "queued" } : a)));
    await requestAnnotationAction(id);
  }

  if (!isAdmin || placed.length === 0) return null;

  return createPortal(
    <div className="dev-overlay-ignore">
      <style>{CSS_TEXT}</style>
      {placed.map(({ annotation: a, rect }) => {
        const color = STATUS_COLOR[a.actionStatus] || STATUS_COLOR.none;
        const StatusIcon = STATUS_ICON[a.actionStatus];
        return (
          <div key={a.id} className="admin-marker" style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height, borderColor: color }}>
            <div className="admin-marker-badge" style={{ background: color }} title={`${a.authorName}: ${a.comment}`}>
              {StatusIcon ? <StatusIcon size={12} className={a.actionStatus === "queued" || a.actionStatus === "in_progress" ? "admin-marker-spin" : ""} /> : null}
              <span className="admin-marker-comment">{a.comment}</span>
              {(!a.actionStatus || a.actionStatus === "none") && (
                <button type="button" className="admin-marker-action-btn" onClick={() => triggerAction(a.id)} title="הפעל סוכן אוטומטי על ההערה הזו">
                  <Zap size={11} /> פעולה
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>,
    document.body
  );
}

const CSS_TEXT = `
.admin-marker{
  position:fixed; pointer-events:none; z-index:99998; border-radius:8px; border:2px dashed;
  transition:top .1s ease, left .1s ease, width .1s ease, height .1s ease;
}
.admin-marker-badge{
  position:absolute; top:-11px; right:8px; pointer-events:auto; display:flex; align-items:center; gap:6px;
  color:#fff; border-radius:20px; padding:4px 10px; font-family:var(--font-sans); font-size:11px; font-weight:700;
  box-shadow:var(--shadow-sm); max-width:280px;
}
.admin-marker-comment{ overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:170px; }
.admin-marker-action-btn{
  display:inline-flex; align-items:center; gap:3px; background:rgba(255,255,255,.22); border:none; border-radius:12px;
  padding:2px 8px; color:#fff; font-size:10.5px; font-weight:700; cursor:pointer; flex:none;
}
.admin-marker-action-btn:hover{ background:rgba(255,255,255,.35); }
.admin-marker-spin{ animation:adminMarkerSpin 1s linear infinite; }
@keyframes adminMarkerSpin{ to{ transform:rotate(360deg); } }
`;
