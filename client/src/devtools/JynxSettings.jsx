import React, { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, RotateCcw, Undo2, GripVertical } from "lucide-react";
import { useKeepInViewport } from "./useKeepInViewport.js";

// שלוש רמות בדידות בלבד (jynx-mt5qh4p68xsg: "this is ugly and not user
// friendly, have it as a 3 way option, small medium large... make them look
// exactly like the menu items") — מחליף את ה-slider הרציף הקודם (0.75–1.75)
// ואת שני אייקוני ה-Sparkles שסימנו את הגבולות שלו. "Medium" הוא בדיוק ברירת
// המחדל הישנה (1×, בלי שינוי), Small/Large הם הקצוות הישנים של אותו slider —
// כך שמשתמש שכבר בחר קצה קודם ("100%"/"175%") ימשיך לראות בדיוק אותו גודל
// אייקון, רק עכשיו דרך כפתור בדיד ולא נקודה על סרגל.
const ICON_SCALE_OPTIONS = [
  { key: "small", label: "Small", value: 0.75 },
  { key: "medium", label: "Medium", value: 1 },
  { key: "large", label: "Large", value: 1.75 },
];

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

// Extracted so the exact same fields (orientation / icon size / drag-to-
// reorder) can be embedded both in this component's own popup (opened from
// the always-available toolbar gear icon, any dev user, no admin secret
// needed — see the file-level note above) AND as a plain tab inside
// DevAdminPanel.jsx's Settings hub (added 2026-08-23, per the "menu setting,
// colors, orientation... will be there [in Settings]" work item) — an admin
// browsing that panel gets it inline instead of having to close it and hunt
// for the separate gear icon. Deliberately NOT removing the standalone gear
// button/popup when adding the admin-panel copy: gating this behind
// ADMIN_SECRET would undo the "not admin-only" decision documented above,
// which was a direct fix for a real complaint, not an oversight.
export function JynxMenuSettingsFields({
  orientation, onSetOrientation, order, defaultOrder, availableIds,
  onReorder, onReset, onUndo, canUndo, iconScale, onSetIconScale,
  roleDocked, onSetRoleDocked,
}) {
  const [dragId, setDragId] = useState(null);
  // יעד-שחרור נוכחי בזמן גרירה — משמש רק להדגשה ויזואלית (ראו
  // .jynx-settings-order-item.drag-over למטה); הלוגיקה עצמה עדיין קוראת
  // dragId/handleDrop כרגיל. בלי זה הגרירה "עובדת" אבל לא נותנת שום משוב
  // איפה בדיוק היא תיפול עד שמשחררים — זה מה שהמשוב "the dragging can be
  // better" תיאר.
  const [dragOverId, setDragOverId] = useState(null);

  const orderChanged = JSON.stringify(order) !== JSON.stringify(defaultOrder);
  const visibleOrder = order.filter((id) => availableIds.includes(id));

  function handleDrop(targetId) {
    if (dragId && dragId !== targetId) {
      const next = [...order];
      const from = next.indexOf(dragId);
      const to = next.indexOf(targetId);
      if (from !== -1 && to !== -1) {
        next.splice(from, 1);
        next.splice(to, 0, dragId);
        onReorder(next);
      }
    }
    setDragId(null);
    setDragOverId(null);
  }

  return (
    <>
      <div className="jynx-settings-section">
        <span className="jynx-settings-label">Menu orientation</span>
        <div className="jynx-settings-toggle-row">
          <button type="button" className={orientation === "horizontal" ? "active" : ""} onClick={() => onSetOrientation("horizontal")}>Horizontal</button>
          <button type="button" className={orientation === "vertical" ? "active" : ""} onClick={() => onSetOrientation("vertical")}>Vertical</button>
        </div>
      </div>

      {/* jynx-mt5qe3axvwkl: "when trying to drag the role play icon from the
          menu the drag just stuck for the entire menu, have it as a toggle in
          the menu settings" — replaces the fragile native-HTML5
          drag-out-of-the-menu gesture (still fixed separately, see
          DevAuthGate.jsx's onPointerDown on that toolbar item) with an
          explicit, reliable toggle here, same shape as the orientation row
          right above it. */}
      <div className="jynx-settings-section">
        <span className="jynx-settings-label">Role picker</span>
        <div className="jynx-settings-toggle-row">
          <button type="button" className={roleDocked ? "active" : ""} onClick={() => onSetRoleDocked(true)}>Docked</button>
          <button type="button" className={!roleDocked ? "active" : ""} onClick={() => onSetRoleDocked(false)}>Detached</button>
        </div>
      </div>

      <div className="jynx-settings-section">
        <span className="jynx-settings-label">Icon size</span>
        <div className="pill-tabs jynx-settings-size-tabs">
          {ICON_SCALE_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              className={"pill-tab" + (iconScale === opt.value ? " active" : "")}
              onClick={() => onSetIconScale(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
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
              className={
                "jynx-settings-order-item"
                + (dragId === id ? " dragging" : "")
                + (dragOverId === id && dragId && dragId !== id ? " drag-over" : "")
              }
              draggable
              onDragStart={() => setDragId(id)}
              onDragEnter={() => dragId && dragId !== id && setDragOverId(id)}
              onDragOver={(e) => e.preventDefault()}
              onDragLeave={() => setDragOverId((prev) => (prev === id ? null : prev))}
              onDrop={() => handleDrop(id)}
              onDragEnd={() => { setDragId(null); setDragOverId(null); }}
            >
              <GripVertical size={12} className="jynx-settings-order-grip" />
              {ITEM_LABELS[id] || id}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

export default function JynxSettings(props) {
  const { onClose } = props;
  const panelRef = useRef(null);
  useKeepInViewport(panelRef, true, 8);

  return createPortal(
    <div className="jynx-settings-overlay" onClick={onClose}>
      <style>{CSS}</style>
      <div ref={panelRef} className="jynx-settings-panel jynx-ui" onClick={(e) => e.stopPropagation()}>
        <div className="jynx-settings-head">
          <span>🔮 Jynx Settings</span>
          <button type="button" className="jynx-settings-close" onClick={onClose}><X size={14} /></button>
        </div>
        <JynxMenuSettingsFields {...props} />
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
/* שם כללי (לא "orientation") — הפאנל הזה עכשיו משתמש בשורת שני-כפתורים
   הזו גם לכיוון הסרגל וגם לעגינת בורר-התפקיד (roleDocked), אותו מבנה
   ויזואלי בדיוק, לא קשור לכיוון בלבד יותר. */
.jynx-settings-toggle-row{ display:flex; gap:6px; }
.jynx-settings-toggle-row button{
  flex:1; border:1px solid var(--line); background:var(--panel-raised); color:var(--text-dim); border-radius:8px;
  padding:7px 0; font-size:12px; font-weight:700; cursor:pointer;
}
.jynx-settings-toggle-row button.active{ background:var(--jynx); border-color:var(--jynx); color:#fff; }
/* גודל-פונט/padding מוקטן, בדיוק כמו .member-identity-tabs .pill-tab
   ב-theme.js — ה-pill-tab הרגיל נבנה למלא-רוחב עמוד, גדול מדי לפופ-אפ הצר
   הזה (320px). ".pill-tabs"/".pill-tab" עצמם גלובליים (theme.js, טעונים תמיד
   דרך App.jsx) ולא צריך לשכפל אותם — רק את ה-override הקומפקטי הזה, כאן
   וגם ב-DevAdminPanel.jsx's duplicate CSS. */
.jynx-settings-size-tabs .pill-tab{ flex:1; text-align:center; padding:6px 0 !important; font-size:12px !important; }
.jynx-settings-order-list{ display:flex; flex-direction:column; gap:4px; }
.jynx-settings-order-item{
  display:flex; align-items:center; gap:7px; background:var(--panel-raised); border:1px solid var(--line);
  border-radius:8px; padding:7px 9px; font-size:12px; color:var(--text); cursor:grab;
  transition:background .1s ease, border-color .1s ease, transform .1s ease;
}
.jynx-settings-order-item:active{ cursor:grabbing; }
.jynx-settings-order-item.dragging{ opacity:.4; }
.jynx-settings-order-item.drag-over{
  border-color:var(--jynx); background:color-mix(in srgb, var(--jynx) 14%, transparent); transform:translateY(1px);
}
.jynx-settings-order-grip{ color:var(--text-dim); flex:none; }
`;
