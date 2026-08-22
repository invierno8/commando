import React from "react";

/* ================================================================== */
/* LEGO BLOCK — the small floating "thought" caption that pops up above  */
/* the Jynx bubble/lock button when something's actually happening      */
/* (waking up, logging in, done, or a mistake) — this plus the          */
/* breathing/pulse CSS in DevAuthGate.jsx is what's meant to make the    */
/* bubble read as alive rather than a static button that occasionally    */
/* shows a spinner. Deliberately NOT a generic toast/notification        */
/* system — this is scoped to Jynx's own bubble, styleless itself (the   */
/* CSS lives with its primary consumer, DevAuthGate.jsx, same as how     */
/* AnnotationPopover.jsx has no <style> of its own either).               */
/* ================================================================== */

const STATUS = {
  waking: { icon: "💤", defaultText: "Waking up…", cls: "jynx-thought-waking" },
  thinking: { icon: "🤔", defaultText: "Thinking…", cls: "jynx-thought-thinking" },
  success: { icon: "✨", defaultText: "Ready!", cls: "jynx-thought-success" },
  error: { icon: "😕", defaultText: "Hmm, that's not right", cls: "jynx-thought-error" },
};

export default function JynxThought({ status, text }) {
  if (!status || !STATUS[status]) return null;
  const s = STATUS[status];
  return (
    <div key={status} className={"jynx-thought " + s.cls}>
      <span className="jynx-thought-icon">{s.icon}</span>
      <span className="jynx-thought-text">{text || s.defaultText}</span>
    </div>
  );
}
