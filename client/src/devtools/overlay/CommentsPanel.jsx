import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { MessageSquare, ChevronDown, ChevronUp, GripVertical, CheckCircle2, MessageCircle } from "lucide-react";
import { fetchDevAnnotations, replyToAnnotation, fetchJynxFeedback, replyToJynxFeedback } from "../devApi.js";
import { useDraggableFab } from "../useDraggableFab.js";

/* ================================================================== */
/* LEGO BLOCK — "who commented on what, here" for EVERY dev user (not    */
/* admin-only, unlike AdminAnnotationMarkers.jsx which is the action-    */
/* management view). Three synced pieces sharing one fetch:              */
/*  1. Small dots on commented elements — hover an element's dot to      */
/*     reveal the comment(s) on it (hidden by default, so it doesn't      */
/*     clutter the page like admin's always-expanded markers).           */
/*  2. A draggable, collapsible side list of comments on the current      */
/*     route — Open/Done tabs, "just mine" toggle. Hovering a row         */
/*     outlines the matching page element in the Jynx brand color;        */
/*     clicking a row scrolls to and flashes it (jump-to-location).       */
/*  3. Reply threads per comment — any dev user can add a follow-up,      */
/*     so a resolved comment's author can react to the fix (or anyone     */
/*     can ask a clarifying question before it's resolved).               */
/* ================================================================== */

