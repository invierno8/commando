import React, { useEffect, useState } from "react";
import JynxFace from "./JynxFace.jsx";

/* ================================================================== */
/* LEGO BLOCK — Jynx's personality now lives entirely inside its own     */
/* bubble (jynx-mt5e8ngp3qvx: "no more of the chat/dreaming bubble       */
/* above it... all animated in the jynx bubble personality"). This      */
/* replaces the old JynxThought.jsx floating caption that popped up      */
/* above the bubble on status changes: that text/icon now renders       */
/* *inside* the same bubble button as the face, taking over the spot    */
/* the static "JYNX" wordmark used to always occupy.                    */
/*                                                                      */
/* Two behaviors:                                                       */
/*  - a `statusText` is given (waking/thinking/success/error) → always  */
/*    show the face (reacting via `mood`) AND the status text, replacing */
/*    the wordmark, with a pop-in animation — same info JynxThought used */
/*    to carry, just relocated.                                          */
/*  - no statusText (idle/typing, nothing actually happening) → cycle    */
/*    between showing only the eyes, only the "JYNX" wordmark, and both  */
/*    together, fading between them, so the bubble never sits fully      */
/*    static — "sometimes only the eyes, sometimes only jynx logo        */
/*    sometimes both, always animations".                                */
/* `icon` (e.g. the Lock/spinner glyphs) is unrelated to personality and  */
/* always rendered as-is, between the face and the label.                */
/* ================================================================== */

const IDLE_CYCLE = ["both", "face", "logo"];

export default function JynxBubbleFace({ mood = "idle", statusText, icon }) {
  const [phase, setPhase] = useState(0);
  const cycling = !statusText && (mood === "idle" || mood === "typing");

  useEffect(() => {
    if (!cycling) return;
    const id = window.setInterval(() => {
      setPhase((p) => (p + 1) % IDLE_CYCLE.length);
    }, 3200 + Math.random() * 1400);
    return () => window.clearInterval(id);
  }, [cycling]);

  const idleShape = cycling ? IDLE_CYCLE[phase] : "both";
  const showFace = statusText || idleShape !== "logo";
  const label = statusText || (idleShape !== "face" ? "JYNX" : null);

  return (
    <>
      {showFace && <JynxFace mood={mood} />}
      {icon}
      {label && (
        <span key={label} className={"jynx-logo" + (statusText ? ` jynx-logo-status jynx-logo-status-${mood}` : "")}>
          {label}
        </span>
      )}
    </>
  );
}
