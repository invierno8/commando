import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { MessageSquare, ChevronDown, ChevronUp, GripVertical, CheckCircle2, MessageCircle, Pencil, Paperclip, Zap, Loader2, GitPullRequest, XCircle, Sparkles, RotateCcw, Check, Undo2, Trash2, Search, Calendar, Crosshair, X } from "lucide-react";
import {
  fetchDevAnnotations, replyToAnnotation, editMyAnnotation, reactToAnnotation, requestAnnotationAction,
  fetchJynxFeedback, fetchMyJynxFeedback, replyToJynxFeedback, reactToJynxFeedback, submitJynxFeedback,
  resolveAnnotation, resolveJynxFeedback, deleteAnnotation, deleteMyAnnotation, deleteMyJynxFeedback, devLogin,
} from "../devApi.js";
import { useDraggableFab } from "../useDraggableFab.js";
import DrawingOverlay from "./DrawingOverlay.jsx";
import { parseMentionQuery, matchMentionCandidates, insertMentionText, renderWithMentions as renderMentionsShared, useDevUserDirectory } from "../mentionUtils.jsx";
import { openUserProfile } from "../openUserProfile.js";
import { findTarget, labelForElement } from "./useHoverTarget.js";
import { getStickyChromeRects, isCoveredBySticky } from "./stickyChromeBounds.js";

// "Last 24h / Last week / Last month" (jynx-mt5f2ow7dqrw) — plain ms
// windows off Date.now(), not calendar-aligned days, same "good enough for
// a QA filter, not a reporting tool" spirit as the rest of this overlay.
const DATE_FILTER_WINDOWS = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

const ACTION_STATUS_LABEL = { queued: "Queued", in_progress: "In progress", pr_opened: "PR opened", done: "Done", failed: "Failed" };
const ACTION_STATUS_ICON = { queued: Loader2, in_progress: Loader2, pr_opened: GitPullRequest, done: CheckCircle2, failed: XCircle };

// פלטת ריאקציות קטנה וקבועה בכוונה — לא ספריית emoji-picker (אין ספריות UI
// חיצוניות נוספות בקודבייס הזה, ראו FORCLAUDE.md). זהה למה שהשרת מאמת מולו
// (ראו data/routes/annotations.js ו-data/routes/jynx-feedback.js).
const REACTION_EMOJI = ["👍", "😄", "🤔", "❤️"];

// מדגיש @שם/@jynx בטקסט תגובה שכבר נשלח — ראו mentionUtils.jsx. עד
// 2026-08-23 היה משותף גם עם DevAnnotationsScreen.jsx/JynxFeedbackScreen.jsx
// (שרשורי-תגובה בפאנל הניהול) — שני אלה נמחקו כשניהול ההערות עבר כולו לכאן
// (ראו הבלוק למעלה), אז זה כרגע היחיד שמשתמש בפונקציה המשותפת הזו, אבל
// mentionUtils.jsx עצמו נשאר מודול משותף בכוונה למקרה שדבר-מה יזדקק לזה שוב.
// `directory` (ראו useDevUserDirectory) הופך אזכור אמיתי ללחיץ — קליק פותח
// את כרטיס הפרופיל של אותו משתמש (openUserProfile.js, UserProfileCard.jsx).
function renderWithMentions(text, directory) {
  return renderMentionsShared(text, { mentionClassName: "comments-mention", jynxClassName: "comments-mention-jynx", directory });
}

/* ================================================================== */
/* LEGO BLOCK — "who commented on what, here" for EVERY dev user (not    */
/* admin-only, unlike AdminAnnotationMarkers.jsx which is the always-on   */
/* status-dot overlay, a separate thing). Sharing one fetch:              */
/*  1. Small dots on commented elements — hover an element's dot to      */
/*     reveal the comment(s) on it (hidden by default, so it doesn't      */
/*     clutter the page like admin's always-expanded markers).           */
/*  2. A draggable, collapsible side list of comments — Open/Done tabs,   */
/*     "just mine" toggle, and (added 2026-08-23, work item                */
/*     jynx-mt558crxb02w) a "This page / All pages" scope toggle: "This    */
/*     page" is the route-filtered view, "All pages" drops the route       */
/*     filter entirely and shows every route's comment (each tagged with   */
/*     its own route so you can tell them apart). Defaults to "All pages"  */
/*     (changed 2026-08-25, jynx-mt8j2qfgvo1w — a real QA report of         */
/*     opening this panel on a screen with few/no comments of its own and  */
/*     seeing "nothing there" despite plenty existing on other screens;    */
/*     "This page" as the starting scope buried them behind a toggle       */
/*     nobody had a reason to discover yet) — this is what makes this      */
/*     panel a genuine single place to see every open comment by default,  */
/*     not just this screen's. Hovering a row outlines the                 */
/*     matching page element in the Jynx brand color; clicking a row        */
/*     scrolls to and flashes it — both are necessarily a no-op for a       */
/*     cross-route item in "All pages" mode (its element isn't in this      */
/*     page's DOM at all), guarded in jumpTo()/rectFor() below.             */
/*  3. Reply threads per comment — any dev user can add a follow-up,      */
/*     so a resolved comment's author can react to the fix (or anyone     */
/*     can ask a clarifying question before it's resolved).               */
/*  4. Inline self-edit — a pencil icon shown only on your own comments    */
/*     (authorId === currentDevUserId), swapping the text for a textarea   */
/*     + Save/Cancel, calling editMyAnnotation() then reload(). Server-    */
/*     side enforced too (PATCH /dev/annotations/:id 403s for anyone       */
/*     else's comment) — this is just where the UI for it lives.           */
/*  5. Admin management (added 2026-08-23, same work item as #2) —         */
/*     resolve/reopen and delete, for whichever admin is looking at this    */
/*     panel. This used to live only in DevAdminPanel.jsx's now-removed     */
/*     "Comments"/"Jynx" tabs (DevAnnotationsScreen.jsx/                    */
/*     JynxFeedbackScreen.jsx, deleted this same change) — moved here so    */
/*     an admin manages a comment right where they're already looking at    */
/*     it instead of re-finding it in a separate admin-only list. Delete    */
/*     is app-annotations-only: there's no DELETE endpoint for Jynx         */
/*     feedback (data/routes/jynx-feedback.js never grew one), so a Jynx-   */
/*     kind item only gets resolve/reopen here, same as before.             */
/* ================================================================== */

