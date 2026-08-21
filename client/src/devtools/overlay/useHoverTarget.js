/* ================================================================== */
/* LEGO BLOCK — hybrid container detection for the dev overlay. Primary  */
/* signal is an opt-in data-devblock="<label>" attribute on structurally */
/* meaningful wrappers (added incrementally per screen). Fallback: walk  */
/* up from the hovered element to the first ancestor whose computed      */
/* display is flex/grid, or whose class matches a known theme.js/screen  */
/* primitive — this is what makes the highlight "snap" to a card/row/    */
/* panel instead of lighting up every nested <div> on the page.          */
/* ================================================================== */

import { useEffect, useRef, useState } from "react";

const FALLBACK_CLASS_HINTS = [
  "panel-card", "pill-tabs", "add-form", "ticket-row", "prod-card-wrap",
  "org-node", "dash-widget", "perm-row", "team-card", "person-card-modal",
  "modal", "search-filter-row",
];

function hasHintClass(el) {
  const cls = el.className;
  if (typeof cls !== "string" || !cls) return false;
  const list = cls.split(/\s+/);
  return FALLBACK_CLASS_HINTS.some((c) => list.includes(c));
}

function isContainerLike(el) {
  if (!el || el === document.body || el === document.documentElement) return false;
  if (el.dataset?.devblock) return true;
  if (hasHintClass(el)) return true;
  const display = window.getComputedStyle(el).display;
  return display === "flex" || display === "grid";
}

function findTarget(el) {
  let node = el;
  while (node && node !== document.body) {
    if (isContainerLike(node)) return node;
    node = node.parentElement;
  }
  return el; // שום דבר "מעניין" יותר בדרך — עדיף האלמנט הגולמי מכלום
}

// allowJynxChrome: מותר "לגלוש" גם על ה-UI של Jynx עצמו (ה-FAB, סרגל הכלים,
// פאנל הניהול — מסומנים .jynx-chrome) כדי לתת משוב על המערכת עצמה, למי
// שמורשה — מנהל, או משתמש-פיתוח עם canJynxComment:true (הקורא, DevOverlay.jsx,
// מעביר isAdmin || canJynxComment כאן). למי שאין לו אף אחת מהשתיים
// .jynx-chrome תמיד חסום, בדיוק כמו .dev-overlay-ignore (שנשאר חסום לגמרי
// לכולם — זה ה-UI של ה-overlay עצמו: הבועה, ההילה, הסימונים — אף פעם לא
// יעד תקין, גם לא למי שמורשה ל-jynx-chrome).
export function useHoverTarget(active, allowJynxChrome) {
  const [target, setTarget] = useState(null);
  const rafRef = useRef(null);

  useEffect(() => {
    if (!active) {
      setTarget(null);
      return;
    }
    function onMove(e) {
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        const el = document.elementFromPoint(e.clientX, e.clientY);
        if (!el || el.closest(".dev-overlay-ignore")) {
          setTarget(null);
          return;
        }
        if (el.closest(".jynx-chrome") && !allowJynxChrome) {
          setTarget(null);
          return;
        }
        setTarget(findTarget(el));
      });
    }
    window.addEventListener("mousemove", onMove);
    return () => {
      window.removeEventListener("mousemove", onMove);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [active, allowJynxChrome]);

  return target;
}

export function labelForElement(el) {
  if (!el) return "?";
  if (el.dataset?.devblock) return el.dataset.devblock;
  const cls = typeof el.className === "string" ? el.className.split(/\s+/).find(Boolean) : null;
  return cls || el.tagName?.toLowerCase() || "?";
}
