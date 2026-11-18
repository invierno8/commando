import { useEffect, useRef, useState } from "react";

/* ================================================================== */
/* LEGO BLOCK — shared drag behavior for every piece of Jynx chrome     */
/* (the main locked button, the role-switcher, the toolbar, the         */
/* comments sidebar, the annotate popover). Position is tracked as      */
/* {[right|left], bottom} — physical, not top/left-only — so it stays   */
/* correct under RTL, and persists per-piece in localStorage so each    */
/* stays wherever it was left across reloads. anchor:"left" is for      */
/* chrome that starts on the opposite side from the main right-side     */
/* button cluster (e.g. the comments sidebar), so its default position  */
/* doesn't collide with them. A tiny movement threshold (4px) tells a   */
/* real drag apart from a clean click, so the underlying button's       */
/* onClick still works normally when nothing was dragged. Pointer       */
/* capture is deferred until real movement is detected (not on every    */
/* pointerdown) — some chrome pieces (the toolbar, the comments sidebar */
/* header) now use their whole bar as the drag target instead of a      */
/* small dedicated grip, so an immediate capture on pointerdown would   */
/* swallow a plain click on a child button before it ever fires.        */
/*                                                                       */
/* Viewport awareness: every position (freshly read from localStorage   */
/* on mount, mid-drag, or after a window resize) is clamped against the */
/* dragged element's OWN measured size — not an estimate — so a piece   */
/* of Jynx chrome can never end up positioned partly or fully outside   */
/* the visible viewport with no way to drag it back into view. This is  */
/* what previously let an aggressive drag (or a position saved on a     */
/* larger screen, then loaded on a smaller one) push the toolbar/bubble */
/* off-screen: the old clamp only had a floor (Math.max(4, ...)), never */
/* a ceiling, so `bottom`/`right`/`left` could grow past the window's   */
/* actual size with nothing pulling it back in. IMPORTANT: `sizeRef`    */
/* must be attached to whichever element is actually sized/positioned   */
/* (the box being placed), even if the grab handle for `dragHandlers`   */
/* is a small child of it (e.g. a grip icon) — attaching it to the grip */
/* instead would measure the grip's tiny size, not the real box, and    */
/* silently under-clamp the box itself.                                 */
/* ================================================================== */

const DEFAULT_POS = { right: 20, bottom: 20 };
const EDGE_MARGIN = 4;

function readStoredPos(key, fallback, horizKey) {
  try {
    const raw = JSON.parse(localStorage.getItem(key));
    if (raw && typeof raw[horizKey] === "number" && typeof raw.bottom === "number") return raw;
  } catch { /* ignore */ }
  return fallback;
}

// מוגבל תמיד לגודל האמיתי (measured, לא מוערך) של האלמנט הנגרר מול ה-viewport
// הנוכחי. מחזיר את אותו ה-object כשאין צורך בשינוי (לא object חדש עם אותם
// ערכים) כדי ש-setState עם תוצאה זהה לא יגרום לרינדור נוסף — מה שמאפשר לקרוא
// לזה בבטחה אחרי כל רינדור, לא רק פעם אחת ב-mount.
function clampToViewport(pos, horizKey, el) {
  const w = el?.offsetWidth || 0;
  const h = el?.offsetHeight || 0;
  const maxHoriz = Math.max(EDGE_MARGIN, window.innerWidth - w - EDGE_MARGIN);
  const maxBottom = Math.max(EDGE_MARGIN, window.innerHeight - h - EDGE_MARGIN);
  const horiz = Math.min(Math.max(EDGE_MARGIN, pos[horizKey] ?? EDGE_MARGIN), maxHoriz);
  const bottom = Math.min(Math.max(EDGE_MARGIN, pos.bottom ?? EDGE_MARGIN), maxBottom);
  return horiz === pos[horizKey] && bottom === pos.bottom ? pos : { [horizKey]: horiz, bottom };
}

// onDragEnd (אופציונלי) — נקרא פעם אחת בסיום גרירה *אמיתית* (moved===true),
// עם המיקום הסופי והאלמנט הנגרר עצמו. נועד לזיהוי "שוחרר מעל יעד-עגינה
// מסוים" (למשל DevFab.jsx בודק חפיפה עם סרגל ה-Jynx כדי לחבר את הבורר
// חזרה לתפריט) בלי לפרק את ה-hook המשותף הזה לגרסה-מודעת-ליעד.
export function useDraggableFab(storageKey, defaultPos = DEFAULT_POS, anchor = "right", onDragEnd) {
  const horizKey = anchor === "left" ? "left" : "right";
  const [pos, setPos] = useState(() => readStoredPos(storageKey, defaultPos, horizKey));
  const dragRef = useRef({ dragging: false, moved: false, startX: 0, startY: 0, startPos: defaultPos });
  const elRef = useRef(null);

  // אחרי כל רינדור — כולל למשל מעבר בין הבועה המכווצת לסרגל המלא, שמשנה את
  // גודל האלמנט הנגרר בפועל — ובכל שינוי גודל חלון, מיישר את הפינה בחזרה
  // לתוך ה-viewport הנוכחי. ה-guard בתוך clampToViewport מבטיח שאין לולאה.
  useEffect(() => {
    setPos((p) => clampToViewport(p, horizKey, elRef.current));
  });
  useEffect(() => {
    function onResize() {
      setPos((p) => clampToViewport(p, horizKey, elRef.current));
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onPointerDown(e) {
    dragRef.current = {
      dragging: true, moved: false, startX: e.clientX, startY: e.clientY, startPos: pos,
      pointerId: e.pointerId, target: e.currentTarget,
    };
    // הלכידה (setPointerCapture) לא קורית כאן בכוונה. מאז ש-.dev-fab-toolbar/
    // .comments-sidebar-head עצמם הפכו ליעד-גרירה (לא רק ידית-גרירה קטנה
    // בפנים), לכידה מיידית כאן שברה את ה-onClick של כל כפתור-ילד בתוכם — קליק
    // רגיל (בלי תזוזה) על "לכידת" הצביע מיד ל-container, כך שה-click הטבעי של
    // הכפתור הפנימי כבר לא נורה. נלכדת רק אחרי שזוהתה תזוזה אמיתית (ראו
    // onPointerMove) — קליק נקי אף פעם לא מגיע לשם, אז לעולם לא שובר אותו.
  }
  function onPointerMove(e) {
    const d = dragRef.current;
    if (!d.dragging) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
      d.moved = true;
      d.target?.setPointerCapture?.(d.pointerId);
    }
    if (!d.moved) return;
    // גרירה ימינה מגדילה את המרחק מ-right אבל מקטינה את המרחק מ-left — הפוך.
    const horizStart = d.startPos[horizKey] ?? 0;
    const next = { [horizKey]: anchor === "left" ? horizStart + dx : horizStart - dx, bottom: d.startPos.bottom - dy };
    setPos(clampToViewport(next, horizKey, elRef.current));
  }
  function onPointerUp() {
    const d = dragRef.current;
    if (!d.dragging) return;
    d.dragging = false;
    if (d.moved) {
      try { localStorage.setItem(storageKey, JSON.stringify(pos)); } catch { /* ignore */ }
      onDragEnd?.(pos, elRef.current);
    }
  }
  // קליק "אמיתי" (לא גרירה) — לקרוא בתוך onClick, לפני שמפעילים את הפעולה.
  function consumeWasDragged() {
    if (dragRef.current.moved) { dragRef.current.moved = false; return true; }
    return false;
  }

  return { pos, dragHandlers: { onPointerDown, onPointerMove, onPointerUp }, sizeRef: elRef, consumeWasDragged };
}
