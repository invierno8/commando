import React, { useState } from "react";
import UnitEmblem from "./UnitEmblem.jsx";

/* ================================================================== */
/* LEGO BLOCK — ScopePicker                                            */
/* דרופדאון עם חץ, שמציג "הכל" + כל יחידה עם האמבלמה שלה. משותף בין     */
/* הדשבורד לבין מסך ההרשאות, כדי שלא יהיו שני מימושים לאותו רכיב.       */
/* ================================================================== */

export const ALL_SCOPE = "__all__";

export default function ScopePicker({
  scope, setScope, units,
  allLabel = "כלל החטיבה", allEmblemName = "חטיבה", unitLogos,
}) {
  const [open, setOpen] = useState(false);
  const current = scope === ALL_SCOPE ? allLabel : scope;

  return (
    <div
      className="scope-picker"
      tabIndex={-1}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false); }}
    >
      <button type="button" className="scope-picker-trigger" onClick={() => setOpen((o) => !o)}>
        <UnitEmblem name={scope === ALL_SCOPE ? allEmblemName : scope} size={26} showRing={false} image={scope !== ALL_SCOPE ? unitLogos?.[scope] : undefined} />
        <span>{current}</span>
        <span className={"scope-picker-arrow" + (open ? " open" : "")}>▾</span>
      </button>

      {open && (
        <div className="scope-picker-menu">
          <button
            type="button"
            className={"scope-picker-item" + (scope === ALL_SCOPE ? " active" : "")}
            onClick={() => { setScope(ALL_SCOPE); setOpen(false); }}
          >
            <UnitEmblem name={allEmblemName} size={22} showRing={false} />
            <span>{allLabel}</span>
          </button>
          {units.map((u) => (
            <button
              type="button"
              key={u}
              className={"scope-picker-item" + (scope === u ? " active" : "")}
              onClick={() => { setScope(u); setOpen(false); }}
            >
              <UnitEmblem name={u} size={22} showRing={false} image={unitLogos?.[u]} />
              <span>{u}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* CSS משותף — מיובא כמחרוזת ומוזרק לתוך ה-<style> של כל מסך שמשתמש ברכיב */
export const SCOPE_PICKER_CSS = `
.scope-picker{ position:relative; }
.scope-picker-trigger{
  display:flex; align-items:center; gap:8px; background:var(--panel); border:1px solid var(--line);
  border-radius:5px; padding:7px 12px; cursor:pointer; color:var(--text); font-family:var(--font-sans);
  font-weight:600; font-size:14px; transition:border-color .15s ease, background .15s ease;
}
.scope-picker-trigger:hover{ border-color:var(--accent); }
.scope-picker-arrow{ color:var(--text-dim); font-size:11px; transition:transform .18s ease; }
.scope-picker-arrow.open{ transform:rotate(180deg); color:var(--accent); }
.scope-picker-menu{
  position:absolute; top:calc(100% + 6px); left:0; right:0; z-index:50; min-width:190px;
  background:var(--panel); border:1px solid var(--line); border-radius:6px;
  box-shadow:var(--shadow-md); padding:6px; animation:fadeSlideUp .14s ease;
}
.scope-picker-item{
  width:100%; display:flex; align-items:center; gap:9px; background:transparent; border:none;
  color:var(--text); padding:8px; border-radius:4px; cursor:pointer; font-size:13px; text-align:right;
  font-family:var(--font-sans);
}
.scope-picker-item:hover{ background:var(--panel-raised); }
.scope-picker-item.active{ background:var(--panel-raised); color:var(--accent); font-weight:600; }
`;
