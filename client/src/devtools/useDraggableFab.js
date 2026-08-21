import { useRef, useState } from "react";

/* ================================================================== */
/* LEGO BLOCK — shared drag behavior for every piece of Jynx chrome     */
/* (the main locked button, the role-switcher, the toolbar, the         */
/* comments sidebar). Position is tracked as {[right|left], bottom} —   */
/* physical, not top/left-only — so it stays correct under RTL, and     */
/* persists per-piece in localStorage so each stays wherever it was     */
/* left across reloads. anchor:"left" is for chrome that starts on the  */
/* opposite side from the main right-side button cluster (e.g. the      */
/* comments sidebar), so its default position doesn't collide with      */
/* them. A tiny movement threshold (4px) tells a real drag apart from a */
/* clean click, so the underlying button's onClick still works normally */
/* when nothing was dragged.                                            */
/* ================================================================== */

const DEFAULT_POS = { right: 20, bottom: 20 };

function readStoredPos(key, fallback, horizKey) {
  try {
    const raw = JSON.parse(localStorage.getItem(key));
    if (raw && typeof raw[horizKey] === "number" && typeof raw.bottom === "number") return raw;
  } catch { /* ignore */ }
  return fallback;
}

export function useDraggableFab(storageKey, defaultPos = DEFAULT_POS, anchor = "right") {
  const horizKey = anchor === "left" ? "left" : "right";
  const [pos, setPos] = useState(() => readStoredPos(storageKey, defaultPos, horizKey));
  const dragRef = useRef({ dragging: false, moved: false, startX: 0, startY: 0, startPos: defaultPos });

  function onPointerDown(e) {
    dragRef.current = { dragging: true, moved: false, startX: e.clientX, startY: e.clientY, startPos: pos };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }
  function onPointerMove(e) {
    const d = dragRef.current;
    if (!d.dragging) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) d.moved = true;
    if (!d.moved) return;
    // גרירה ימינה מגדילה את המרחק מ-right אבל מקטינה את המרחק מ-left — הפוך.
    const horizStart = d.startPos[horizKey] ?? 0;
    const next = { [horizKey]: Math.max(4, anchor === "left" ? horizStart + dx : horizStart - dx), bottom: Math.max(4, d.startPos.bottom - dy) };
    setPos(next);
  }
  function onPointerUp() {
    const d = dragRef.current;
    if (!d.dragging) return;
    d.dragging = false;
    if (d.moved) {
      try { localStorage.setItem(storageKey, JSON.stringify(pos)); } catch { /* ignore */ }
    }
  }
  // קליק "אמיתי" (לא גרירה) — לקרוא בתוך onClick, לפני שמפעילים את הפעולה.
  function consumeWasDragged() {
    if (dragRef.current.moved) { dragRef.current.moved = false; return true; }
    return false;
  }

  return { pos, dragHandlers: { onPointerDown, onPointerMove, onPointerUp }, consumeWasDragged };
}
