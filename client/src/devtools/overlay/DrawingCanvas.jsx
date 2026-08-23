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
/* Ending a single stroke near where it started (see CLOSE_THRESHOLD_PCT) */
/* auto-classifies THAT stroke as a closed "polygon" instead of an open    */
/* "freehand" line — no separate polygon tool needed.                      */
/*                                                                          */
/* Multi-step drawing (added 2026-08-23, per QA feedback that one stroke   */
/* forced you to comment before you could add anything else — no way to   */
/* build e.g. an arrow out of a shaft + two head lines): letting go no      */
/* longer ends the drawing. Each Ctrl/Cmd+drag appends one more stroke to  */
/* the same in-progress session (drawing.strokes[]); the session only      */
/* finalizes (calling onComplete, which opens the comment popover) on       */
/* Escape, or automatically if draw mode is turned off / the component is  */
/* deactivated while strokes are still pending — so a stray toggle never    */
/* silently discards work already drawn.                                    */
/* ================================================================== */

const CLOSE_THRESHOLD_PCT = 3;

function toPercent(clientX, clientY) {
  return [(clientX / window.innerWidth) * 100, (clientY / window.innerHeight) * 100];
}

function strokeFromPoints(points) {
  const [sx, sy] = points[0];
  const [ex, ey] = points[points.length - 1];
  const type = Math.hypot(ex - sx, ey - sy) < CLOSE_THRESHOLD_PCT ? "polygon" : "freehand";
  return { points, type };
}

export default function DrawingCanvas({ active, onComplete, color = "var(--jynx)" }) {
  const [strokes, setStrokes] = useState([]); // completed strokes this session — [{points, type}]
  const [livePoints, setLivePoints] = useState([]); // current in-progress stroke
  const strokesRef = useRef([]);
  const pointsRef = useRef([]);
  const drawingRef = useRef(false);
  const lastScreenRef = useRef(null); // last known {x,y} in real screen pixels, for Escape/deactivate finalize
  // Latest onComplete/color read via refs rather than effect deps — neither
  // is memoized by the caller, so depending on them directly would re-run
  // this effect (and its finalize-on-cleanup) on every unrelated parent
  // render, ending the drawing session the instant anything else changed.
  const onCompleteRef = useRef(onComplete);
  const colorRef = useRef(color);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);
  useEffect(() => { colorRef.current = color; }, [color]);

  useEffect(() => {
    if (!active) return;

    function finishSession() {
      const finalStrokes = strokesRef.current;
      strokesRef.current = [];
      setStrokes([]);
      if (!finalStrokes.length) return;
      const xs = finalStrokes.flatMap((s) => s.points.map((p) => p[0]));
      const ys = finalStrokes.flatMap((s) => s.points.map((p) => p[1]));
      const cx = ((Math.min(...xs) + Math.max(...xs)) / 2 / 100) * window.innerWidth;
      const cy = ((Math.min(...ys) + Math.max(...ys)) / 2 / 100) * window.innerHeight;
      const last = lastScreenRef.current || { x: cx, y: cy };
      onCompleteRef.current({
        drawing: { strokes: finalStrokes, color: colorRef.current },
        targetEl: document.elementFromPoint(cx, cy),
        screenX: last.x,
        screenY: last.y,
      });
    }

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
      lastScreenRef.current = { x: e.clientX, y: e.clientY };
      if (finalPoints.length < 2) return;
      const nextStrokes = [...strokesRef.current, strokeFromPoints(finalPoints)];
      strokesRef.current = nextStrokes;
      setStrokes(nextStrokes);
    }
    function onKeyDown(e) {
      if (e.key === "Escape" && strokesRef.current.length) finishSession();
    }
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("pointermove", onPointerMove, true);
    window.addEventListener("pointerup", onPointerUp, true);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("pointermove", onPointerMove, true);
      window.removeEventListener("pointerup", onPointerUp, true);
      window.removeEventListener("keydown", onKeyDown);
      // draw mode turned off (or the popover opened) mid-session — finalize
      // whatever's already drawn instead of silently dropping it.
      finishSession();
    };
  }, [active]);

  if (!active || (livePoints.length < 2 && !strokes.length)) return null;

  function pointsAttr(points) {
    return points.map(([x, y]) => `${(x / 100) * window.innerWidth},${(y / 100) * window.innerHeight}`).join(" ");
  }

  return createPortal(
    <svg className="dev-overlay-ignore jynx-drawing-live">
      {strokes.map((s, i) => {
        const Tag = s.type === "polygon" ? "polygon" : "polyline";
        return (
          <Tag
            key={i}
            points={pointsAttr(s.points)}
            fill={s.type === "polygon" ? `color-mix(in srgb, ${color} 16%, transparent)` : "none"}
            stroke={color}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        );
      })}
      {livePoints.length >= 2 && (
        <polyline points={pointsAttr(livePoints)} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>,
    document.body
  );
}
