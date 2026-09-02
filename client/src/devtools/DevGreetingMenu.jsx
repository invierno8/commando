import React, { useEffect, useRef, useState } from "react";
import { Settings2, LogOut, CircleHelp } from "lucide-react";
import { useKeepInViewport } from "./useKeepInViewport.js";

/* ================================================================== */
/* LEGO BLOCK — the "Hi, {name}" account menu, lives in the Jynx toolbar */
/* (see DevAuthGate.jsx). jynx-mt5q884jd7ap: the old plain "Hi, {devName}"*/
/* pill + a separate standalone Logout icon button read as cluttered and */
/* misaligned next to the other same-size icon buttons. This collapses   */
/* both into one trigger ("Hi") that opens a small dropdown showing the  */
/* full greeting plus "User settings" (reuses the existing Settings      */
/* panel, same one the toolbar's own gear icon opens — no separate       */
/* personal-settings screen exists or is being invented here) and        */
/* "Logout". Same open/click-outside/viewport-clamp shape as             */
/* MentionsBell.jsx, the sibling toolbar dropdown right next to this one.*/
/* ================================================================== */
export default function DevGreetingMenu({ devName, onOpenSettings, onLogout, shortcuts, helpModeOn, onToggleHelp }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const dropdownRef = useRef(null);
  useKeepInViewport(dropdownRef, open, 8);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e) {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    }
    window.addEventListener("click", onDocClick, true);
    return () => window.removeEventListener("click", onDocClick, true);
  }, [open]);

  return (
    <div ref={wrapRef} className="dev-greeting-wrap" data-devblock="dev-toolbar-greeting-btn">
      <style>{CSS}</style>
      <button
        type="button" className="dev-toolbar-icon-btn dev-greeting-btn"
        onClick={() => setOpen((v) => !v)} title={`Signed in as ${devName}`}
      >
        Hi
      </button>
      {open && (
        <div ref={dropdownRef} className="dev-greeting-dropdown jynx-ui">
          <div className="dev-greeting-dropdown-head-row">
            <div className="dev-greeting-dropdown-head">Hi, {devName}</div>
            {/* jynx-mtjv4sponizo: "add a ? icon inside the 'HI' menu item ...
                when the user is done with the tutorial the ? icon stays on
                ... until he goes back to hi menu item and clicks on ? to
                turn it off" — off: starts the interactive tour (see
                JynxTutorial.jsx); already on: turns hover-help straight back
                off without replaying the tour, exactly as asked. The tour
                itself is what flips this "on" once it finishes/is skipped —
                this button never sets helpModeOn directly when it's off. */}
            <button
              type="button"
              className={"dev-greeting-help-btn" + (helpModeOn ? " active" : "")}
              onClick={() => { setOpen(false); onToggleHelp(); }}
              title={helpModeOn ? "Turn off field explanations" : "Start the Jynx tour"}
            >
              <CircleHelp size={14} />
            </button>
          </div>
          {/* jynx-mth50gvydy9j: "the hotkey is not clearly stated to the
              user and they cannot change it ... under 'hi' menu" — lists
              the number key each toolbar button currently answers to
              (computed live off the actual menu order in DevAuthGate.jsx,
              so it can never drift out of sync) and links straight to the
              existing drag-to-reorder Settings panel, which is what
              actually changes which number maps to which button. */}
          {shortcuts && shortcuts.length > 0 && (
            <div className="dev-greeting-shortcuts">
              <div className="dev-greeting-shortcuts-label">Keyboard shortcuts</div>
              {shortcuts.map((s) => (
                <div key={s.num} className="dev-greeting-shortcut-row">
                  <span className="dev-greeting-shortcut-key">{s.num}</span>
                  <span>{s.label}</span>
                </div>
              ))}
              <button
                type="button" className="dev-greeting-shortcuts-hint"
                onClick={() => { setOpen(false); onOpenSettings(); }}
              >
                Reorder in Settings to change which number does what
              </button>
            </div>
          )}
          <button
            type="button" className="dev-greeting-dropdown-item"
            onClick={() => { setOpen(false); onOpenSettings(); }}
          >
            <Settings2 size={13} /> User settings
          </button>
          <button
            type="button" className="dev-greeting-dropdown-item"
            onClick={() => { setOpen(false); onLogout(); }}
          >
            <LogOut size={13} /> Logout
          </button>
        </div>
      )}
    </div>
  );
}

