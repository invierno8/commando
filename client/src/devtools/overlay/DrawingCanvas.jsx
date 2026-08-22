import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/* ================================================================== */
/* LEGO BLOCK — Ctrl/Cmd+drag freehand drawing, active only while draw   */
/* mode is on (pencil icon in the toolbar). Deliberately window-level    */
/* pointer listeners (capture phase), same pattern as DevOverlay.jsx's   */
/* own Ctrl+click handler, rather than a full-screen pointer-catching    */
/* <div> — that way normal page interaction is completely untouched      */
/* whenever Ctrl/Cmd isn't actually held, even while draw mode is on.    */
/*                                                                        */
/* Points are stored as PERCENTAGES of the current viewport (0-100), not */
/* pixels — see the matching server-side field in                        */
/* data/routes/annotations.js — so a saved drawing scales back to the     */
/* right relative spot on a differently-sized screen instead of only      */
/* being correct on the exact viewport it was drawn on.                  */
/*                                                                         */
/* Ending the stroke near where it started (see CLOSE_THRESHOLD_PCT)      */
/* auto-classifies it as a closed "polygon" instead of an open            */
/* "freehand" line — no separate polygon tool needed, drawing back to      */
/* your own start point IS the polygon gesture.                           */
/* ================================================================== */

const CLOSE_THRESHOLD_PCT = 3;

function toPercent(clientX, clientY) {
  return [(clientX / window.innerWidth) * 100, (clientY / window.innerHeight) * 100];
}

export default function DrawingCanvas({ active, onComplete }) {
  const [livePoints, setLivePoints] = useState([]);
  const pointsRef = useRef([]);
  const drawingRef = useRef(false);

  useEffect(() => {
    if (!active) return;
    function onPointerDown(e) {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.target.closest?.(".dev-overlay-ignore, .jynx-chrome")) return;
      e.preventDefault();
      e.stopPropagation();
      drawingRef.current = true;
      const start = [toPercent(e.clientX, e.clientY)];
      pointsRef.current = start;
      setLivePoints(start);
    }
    function onPointerMove(e) {
      if (!drawingRef.current) return;
      e.preventDefault();
      const next = [...pointsRef.current, toPercent(e.clientX, e.clientY)];
      pointsRef.current = next;
      setLivePoints(next);
    }
    function onPointerUp(e) {
      if (!drawingRef.current) return;
      drawingRef.current = false;
      const finalPoints = pointsRef.current;
      pointsRef.current = [];
      setLivePoints([]);
      if (finalPoints.length < 2) return;
      const [sx, sy] = finalPoints[0];
      const [ex, ey] = finalPoints[finalPoints.length - 1];
      const type = Math.hypot(ex - sx, ey - sy) < CLOSE_THRESHOLD_PCT ? "polygon" : "freehand";
      const xs = finalPoints.map((p) => p[0]);
      const ys = finalPoints.map((p) => p[1]);
      const cx = ((Math.min(...xs) + Math.max(...xs)) / 2 / 100) * window.innerWidth;
      const cy = ((Math.min(...ys) + Math.max(...ys)) / 2 / 100) * window.innerHeight;
      onComplete({
        drawing: { points: finalPoints, type },
        targetEl: document.elementFromPoint(cx, cy),
        screenX: e.clientX,
        screenY: e.clientY,
      });
    }
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("pointermove", onPointerMove, true);
    window.addEventListener("pointerup", onPointerUp, true);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("pointermove", onPointerMove, true);
      window.removeEventListener("pointerup", onPointerUp, true);
    };
  }, [active, onComplete]);

  if (!active || livePoints.length < 2) return null;

  const pointsAttr = livePoints.map(([x, y]) => `${(x / 100) * window.innerWidth},${(y / 100) * window.innerHeight}`).join(" ");

  return createPortal(
    <svg className="dev-overlay-ignore jynx-drawing-live">
      <polyline points={pointsAttr} fill="none" stroke="var(--jynx)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>,
    document.body
  );
}
