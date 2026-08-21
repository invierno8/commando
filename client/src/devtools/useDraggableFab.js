import { useRef, useState } from "react";

/* ================================================================== */
/* LEGO BLOCK — shared drag behavior for every piece of Jynx chrome     */
/* (the main locked button, the role-switcher, the toolbar). Position   */
/* is tracked as {right, bottom} — not {top, left} — so it stays        */
/* correct under RTL, and persists per-piece in localStorage so each    */
/* stays wherever it was left across reloads. A tiny movement threshold */
/* (4px) tells a real drag apart from a clean click, so the underlying  */
/* button's onClick still works normally when nothing was dragged.      */
/* ================================================================== */

const DEFAULT_POS = { right: 20, bottom: 20 };

function readStoredPos(key, fallback) {
  try {
    const raw = JSON.parse(localStorage.getItem(key));
    if (raw && typeof raw.right === "number" && typeof raw.bottom === "number") return raw;
  } catch { /* ignore */ }
  return fallback;
}

export function useDraggableFab(storageKey, defaultPos = DEFAULT_POS) {
  const [pos, setPos] = useState(() => readStoredPos(storageKey, defaultPos));
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
    const next = { right: Math.max(4, d.startPos.right - dx), bottom: Math.max(4, d.startPos.bottom - dy) };
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
