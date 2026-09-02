import React, { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, HelpCircle } from "lucide-react";

/* ================================================================== */
/* LEGO BLOCK — jynx-mtjv4sponizo: "add a ? icon inside the 'HI' menu   */
/* item, that when pressed will start an on screen tutorial that will   */
/* explain all functions of jynx interactively ... and when the user   */
/* is done with the tutorial the ? icon stays on and when he hovers    */
/* any jynx field there will be a small bubble explaining what it is   */
/* and functionalities until he goes back to hi menu item and clicks   */
/* on ? to turn it off."                                                */
/*                                                                       */
/* Two modes sharing one toggle (see the "?" item DevGreetingMenu.jsx   */
/* renders in the "Hi" dropdown, wired from DevAuthGate.jsx's helpMode  */
/* state — no Context, plain prop-drilling per the project convention): */
/*   "tour"  — a short guided walkthrough over the toolbar's own        */
/*             data-devblock buttons, one at a time, reusing each       */
/*             button's own `title` text as the explanation. Not a      */
/*             slideshow engine — deliberately just a highlight box +   */
/*             a small panel with Back/Next/Skip, built entirely from   */
/*             copy that already exists on each button rather than      */
/*             authoring/duplicating new descriptions here.             */
/*   "hover" — the persistent state the tutorial ends into (or "Skip    */
/*             tour" jumps straight to): hovering any Jynx-chrome       */
/*             element that has a `title` shows that same text as an    */
/*             instant bubble near the cursor, with the native title    */
/*             tooltip temporarily blanked (and restored on mouseout)   */
/*             so the two never show at once — same "native title has   */
/*             no controllable delay" reasoning as the sidebar-tooltip  */
/*             fix (ann-mtihjhf7ej04), just Jynx-chrome-scoped instead   */
/*             of app-scoped, and reusing existing text instead of a    */
/*             new one.                                                 */
/* Scoped to `.jynx-chrome`/`.jynx-ui` elements only (the same pin-     */
/* block classes theme.js already uses to mark every Jynx UI root) —    */
/* this is "any jynx field," not the app's own separate data-devblock   */
/* usage on ordinary HANGAR screens (that's DevOverlay.jsx's unrelated  */
/* QA-annotation hover highlight).                                      */
/* ================================================================== */

// The toolbar's own known data-devblock ids, in the order they appear —
// the exact same set DevAuthGate.jsx's keyboardShortcuts list already
// draws from. Not every id is present on every page load (role-btn only
// while docked, markers-toggle only for admin/Jynx-commenter) — missing/
// hidden ones are simply skipped when the tour is built, not shown as
// broken steps.
const TOUR_STEP_IDS = [
  "dev-toolbar-role-btn",
  "dev-toolbar-overlay-toggle",
  "dev-toolbar-draw-toggle",
  "dev-toolbar-comments-toggle",
  "dev-toolbar-markers-toggle",
  "dev-toolbar-greeting-btn",
  "dev-toolbar-admin-btn",
  "dev-toolbar-collapse-btn",
];

function collectTourSteps() {
  const steps = [];
  for (const id of TOUR_STEP_IDS) {
    const el = document.querySelector(`[data-devblock="${id}"]`);
    if (!el || el.offsetParent === null) continue; // not on page right now
    const label = el.getAttribute("title");
    if (!label) continue; // nothing to explain without existing copy
    steps.push({ id, el, label });
  }
  return steps;
}

export function JynxHelpButton({ mode, onToggle }) {
  const active = mode !== "off";
  return (
    <button
      type="button"
      className={"dev-greeting-dropdown-item jynx-help-toggle" + (active ? " active" : "")}
      onClick={onToggle}
      title={active ? "Turn off Jynx help mode" : "Start the Jynx tutorial"}
    >
      <HelpCircle size={13} /> {active ? "Help mode: on" : "Help mode"}
    </button>
  );
}