export default function CommentsPanel({ active, route, currentDevUserId, isAdmin, canJynxComment }) {
  const [items, setItems] = useState([]);
  const [statusFilter, setStatusFilter] = useState("open"); // open | done
  const [mineOnly, setMineOnly] = useState(false);
  const [hoveredListId, setHoveredListId] = useState(null);
  const [hoveredDotLabel, setHoveredDotLabel] = useState(null);
  const [flashId, setFlashId] = useState(null);
  const [openThreadId, setOpenThreadId] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const [tick, setTick] = useState(0);
  // עוגן שמאלי בכוונה — הצד ההפוך מאשכול הכפתורים הימני (הבועה/הסרגל/בורר
  // התפקיד), כדי שהמיקום ההתחלתי לא יתנגש איתם עוד לפני שגוררים משהו.
  const panelFab = useDraggableFab("jynx-comments-panel-pos", { left: 16, bottom: 76 }, "left");

  // מנהל, וכעת גם משתמש-פיתוח עם canJynxComment:true, רואים כאן גם משוב על
  // Jynx עצמו (תור נפרד לגמרי — jynx-feedback, ראו data/routes/jynx-feedback.js
  // ו-requireAdminOrJynxCommenter) — בלי זה, מי שכתב הערה דרך מצב "משוב
  // Jynx" (הילה סגולה, ראו DevOverlay.jsx) לא היה רואה אותה בכלל כאן, כי
  // היא לא באה מ-/dev/annotations. מסומנת kind:"jynx" להבחנה. השרת מחזיר
  // את כל הרשומות (לא רק שלי) בדיוק כמו הערות QA רגילות — סינון "Just me"
  // קורה כאן, בצד הלקוח (a.authorId === currentDevUserId למטה).
  const canSeeJynxFeedback = isAdmin || canJynxComment;
  function reload() {
    const appPromise = fetchDevAnnotations(route).then((d) => d.map((a) => ({ ...a, kind: "app" })));
    const jynxPromise = canSeeJynxFeedback
      ? fetchJynxFeedback().then((d) => d.filter((a) => a.route === route).map((a) => ({ ...a, kind: "jynx", authorName: a.authorName || "Admin" })))
      : Promise.resolve([]);
    Promise.all([appPromise, jynxPromise]).then(([app, jynx]) => setItems([...app, ...jynx]));
  }
  useEffect(() => {
    if (!active) return;
    reload();
    const t = setInterval(reload, 5000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, route, canSeeJynxFeedback]);

  useEffect(() => {
    if (!active) return;
    function onLayoutChange() { setTick((t) => t + 1); }
    window.addEventListener("scroll", onLayoutChange, true);
    window.addEventListener("resize", onLayoutChange);
    const id = setInterval(onLayoutChange, 1500);
    return () => {
      window.removeEventListener("scroll", onLayoutChange, true);
      window.removeEventListener("resize", onLayoutChange);
      clearInterval(id);
    };
  }, [active]);

  const grouped = useMemo(() => {
    void tick;
    const byLabel = new Map();
    items.filter((a) => !a.resolved).forEach((a) => {
      if (!a.targetLabel) return;
      if (!byLabel.has(a.targetLabel)) byLabel.set(a.targetLabel, []);
      byLabel.get(a.targetLabel).push(a);
    });
    const out = [];
    byLabel.forEach((list, label) => {
      const el = document.querySelector(`[data-devblock="${CSS.escape(label)}"]`);
      if (el) out.push({ label, list, rect: el.getBoundingClientRect() });
    });
    return out;
  }, [items, tick]);

  function rectFor(a) {
    if (!a?.targetLabel) return null;
    const el = document.querySelector(`[data-devblock="${CSS.escape(a.targetLabel)}"]`);
    return el ? { el, rect: el.getBoundingClientRect() } : null;
  }

  const hoveredRect = useMemo(() => {
    if (!hoveredListId) return null;
    void tick;
    return rectFor(items.find((x) => x.id === hoveredListId))?.rect || null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoveredListId, items, tick]);

  function jumpTo(a) {
    const found = rectFor(a);
    if (!found) return;
    found.el.scrollIntoView({ behavior: "smooth", block: "center" });
    setFlashId(a.id);
    window.setTimeout(() => setFlashId((f) => (f === a.id ? null : f)), 1600);
  }

  async function sendReply(a) {
    if (!replyText.trim()) return;
    if (a.kind === "jynx") await replyToJynxFeedback(a.id, replyText.trim());
    else await replyToAnnotation(a.id, replyText.trim());
    setReplyText("");
    reload();
  }

  if (!active) return null;

  const shown = items
    .filter((a) => (statusFilter === "open" ? !a.resolved : a.resolved))
    .filter((a) => !mineOnly || a.authorId === currentDevUserId);
  const flashRect = flashId ? rectFor(items.find((x) => x.id === flashId))?.rect : null;

  return createPortal(
    <div className="dev-overlay-ignore">
      <style>{CSS_TEXT}</style>

      {grouped.map(({ label, list, rect }) => (
        <CommentDot
          key={label}
          label={label}
          rect={rect}
          list={list}
          hovered={hoveredDotLabel === label}
          onHover={setHoveredDotLabel}
        />
      ))}

      {hoveredRect && (
        <div
          className="comments-panel-highlight"
          style={{ top: hoveredRect.top, left: hoveredRect.left, width: hoveredRect.width, height: hoveredRect.height }}
        />
      )}
      {flashRect && (
        <div
          className="comments-panel-highlight comments-panel-flash"
          style={{ top: flashRect.top, left: flashRect.left, width: flashRect.width, height: flashRect.height }}
        />
      )}

      <div className="comments-sidebar jynx-ui" style={{ left: panelFab.pos.left, bottom: panelFab.pos.bottom }}>
        <div className="comments-sidebar-head">
          <span className="comments-sidebar-grip" {...panelFab.dragHandlers} title="Drag to move"><GripVertical size={13} /></span>
          <span className="comments-sidebar-title"><MessageSquare size={13} /> Comments</span>
          <button type="button" className="comments-sidebar-collapse" onClick={() => setCollapsed((v) => !v)} title={collapsed ? "Expand" : "Collapse"}>
            {collapsed ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </div>
        {!collapsed && (
          <>
            <div className="comments-sidebar-filters">
              <div className="pill-tabs">
                <button type="button" className={"pill-tab" + (statusFilter === "open" ? " active" : "")} onClick={() => setStatusFilter("open")}>Open</button>
                <button type="button" className={"pill-tab" + (statusFilter === "done" ? " active" : "")} onClick={() => setStatusFilter("done")}>Done</button>
              </div>
              <button type="button" className={"comments-mine-toggle" + (mineOnly ? " active" : "")} onClick={() => setMineOnly((v) => !v)}>Just me</button>
            </div>
            {shown.length === 0 && <div className="comments-sidebar-empty">No {statusFilter} comments on this screen.</div>}
            <div className="comments-sidebar-list">
              {shown.map((a) => {
                const replies = a.replies || [];
                return (
                  <div key={a.id} className="comments-sidebar-item-wrap">
                    <div
                      className="comments-sidebar-item"
                      onMouseEnter={() => setHoveredListId(a.id)}
                      onMouseLeave={() => setHoveredListId((h) => (h === a.id ? null : h))}
                      onClick={() => jumpTo(a)}
                    >
                      {a.targetLabel && (
                        <span className="comments-sidebar-item-target">
                          {a.kind === "jynx" && <span className="comments-jynx-badge">🔮 Jynx</span>}
                          {a.targetLabel}
                          {a.resolved && <span className="comments-done-badge"><CheckCircle2 size={10} /> Done</span>}
                        </span>
                      )}
                      <p className="comments-sidebar-item-comment">{a.comment}</p>
                      <span className="comments-sidebar-item-meta">{a.authorName} · {new Date(a.createdAt).toLocaleString("en-US")}</span>
                      {a.resolved && a.resolutionNote && (
                        <div className="comments-resolution-note"><CheckCircle2 size={11} /> {a.resolutionNote}</div>
                      )}
                    </div>
                    <button
                      type="button" className="comments-thread-toggle"
                      onClick={(e) => { e.stopPropagation(); setOpenThreadId(openThreadId === a.id ? null : a.id); }}
                    >
                      <MessageCircle size={11} /> {replies.length > 0 ? `${replies.length} repl${replies.length === 1 ? "y" : "ies"}` : "Reply"}
                    </button>
                    {openThreadId === a.id && (
                      <div className="comments-thread" onClick={(e) => e.stopPropagation()}>
                        {replies.map((r) => (
                          <div key={r.id} className="comments-thread-item"><b>{r.authorName}:</b> {r.text}</div>
                        ))}
                        <div className="comments-thread-input">
                          <input value={replyText} placeholder="Write a reply..." onChange={(e) => setReplyText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendReply(a)} />
                          <button type="button" onClick={() => sendReply(a)} disabled={!replyText.trim()}>Send</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}

function CommentDot({ label, rect, list, hovered, onHover }) {
  return (
    <div
      className="comments-dot-wrap"
      style={{ top: rect.top - 6, left: rect.left + rect.width - 6 }}
      onMouseEnter={() => onHover(label)}
      onMouseLeave={() => onHover(null)}
    >
      <div className="comments-dot">{list.length > 1 ? list.length : ""}</div>
      {hovered && (
        <div className="comments-dot-tooltip">
          {list.map((a) => (
            <div key={a.id} className="comments-dot-tooltip-item">
              <b>{a.authorName}:</b> {a.comment}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const CSS_TEXT = `
.comments-dot-wrap{ position:fixed; z-index:99997; pointer-events:auto; }
.comments-dot{
  width:18px; height:18px; border-radius:50%; background:var(--jynx); color:#fff; border:2px solid var(--panel);
  display:flex; align-items:center; justify-content:center; font-size:10px; font-weight:700; box-shadow:var(--shadow-sm);
  cursor:default;
}
.comments-dot-tooltip{
  position:absolute; top:22px; left:0; width:240px; background:var(--panel); border:1px solid var(--jynx);
  border-radius:9px; padding:8px 10px; box-shadow:var(--shadow-md); display:flex; flex-direction:column; gap:6px;
  font-size:12px; color:var(--text); animation:devAnnotateIn .12s ease;
}
.comments-dot-tooltip-item b{ color:var(--jynx); }

.comments-panel-highlight{
  position:fixed; pointer-events:none; z-index:99996; border-radius:8px; border:2px solid var(--dev);
  box-shadow:0 0 0 3px color-mix(in srgb, var(--dev) 28%, transparent),
             0 0 18px color-mix(in srgb, var(--dev) 50%, transparent);
  transition:top .1s ease, left .1s ease, width .1s ease, height .1s ease;
}
.comments-panel-flash{
  border-color:var(--jynx); animation:commentsFlash 1.6s ease;
}
@keyframes commentsFlash{
  0%, 100% { box-shadow:0 0 0 3px color-mix(in srgb, var(--jynx) 28%, transparent), 0 0 18px color-mix(in srgb, var(--jynx) 50%, transparent); }
  50% { box-shadow:0 0 0 8px color-mix(in srgb, var(--jynx) 45%, transparent), 0 0 28px color-mix(in srgb, var(--jynx) 70%, transparent); }
}

.comments-sidebar{
  position:fixed; width:280px; max-height:calc(100vh - 100px); z-index:79;
  background:var(--panel); border:1px solid var(--line); border-radius:12px; box-shadow:var(--shadow-md);
  display:flex; flex-direction:column; overflow:hidden;
}
.comments-sidebar-head{ padding:8px 10px; border-bottom:1px solid var(--line); display:flex; align-items:center; gap:6px; }
.comments-sidebar-grip{ display:flex; align-items:center; color:var(--text-dim); cursor:grab; touch-action:none; }
.comments-sidebar-grip:active{ cursor:grabbing; }
.comments-sidebar-title{ display:flex; align-items:center; gap:6px; font-size:12.5px; font-weight:700; color:var(--jynx); flex:1; }
.comments-sidebar-collapse{ background:none; border:none; color:var(--text-dim); cursor:pointer; display:flex; }
.comments-sidebar-collapse:hover{ color:var(--jynx); }
.comments-sidebar-filters{ padding:8px 10px 0; display:flex; align-items:center; justify-content:space-between; gap:8px; }
.comments-mine-toggle{
  background:none; border:1px solid var(--line); color:var(--text-dim); border-radius:14px; padding:3px 9px;
  font-size:10.5px; font-weight:700; cursor:pointer;
}
.comments-mine-toggle.active{ background:var(--jynx); border-color:var(--jynx); color:#fff; }
.comments-sidebar-empty{ padding:16px 12px; font-size:12px; color:var(--text-dim); text-align:center; }
.comments-sidebar-list{ overflow-y:auto; display:flex; flex-direction:column; }
.comments-sidebar-item-wrap{ border-bottom:1px solid var(--line); padding:2px 0; }
.comments-sidebar-item{ padding:9px 12px 2px; cursor:pointer; }
.comments-sidebar-item:hover{ background:color-mix(in srgb, var(--jynx) 8%, transparent); }
.comments-sidebar-item-target{ font-family:var(--font-mono); font-size:10px; color:var(--jynx); text-transform:uppercase; display:flex; align-items:center; gap:6px; }
.comments-sidebar-item-comment{ margin:2px 0; font-size:12.5px; color:var(--text); }
.comments-sidebar-item-meta{ font-size:10.5px; color:var(--text-dim); }
.comments-done-badge{ display:inline-flex; align-items:center; gap:2px; color:var(--green); font-size:9.5px; text-transform:none; }
.comments-jynx-badge{
  display:inline-flex; align-items:center; background:color-mix(in srgb, var(--dev) 15%, transparent);
  color:var(--dev); font-size:9px; font-weight:700; text-transform:none; border-radius:8px; padding:1px 6px;
}
.comments-resolution-note{
  display:flex; align-items:flex-start; gap:4px; font-size:11px; color:var(--green);
  background:color-mix(in srgb, var(--green) 10%, transparent); border-radius:6px; padding:4px 7px; margin:4px 0;
}
.comments-thread-toggle{
  display:inline-flex; align-items:center; gap:4px; background:none; border:none; color:var(--text-dim);
  font-size:10.5px; cursor:pointer; padding:2px 12px 8px;
}
.comments-thread-toggle:hover{ color:var(--jynx); }
.comments-thread{ display:flex; flex-direction:column; gap:5px; background:var(--bg); border-radius:8px; padding:7px; margin:0 12px 9px; }
.comments-thread-item{ font-size:11px; color:var(--text); }
.comments-thread-item b{ color:var(--jynx); }
.comments-thread-input{ display:flex; gap:5px; }
.comments-thread-input input{
  flex:1; background:var(--panel); border:1px solid var(--line); border-radius:7px; padding:5px 8px; font-size:11.5px; color:var(--text);
}
.comments-thread-input button{
  background:var(--jynx); color:#fff; border:none; border-radius:7px; padding:5px 10px; font-size:11px; font-weight:700; cursor:pointer;
}
.comments-thread-input button:disabled{ opacity:.5; cursor:not-allowed; }
`;
