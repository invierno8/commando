import React, { useEffect, useState } from "react";
import JynxFace from "./JynxFace.jsx";

/* ================================================================== */
/* LEGO BLOCK — replaces JynxThought.jsx (the floating "thought bubble"  */
/* callout above the Jynx bubble) per jynx-mt5e8ngp3qvx: "no more         */
/* dreaming thinking bubble... always animations or text in the bubble   */
/* [itself]... perfect its personality". Everything JynxThought used to   */
/* show (waking/thinking/welcome/error text) now renders INSIDE the       */
/* existing pill instead of in a separate floating element above it.      */
/*                                                                        */
/* Idle is the only mood that cycles — waking/thinking/typing/success/    */
/* error are meaningful transient states that need to stay legible, so    */
/* each gets one fixed face+text pairing, not a rotation. Idle cycles     */
/* through face-only / logo-only / both / a small wave every few seconds  */
/* ("sometimes only the eyes, sometimes only jynx logo, sometimes both"), */
/* so the bubble never looks like a static button even doing nothing.     */
/* ================================================================== */

const IDLE_FRAMES = ["face", "logo", "both", "wave"];
const IDLE_INTERVAL_MS = 4000;

export default function JynxBubbleContent({ mood, welcomeName, errorText }) {
  const [idleFrame, setIdleFrame] = useState(0);

  useEffect(() => {
    if (mood !== "idle") return;
    const t = setInterval(() => setIdleFrame((f) => (f + 1) % IDLE_FRAMES.length), IDLE_INTERVAL_MS);
    return () => clearInterval(t);
  }, [mood]);

  if (mood === "waking") {
    return (<><JynxFace mood="thinking" /><span className="jynx-logo">Waking up…</span></>);
  }
  if (mood === "thinking") {
    return (<><JynxFace mood="thinking" /><span className="jynx-logo">Thinking…</span></>);
  }
  if (mood === "success") {
    return (<><JynxFace mood="success" /><span className="jynx-logo">{welcomeName ? `Hi, ${welcomeName}!` : "Ready!"}</span></>);
  }
  if (mood === "error") {
    return (<><JynxFace mood="error" /><span className="jynx-logo jynx-logo-error">{errorText || "Hmm, that's not right"}</span></>);
  }
  if (mood === "typing") {
    return (<><JynxFace mood="typing" /><span className="jynx-logo">JYNX</span></>);
  }

  switch (IDLE_FRAMES[idleFrame]) {
    case "face": return <JynxFace mood="idle" />;
    case "logo": return <span className="jynx-logo">JYNX</span>;
    case "wave": return <span className="jynx-logo">👋</span>;
    default: return (<><JynxFace mood="idle" /><span className="jynx-logo">JYNX</span></>);
  }
}
