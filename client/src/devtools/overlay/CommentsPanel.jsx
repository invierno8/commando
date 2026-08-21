import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { MessageSquare } from "lucide-react";
import { fetchDevAnnotations } from "../devApi.js";

/* ================================================================== */
/* LEGO BLOCK — "who commented on what, here" for EVERY dev user (not    */
/* admin-only, unlike AdminAnnotationMarkers.jsx which is the action-    */
/* management view). Two synced pieces sharing one fetch:                */
/*  1. Small dots on commented elements — hover an element's dot to      */
/*     reveal the comment(s) on it (hidden by default, so it doesn't      */
/*     clutter the page like admin's always-expanded markers).           */
/*  2. A side list of every open comment on the current route, with a    */
/*     "הכל / רק אני" filter. Hovering a list row outlines the matching   */
/*     page element in the Jynx brand color (not the amber creation-      */
/*     glow) — this is a viewing aid, not the annotate flow.             */
/* ================================================================== */

export default function CommentsPanel({ active, route, currentDevUserId }) {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState("all"); // all | mine
  const [hoveredListId, setHoveredListId] = useState(null);
  const [hoveredDotLabel, setHoveredDotLabel] = useState(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    function reload() {
      fetchDevAnnotations(route).then((d) => { if (!cancelled) setItems(d); });
    }
    reload();
    const t = setInterval(reload, 5000);
    return () => { cancelled = true; clearInterval(t); };
  }, [active, route]);

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
    items.forEach((a) => {
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

  const hoveredRect = useMemo(() => {
    if (!hoveredListId) return null;
    const a = items.find((x) => x.id === hoveredListId);
    if (!a?.targetLabel) return null;
    void tick;
    const el = document.querySelector(`[data-devblock="${CSS.escape(a.targetLabel)}"]`);
    return el ? el.getBoundingClientRect() : null;
  }, [hoveredListId, items, tick]);

  if (!active) return null;

  const shown = filter === "mine" ? items.filter((a) => a.authorId === currentDevUserId) : items;

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

      <div className="comments-sidebar">
        <div className="comments-sidebar-head">
          <span className="comments-sidebar-title"><MessageSquare size={13} /> הערות על המסך</span>
          <div className="pill-tabs">
            <button type="button" className={"pill-tab" + (filter === "all" ? " active" : "")} onClick={() => setFilter("all")}>הכל</button>
            <button type="button" className={"pill-tab" + (filter === "mine" ? " active" : "")} onClick={() => setFilter("mine")}>רק אני</button>
          </div>
        </div>
        {shown.length === 0 && <div className="comments-sidebar-empty">אין הערות פתוחות במסך הזה.</div>}
        <div className="comments-sidebar-list">
          {shown.map((a) => (
            <div
              key={a.id}
              className="comments-sidebar-item"
              onMouseEnter={() => setHoveredListId(a.id)}
              onMouseLeave={() => setHoveredListId((h) => (h === a.id ? null : h))}
            >
              {a.targetLabel && <span className="comments-sidebar-item-target">{a.targetLabel}</span>}
              <p className="comments-sidebar-item-comment">{a.comment}</p>
              <span className="comments-sidebar-item-meta">{a.authorName} · {new Date(a.createdAt).toLocaleString("he-IL")}</span>
            </div>
          ))}
        </div>
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
  position:fixed; pointer-events:none; z-index:99996; border-radius:8px; border:2px solid var(--jynx);
  box-shadow:0 0 0 3px color-mix(in srgb, var(--jynx) 28%, transparent),
             0 0 18px color-mix(in srgb, var(--jynx) 50%, transparent);
  transition:top .1s ease, left .1s ease, width .1s ease, height .1s ease;
}

.comments-sidebar{
  position:fixed; top:76px; left:16px; width:270px; max-height:calc(100vh - 100px); z-index:79;
  background:var(--panel); border:1px solid var(--line); border-radius:12px; box-shadow:var(--shadow-md);
  display:flex; flex-direction:column; overflow:hidden;
}
.comments-sidebar-head{ padding:10px 12px; border-bottom:1px solid var(--line); display:flex; flex-direction:column; gap:8px; }
.comments-sidebar-title{ display:flex; align-items:center; gap:6px; font-size:12.5px; font-weight:700; color:var(--jynx); }
.comments-sidebar-empty{ padding:16px 12px; font-size:12px; color:var(--text-dim); text-align:center; }
.comments-sidebar-list{ overflow-y:auto; display:flex; flex-direction:column; }
.comments-sidebar-item{ padding:9px 12px; border-bottom:1px solid var(--line); cursor:default; }
.comments-sidebar-item:hover{ background:color-mix(in srgb, var(--jynx) 8%, transparent); }
.comments-sidebar-item-target{ font-family:var(--font-mono); font-size:10px; color:var(--jynx); text-transform:uppercase; }
.comments-sidebar-item-comment{ margin:2px 0; font-size:12.5px; color:var(--text); }
.comments-sidebar-item-meta{ font-size:10.5px; color:var(--text-dim); }
`;