const CSS = `
/* align-self:center — same fix .jynx-toolbar-item already needed in
   DevAuthGate.jsx's own CSS (see the comment there): the vertical-orientation
   toolbar (.dev-fab-toolbar.vertical) stretches every direct child to the
   column's full width by default (align-items:stretch), and this wrap div
   has no explicit width of its own — without opting out, the "Hi" trigger
   would render flush to one side of a stretched-wide box instead of
   centered, which is exactly the "everything is not centered" complaint
   (jynx-mt5q884jd7ap) this component exists to fix, not reintroduce. */
.dev-greeting-wrap{ position:relative; display:flex; align-self:center; }
.dev-greeting-btn{ font-family:var(--font-sans); font-size:11px; font-weight:700; }
.dev-greeting-dropdown{
  position:absolute; top:36px; right:0; width:210px; background:var(--panel); border:1px solid var(--jynx);
  border-radius:10px; padding:6px; display:flex; flex-direction:column; gap:2px; box-shadow:var(--shadow-md);
  animation:devAnnotateIn .12s ease; z-index:1;
}
.dev-greeting-dropdown-head-row{
  display:flex; align-items:center; justify-content:space-between; gap:6px; padding:6px 8px 8px;
  border-bottom:1px solid var(--line); margin-bottom:4px;
}
.dev-greeting-dropdown-head{
  font-family:var(--font-mono); font-size:11.5px; font-weight:700; color:var(--jynx);
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
}
.dev-greeting-help-btn{
  flex:none; display:flex; align-items:center; justify-content:center; width:20px; height:20px;
  background:none; border:1px solid var(--line); border-radius:6px; color:var(--text-dim); cursor:pointer; padding:0;
}
.dev-greeting-help-btn:hover{ border-color:var(--jynx); color:var(--jynx); }
.dev-greeting-help-btn.active{ background:var(--jynx); border-color:var(--jynx); color:#fff; }
.dev-greeting-shortcuts{
  display:flex; flex-direction:column; gap:3px; padding:4px 8px 8px; margin-bottom:2px;
  border-bottom:1px solid var(--line);
}
.dev-greeting-shortcuts-label{
  font-size:10px; color:var(--text-dim); font-weight:700; text-transform:uppercase; letter-spacing:.03em; margin-bottom:2px;
}
.dev-greeting-shortcut-row{ display:flex; align-items:center; gap:8px; font-size:12px; color:var(--text); }
.dev-greeting-shortcut-key{
  flex:none; width:16px; height:16px; border-radius:4px; background:var(--panel-raised); border:1px solid var(--line);
  color:var(--jynx); font-family:var(--font-mono); font-size:10px; font-weight:800; display:flex;
  align-items:center; justify-content:center;
}
.dev-greeting-shortcuts-hint{
  background:none; border:none; color:var(--text-dim); font-family:var(--font-sans); font-size:10.5px;
  text-align:start; cursor:pointer; padding:4px 0 0; text-decoration:underline; text-underline-offset:2px;
}
.dev-greeting-shortcuts-hint:hover{ color:var(--jynx); }
.dev-greeting-dropdown-item{
  display:flex; align-items:center; gap:8px; background:none; border:none; border-radius:6px; padding:7px 8px;
  font-family:var(--font-sans); font-size:12px; font-weight:600; color:var(--text); cursor:pointer; text-align:start;
}
.dev-greeting-dropdown-item:hover{ background:var(--panel-raised); color:var(--jynx); }
`;
