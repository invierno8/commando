import { useEffect } from "react";

/* ================================================================== */
/* LEGO BLOCK — for Jynx chrome that ISN'T itself draggable (see          */
/* useDraggableFab.js for that case) but opens/pops out relative to an   */
/* anchor that might be near a viewport edge — e.g. the login panel,      */
/* which always opens upward-and-rightward from wherever the locked FAB  */
/* was last dragged to. Measures the panel's real rendered box every      */
/* time it's open (and on resize) and nudges it back fully into view      */
/* with a corrective translate() if any edge overflows, instead of        */
/* letting it render partly or fully off-screen with no way to reach it.  */
/* ================================================================== */
// watch: אופציונלי — ערכים נוספים שגידול/שינוי בהם עשוי לשנות את גובה/רוחב
// הפאנל בזמן שהוא כבר פתוח (למשל הופעת שורת שגיאה בטופס ההתחברות), כדי
// שהמדידה תתבצע שוב גם בלי שינוי גודל חלון.
export function useKeepInViewport(ref, active, margin = 8, watch = []) {
  useEffect(() => {
    if (!active) return;
    function reposition() {
      const el = ref.current;
      if (!el) return;
      el.style.transform = "";
      const rect = el.getBoundingClientRect();
      let dx = 0;
      let dy = 0;
      if (rect.left < margin) dx = margin - rect.left;
      else if (rect.right > window.innerWidth - margin) dx = window.innerWidth - margin - rect.right;
      if (rect.top < margin) dy = margin - rect.top;
      else if (rect.bottom > window.innerHeight - margin) dy = window.innerHeight - margin - rect.bottom;
      if (dx || dy) el.style.transform = `translate(${dx}px, ${dy}px)`;
    }
    reposition();
    window.addEventListener("resize", reposition);
    return () => window.removeEventListener("resize", reposition);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, ...watch]);
}
