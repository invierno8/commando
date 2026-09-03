import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { useHoverTarget } from "./overlay/useHoverTarget.js";
import { useKeepInViewport } from "./useKeepInViewport.js";

/* ================================================================== */
/* LEGO BLOCK — jynx-mtjv4sponizo: "add a ? icon inside the 'HI' menu    */
/* item, that when pressed will start a on screen tutorial ... and when  */
/* the user is done with the tutorial the ? icon stays on and ... hovers */
/* any jynx field there will be a small bubble explaining what it is".   */
/* Two independent pieces live here, both driven by DevAuthGate.jsx's    */
/* own `tutorialOpen`/`helpModeOn` state (the ? button itself lives in   */
/* DevGreetingMenu.jsx's dropdown, per "inside the Hi menu item"):        */
/*   - JynxTutorialOverlay: the one-shot step-by-step walkthrough, spot- */
/*     lighting each real toolbar control in turn via its existing       */
/*     data-devblock label (the same attribute AdminAnnotationMarkers.jsx*/
/*     /CommentsPanel.jsx already use to relocate a comment's target —   */
/*     reused here instead of inventing a second registry of the same    */
/*     buttons).                                                         */
/*   - JynxHelpHoverBubble: the persistent "hover any jynx field" mode    */
/*     the tutorial hands off into once it's done/skipped. Reuses         */
/*     overlay/useHoverTarget.js (the same hybrid data-devblock/flex-     */
/*     fallback target finder the QA hover-overlay uses) with             */
/*     allowJynxChrome:true, then narrows its result to elements actually*/
/*     inside .jynx-chrome AND carrying an explicit data-devblock — the   */
/*     QA overlay's own flex/grid fallback-container matching is useful   */
/*     for "which card is this" on the real app, but would just light up */
/*     empty toolbar padding here, not a genuine "field".                 */
/* Both render via createPortal(document.body) per the standing portal    */
/* rule (FORCLAUDE.md's z-index rule — the toolbar/backdrop must never    */
/* end up trapped under .app-sidebar's stacking context), and both carry  */
/* .dev-overlay-ignore so the QA hover-overlay/annotate flow never treats */
/* this UI itself as a target (same convention every other Jynx-chrome    */
/* popover already follows).                                              */
/* ================================================================== */

// Single source of truth for both the tour's step order/copy AND the
// hover-help bubble's per-control text — a step with no `target` is a
// centered intro/outro slide (no element to spotlight). Order matches the
// toolbar's fixed left-to-right (or top-to-bottom, when vertical) layout in
// DevAuthGate.jsx so the tour reads the same direction the eye already
// travels across the real bar.
export const TUTORIAL_STEPS = [
  {
    target: null,
    title: "Welcome to Jynx",
    text: "This is HANGAR's built-in QA toolkit — the toolbar that follows you around every screen. This quick tour points out what each button does. Back/Next to move around, or Skip at any time.",
  },
  {
    target: "dev-toolbar-role-btn",
    title: "Role & brigade simulator",
    text: "Switch role, brigade, and identity — the screen behind this toolbar reacts live, without needing a real login for each combination. Drag this button out of the toolbar to detach it into its own floating panel.",
  },
  {
    target: "dev-toolbar-overlay-toggle",
    title: "Hover overlay",
    text: "While this is on, hovering the page outlines whichever section is under your cursor — that's what a QA comment attaches to. Turn it off if the highlight gets in the way of what you're looking at.",
  },
  {
    target: "dev-toolbar-draw-toggle",
    title: "Drawing",
    text: "Turn this on, then hold Ctrl (⌘ on Mac) and drag on the page to sketch directly over what you're pointing at. The drawing attaches to your next comment, like a hand-marked-up screenshot.",
  },
  {
    target: "dev-toolbar-comments-toggle",
    title: "Comments panel",
    text: "Every QA comment left on the current screen, in one list — search, filter, and reply from here instead of hunting for each one on the page itself.",
  },
  {
    target: "dev-toolbar-markers-toggle",
    title: "Status dots",
    text: "Small colored dots pinned directly next to whatever a comment is about, right on the page. The color shows its status (open/in progress/PR opened/done) without opening the comments panel.",
  },
  {
    target: "dev-toolbar-admin-btn",
    title: "Settings",
    text: "Toolbar item order, icon size, orientation, and your hotkey preference live here — and, for admins, the full QA queue and the dev-user roster.",
  },
  {
    target: "dev-toolbar-greeting-btn",
    title: "Hi menu",
    text: "Your keyboard shortcuts (one number per toolbar button, in whatever order they're currently arranged), a link to Settings, and Logout — plus the ? you just clicked to start this tour.",
  },
  {
    target: "dev-toolbar-collapse-btn",
    title: "Collapse",
    text: "Shrinks the whole toolbar down to just the Jynx bubble when you want the corner of the screen back. Click the bubble again to bring everything back.",
  },
  {
    target: "dev-toolbar-grip",
    title: "Orientation grip",
    text: "Click it to flip the toolbar between a horizontal row and a vertical column. Drag anywhere else on the bar (not this button) to move the whole toolbar around the screen.",
  },
  {
    target: null,
    title: "Leaving a comment",
    text: "Hold your hotkey (shown just below the toolbar) and click anything on the page to open a comment box right there — write what you see and submit. That's what turns into everything else you just toured.",
  },
  {
    target: null,
    title: "That's the tour",
    text: "From here on, hovering any Jynx button — no need to run this tour again — shows a small reminder bubble like the ones you just saw. Open the Hi menu and click ? again anytime to turn that off.",
  },
];

