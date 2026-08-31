import React, { useEffect, useRef, useState } from "react";
import { Settings2, LogOut, Keyboard } from "lucide-react";
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
export default function DevGreetingMenu({ devName, onOpenSettings, onLogout, hotkeys }) {
  const [open, setOpen] = useState(false);
  // jynx-mth50gvydy9j: an accordion row inside this same dropdown rather
  // than a second popup/modal — keeps the ask ("write for the user what is
  // the hotkey, under 'hi' menu") literally under this menu instead of one
  // more click away. Resets closed whenever the dropdown itself closes so it
  // doesn't reopen pre-expanded next time for no reason.
  const [showHotkeys, setShowHotkeys] = useState(false);
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
  useEffect(() => { if (!open) setShowHotkeys(false); }, [open]);

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
            onClick={() => setShowHotkeys((v) => !v)}
          >
            <Keyboard size={13} /> Keyboard shortcuts
          </button>
          {showHotkeys && (
            <div className="dev-greeting-hotkey-panel">
              {hotkeys && hotkeys.length > 0 ? (
                hotkeys.map((h) => (
                  <div key={h.num} className="dev-greeting-hotkey-row">
                    <span className="dev-greeting-hotkey-num">{h.num}</span>
                    {h.label}
                  </div>
                ))
              ) : (
                <div className="dev-greeting-hotkey-empty">No shortcuts available right now.</div>
              )}
              <div className="dev-greeting-hotkey-hint">
                Press a number key to trigger that toolbar button (ignored while typing in a field).
                {" "}
                <button
                  type="button" className="dev-greeting-hotkey-link"
                  onClick={() => { setOpen(false); onOpenSettings(); }}
                >
                  Reorder them in User settings → Menu
                </button>
                {" "}to change the numbers.
              </div>
            </div>
          )}
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
.dev-greeting-hotkey-panel{
  display:flex; flex-direction:column; gap:4px; background:var(--bg); border:1px solid var(--line);
  border-radius:8px; padding:7px 8px; margin:2px 0 4px;
}
.dev-greeting-hotkey-row{
  display:flex; align-items:center; gap:8px; font-family:var(--font-sans); font-size:12px; color:var(--text);
}
.dev-greeting-hotkey-num{
  flex:none; width:16px; height:16px; border-radius:4px; background:var(--jynx); color:#fff;
  font-family:var(--font-mono); font-size:10px; font-weight:700; display:flex; align-items:center; justify-content:center;
}
.dev-greeting-hotkey-empty{ font-size:11.5px; color:var(--text-dim); }
.dev-greeting-hotkey-hint{ font-size:10.5px; color:var(--text-dim); line-height:1.5; margin-top:2px; }
.dev-greeting-hotkey-link{
  background:none; border:none; padding:0; color:var(--jynx); font-size:10.5px; font-weight:700;
  cursor:pointer; text-decoration:underline; text-underline-offset:2px; display:inline;
}
`;
