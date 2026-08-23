import { useEffect } from "react";

/* ================================================================== */
/* LEGO BLOCK — a plain DOM CustomEvent, not React context, to connect   */
/* "click a @mention or an author name" (deeply nested in CommentsPanel  */
/* .jsx / DevAnnotationsScreen.jsx / JynxFeedbackScreen.jsx /            */
/* AdminAnnotationMarkers.jsx / DevAdminUsersScreen.jsx / MentionsBell    */
/* .jsx — six independent components with no shared parent below         */
/* DevAuthGate.jsx) to "open UserProfileCard.jsx", which mounts once at   */
/* the top (DevAuthGate.jsx). Threading a context/prop through six        */
/* unrelated call sites for a single "open this modal" action would be    */
/* far more invasive than the codebase's existing precedent for this      */
/* exact kind of cross-component signal (see data-jynx-dock-zone in       */
/* DevAuthGate.jsx/DevFab.jsx, found via a plain DOM query rather than     */
/* threaded state).                                                       */
/* ================================================================== */

const EVENT = "jynx:open-user-profile";

export function openUserProfile(userId) {
  if (!userId) return;
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { userId } }));
}

export function useOpenUserProfileListener(onOpen) {
  useEffect(() => {
    function handler(e) { onOpen(e.detail.userId); }
    window.addEventListener(EVENT, handler);
    return () => window.removeEventListener(EVENT, handler);
  }, [onOpen]);
}