// Built from TUTORIAL_STEPS instead of kept as a second hand-written list —
// every step that targets a real control already has the exact copy the
// hover bubble should show, so there is exactly one place to update either.
export const HELP_DESCRIPTIONS = TUTORIAL_STEPS.reduce((map, step) => {
  if (step.target) map[step.target] = { title: step.title, text: step.text };
  return map;
}, {});

function targetRect(label) {
  if (!label) return null;
  const el = document.querySelector(`[data-devblock="${CSS.escape(label)}"]`);
  return el ? el.getBoundingClientRect() : null;
}

// The toolbar is user-draggable and can flip orientation mid-tour, so a
// step's target can move under the highlight at any moment — a plain
// mount-time measurement isn't enough. This is a devtool overlay showing at
// most ~12 short-lived steps, so a cheap poll is simpler and just as
// correct as wiring a ResizeObserver/MutationObserver pair for something
// this small, and it self-clears the moment the step (and therefore the
// interval) changes.
function useTrackedRect(label) {
  const [rect, setRect] = useState(() => targetRect(label));
  useEffect(() => {
    setRect(targetRect(label));
    if (!label) return;
    const measure = () => setRect(targetRect(label));
    const id = setInterval(measure, 150);
    window.addEventListener("resize", measure);
    return () => {
      clearInterval(id);
      window.removeEventListener("resize", measure);
    };
  }, [label]);
  return rect;
}

// No transform-based centering here on purpose — useKeepInViewport (applied
// to this same card below) does its own viewport-clamp correction via
// el.style.transform, reset to "" as its baseline every time it re-measures;
// a CSS transform set here for centering would just get wiped out by that
// reset. Card width is fixed (see .jynx-tutorial-card), so a static
// margin-left half its width centers it horizontally without needing one.
function cardStyleFromRect(rect) {
  if (!rect) return { top: "30%", left: "50%", marginLeft: -130 };
  const preferLeft = rect.left > window.innerWidth / 2;
  return preferLeft
    ? { top: Math.max(12, rect.top - 8), right: window.innerWidth - rect.left + 14 }
    : { top: Math.max(12, rect.top - 8), left: rect.right + 14 };
}

