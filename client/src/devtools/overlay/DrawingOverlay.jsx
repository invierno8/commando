import React from "react";
import { createPortal } from "react-dom";

/* ================================================================== */
/* LEGO BLOCK — render-only: draws a saved drawing (see DrawingCanvas.js */
/* for how one gets created) back onto the page as an SVG overlay.       */
/* Points are stored as viewport percentages, converted back to pixels   */
/* against the CURRENT window size every render — correct relative       */
/* position even if the drawing was made on a different-sized screen,    */
/* though genuinely different aspect ratios will still distort it        */
/* somewhat (accepted trade-off, same as the rest of Jynx's position     */
/* system has no true responsive-reflow awareness either).                */
/* Not shown all the time — CommentsPanel.jsx's CommentDot and            */
/* AdminAnnotationMarkers.jsx's AdminMarkerDot both render this only      */
/* while their dot is hovered, so a page with several drawings doesn't    */
/* look permanently scribbled-on.                                        */
/*                                                                        */
/* A drawing is one or more strokes (drawing.strokes[], added 2026-08-23  */
/* for multi-step drawing — see DrawingCanvas.jsx) sharing one color,      */
/* stored on the drawing itself rather than passed in by every caller —   */
/* it's a property of what was drawn (the 4-swatch Jynx draw palette),     */
/* not of who's currently viewing it.                                      */
/* ================================================================== */
export default function DrawingOverlay({ drawing }) {
  if (!drawing?.strokes?.length) return null;
  const color = drawing.color || "var(--jynx)";

  return createPortal(
    <svg className="dev-overlay-ignore jynx-drawing-overlay">
      {drawing.strokes.map((s, i) => {
        const pixelPoints = s.points.map(([x, y]) => [(x / 100) * window.innerWidth, (y / 100) * window.innerHeight]);
        const pointsAttr = pixelPoints.map(([x, y]) => `${x},${y}`).join(" ");
        const isPolygon = s.type === "polygon";
        const Tag = isPolygon ? "polygon" : "polyline";
        return (
          <Tag
            key={i}
            points={pointsAttr}
            fill={isPolygon ? `color-mix(in srgb, ${color} 16%, transparent)` : "none"}
            stroke={color}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        );
      })}
    </svg>,
    document.body
  );
}
