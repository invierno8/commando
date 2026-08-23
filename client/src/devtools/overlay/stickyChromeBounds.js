/* ================================================================== */
/* jynx-mt5edij0xz1s: "some jynx overlayes are above the nav bar in       */
/* z index so its just all over the place when scrolling, like the       */
/* dots". Root cause: comment dots/highlights render in a portal with a   */
/* very high z-index (deliberately, so they sit above every app screen —  */
/* see AdminAnnotationMarkers.jsx's own note on this), positioned purely  */
/* from the target element's getBoundingClientRect(). When the page       */
/* scrolls a target up underneath the app's own sticky header/sidebar     */
/* (.app-topbar / .app-sidebar, theme.js), the target is visually hidden  */
/* there — but its dot has no such awareness, so it keeps floating on TOP */
/* of the sticky chrome instead of disappearing with the thing it's       */
/* pointing at. One shared check, used by both AdminAnnotationMarkers.jsx */
/* and CommentsPanel.jsx's on-page dots, rather than duplicating the      */
/* sticky-selector list in each.                                          */
/* ================================================================== */

const STICKY_SELECTORS = [".app-topbar", ".app-sidebar"];

export function getStickyChromeRects() {
  return STICKY_SELECTORS
    .map((sel) => document.querySelector(sel))
    .filter(Boolean)
    .map((el) => el.getBoundingClientRect());
}

export function isCoveredBySticky(rect, stickyRects) {
  return stickyRects.some((s) =>
    rect.top < s.bottom && rect.bottom > s.top && rect.left < s.right && rect.right > s.left
  );
}