export function JynxTutorialOverlay({ active, onFinish }) {
  const [stepIndex, setStepIndex] = useState(0);
  // Filtered once per tour start against what's actually on screen right
  // now — e.g. "markers" is hidden for a dev user who isn't an admin/Jynx
  // commenter (see KEYABLE_IDS/TOOLBAR_ITEM_NODES in DevAuthGate.jsx), and
  // the comment composer only exists while a comment is actually open, so
  // both would otherwise spotlight nothing.
  const steps = useMemo(
    () => (active ? TUTORIAL_STEPS.filter((s) => !s.target || targetRect(s.target)) : []),
    [active]
  );
  useEffect(() => { if (active) setStepIndex(0); }, [active]);

  const step = steps[stepIndex];
  const rect = useTrackedRect(step?.target || null);
  const cardRef = useRef(null);
  useKeepInViewport(cardRef, active, 12, [stepIndex, rect?.top, rect?.left]);

  if (!active || !step) return null;

  const isFirst = stepIndex === 0;
  const isLast = stepIndex === steps.length - 1;
  function next() { if (isLast) onFinish(); else setStepIndex((i) => i + 1); }
  function back() { if (!isFirst) setStepIndex((i) => i - 1); }

  return createPortal(
    <div className="jynx-tutorial-root jynx-chrome jynx-ui dev-overlay-ignore">
      <style>{TUTORIAL_CSS}</style>
      <div className="jynx-tutorial-backdrop" onClick={onFinish} />
      {rect && (
        <div
          className="jynx-tutorial-ring"
          style={{ top: rect.top - 6, left: rect.left - 6, width: rect.width + 12, height: rect.height + 12 }}
        />
      )}
      <div ref={cardRef} className="jynx-tutorial-card" style={{ position: "fixed", ...cardStyleFromRect(rect) }}>
        <button type="button" className="jynx-tutorial-skip" onClick={onFinish} title="Skip tour">
          <X size={14} />
        </button>
        <div className="jynx-tutorial-step-count">{stepIndex + 1} / {steps.length}</div>
        <div className="jynx-tutorial-title">{step.title}</div>
        <div className="jynx-tutorial-text">{step.text}</div>
        <div className="jynx-tutorial-nav">
          <button type="button" className="jynx-tutorial-nav-btn" onClick={back} disabled={isFirst}>
            <ChevronLeft size={14} /> Back
          </button>
          <button type="button" className="jynx-tutorial-nav-btn jynx-tutorial-nav-primary" onClick={next}>
            {isLast ? (<>Done <Check size={14} /></>) : (<>Next <ChevronRight size={14} /></>)}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function JynxHelpHoverBubble({ active }) {
  const rawTarget = useHoverTarget(active, true);
  // useHoverTarget(allowJynxChrome:true) matches jynx-chrome AND ordinary
  // app content (it only ever *excludes* jynx-chrome, never restricts to
  // it) — narrow to jynx-chrome elements carrying a genuine data-devblock
  // label, i.e. an actual documented "field", not the QA overlay's own
  // flex/grid fallback match (which would otherwise light up empty toolbar
  // padding as if it were something explainable).
  const el = rawTarget?.closest?.(".jynx-chrome") && rawTarget.dataset?.devblock ? rawTarget : null;

  if (!active || !el) return null;
  // The Hi trigger already opens its own dropdown (DevGreetingMenu.jsx) —
  // hovering it while that's open would stack this bubble right on top of
  // it, both saying roughly the same thing. Skip the bubble whenever the
  // hovered control already has its own popover open underneath it.
  if (el.querySelector(".dev-greeting-dropdown")) return null;
  const rect = el.getBoundingClientRect();
  const label = el.dataset.devblock;
  const info = HELP_DESCRIPTIONS[label] || { title: label, text: el.title || "Part of the Jynx dev toolkit." };
  const preferLeft = rect.left > window.innerWidth / 2;
  const style = preferLeft
    ? { top: Math.max(8, rect.top), right: window.innerWidth - rect.left + 10 }
    : { top: Math.max(8, rect.top), left: rect.right + 10 };

  return createPortal(
    <div className="jynx-help-bubble jynx-chrome jynx-ui dev-overlay-ignore" style={{ position: "fixed", ...style }}>
      <style>{HOVER_CSS}</style>
      <div className="jynx-help-bubble-title">{info.title}</div>
      <div className="jynx-help-bubble-text">{info.text}</div>
    </div>,
    document.body
  );
}

const TUTORIAL_CSS = `
@keyframes jynxTutorialFadeIn{ from{ opacity:0; } to{ opacity:1; } }
@keyframes jynxTutorialCardIn{ from{ opacity:0; transform:translateY(4px); } to{ opacity:1; transform:translateY(0); } }
.jynx-tutorial-backdrop{
  position:fixed; inset:0; background:rgba(0,0,0,.55); z-index:2000;
  animation:jynxTutorialFadeIn .15s ease;
}
.jynx-tutorial-ring{
  position:fixed; z-index:2001; pointer-events:none; border-radius:10px;
  border:2px solid var(--jynx); box-shadow:0 0 0 3px color-mix(in srgb, var(--jynx) 35%, transparent), 0 0 18px color-mix(in srgb, var(--jynx) 55%, transparent);
  transition:top .18s ease, left .18s ease, width .18s ease, height .18s ease;
}
.jynx-tutorial-card{
  z-index:2002; width:260px; background:var(--panel); border:1px solid var(--jynx); border-radius:12px;
  padding:14px 14px 12px; box-shadow:var(--shadow-md); font-family:var(--font-sans);
  animation:jynxTutorialCardIn .16s ease;
}
.jynx-tutorial-skip{
  position:absolute; top:8px; right:8px; background:none; border:none; color:var(--text-dim);
  cursor:pointer; padding:2px; border-radius:6px; display:flex;
}
.jynx-tutorial-skip:hover{ background:var(--panel-raised); color:var(--jynx); }
.jynx-tutorial-step-count{
  font-family:var(--font-mono); font-size:10px; color:var(--text-dim); font-weight:700;
  text-transform:uppercase; letter-spacing:.04em; margin-bottom:6px;
}
.jynx-tutorial-title{ font-size:13.5px; font-weight:800; color:var(--text); margin-bottom:4px; padding-right:16px; }
.jynx-tutorial-text{ font-size:12px; line-height:1.5; color:var(--text-dim); margin-bottom:12px; }
.jynx-tutorial-nav{ display:flex; align-items:center; justify-content:space-between; gap:8px; }
.jynx-tutorial-nav-btn{
  display:flex; align-items:center; gap:3px; background:var(--panel-raised); border:1px solid var(--line);
  border-radius:7px; padding:6px 10px; font-family:var(--font-sans); font-size:11.5px; font-weight:700;
  color:var(--text); cursor:pointer;
}
.jynx-tutorial-nav-btn:hover:not(:disabled){ border-color:var(--jynx); color:var(--jynx); }
.jynx-tutorial-nav-btn:disabled{ opacity:.4; cursor:not-allowed; }
.jynx-tutorial-nav-primary{ background:var(--jynx); border-color:var(--jynx); color:#fff; margin-left:auto; }
.jynx-tutorial-nav-primary:hover{ opacity:.9; color:#fff; }
`;

const HOVER_CSS = `
@keyframes jynxHelpBubbleIn{ from{ opacity:0; transform:translateY(2px); } to{ opacity:1; transform:translateY(0); } }
.jynx-help-bubble{
  z-index:2000; max-width:220px; background:var(--panel); border:1px solid var(--jynx); border-radius:9px;
  padding:8px 10px; box-shadow:var(--shadow-md); font-family:var(--font-sans); pointer-events:none;
  animation:jynxHelpBubbleIn .1s ease;
}
.jynx-help-bubble-title{ font-size:11.5px; font-weight:800; color:var(--jynx); margin-bottom:2px; }
.jynx-help-bubble-text{ font-size:11px; line-height:1.4; color:var(--text-dim); }
`;
