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
/* ================================================================== */
export default function DrawingOverlay({ drawing, color = "var(--jynx)" }) {
  if (!drawing?.points?.length) return null;
  const pixelPoints = drawing.points.map(([x, y]) => [(x / 100) * window.innerWidth, (y / 100) * window.innerHeight]);
  const pointsAttr = pixelPoints.map(([x, y]) => `${x},${y}`).join(" ");
  const isPolygon = drawing.type === "polygon";
  const Tag = isPolygon ? "polygon" : "polyline";

  return createPortal(
    <svg className="dev-overlay-ignore jynx-drawing-overlay">
      <Tag
        points={pointsAttr}
        fill={isPolygon ? `color-mix(in srgb, ${color} 16%, transparent)` : "none"}
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>,
    document.body
  );
}
