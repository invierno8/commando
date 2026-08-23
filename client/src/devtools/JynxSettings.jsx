import React, { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, RotateCcw, Undo2, GripVertical } from "lucide-react";
import { useKeepInViewport } from "./useKeepInViewport.js";

/* ================================================================== */
/* LEGO BLOCK — everything about how the Jynx toolbar itself looks/     */
/* behaves, pulled OUT of the live toolbar into its own popup. Previous */
/* design had drag-to-reorder directly on the live toolbar items, which */
/* shared the same pointer gesture as dragging the WHOLE toolbar around  */
/* the screen (useDraggableFab.js on the container) — the two competed   */
/* on every drag attempt ("drag and drop is fucked", real complaint).    */
/* This panel isn't itself draggable-as-a-whole, so reordering here      */
/* never fights anything.                                                */
/*                                                                        */
/* Deliberately NOT the ADMIN_SECRET-gated DevAdminPanel — toolbar        */
/* layout/size/order is a personal preference (stored per-browser in      */
/* localStorage already), not an admin-only setting, so gating it behind  */
/* the admin secret would be a real regression for non-admin dev users    */
/* who already could drag/resize/reorder their own toolbar before.        */
/* ================================================================== */

const ITEM_LABELS = {
  role: "Role & brigade",
  overlay: "Hover overlay",
  draw: "Drawing",
  comments: "Comments panel",
  markers: "Status dots",
  admin: "Admin",
  mentions: "Mentions",
};

export default function JynxSettings({
  onClose, orientation, onSetOrientation, order, defaultOrder, availableIds,
  onReorder, onReset, onUndo, canUndo, iconScale, onSetIconScale,
}) {
  const panelRef = useRef(null);
  useKeepInViewport(panelRef, true, 8);
  const [dragId, setDragId] = useState(null);

  const orderChanged = JSON.stringify(order) !== JSON.stringify(defaultOrder);
  const visibleOrder = order.filter((id) => availableIds.includes(id));

  function handleDrop(targetId) {
    if (!dragId || dragId === targetId) return;
    const next = [...order];
    const from = next.indexOf(dragId);
    const to = next.indexOf(targetId);
    if (from !== -1 && to !== -1) {
      next.splice(from, 1);
      next.splice(to, 0, dragId);
      onReorder(next);
    }
    setDragId(null);
  }

  return createPortal(
    <div className="jynx-settings-overlay" onClick={onClose}>
      <style>{CSS}</style>
      <div ref={panelRef} className="jynx-settings-panel jynx-ui" onClick={(e) => e.stopPropagation()}>
        <div className="jynx-settings-head">
          <span>🔮 Jynx Settings</span>
          <button type="button" className="jynx-settings-close" onClick={onClose}><X size={14} /></button>
        </div>

        <div className="jynx-settings-section">
          <span className="jynx-settings-label">Menu orientation</span>
          <div className="jynx-settings-orientation-row">
            <button type="button" className={orientation === "horizontal" ? "active" : ""} onClick={() => onSetOrientation("horizontal")}>Horizontal</button>
            <button type="button" className={orientation === "vertical" ? "active" : ""} onClick={() => onSetOrientation("vertical")}>Vertical</button>
          </div>
        </div>

        <div className="jynx-settings-section">
          <span className="jynx-settings-label">Icon size</span>
          <input
            type="range" min="0.8" max="1.6" step="0.1" value={iconScale}
            onChange={(e) => onSetIconScale(Number(e.target.value))}
            className="jynx-settings-slider"
          />
        </div>

        <div className="jynx-settings-section">
          <div className="jynx-settings-label-row">
            <span className="jynx-settings-label">Menu order — drag to rearrange</span>
            <div className="jynx-settings-order-actions">
              <button type="button" onClick={onUndo} disabled={!canUndo} title="Undo last reorder">
                <Undo2 size={12} />
              </button>
              <button type="button" onClick={onReset} disabled={!orderChanged} title="Reset to default order">
                <RotateCcw size={12} />
              </button>
            </div>
          </div>
          <div className="jynx-settings-order-list">
            {visibleOrder.map((id) => (
              <div
                key={id}
                className={"jynx-settings-order-item" + (dragId === id ? " dragging" : "")}
                draggable
                onDragStart={() => setDragId(id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(id)}
                onDragEnd={() => setDragId(null)}
              >
                <GripVertical size={12} className="jynx-settings-order-grip" />
                {ITEM_LABELS[id] || id}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

const CSS = `
.jynx-settings-overlay{
  position:fixed; inset:0; background:rgba(6,8,10,.55); backdrop-filter:blur(1px); z-index:100010;
  display:flex; align-items:center; justify-content:center; padding:20px;
}
.jynx-settings-panel{
  width:min(320px, 92vw); background:var(--panel); border:1px solid var(--jynx); border-radius:14px;
  padding:16px; display:flex; flex-direction:column; gap:14px; box-shadow:var(--shadow-md);
  animation:jynxSettingsIn .16s ease;
}
@keyframes jynxSettingsIn{ from{ opacity:0; transform:scale(.96); } to{ opacity:1; transform:scale(1); } }
.jynx-settings-head{ display:flex; align-items:center; justify-content:space-between; font-weight:700; color:var(--jynx); font-size:14px; }
.jynx-settings-close{ background:none; border:none; color:var(--text-dim); cursor:pointer; display:flex; }
.jynx-settings-close:hover{ color:var(--red); }
.jynx-settings-section{ display:flex; flex-direction:column; gap:7px; }
.jynx-settings-label{ font-size:11px; color:var(--text-dim); font-weight:700; text-transform:uppercase; letter-spacing:.03em; }
.jynx-settings-label-row{ display:flex; align-items:center; justify-content:space-between; }
.jynx-settings-order-actions{ display:flex; gap:4px; }
.jynx-settings-order-actions button{
  width:22px; height:22px; border-radius:6px; border:1px solid var(--line); background:var(--panel-raised);
  color:var(--text-dim); display:flex; align-items:center; justify-content:center; cursor:pointer;
}
.jynx-settings-order-actions button:hover:not(:disabled){ color:var(--jynx); border-color:var(--jynx); }
.jynx-settings-order-actions button:disabled{ opacity:.35; cursor:not-allowed; }
.jynx-settings-orientation-row{ display:flex; gap:6px; }
.jynx-settings-orientation-row button{
  flex:1; border:1px solid var(--line); background:var(--panel-raised); color:var(--text-dim); border-radius:8px;
  padding:7px 0; font-size:12px; font-weight:700; cursor:pointer;
}
.jynx-settings-orientation-row button.active{ background:var(--jynx); border-color:var(--jynx); color:#fff; }
.jynx-settings-slider{ width:100%; accent-color:var(--jynx); }
.jynx-settings-order-list{ display:flex; flex-direction:column; gap:4px; }
.jynx-settings-order-item{
  display:flex; align-items:center; gap:7px; background:var(--panel-raised); border:1px solid var(--line);
  border-radius:8px; padding:7px 9px; font-size:12px; color:var(--text); cursor:grab;
}
.jynx-settings-order-item:active{ cursor:grabbing; }
.jynx-settings-order-item.dragging{ opacity:.4; }
.jynx-settings-order-grip{ color:var(--text-dim); flex:none; }
`;
