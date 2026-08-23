import React, { useEffect, useRef, useState } from "react";
import { Settings2, LogOut } from "lucide-react";
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
export default function DevGreetingMenu({ devName, onOpenSettings, onLogout }) {
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
          <div className="dev-greeting-dropdown-head">Hi, {devName}</div>
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
  position:absolute; top:36px; right:0; width:180px; background:var(--panel); border:1px solid var(--jynx);
  border-radius:10px; padding:6px; display:flex; flex-direction:column; gap:2px; box-shadow:var(--shadow-md);
  animation:devAnnotateIn .12s ease; z-index:1;
}
.dev-greeting-dropdown-head{
  font-family:var(--font-mono); font-size:11.5px; font-weight:700; color:var(--jynx); padding:6px 8px 8px;
  border-bottom:1px solid var(--line); margin-bottom:4px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
}
.dev-greeting-dropdown-item{
  display:flex; align-items:center; gap:8px; background:none; border:none; border-radius:6px; padding:7px 8px;
  font-family:var(--font-sans); font-size:12px; font-weight:600; color:var(--text); cursor:pointer; text-align:start;
}
.dev-greeting-dropdown-item:hover{ background:var(--panel-raised); color:var(--jynx); }
`;