export default function CommentsPanel({ active, route, currentDevUserId, isAdmin, canJynxComment }) {
  const userDirectory = useDevUserDirectory();
  const [items, setItems] = useState([]);
  const [statusFilter, setStatusFilter] = useState("open"); // open | done
  const [mineOnly, setMineOnly] = useState(false);
  // "This page" (route-filtered) vs "All pages" (no route filter at all,
  // the default — see the LEGO BLOCK comment above for why).
  const [scope, setScope] = useState("all"); // page | all
  // Filtering pass (jynx-mt5f2ow7dqrw): date-range pills, a keyword search
  // box, and an "element filter" — Ctrl/Cmd+click any element on the page
  // (while "pick" mode is on) to narrow the list to comments whose own
  // targetLabel or secondaryTargets match that element, reusing the exact
  // same findTarget/labelForElement heuristic DevOverlay.jsx already uses
  // for hover/Ctrl+click-to-annotate, so "the element you clicked" always
  // means the same thing here as it does when leaving a new comment.
  const [dateFilter, setDateFilter] = useState("all"); // all | 24h | 7d | 30d
  const [keywordFilter, setKeywordFilter] = useState("");
  const [pickingElement, setPickingElement] = useState(false);
  const [elementFilterLabel, setElementFilterLabel] = useState(null);
  const [hoveredListId, setHoveredListId] = useState(null);
  const [hoveredDotLabel, setHoveredDotLabel] = useState(null);
  const [flashId, setFlashId] = useState(null);
  const [openThreadId, setOpenThreadId] = useState(null);
  const [replyText, setReplyText] = useState("");
  // "Reply as Jynx" (jynx-mt5ev53xof3v) — admin-only toggle so a reply
  // posted from this box shows up with its own "Jynx" identity instead of
  // the admin's real dev-user name. Resets to false after every send/thread
  // switch so it's an explicit per-reply choice, never a sticky mode you
  // forget is on.
  const [replyAsJynx, setReplyAsJynx] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  // "מנהל מטפל בהערה" — resolvingId פותח תיבת-הערת-פתרון (כמו
  // DevAnnotationsScreen.jsx לשעבר), deletingId פותח אישור-מחיקה מוטמע (רק
  // ל-kind:"app", ראו LEGO BLOCK #5 למעלה).
  const [resolvingId, setResolvingId] = useState(null);
  const [resolveNote, setResolveNote] = useState("");
  const [deletingId, setDeletingId] = useState(null);
  const [collapsed, setCollapsed] = useState(false);
  const [tick, setTick] = useState(0);
  // jynx-mtihenhmc7hh: "because i need to login every time i send a
  // comment ... allow bulk sending instead" — traced this to a real bug,
  // not a genuine bulk-send request: every write action below (reply,
  // edit, the Jynx composer, delete) had NO error handling at all, so a
  // session that expired mid-use (dev sessions live in an in-memory Map —
  // any Render free-tier idle spin-down silently drops them, independent
  // of the 7-day TTL) failed with an uncaught rejection and zero visible
  // feedback. That reads exactly like "I have to log in again" with no
  // obvious way to do so short of navigating elsewhere — this mirrors
  // AnnotationPopover.jsx's own older reloginOpen/relogin() pattern
  // (jynx-mth55ybetlt5) so the same graceful "log in again without losing
  // what you typed" recovery exists here too, not just on the Ctrl/Cmd+
  // click composer.
  const [sendError, setSendError] = useState("");
  const [reloginOpen, setReloginOpen] = useState(false);
  const [reloginPassword, setReloginPassword] = useState("");
  const [reloggingIn, setReloggingIn] = useState(false);
  async function relogin() {
    if (!reloginPassword.trim() || reloggingIn) return;
    setReloggingIn(true);
    try {
      await devLogin(reloginPassword.trim());
      setReloginOpen(false);
      setReloginPassword("");
      setSendError("");
    } catch (e) {
      setSendError(e.message || "Login failed");
    } finally {
      setReloggingIn(false);
    }
  }
  // "+ Feedback about Jynx" — הרכבה מינימלית inline, לא שימוש חוזר
  // ב-AnnotationPopover.jsx (שממוקם לפי קואורדינטות x/y של קליק, שלא
  // רלוונטיות כאן). מנהל, וגם משתמש-פיתוח עם canJynxComment (ראו
  // POST /admin/jynx-feedback ב-data/routes/jynx-feedback.js, שכבר תומך
  // בשני אלה) — היה נעול ל-isAdmin בלבד כאן בטעות, מה שחסם את כל הנקודה
  // של הרשאת "Jynx commenter" מלהגיע לכפתור המהיר הזה.
  const [jynxComposerOpen, setJynxComposerOpen] = useState(false);
  const [jynxComposerText, setJynxComposerText] = useState("");
  const [jynxComposerSending, setJynxComposerSending] = useState(false);
  // עוגן שמאלי בכוונה — הצד ההפוך מאשכול הכפתורים הימני (הבועה/הסרגל/בורר
  // התפקיד), כדי שהמיקום ההתחלתי לא יתנגש איתם עוד לפני שגוררים משהו.
  const panelFab = useDraggableFab("jynx-comments-panel-pos", { left: 16, bottom: 76 }, "left");

  // מנהל (וכן Jynx commenter, ראו למטה) רואה כאן גם משוב על Jynx עצמו (תור
  // נפרד לגמרי — jynx-feedback, ראו data/routes/jynx-feedback.js) — בלי זה,
  // מי שכתב הערה דרך מצב "משוב Jynx" (הילה סגולה, ראו DevOverlay.jsx) לא היה
  // רואה אותה בכלל כאן, כי היא לא באה מ-/dev/annotations. מסומנת kind:"jynx"
  // להבחנה.
  function reload() {
    // .catch(() => null) on EACH branch independently — not just one shared
    // catch on the combined Promise.all — because the dev-session token
    // (Bearer, used by fetchDevAnnotations) and the admin-session token
    // (X-Admin-Session, used by fetchJynxFeedback) are two separate,
    // independently-expiring sessions (see FORCLAUDE.md's "Dev-mode auth"
    // section). If only one of the two has gone stale, a single unhandled
    // rejection on the combined Promise.all used to silently abort the
    // *entire* reload — setItems() never ran again, so this panel would
    // freeze on whatever it last successfully loaded (while DevAdminPanel,
    // which fetches independently, kept working) until a hard page reload.
    //
    // null (not []) on failure is deliberate too, and fixes a real follow-up
    // bug reported after the first fix landed: catching to an empty array
    // meant a single transient network blip on either branch made ALL
    // comments of that kind visibly vanish for one 5s poll, then reappear —
    // "comments randomly disappear" from the user's side. null means "this
    // branch failed, keep whatever it last successfully had" instead of
    // "this branch is now empty" — see the setItems merge below.
    // scope "all" משמיט את פרמטר ה-route לגמרי (fetchDevAnnotations תומכת
    // בזה — השרת כבר מחזיר הכל בלי route, ראו devApi.js) / את סינון ה-route
    // הקליינטי על משוב Jynx (שממילא תמיד מגיע לא-מסונן מהשרת).
    const appPromise = fetchDevAnnotations(scope === "all" ? null : route).then((d) => d.map((a) => ({ ...a, kind: "app" }))).catch(() => null);
    // Jynx commenter שאינו מנהל: לא יכול לקרוא את התור המלא
    // (GET /admin/jynx-feedback נשאר admin-only בכוונה), אבל צריך לראות את
    // מה שהוא עצמו כתב — ראו GET /dev/jynx-feedback/mine.
    const jynxPromise = isAdmin
      ? fetchJynxFeedback().then((d) => d.filter((a) => scope === "all" || a.route === route).map((a) => ({ ...a, kind: "jynx", authorName: a.authorName || "Admin" }))).catch(() => null)
      : canJynxComment
      ? fetchMyJynxFeedback().then((d) => d.filter((a) => scope === "all" || a.route === route).map((a) => ({ ...a, kind: "jynx", authorName: a.authorName || "Admin" }))).catch(() => null)
      : Promise.resolve([]);
    Promise.all([appPromise, jynxPromise]).then(([app, jynx]) => {
      setItems((prev) => [
        ...(app ?? prev.filter((a) => a.kind !== "jynx")),
        ...(jynx ?? prev.filter((a) => a.kind === "jynx")),
      ]);
    });
  }
  useEffect(() => {
    if (!active) return;
    reload();
    const t = setInterval(reload, 5000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, route, scope, isAdmin, canJynxComment]);

  // rAF-throttled — ראו ההערה המקבילה ב-AdminAnnotationMarkers.jsx
  // (jynx-mt5edij0xz1s): setTick() גולמי לכל אירוע scroll טבעי הצטבר מהר
  // יותר משה-render יכול לעמוד בו ברשימת-תגובות ארוכה, מה שגרם לנקודות
  // להיראות "מפגרות" אחרי האלמנט שלהן בגלילה מהירה.
  useEffect(() => {
    if (!active) return;
    let rafId = null;
    function onLayoutChange() {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        setTick((t) => t + 1);
      });
    }
    window.addEventListener("scroll", onLayoutChange, true);
    window.addEventListener("resize", onLayoutChange);
    const id = setInterval(onLayoutChange, 1500);
    return () => {
      window.removeEventListener("scroll", onLayoutChange, true);
      window.removeEventListener("resize", onLayoutChange);
      clearInterval(id);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [active]);

  // "Pick element" mode for the element filter (jynx-mt5f2ow7dqrw) — same
  // capture-phase-on-window + stopPropagation technique DevOverlay.jsx uses
  // for Ctrl/Cmd+click-to-annotate, so this doesn't fall through to the
  // real app's own click handler underneath. Only reacts to a
  // Ctrl/Cmd-held click, exactly like the annotate gesture, so a plain
  // click while picking still does nothing surprising to the page.
  // Deliberately NOT excluding .jynx-chrome (unlike DevOverlay.jsx's
  // hover-highlight, which only allows it for allowJynxChrome callers) —
  // this is filtering an already-existing list, not creating a new
  // annotation, and plenty of real comments already target Jynx's own
  // toolbar/settings elements (dev-toolbar-settings-btn, jynx-settings-
  // panel, comments-sidebar-filters, ...), so picking one of those must
  // work too. .dev-overlay-ignore (the transient dot/highlight layer
  // itself) stays excluded — never a meaningful filter target.
  useEffect(() => {
    if (!pickingElement) return;
    function onClick(e) {
      if (!(e.ctrlKey || e.metaKey)) return;
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (!el || el.closest(".dev-overlay-ignore")) return;
      e.preventDefault();
      e.stopPropagation();
      setElementFilterLabel(labelForElement(findTarget(el)));
      setPickingElement(false);
    }
    window.addEventListener("click", onClick, true);
    return () => window.removeEventListener("click", onClick, true);
  }, [pickingElement]);

  const grouped = useMemo(() => {
    void tick;
    const byLabel = new Map();
    // "All pages" יכול להביא הערות ממסכים אחרים — לא אמורות לקבל נקודה על
    // *העמוד הזה* (data-devblock שלהן, אם בכלל קיים כאן, שייך למשהו אחר
    // לגמרי), אז מסננים גם לפי route כאן, לא רק resolved.
    items.filter((a) => !a.resolved && (!a.route || a.route === route)).forEach((a) => {
      if (!a.targetLabel) return;
      if (!byLabel.has(a.targetLabel)) byLabel.set(a.targetLabel, []);
      byLabel.get(a.targetLabel).push(a);
    });
    const out = [];
    // ראו stickyChromeBounds.js — אלמנט שגלל מתחת לניווט הדביק לא אמור
    // להשאיר נקודה צפה מעליו (jynx-mt5edij0xz1s).
    const stickyRects = getStickyChromeRects();
    byLabel.forEach((list, label) => {
      const el = document.querySelector(`[data-devblock="${CSS.escape(label)}"]`);
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (isCoveredBySticky(rect, stickyRects)) return;
      out.push({ label, list, rect });
    });
    return out;
  }, [items, tick, route]);

  // מחזיר null גם אם ה-targetLabel קיים אבל ההערה שייכת למסך אחר (מצב "All
  // pages") — אין לה אלמנט אמיתי על העמוד הנוכחי, גם אם באיזשהו צירוף מקרים
  // יש data-devblock עם אותה תווית (תוויות לא מובטחות ייחודיות בין מסכים).
  function rectFor(a) {
    if (!a?.targetLabel) return null;
    if (a.route && a.route !== route) return null;
    const el = document.querySelector(`[data-devblock="${CSS.escape(a.targetLabel)}"]`);
    return el ? { el, rect: el.getBoundingClientRect() } : null;
  }

  const hoveredRect = useMemo(() => {
    if (!hoveredListId) return null;
    void tick;
    return rectFor(items.find((x) => x.id === hoveredListId))?.rect || null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoveredListId, items, tick]);

  // יעדים משניים (a.secondaryTargets) של השורה שמעל העכבר — אותה שיטת
  // איתור בדיוק כמו rectFor() ליעד הראשי, רק שיש כאן כמה תוצאות אפשריות
  // במקום אחת, ומוצגות בכחול כדי לא להתבלבל עם ההדגשה הכתומה של היעד הראשי.
  const hoveredSecondaryRects = useMemo(() => {
    if (!hoveredListId) return [];
    void tick;
    const a = items.find((x) => x.id === hoveredListId);
    if (!a?.secondaryTargets?.length) return [];
    if (a.route && a.route !== route) return [];
    return a.secondaryTargets
      .map((label) => document.querySelector(`[data-devblock="${CSS.escape(label)}"]`))
      .filter(Boolean)
      .map((el) => el.getBoundingClientRect());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoveredListId, items, tick]);

  // @mentions בתגובה — מועמדים הם שמות המחברים שכבר מופיעים בתור הזה (אין
  // עדיין endpoint שחושף את מרשם משתמשי-הפיתוח המלא למי שאינו מנהל) ועוד
  // "jynx" השמור, תמיד זמין. אותה פילוסופיה של "הטקסט הוא מקור האמת" כמו
  // [→ תווית] ב-DevOverlay.jsx — אין state נפרד לרשימת אזכורים, רק ניתוח
  // הטוקן החלקי בסוף replyText כרגע (התגובה היא input חד-שורתי, אז "בסוף
  // הטקסט" מספיק טוב בלי מעקב מיקום-סמן מדויק).
  const mentionCandidates = useMemo(() => {
    const names = new Set(["jynx"]);
    userDirectory.forEach((u) => names.add(u.name));
    items.forEach((a) => { if (a.authorName) names.add(a.authorName); });
    return [...names];
  }, [items, userDirectory]);
  const activeMentionQuery = useMemo(() => parseMentionQuery(replyText), [replyText]);
  const mentionMatches = useMemo(
    () => matchMentionCandidates(activeMentionQuery, mentionCandidates),
    [activeMentionQuery, mentionCandidates]
  );
  function insertMention(name) {
    setReplyText((prev) => insertMentionText(prev, name));
  }

  function jumpTo(a) {
    // מצב "All pages": פריט ממסך אחר — אין לו אלמנט אמיתי כאן, לקפוץ אליו
    // לא אומר כלום (rectFor כבר מחזיר null עבורו, אבל בודקים גם כאן במפורש
    // כדי לא לסמוך רק על תופעת-לוואי).
    if (a?.route && a.route !== route) return;
    const found = rectFor(a);
    if (!found) return;
    found.el.scrollIntoView({ behavior: "smooth", block: "center" });
    setFlashId(a.id);
    window.setTimeout(() => setFlashId((f) => (f === a.id ? null : f)), 1600);
  }

  async function sendReply(a) {
    if (!replyText.trim()) return;
    setSendError("");
    try {
      if (a.kind === "jynx") await replyToJynxFeedback(a.id, replyText.trim(), replyAsJynx);
      else await replyToAnnotation(a.id, replyText.trim(), replyAsJynx);
    } catch (e) {
      setSendError(e.message || "Failed to send, please try again");
      return; // replyText intentionally left in place — nothing typed is lost
    }
    setReplyText("");
    setReplyAsJynx(false);
    reload();
  }

  async function saveEdit(a) {
    if (!editText.trim()) return;
    setSendError("");
    try {
      await editMyAnnotation(a.id, editText.trim());
    } catch (e) {
      setSendError(e.message || "Failed to save, please try again");
      return;
    }
    setEditingId(null);
    setEditText("");
    reload();
  }

  // "Reopen" (jynx-mt3djr6idsg1) — once a comment already has a PR or is
  // marked done, silently rewriting its text (saveEdit above) leaves the
  // shipped PR out of sync with nobody told. Reusing the existing @jynx
  // reply path instead of a plain edit means the agent revisits the
  // existing PR with the new instructions (see queueFollowUp/isFollowUp in
  // data/routes/annotations.js) rather than re-implementing from scratch —
  // exactly the "revisit the text, not the whole thinking process" ask.
  async function saveReopen(a) {
    if (!editText.trim()) return;
    setSendError("");
    try {
      await replyToAnnotation(a.id, `@jynx ${editText.trim()}`);
    } catch (e) {
      setSendError(e.message || "Failed to save, please try again");
      return;
    }
    setEditingId(null);
    setEditText("");
    reload();
  }

  async function triggerAction(a) {
    await requestAnnotationAction(a.id);
    reload();
  }

  // ניהול ע"י מנהל — ראו LEGO BLOCK #5 למעלה. resolveAnnotation/
  // resolveJynxFeedback שתיהן כבר קיימות ב-devApi.js (היו משמשות רק את
  // DevAnnotationsScreen.jsx/JynxFeedbackScreen.jsx, שנמחקו).
  async function confirmResolve(a) {
    if (a.kind === "jynx") await resolveJynxFeedback(a.id, true, resolveNote.trim() || null);
    else await resolveAnnotation(a.id, true, "Admin", resolveNote.trim() || null);
    setResolvingId(null);
    setResolveNote("");
    reload();
  }
  async function reopenComment(a) {
    if (a.kind === "jynx") await resolveJynxFeedback(a.id, false);
    else await resolveAnnotation(a.id, false);
    reload();
  }
  // מחיקת מנהל (כל הערה, כל kind מ-2026-09-02) מול מחיקה עצמית
  // (jynx-mth5347s3eil: "for dev user - allow deleting their own
  // comments") — שני נתיבים נפרדים בשרת, נבחר כאן לפי מי בעצם לוחץ.
  async function confirmDelete(a) {
    if (isAdmin) await deleteAnnotation(a.id);
    else if (a.kind === "jynx") await deleteMyJynxFeedback(a.id);
    else await deleteMyAnnotation(a.id);
    setDeletingId(null);
    reload();
  }

  // toggle רגיל — קליק על אימוג'י שכבר ריאקטתי איתו מסיר אותו, לא מוסיף שוב.
  async function sendReaction(a, emoji) {
    if (a.kind === "jynx") await reactToJynxFeedback(a.id, emoji);
    else await reactToAnnotation(a.id, emoji);
    reload();
  }

  async function submitJynxComposer() {
    if (!jynxComposerText.trim() || jynxComposerSending) return;
    setJynxComposerSending(true);
    setSendError("");
    try {
      // אין צורך ב-targetLabel/סיכת מיקום — משוב כללי על Jynx עצמו, לא
      // מוצמד לאלמנט ספציפי (הבקאנד כבר מקבל targetLabel:null, ראו
      // data/routes/jynx-feedback.js). route כן נשלח, כדי שהפריט יופיע
      // ישר ברשימה הנוכחית (שמסוננת לפי מסך, ראו reload() למעלה).
      await submitJynxFeedback({ route, comment: jynxComposerText.trim() });
      setJynxComposerText("");
      setJynxComposerOpen(false);
      reload();
    } catch (e) {
      // jynx-mtihenhmc7hh: draft deliberately left in place on failure —
      // see the sendError state comment above.
      setSendError(e.message || "Failed to send, please try again");
    } finally {
      setJynxComposerSending(false);
    }
  }

  if (!active) return null;

  const keywordNeedle = keywordFilter.trim().toLowerCase();
  const shown = items
    .filter((a) => (statusFilter === "open" ? !a.resolved : a.resolved))
    .filter((a) => !mineOnly || a.authorId === currentDevUserId)
    .filter((a) => dateFilter === "all" || (Date.now() - new Date(a.createdAt).getTime()) <= DATE_FILTER_WINDOWS[dateFilter])
    .filter((a) => !keywordNeedle || a.comment?.toLowerCase().includes(keywordNeedle) || a.targetLabel?.toLowerCase().includes(keywordNeedle))
    .filter((a) => !elementFilterLabel || a.targetLabel === elementFilterLabel || (a.secondaryTargets || []).includes(elementFilterLabel));
  const flashRect = flashId ? rectFor(items.find((x) => x.id === flashId))?.rect : null;

  return createPortal(
    <>
      {/* יעדים משניים: הנקודות/ההילות האלה הן ה-UI הזמני-לחלוטין של האוברליי  */}
      {/* עצמו (ראו DevOverlay.jsx) — לעולם לא יעד תקין לתגובה, גם לא למנהל,   */}
      {/* אז dev-overlay-ignore נשאר עליהן בלבד. .comments-sidebar עצמו (למטה) */}
      {/* הוזז החוצה מהעטיפה הזו ל-jynx-chrome, כי הוא תוכן אמיתי של Jynx (לא  */}
      {/* שונה עקרונית מה-toolbar/ה-FAB) — קודם היה עטוף כאן בטעות, מה שחסם    */}
      {/* לגמרי hover/Ctrl+קליק-להערה על כל מה שבתוכו, גם למנהל. */}
      <div className="dev-overlay-ignore">
        <style>{CSS_TEXT}</style>

        {grouped.map(({ label, list, rect }) => (
          <CommentDot
            key={label}
            label={label}
            rect={rect}
            list={list}
            hovered={hoveredDotLabel === label}
            onHover={setHoveredDotLabel}
          />
        ))}

        {hoveredRect && (
          <div
            className="comments-panel-highlight"
            style={{ top: hoveredRect.top, left: hoveredRect.left, width: hoveredRect.width, height: hoveredRect.height }}
          />
        )}
        {hoveredSecondaryRects.map((r, i) => (
          <div
            key={i}
            className="comments-panel-highlight comments-panel-highlight-secondary"
            style={{ top: r.top, left: r.left, width: r.width, height: r.height }}
          />
        ))}
        {flashRect && (
          <div
            className="comments-panel-highlight comments-panel-flash"
            style={{ top: flashRect.top, left: flashRect.left, width: flashRect.width, height: flashRect.height }}
          />
        )}
      </div>

      {/* גרירה: כל הכרטיס גרירי עכשיו (לא רק הכותרת), אותו מנגנון-לכידה-דחוי  */}
      {/* כמו dev-fab-toolbar (ראו useDraggableFab.js) — קליק נקי על כפתור/    */}
      {/* שורת-תגובה בפנים ממשיך לעבוד רגיל, רק תזוזה אמיתית (4px+) גוררת.     */}
      <div
        ref={panelFab.sizeRef}
        className="comments-sidebar jynx-chrome jynx-ui"
        style={{ left: panelFab.pos.left, bottom: panelFab.pos.bottom }}
        {...panelFab.dragHandlers}
      >
        <div className="comments-sidebar-head">
          <span className="comments-sidebar-grip" title="Drag anywhere on this panel to move it"><GripVertical size={13} /></span>
          <span className="comments-sidebar-title"><MessageSquare size={13} /> Comments</span>
          <button type="button" className="comments-sidebar-collapse" onClick={() => setCollapsed((v) => !v)} title={collapsed ? "Expand" : "Collapse"}>
            {collapsed ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </div>
        {!collapsed && sendError && (
          <div className="comments-send-error">
            {sendError}{" "}
            <button type="button" className="comments-send-error-relogin-link" onClick={() => setReloginOpen((v) => !v)}>
              Log in again
            </button>
            {reloginOpen && (
              <div className="comments-send-error-relogin-box">
                <input
                  type="password" autoFocus placeholder="Password" value={reloginPassword} disabled={reloggingIn}
                  onChange={(e) => setReloginPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && relogin()}
                />
                <button type="button" onClick={relogin} disabled={!reloginPassword.trim() || reloggingIn}>
                  {reloggingIn ? "..." : "Sign in"}
                </button>
              </div>
            )}
          </div>
        )}
        {!collapsed && (isAdmin || canJynxComment) && (
          <div className="comments-jynx-composer-wrap">
            {!jynxComposerOpen ? (
              <button type="button" className="comments-jynx-composer-toggle" onClick={() => setJynxComposerOpen(true)}>
                <Sparkles size={12} /> Feedback about Jynx
              </button>
            ) : (
              <div className="comments-jynx-composer">
                <textarea
                  autoFocus
                  rows={2}
                  placeholder="What should improve in the dev tool itself?"
                  value={jynxComposerText}
                  onChange={(e) => setJynxComposerText(e.target.value)}
                />
                <div className="comments-jynx-composer-actions">
                  <button
                    type="button"
                    onClick={() => { setJynxComposerOpen(false); setJynxComposerText(""); }}
                    disabled={jynxComposerSending}
                  >
                    Cancel
                  </button>
                  <button
                    type="button" className="primary" onClick={submitJynxComposer}
                    disabled={!jynxComposerText.trim() || jynxComposerSending}
                  >
                    {jynxComposerSending ? "Sending..." : "Send"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
        {!collapsed && (
          <>
            <div className="comments-sidebar-filters">
              <div className="pill-tabs">
                <button type="button" className={"pill-tab" + (statusFilter === "open" ? " active" : "")} onClick={() => setStatusFilter("open")}>Open</button>
                <button type="button" className={"pill-tab" + (statusFilter === "done" ? " active" : "")} onClick={() => setStatusFilter("done")}>Done</button>
              </div>
              <button type="button" className={"comments-mine-toggle" + (mineOnly ? " active" : "")} onClick={() => setMineOnly((v) => !v)}>Just me</button>
            </div>
            <div className="comments-sidebar-filters comments-sidebar-scope-row">
              <div className="pill-tabs">
                <button type="button" className={"pill-tab" + (scope === "page" ? " active" : "")} onClick={() => setScope("page")}>This page</button>
                <button type="button" className={"pill-tab" + (scope === "all" ? " active" : "")} onClick={() => setScope("all")}>All pages</button>
              </div>
            </div>
            <div className="comments-sidebar-filters comments-sidebar-date-row">
              <div className="pill-tabs">
                <button type="button" className={"pill-tab" + (dateFilter === "all" ? " active" : "")} onClick={() => setDateFilter("all")}>Any time</button>
                <button type="button" className={"pill-tab" + (dateFilter === "24h" ? " active" : "")} onClick={() => setDateFilter("24h")}>24h</button>
                <button type="button" className={"pill-tab" + (dateFilter === "7d" ? " active" : "")} onClick={() => setDateFilter("7d")}>Week</button>
                <button type="button" className={"pill-tab" + (dateFilter === "30d" ? " active" : "")} onClick={() => setDateFilter("30d")}>Month</button>
              </div>
            </div>
            <div className="comments-sidebar-search-row">
              <div className="comments-sidebar-search-box">
                <Search size={12} />
                <input
                  value={keywordFilter}
                  placeholder="Filter by keyword..."
                  onChange={(e) => setKeywordFilter(e.target.value)}
                />
                {keywordFilter && (
                  <button type="button" onClick={() => setKeywordFilter("")} title="Clear keyword filter"><X size={12} /></button>
                )}
              </div>
              {!elementFilterLabel ? (
                <button
                  type="button"
                  className={"comments-element-pick-toggle" + (pickingElement ? " active" : "")}
                  onClick={() => setPickingElement((v) => !v)}
                  title={pickingElement ? "Ctrl/Cmd+click any element on the page to filter to it (click again to cancel)" : "Filter to comments on one specific element"}
                >
                  <Crosshair size={12} /> {pickingElement ? "Ctrl/Cmd+click an element..." : "Element"}
                </button>
              ) : (
                <button type="button" className="comments-element-filter-chip" onClick={() => setElementFilterLabel(null)} title="Clear element filter">
                  <Crosshair size={11} /> {elementFilterLabel} <X size={11} />
                </button>
              )}
            </div>
            {shown.length === 0 && <div className="comments-sidebar-empty">No {statusFilter} comments {scope === "all" ? "anywhere" : "on this screen"}{(dateFilter !== "all" || keywordNeedle || elementFilterLabel) ? " matching these filters" : ""}.</div>}
            <div className="comments-sidebar-list">
              {shown.map((a) => {
                const replies = a.replies || [];
                // עריכה עצמית זמינה רק על הערות "אפליקציה" רגילות (kind
                // "app"/undefined) שאתה בעצמך כתבת — לא על משוב Jynx (תור
                // נפרד, אין לו endpoint עריכה מקביל, וממילא רק מנהל כותב שם).
                const canEdit = a.kind !== "jynx" && a.authorId === currentDevUserId;
                // jynx-mth5347s3eil: dev users (not admin — admin already has
                // its own full delete button below) can delete their OWN
                // comment, either kind, as long as nobody's replied yet (a
                // reply is someone else's visible content riding on this
                // comment — that case stays admin-only).
                const canDeleteSelf = !isAdmin && a.authorId === currentDevUserId && replies.length === 0;
                // Once a comment has a PR or is marked done, "editing" it
                // becomes "reopening" it instead (jynx-mt3djr6idsg1) — see
                // saveReopen() above.
                const isProcessed = a.resolved || a.actionStatus === "pr_opened";
                const isEditing = editingId === a.id;
                // "All pages" בלבד: פריט ממסך אחר — אין לו אלמנט על העמוד
                // הזה, אז hover/קליק-לקפיצה לא עושים כלום (ראו rectFor/
                // jumpTo למעלה) — מסמנים את זה ויזואלית עם תווית ה-route
                // ו-cursor רגיל במקום pointer, לא שקט לגמרי.
                const otherPage = scope === "all" && a.route && a.route !== route;
                return (
                  <div key={a.id} className="comments-sidebar-item-wrap">
                    <div
                      className={"comments-sidebar-item" + (otherPage ? " comments-sidebar-item-other-page" : "")}
                      onMouseEnter={() => !otherPage && setHoveredListId(a.id)}
                      onMouseLeave={() => setHoveredListId((h) => (h === a.id ? null : h))}
                      onClick={() => !isEditing && jumpTo(a)}
                    >
                      {(a.targetLabel || a.kind === "jynx" || otherPage) && (
                        <span className="comments-sidebar-item-target">
                          {a.kind === "jynx" && <span className="comments-jynx-badge">🔮 Jynx</span>}
                          {otherPage && <span className="comments-route-badge">{a.route}</span>}
                          {a.targetLabel}
                          {a.resolved && <span className="comments-done-badge"><CheckCircle2 size={10} /> Done</span>}
                        </span>
                      )}
                      {isEditing ? (
                        <div className="comments-edit-box" onClick={(e) => e.stopPropagation()}>
                          <textarea
                            autoFocus rows={3} value={editText} onChange={(e) => setEditText(e.target.value)}
                            placeholder={isProcessed ? "What still needs to change? The agent will revisit the existing PR, not start over." : undefined}
                          />
                          <div className="comments-edit-actions">
                            <button type="button" onClick={() => { setEditingId(null); setEditText(""); }}>Cancel</button>
                            <button
                              type="button" className="primary"
                              onClick={() => (isProcessed ? saveReopen(a) : saveEdit(a))}
                              disabled={!editText.trim()}
                            >
                              {isProcessed ? "Reopen" : "Save"}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="comments-sidebar-item-comment">
                          {a.comment}
                          {canEdit && (
                            <button
                              type="button" className="comments-edit-btn"
                              title={isProcessed ? "Reopen — describe what still needs to change" : "Edit your comment"}
                              onClick={(e) => { e.stopPropagation(); setEditingId(a.id); setEditText(isProcessed ? "" : a.comment); }}
                            >
                              {isProcessed ? <RotateCcw size={11} /> : <Pencil size={11} />}
                            </button>
                          )}
                          {canDeleteSelf && (
                            <button
                              type="button" className="comments-edit-btn comments-delete-self-btn"
                              title="Delete your comment"
                              onClick={(e) => { e.stopPropagation(); setDeletingId(a.id); }}
                            >
                              <Trash2 size={11} />
                            </button>
                          )}
                        </p>
                      )}
                      {a.attachment && (
                        a.attachment.startsWith("data:image/") ? (
                          <a href={a.attachment} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="comments-attachment-link">
                            <img src={a.attachment} alt={a.attachmentName || "attachment"} className="comments-attachment-thumb" />
                          </a>
                        ) : (
                          <a
                            href={a.attachment} download={a.attachmentName || "attachment"}
                            onClick={(e) => e.stopPropagation()} className="comments-attachment-link comments-attachment-file"
                          >
                            <Paperclip size={10} /> {a.attachmentName || "attachment"}
                          </a>
                        )
                      )}
                      {a.drawing && (
                        <span className="comments-drawing-badge"><Pencil size={10} /> drawing — hover to see it on the page</span>
                      )}
                      {hoveredListId === a.id && a.drawing && <DrawingOverlay drawing={a.drawing} />}
                      <span className="comments-sidebar-item-meta">
                        <span
                          className="jynx-author-link" role="button" tabIndex={0}
                          onClick={(e) => { e.stopPropagation(); openUserProfile(a.authorId); }}
                        >
                          {a.authorName}
                        </span>
                        {" · "}{new Date(a.createdAt).toLocaleString("en-US")}
                      </span>
                      {a.resolved && a.resolutionNote && (
                        <div className="comments-resolution-note"><CheckCircle2 size={11} /> {a.resolutionNote}</div>
                      )}
                      {isAdmin && a.actionStatus && a.actionStatus !== "none" && (() => {
                        const StatusIcon = ACTION_STATUS_ICON[a.actionStatus];
                        return (
                          <span className="comments-action-pill" onClick={(e) => e.stopPropagation()}>
                            {StatusIcon && <StatusIcon size={11} className={a.actionStatus === "queued" || a.actionStatus === "in_progress" ? "comments-action-spin" : ""} />}
                            {ACTION_STATUS_LABEL[a.actionStatus]}
                            {a.actionPrUrl && <a href={a.actionPrUrl} target="_blank" rel="noreferrer">View PR</a>}
                          </span>
                        );
                      })()}
                      {isAdmin && a.kind === "app" && (!a.actionStatus || a.actionStatus === "none") && (
                        <button type="button" className="comments-action-btn" onClick={(e) => { e.stopPropagation(); triggerAction(a); }} title="Run the automated agent on this comment">
                          <Zap size={11} /> Action
                        </button>
                      )}
                      {/* ניהול-מנהל — ראו LEGO BLOCK #5 למעלה: זה מה שהחליף את
                          DevAdminPanel.jsx's "Comments"/"Jynx" tabs שנמחקו. */}
                      {isAdmin && resolvingId === a.id && (
                        <div className="comments-edit-box" onClick={(e) => e.stopPropagation()}>
                          <textarea
                            autoFocus rows={2} placeholder="What did you fix? (optional, notifies the author)"
                            value={resolveNote} onChange={(e) => setResolveNote(e.target.value)}
                          />
                          <div className="comments-edit-actions">
                            <button type="button" onClick={() => { setResolvingId(null); setResolveNote(""); }}>Cancel</button>
                            <button type="button" className="primary" onClick={() => confirmResolve(a)}>Mark done</button>
                          </div>
                        </div>
                      )}
                      {(isAdmin || canDeleteSelf) && deletingId === a.id && (
                        <div className="comments-delete-confirm" onClick={(e) => e.stopPropagation()}>
                          <span>Delete this comment permanently?</span>
                          <div className="comments-delete-confirm-actions">
                            <button type="button" onClick={() => setDeletingId(null)}>Cancel</button>
                            <button type="button" className="danger" onClick={() => confirmDelete(a)}>Delete</button>
                          </div>
                        </div>
                      )}
                      {isAdmin && resolvingId !== a.id && deletingId !== a.id && (
                        <div className="comments-admin-actions" onClick={(e) => e.stopPropagation()}>
                          {a.resolved ? (
                            <button type="button" className="comments-admin-btn" onClick={() => reopenComment(a)} title="Reopen">
                              <Undo2 size={12} />
                            </button>
                          ) : (
                            <button type="button" className="comments-admin-btn" onClick={() => { setResolvingId(a.id); setResolveNote(""); }} title="Mark as resolved">
                              <Check size={12} />
                            </button>
                          )}
                          {a.kind === "app" && (
                            <button type="button" className="comments-admin-btn comments-admin-btn-danger" onClick={() => setDeletingId(a.id)} title="Delete permanently">
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="comments-reaction-row" onClick={(e) => e.stopPropagation()}>
                      {REACTION_EMOJI.map((emoji) => {
                        const reactors = a.reactions?.[emoji] || [];
                        const mine = reactors.includes(currentDevUserId);
                        return (
                          <button
                            key={emoji}
                            type="button"
                            className={"comments-reaction-btn" + (mine ? " active" : "")}
                            onClick={() => sendReaction(a, emoji)}
                            title={mine ? "Remove your reaction" : "React"}
                          >
                            {emoji}
                            {reactors.length > 0 && <span className="comments-reaction-count">{reactors.length}</span>}
                          </button>
                        );
                      })}
                    </div>
                    <button
                      type="button" className="comments-thread-toggle"
                      onClick={(e) => { e.stopPropagation(); setReplyAsJynx(false); setOpenThreadId(openThreadId === a.id ? null : a.id); }}
                    >
                      <MessageCircle size={11} /> {replies.length > 0 ? `${replies.length} repl${replies.length === 1 ? "y" : "ies"}` : "Reply"}
                    </button>
                    {openThreadId === a.id && (
                      <div className="comments-thread" onClick={(e) => e.stopPropagation()}>
                        {replies.map((r) => (
                          <div key={r.id} className="comments-thread-item">
                            {r.isJynx ? (
                              <b className="comments-jynx-reply-badge"><Sparkles size={10} /> Jynx:</b>
                            ) : (
                              <b className="jynx-author-link" role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); openUserProfile(r.authorId); }}>
                                {r.authorName}:
                              </b>
                            )} {renderWithMentions(r.text, userDirectory)}
                          </div>
                        ))}
                        <div className="comments-thread-input-wrap">
                          {mentionMatches.length > 0 && (
                            <div className="comments-mention-dropdown">
                              {mentionMatches.map((n) => (
                                <button key={n} type="button" onClick={() => insertMention(n)}>
                                  {n === "jynx" ? "🔮 @jynx — re-open the PR for this" : `@${n}`}
                                </button>
                              ))}
                            </div>
                          )}
                          {isAdmin && (
                            <button
                              type="button"
                              className={"comments-reply-as-jynx-toggle" + (replyAsJynx ? " active" : "")}
                              onClick={() => setReplyAsJynx((v) => !v)}
                              title={replyAsJynx ? "Sending as Jynx — click to reply as yourself instead" : "Reply as Jynx instead of your own admin name"}
                            >
                              <Sparkles size={11} /> {replyAsJynx ? "Replying as Jynx" : "Reply as Jynx"}
                            </button>
                          )}
                          <div className="comments-thread-input">
                            <input
                              value={replyText} placeholder="Write a reply... (@name to notify, @jynx to update the PR)"
                              onChange={(e) => setReplyText(e.target.value)}
                              onKeyDown={(e) => e.key === "Enter" && sendReply(a)}
                            />
                            <button type="button" onClick={() => sendReply(a)} disabled={!replyText.trim()}>Send</button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </>,
    document.body
  );
}

function CommentDot({ label, rect, list, hovered, onHover }) {
  // ציורים (ראו DrawingCanvas.jsx) מוצגים על העמוד עצמו רק בזמן שהנקודה
  // הזו מרחפת — לא כל הזמן, כדי שמסך עם כמה ציורים לא ייראה משורבט לצמיתות.
  const drawings = list.filter((a) => a.drawing);
  return (
    <div
      className="comments-dot-wrap"
      style={{ top: rect.top - 6, left: rect.left + rect.width - 6 }}
      onMouseEnter={() => onHover(label)}
      onMouseLeave={() => onHover(null)}
    >
      <div className="comments-dot">{list.length > 1 ? list.length : ""}</div>
      {hovered && drawings.map((a) => <DrawingOverlay key={a.id} drawing={a.drawing} />)}
      {hovered && (
        <div className="comments-dot-tooltip">
          {list.map((a) => (
            <div key={a.id} className="comments-dot-tooltip-item">
              <b>{a.authorName}:</b> {a.comment}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const CSS_TEXT = `
.comments-dot-wrap{ position:fixed; z-index:99997; pointer-events:auto; }
.comments-dot{
  width:18px; height:18px; border-radius:50%; background:var(--jynx); color:#fff; border:2px solid var(--panel);
  display:flex; align-items:center; justify-content:center; font-size:10px; font-weight:700; box-shadow:var(--shadow-sm);
  cursor:default;
}
.comments-dot-tooltip{
  position:absolute; top:22px; left:0; width:240px; background:var(--panel); border:1px solid var(--jynx);
  border-radius:9px; padding:8px 10px; box-shadow:var(--shadow-md); display:flex; flex-direction:column; gap:6px;
  font-size:12px; color:var(--text); animation:devAnnotateIn .12s ease;
}
.comments-dot-tooltip-item b{ color:var(--jynx); }

.comments-panel-highlight{
  position:fixed; pointer-events:none; z-index:99996; border-radius:8px; border:2px solid var(--jynx);
  box-shadow:0 0 0 3px color-mix(in srgb, var(--jynx) 28%, transparent),
             0 0 18px color-mix(in srgb, var(--jynx) 50%, transparent);
  transition:top .1s ease, left .1s ease, width .1s ease, height .1s ease;
}
.comments-panel-flash{
  border-color:var(--jynx); animation:commentsFlash 1.6s ease;
}
/* יעד משני — צבע נבדל בכוונה (var(--dev), אותו כתום/ענבר שכבר משמש לכל
   "פעולה/מנהל" אחר בקודבייס הזה) מהיעד הראשי (var(--jynx)), כדי שברור מיד
   איזה אלמנט זה "העיקרי שעליו נפתחה ההערה" מול "עוד אלמנט שקושר אליה". */
.comments-panel-highlight-secondary{
  border-color:var(--dev);
  box-shadow:0 0 0 3px color-mix(in srgb, var(--dev) 28%, transparent),
             0 0 18px color-mix(in srgb, var(--dev) 50%, transparent);
}
@keyframes commentsFlash{
  0%, 100% { box-shadow:0 0 0 3px color-mix(in srgb, var(--jynx) 28%, transparent), 0 0 18px color-mix(in srgb, var(--jynx) 50%, transparent); }
  50% { box-shadow:0 0 0 8px color-mix(in srgb, var(--jynx) 45%, transparent), 0 0 28px color-mix(in srgb, var(--jynx) 70%, transparent); }
}

.comments-sidebar{
  position:fixed; width:280px; max-height:calc(100vh - 100px); z-index:79;
  background:var(--panel); border:1px solid var(--line); border-radius:12px; box-shadow:var(--shadow-md);
  display:flex; flex-direction:column; overflow:hidden;
}
.comments-sidebar-head{ padding:8px 10px; border-bottom:1px solid var(--line); display:flex; align-items:center; gap:6px; cursor:grab; touch-action:none; }
.comments-sidebar-head:active{ cursor:grabbing; }
.comments-sidebar-grip{ display:flex; align-items:center; color:var(--text-dim); }
.comments-sidebar-title{ display:flex; align-items:center; gap:6px; font-size:12.5px; font-weight:700; color:var(--jynx); flex:1; }
.comments-sidebar-collapse{ background:none; border:none; color:var(--text-dim); cursor:pointer; display:flex; }
.comments-sidebar-collapse:hover{ color:var(--jynx); }
.comments-sidebar-filters{ padding:7px 10px; display:flex; align-items:center; justify-content:space-between; gap:8px; }
/* pill-tabs/pill-tab (theme.js) are the shared primitive, sized for
   full-width page tab rows (padding:9px 18px, font-size:13.5px) — inside
   this 280px-wide floating sidebar that read as oversized and mismatched
   next to the panel's own compact controls (.comments-mine-toggle etc.),
   which is what made this row read as unpolished. Scoped override here
   rather than touching theme.js itself, per the "duplicate, don't share
   across files" rule — this panel already owns its CSS_TEXT block. */
.comments-sidebar-filters .pill-tabs{ gap:5px; }
.comments-sidebar-filters .pill-tab{
  padding:4px 11px; font-size:11px; border-radius:8px; border-width:1px;
}
.comments-mine-toggle{
  background:none; border:1px solid var(--line); color:var(--text-dim); border-radius:8px; padding:4px 11px;
  font-size:11px; font-weight:700; cursor:pointer; transition:border-color .15s ease, color .15s ease, background .15s ease;
}
.comments-mine-toggle:hover{ color:var(--text); }
.comments-mine-toggle.active{ background:var(--jynx); border-color:var(--jynx); color:#fff; }
.comments-sidebar-scope-row{ padding-top:0; padding-bottom:8px; border-bottom:1px solid var(--line); }
.comments-sidebar-date-row{ padding-top:0; }
.comments-sidebar-search-row{ padding:6px 10px 0; display:flex; align-items:center; gap:6px; }
.comments-sidebar-search-box{
  flex:1; display:flex; align-items:center; gap:5px; background:var(--bg); border:1px solid var(--line);
  border-radius:8px; padding:4px 8px; color:var(--text-dim); min-width:0;
}
.comments-sidebar-search-box input{
  flex:1; min-width:0; background:none; border:none; font-size:11.5px; color:var(--text);
}
.comments-sidebar-search-box button{ background:none; border:none; color:var(--text-dim); cursor:pointer; display:flex; }
.comments-sidebar-search-box button:hover{ color:var(--jynx); }
.comments-element-pick-toggle, .comments-element-filter-chip{
  display:inline-flex; align-items:center; gap:4px; white-space:nowrap; background:none; border:1px solid var(--line);
  color:var(--text-dim); border-radius:14px; padding:4px 9px; font-size:10.5px; font-weight:700; cursor:pointer;
}
.comments-element-pick-toggle.active{ background:var(--jynx); border-color:var(--jynx); color:#fff; }
.comments-element-filter-chip{ background:color-mix(in srgb, var(--jynx) 14%, transparent); border-color:var(--jynx); color:var(--jynx); }
.comments-sidebar-item-other-page{ cursor:default; }
.comments-sidebar-item-other-page:hover{ background:none; }
.comments-route-badge{
  font-family:var(--font-mono); background:color-mix(in srgb, var(--jynx) 14%, transparent); color:var(--jynx);
  border-radius:6px; padding:1px 6px; text-transform:uppercase;
}
.comments-sidebar-empty{ padding:16px 12px; font-size:12px; color:var(--text-dim); text-align:center; }
.comments-sidebar-list{ overflow-y:auto; display:flex; flex-direction:column; }
.comments-sidebar-item-wrap{ border-bottom:1px solid var(--line); padding:2px 0; }
.comments-sidebar-item{ padding:9px 12px 2px; cursor:pointer; }
.comments-sidebar-item:hover{ background:color-mix(in srgb, var(--jynx) 8%, transparent); }
.comments-sidebar-item-target{ font-family:var(--font-mono); font-size:10px; color:var(--jynx); text-transform:uppercase; display:flex; align-items:center; gap:6px; }
.comments-sidebar-item-comment{ margin:2px 0; font-size:12.5px; color:var(--text); }
.comments-edit-btn{
  display:inline-flex; align-items:center; justify-content:center; background:none; border:none;
  color:var(--text-dim); cursor:pointer; padding:0 0 0 6px; vertical-align:middle;
}
.comments-edit-btn:hover{ color:var(--jynx); }
.comments-delete-self-btn:hover{ color:var(--red); }
.comments-edit-box{ display:flex; flex-direction:column; gap:5px; margin:3px 0; }
.comments-edit-box textarea{
  width:100%; background:var(--bg); border:1px solid var(--jynx); border-radius:7px; padding:6px 8px;
  /* ann-mtihhb0g8r01: same fix as AnnotationPopover's composer textarea —
     see the comment there. */
  font-size:14px; line-height:1.4; font-family:var(--font-sans); color:var(--text); resize:vertical;
}
.comments-edit-actions{ display:flex; justify-content:flex-end; gap:6px; }
.comments-edit-actions button{
  border:none; border-radius:7px; padding:4px 10px; font-size:11px; font-weight:700; cursor:pointer;
  background:var(--panel-raised); color:var(--text-dim);
}
.comments-edit-actions button.primary{ background:var(--jynx); color:#fff; }
.comments-edit-actions button.primary:disabled{ opacity:.5; cursor:not-allowed; }
.comments-attachment-link{ display:inline-flex; margin:2px 0; }
.comments-attachment-thumb{ width:44px; height:44px; object-fit:cover; border-radius:6px; border:1px solid var(--line); }
.comments-attachment-file{
  align-items:center; gap:4px; background:var(--panel); border:1px solid var(--line);
  border-radius:12px; padding:3px 8px; font-size:10.5px; color:var(--text-dim); text-decoration:none;
}
.comments-attachment-file:hover{ color:var(--jynx); border-color:var(--jynx); }
.comments-drawing-badge{
  display:inline-flex; align-items:center; gap:4px; background:color-mix(in srgb, var(--jynx) 12%, transparent);
  border:1px solid var(--jynx); border-radius:12px; padding:3px 8px; font-size:10.5px; color:var(--jynx); margin:2px 0;
}
.comments-sidebar-item-meta{ font-size:10.5px; color:var(--text-dim); }
.jynx-author-link{ cursor:pointer; text-decoration:underline; text-underline-offset:2px; }
.jynx-author-link:hover{ color:var(--jynx); }
.comments-done-badge{ display:inline-flex; align-items:center; gap:2px; color:var(--green); font-size:9.5px; text-transform:none; }
.comments-jynx-badge{
  display:inline-flex; align-items:center; background:color-mix(in srgb, var(--dev) 15%, transparent);
  color:var(--dev); font-size:9px; font-weight:700; text-transform:none; border-radius:8px; padding:1px 6px;
}
.comments-resolution-note{
  display:flex; align-items:flex-start; gap:4px; font-size:11px; color:var(--green);
  background:color-mix(in srgb, var(--green) 10%, transparent); border-radius:6px; padding:4px 7px; margin:4px 0;
}
.comments-action-pill{
  display:inline-flex; align-items:center; gap:4px; background:color-mix(in srgb, #2F8FCE 15%, transparent);
  color:#2F8FCE; font-size:10px; font-weight:700; border-radius:12px; padding:2px 8px; margin:4px 0; cursor:default;
}
.comments-action-pill a{ color:inherit; text-decoration:underline; margin-inline-start:3px; }
.comments-action-spin{ animation:commentsActionSpin 1s linear infinite; }
@keyframes commentsActionSpin{ to{ transform:rotate(360deg); } }
.comments-action-btn{
  display:inline-flex; align-items:center; gap:4px; background:#2F8FCE; color:#fff; border:none;
  border-radius:12px; padding:3px 9px; font-size:10.5px; font-weight:700; cursor:pointer; margin:4px 0;
}
.comments-action-btn:hover{ filter:brightness(1.08); }
.comments-admin-actions{ display:flex; gap:5px; margin:4px 0; }
.comments-admin-btn{
  width:22px; height:22px; border-radius:50%; border:1px solid var(--line); background:var(--panel);
  color:var(--text-dim); cursor:pointer; display:flex; align-items:center; justify-content:center;
}
.comments-admin-btn:hover{ color:var(--jynx); border-color:var(--jynx); }
.comments-admin-btn-danger:hover{ background:var(--red); border-color:var(--red); color:#fff; }
.comments-delete-confirm{
  display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin:4px 0; font-size:11px; color:var(--red);
  background:color-mix(in srgb, var(--red) 10%, transparent); border:1px solid var(--red); border-radius:7px; padding:6px 9px;
}
.comments-delete-confirm-actions{ display:flex; gap:6px; margin-inline-start:auto; }
.comments-delete-confirm-actions button{
  border:none; border-radius:7px; padding:4px 9px; font-size:11px; font-weight:700; cursor:pointer;
  background:var(--panel-raised); color:var(--text-dim);
}
.comments-delete-confirm-actions button.danger{ background:var(--red); color:#fff; }
.comments-thread-toggle{
  display:inline-flex; align-items:center; gap:4px; background:none; border:none; color:var(--text-dim);
  font-size:10.5px; cursor:pointer; padding:2px 12px 8px;
}
.comments-thread-toggle:hover{ color:var(--jynx); }
.comments-thread{ display:flex; flex-direction:column; gap:5px; background:var(--bg); border-radius:8px; padding:7px; margin:0 12px 9px; }
.comments-thread-item{ font-size:11px; color:var(--text); }
.comments-thread-item b{ color:var(--jynx); }
/* כחול, לא הסגול-מותג הרגיל של Jynx — בכוונה: QA ביקש שאזכור-שם יובחן
   ויזואלית משאר ה-UI הסגול, לא רק יהיה מודגש (ראו PR זה). */
.comments-mention{ color:#2F8FCE; font-weight:700; }
.comments-mention-jynx{ color:var(--dev); }
/* תג-זהות ל"תגובה בתור Jynx" (jynx-mt5ev53xof3v) — לא jynx-author-link
   הרגיל (אין authorId אמיתי מאחוריו, אז לא לחיץ-לפרופיל), אלא badge קבוע
   עם Sparkles, כדי שיהיה ברור מיד שזו לא הודעת ה-admin האמיתי. */
.comments-jynx-reply-badge{ display:inline-flex; align-items:center; gap:3px; color:var(--jynx); }
.comments-reply-as-jynx-toggle{
  display:inline-flex; align-items:center; gap:4px; background:none; border:1px dashed var(--jynx);
  color:var(--jynx); border-radius:12px; padding:3px 9px; font-size:10.5px; font-weight:700; cursor:pointer;
  margin-bottom:5px;
}
.comments-reply-as-jynx-toggle.active{ background:var(--jynx); border-style:solid; color:#fff; }
.comments-thread-input-wrap{ position:relative; }
.comments-mention-dropdown{
  position:absolute; bottom:100%; left:0; right:0; margin-bottom:4px; background:var(--panel);
  border:1px solid var(--jynx); border-radius:8px; padding:4px; display:flex; flex-direction:column; gap:2px;
  box-shadow:var(--shadow-md); z-index:1; max-height:140px; overflow-y:auto;
}
.comments-mention-dropdown button{
  background:none; border:none; text-align:left; padding:5px 7px; border-radius:5px; font-size:11.5px;
  color:var(--text); cursor:pointer;
}
.comments-mention-dropdown button:hover{ background:color-mix(in srgb, var(--jynx) 12%, transparent); color:var(--jynx); }
.comments-thread-input{ display:flex; gap:5px; }
.comments-thread-input input{
  /* ann-mtihhb0g8r01: same fix as the composer/edit-box textareas — the
     one field you're actively typing a reply into shouldn't read smaller
     than the metadata around it. */
  flex:1; background:var(--panel); border:1px solid var(--line); border-radius:7px; padding:5px 8px; font-size:14px; color:var(--text);
}
.comments-thread-input button{
  background:var(--jynx); color:#fff; border:none; border-radius:7px; padding:5px 10px; font-size:11px; font-weight:700; cursor:pointer;
}
.comments-thread-input button:disabled{ opacity:.5; cursor:not-allowed; }

.comments-reaction-row{ display:flex; flex-wrap:wrap; gap:5px; padding:2px 12px 8px; }
.comments-reaction-btn{
  display:inline-flex; align-items:center; gap:3px; background:none; border:1px solid var(--line);
  color:var(--text-dim); border-radius:12px; padding:2px 7px; font-size:12px; line-height:1.4; cursor:pointer;
}
.comments-reaction-btn:hover{ border-color:var(--jynx); }
.comments-reaction-btn.active{ background:color-mix(in srgb, var(--jynx) 16%, transparent); border-color:var(--jynx); }
.comments-reaction-count{ font-family:var(--font-mono); font-size:10px; color:var(--text-dim); }
.comments-reaction-btn.active .comments-reaction-count{ color:var(--jynx); }

/* jynx-mtihenhmc7hh: same visual language as AnnotationPopover.jsx's own
   .dev-login-error/.dev-annotate-relogin-* (see DevOverlay.jsx) — kept as
   its own small block here rather than a shared import, same convention
   as every other CSS block in this file. */
.comments-send-error{ padding:6px 10px 0; font-size:11.5px; color:var(--red); }
.comments-send-error-relogin-link{
  background:none; border:none; color:var(--dev); font-weight:700; font-size:11px; text-decoration:underline;
  cursor:pointer; padding:0;
}
.comments-send-error-relogin-box{ display:flex; gap:6px; margin-top:5px; }
.comments-send-error-relogin-box input{
  flex:1; background:var(--bg); border:1px solid var(--line); border-radius:7px; padding:6px 8px;
  font-size:12px; color:var(--text); font-family:var(--font-sans);
}
.comments-send-error-relogin-box input:focus{ outline:none; border-color:var(--dev); }
.comments-send-error-relogin-box button{
  border:none; border-radius:7px; padding:6px 12px; font-family:var(--font-sans); font-weight:700; font-size:12px;
  cursor:pointer; background:var(--dev); color:#fff;
}
.comments-send-error-relogin-box button:disabled{ opacity:.5; cursor:not-allowed; }

.comments-jynx-composer-wrap{ padding:8px 10px 0; }
.comments-jynx-composer-toggle{
  display:inline-flex; align-items:center; gap:5px; width:100%; justify-content:center; background:none;
  border:1px dashed var(--dev); color:var(--dev); border-radius:8px; padding:6px 10px; font-size:11.5px;
  font-weight:700; cursor:pointer;
}
.comments-jynx-composer-toggle:hover{ background:color-mix(in srgb, var(--dev) 10%, transparent); }
.comments-jynx-composer{
  display:flex; flex-direction:column; gap:6px; border:1px solid var(--dev); border-radius:8px; padding:8px;
  background:color-mix(in srgb, var(--dev) 6%, transparent);
}
.comments-jynx-composer textarea{
  width:100%; background:var(--bg); border:1px solid var(--line); border-radius:7px; padding:6px 8px;
  /* ann-mtihhb0g8r01: same fix as every other Jynx text-entry field. */
  font-size:14px; line-height:1.4; font-family:var(--font-sans); color:var(--text); resize:vertical;
}
.comments-jynx-composer textarea:focus{ outline:none; border-color:var(--dev); }
.comments-jynx-composer-actions{ display:flex; justify-content:flex-end; gap:6px; }
.comments-jynx-composer-actions button{
  border:none; border-radius:7px; padding:5px 11px; font-family:var(--font-sans); font-weight:700; font-size:11.5px;
  cursor:pointer; background:var(--panel-raised); color:var(--text-dim);
}
.comments-jynx-composer-actions button.primary{ background:var(--dev); color:#fff; }
.comments-jynx-composer-actions button:disabled{ opacity:.5; cursor:not-allowed; }
`;
