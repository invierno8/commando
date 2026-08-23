import React, { useEffect, useRef, useState } from "react";

/* ================================================================== */
/* LEGO BLOCK — a tiny animated face inside the Jynx bubble itself       */
/* (jynx-mt51mv19l46u: "make it have a face... any other state make it  */
/* move inside... react to me typing or sending"). Two eye-dots + a     */
/* mouth, all plain CSS (no SVG/asset dependency, matches the rest of   */
/* this dev-tool's zero-external-UI-library convention). `mood` drives  */
/* both shape (className) and behavior:                                 */
/*  - idle: blinks on a randomized interval, eyes drift slightly toward */
/*    the cursor (subtle — a few px, never enough to look glitchy).      */
/*  - typing: quick, alert blinking, no cursor-tracking (attention is on */
/*    the input, not roaming).                                          */
/*  - thinking/success/error: single fixed expression, matching          */
/*    JynxThought's tone for the same status names.                     */
/* Deliberately kept inside the small bubble itself, not a replacement   */
/* for the JYNX wordmark — this sits above it as a second, tinier detail, */
/* the same relationship JynxThought has to the bubble (an addition, not */
/* a redesign of the existing brand mark).                               */
/* ================================================================== */

export default function JynxFace({ mood = "idle" }) {
  const [blink, setBlink] = useState(false);
  const [look, setLook] = useState({ x: 0, y: 0 });
  const faceRef = useRef(null);

  useEffect(() => {
    if (mood !== "idle" && mood !== "typing") return;
    let cancelled = false;
    const gap = mood === "typing" ? 1400 : 2600;
    function scheduleBlink() {
      const delay = gap + Math.random() * gap;
      window.setTimeout(() => {
        if (cancelled) return;
        setBlink(true);
        window.setTimeout(() => { if (!cancelled) setBlink(false); }, 140);
        scheduleBlink();
      }, delay);
    }
    scheduleBlink();
    return () => { cancelled = true; };
  }, [mood]);

  useEffect(() => {
    if (mood !== "idle") { setLook({ x: 0, y: 0 }); return; }
    function onMove(e) {
      const el = faceRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const dist = Math.hypot(dx, dy) || 1;
      const maxShift = 1.4;
      setLook({ x: (dx / dist) * maxShift, y: (dy / dist) * maxShift });
    }
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [mood]);

  const eyeStyle = mood === "idle" ? { transform: `translate(${look.x}px, ${look.y}px)` } : undefined;

  return (
    <div ref={faceRef} className={"jynx-face jynx-face-" + mood} aria-hidden="true">
      <span className={"jynx-face-eye" + (blink ? " jynx-face-blink" : "")} style={eyeStyle} />
      <span className={"jynx-face-eye" + (blink ? " jynx-face-blink" : "")} style={eyeStyle} />
    </div>
  );
}