export default function JynxHelpMode({ mode, onModeChange }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [steps, setSteps] = useState([]);
  const [, forceTick] = useState(0);
  const [bubble, setBubble] = useState(null);

  // Build the step list fresh every time the tour starts, so it always
  // reflects whichever toolbar buttons actually exist right now (role/
  // markers visibility can vary by admin status and dock state).
  useEffect(() => {
    if (mode !== "tour") return;
    setSteps(collectTourSteps());
    setStepIndex(0);
  }, [mode]);

  // Keep the highlight box glued to its target through resize/scroll —
  // same "measure the real DOM, don't guess" approach as useDraggableFab.js.
  useEffect(() => {
    if (mode !== "tour") return;
    function onReflow() { forceTick((t) => t + 1); }
    window.addEventListener("resize", onReflow);
    window.addEventListener("scroll", onReflow, true);
    return () => {
      window.removeEventListener("resize", onReflow);
      window.removeEventListener("scroll", onReflow, true);
    };
  }, [mode]);

  // Hover-bubble mode: reuses each element's own `title` as the bubble
  // text, blanking the native `title` attribute while hovered (stashed
  // in a data attribute) so the browser's own delayed tooltip never
  // shows alongside this instant one, and always restores it — on
  // mouseout, and again on unmount/mode-change, in case help mode gets
  // turned off mid-hover.
  useEffect(() => {
    if (mode !== "hover") return;
    function onOver(e) {
      const el = e.target.closest?.("[title]");
      if (!el || !el.closest(".jynx-chrome, .jynx-ui")) return;
      const text = el.getAttribute("title");
      if (!text) return;
      el.dataset.jynxHelpTitle = text;
      el.removeAttribute("title");
      setBubble({ text, rect: el.getBoundingClientRect() });
    }
    function onOut(e) {
      const el = e.target.closest?.("[data-jynx-help-title]");
      if (el) {
        el.setAttribute("title", el.dataset.jynxHelpTitle);
        delete el.dataset.jynxHelpTitle;
      }
      const to = e.relatedTarget;
      if (!to || !(to.closest?.("[title]") || to.closest?.("[data-jynx-help-title]"))) {
        setBubble(null);
      }
    }
    document.addEventListener("mouseover", onOver);
    document.addEventListener("mouseout", onOut);
    return () => {
      document.removeEventListener("mouseover", onOver);
      document.removeEventListener("mouseout", onOut);
      document.querySelectorAll("[data-jynx-help-title]").forEach((el) => {
        el.setAttribute("title", el.dataset.jynxHelpTitle);
        delete el.dataset.jynxHelpTitle;
      });
      setBubble(null);
    };
  }, [mode]);

  if (mode === "tour") {
    const step = steps[stepIndex];
    if (!step) {
      // Nothing on this page to walk through right now — go straight to
      // the persistent hover mode instead of showing an empty tour.
      if (mode === "tour") setTimeout(() => onModeChange("hover"), 0);
      return null;
    }
    const rect = step.el.getBoundingClientRect();
    const last = stepIndex === steps.length - 1;
    // Panel opens upward from the highlighted button (all these buttons
    // live near the bottom-right of the screen) with a small edge clamp
    // so it can't run off the left/top of the viewport.
    const panelLeft = Math.min(Math.max(8, rect.right - 260), window.innerWidth - 268);
    const panelBottom = Math.max(8, window.innerHeight - rect.top + 10);
    return (
      <>
        <style>{CSS}</style>
        <div
          className="jynx-help-highlight"
          style={{ left: rect.left - 4, top: rect.top - 4, width: rect.width + 8, height: rect.height + 8 }}
        />
        <div className="jynx-help-panel jynx-chrome jynx-ui" style={{ left: panelLeft, bottom: panelBottom }}>
          <div className="jynx-help-panel-progress">Jynx tutorial — {stepIndex + 1} / {steps.length}</div>
          <div className="jynx-help-panel-text">{step.label}</div>
          <div className="jynx-help-panel-row">
            <button type="button" className="jynx-help-skip" onClick={() => onModeChange("hover")}>Skip tour</button>
            <div className="jynx-help-panel-nav">
              <button type="button" disabled={stepIndex === 0} onClick={() => setStepIndex((i) => i - 1)} title="Back">
                <ChevronLeft size={14} />
              </button>
              <button type="button" onClick={() => (last ? onModeChange("hover") : setStepIndex((i) => i + 1))} title={last ? "Done" : "Next"}>
                {last ? "Done" : <ChevronRight size={14} />}
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (mode === "hover" && bubble) {
    const left = Math.min(bubble.rect.left, window.innerWidth - 268);
    const top = bubble.rect.bottom + 8;
    return (
      <>
        <style>{CSS}</style>
        <div className="jynx-help-bubble jynx-chrome jynx-ui" style={{ left, top }}>{bubble.text}</div>
      </>
    );
  }

  return mode === "hover" ? <style>{CSS}</style> : null;
}

const CSS = `
.jynx-help-toggle.active{ color:var(--jynx); }
.jynx-help-toggle.active svg{ color:var(--jynx); }

.jynx-help-highlight{
  position:fixed; z-index:99996; pointer-events:none; border-radius:8px;
  border:2px solid var(--jynx);
  box-shadow:0 0 0 3px color-mix(in srgb, var(--jynx) 28%, transparent),
             0 0 18px color-mix(in srgb, var(--jynx) 50%, transparent);
  transition:left .15s ease, top .15s ease, width .15s ease, height .15s ease;
}
.jynx-help-panel{
  position:fixed; z-index:100005; width:250px; padding:10px 12px; border-radius:10px;
  background:var(--panel); border:1px solid var(--jynx); box-shadow:var(--shadow-md);
  display:flex; flex-direction:column; gap:6px; font-family:var(--font-sans);
  animation:devAnnotateIn .12s ease;
}
.jynx-help-panel-progress{ font-size:10px; font-weight:700; color:var(--jynx); font-family:var(--font-mono); text-transform:uppercase; letter-spacing:.03em; }
.jynx-help-panel-text{ font-size:12.5px; color:var(--text); line-height:1.4; }
.jynx-help-panel-row{ display:flex; align-items:center; justify-content:space-between; margin-top:2px; }
.jynx-help-skip{
  background:none; border:none; color:var(--text-dim); font-size:11px; cursor:pointer; padding:0;
  text-decoration:underline; text-underline-offset:2px; font-family:var(--font-sans);
}
.jynx-help-skip:hover{ color:var(--jynx); }
.jynx-help-panel-nav{ display:flex; align-items:center; gap:4px; }
.jynx-help-panel-nav button{
  display:flex; align-items:center; justify-content:center; gap:4px; min-width:28px; height:26px; padding:0 8px;
  border-radius:7px; border:1px solid var(--jynx); background:var(--panel-raised); color:var(--jynx);
  font-family:var(--font-sans); font-size:11.5px; font-weight:700; cursor:pointer;
}
.jynx-help-panel-nav button:disabled{ opacity:.35; cursor:not-allowed; }
.jynx-help-panel-nav button:not(:disabled):hover{ background:var(--jynx); color:#fff; }

.jynx-help-bubble{
  position:fixed; z-index:100005; max-width:250px; padding:7px 10px; border-radius:8px;
  background:var(--panel); border:1px solid var(--jynx); box-shadow:var(--shadow-md);
  font-family:var(--font-sans); font-size:11.5px; color:var(--text); line-height:1.4;
  pointer-events:none; animation:devAnnotateIn .1s ease;
}
`;
