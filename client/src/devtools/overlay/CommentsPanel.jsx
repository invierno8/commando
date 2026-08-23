import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { MessageSquare, ChevronDown, ChevronUp, GripVertical, CheckCircle2, MessageCircle, Pencil, Paperclip, Zap, Loader2, GitPullRequest, XCircle, Sparkles } from "lucide-react";
import {
  fetchDevAnnotations, replyToAnnotation, editMyAnnotation, reactToAnnotation, requestAnnotationAction,
  fetchJynxFeedback, fetchMyJynxFeedback, replyToJynxFeedback, reactToJynxFeedback, submitJynxFeedback,
} from "../devApi.js";
import { useDraggableFab } from "../useDraggableFab.js";
import DrawingOverlay from "./DrawingOverlay.jsx";
import { parseMentionQuery, matchMentionCandidates, insertMentionText, renderWithMentions as renderMentionsShared } from "../mentionUtils.jsx";

const ACTION_STATUS_LABEL = { queued: "Queued", in_progress: "In progress", pr_opened: "PR opened", done: "Done", failed: "Failed" };
const ACTION_STATUS_ICON = { queued: Loader2, in_progress: Loader2, pr_opened: GitPullRequest, done: CheckCircle2, failed: XCircle };

// פלטת ריאקציות קטנה וקבועה בכוונה — לא ספריית emoji-picker (אין ספריות UI
// חיצוניות נוספות בקודבייס הזה, ראו FORCLAUDE.md). זהה למה שהשרת מאמת מולו
// (ראו data/routes/annotations.js ו-data/routes/jynx-feedback.js).
const REACTION_EMOJI = ["👍", "😄", "🤔", "❤️"];

// מדגיש @שם/@jynx בטקסט תגובה שכבר נשלח — ראו mentionUtils.jsx (משותף עכשיו
// עם DevAnnotationsScreen.jsx/JynxFeedbackScreen.jsx, לא רק כאן).
function renderWithMentions(text) {
  return renderMentionsShared(text, { mentionClassName: "comments-mention", jynxClassName: "comments-mention-jynx" });
}

/* ================================================================== */
/* LEGO BLOCK — "who commented on what, here" for EVERY dev user (not    */
/* admin-only, unlike AdminAnnotationMarkers.jsx which is the action-    */
/* management view). Three synced pieces sharing one fetch:              */
/*  1. Small dots on commented elements — hover an element's dot to      */
/*     reveal the comment(s) on it (hidden by default, so it doesn't      */
/*     clutter the page like admin's always-expanded markers).           */
/*  2. A draggable, collapsible side list of comments on the current      */
/*     route — Open/Done tabs, "just mine" toggle. Hovering a row         */
/*     outlines the matching page element in the Jynx brand color;        */
/*     clicking a row scrolls to and flashes it (jump-to-location).       */
/*  3. Reply threads per comment — any dev user can add a follow-up,      */
/*     so a resolved comment's author can react to the fix (or anyone     */
/*     can ask a clarifying question before it's resolved).               */
/*  4. Inline self-edit — a pencil icon shown only on your own comments    */
/*     (authorId === currentDevUserId), swapping the text for a textarea   */
/*     + Save/Cancel, calling editMyAnnotation() then reload(). Server-    */
/*     side enforced too (PATCH /dev/annotations/:id 403s for anyone       */
/*     else's comment) — this is just where the UI for it lives. Distinct  */
/*     from the admin's own edit-any-comment control in                    */
/*     DevAnnotationsScreen.jsx (PATCH /admin/annotations/:id) — that one  */
/*     needs admin rights, this one needs nothing but being the author.    */
/* ================================================================== */

export default function CommentsPanel({ active, route, currentDevUserId, isAdmin, canJynxComment }) {
  const [items, setItems] = useState([]);
  const [statusFilter, setStatusFilter] = useState("open"); // open | done
  const [mineOnly, setMineOnly] = useState(false);
  const [hoveredListId, setHoveredListId] = useState(null);
  const [hoveredDotLabel, setHoveredDotLabel] = useState(null);
  const [flashId, setFlashId] = useState(null);
  const [openThreadId, setOpenThreadId] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const [tick, setTick] = useState(0);
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
    // .catch(() => []) on EACH branch independently — not just one shared
    // catch on the combined Promise.all — because the dev-session token
    // (Bearer, used by fetchDevAnnotations) and the admin-session token
    // (X-Admin-Session, used by fetchJynxFeedback) are two separate,
    // independently-expiring sessions (see FORCLAUDE.md's "Dev-mode auth"
    // section). If only one of the two has gone stale, a single unhandled
    // rejection on the combined Promise.all used to silently abort the
    // *entire* reload — setItems() never ran again, so this panel would
    // freeze on whatever it last successfully loaded (while DevAdminPanel,
    // which fetches independently, kept working) until a hard page reload.
    // Now a stale/expired session on one branch just yields an empty list
    // for that branch on this poll, and self-heals on the next 5s poll
    // once the session issue is resolved, instead of freezing forever.
    const appPromise = fetchDevAnnotations(route).then((d) => d.map((a) => ({ ...a, kind: "app" }))).catch(() => []);
    // Jynx commenter שאינו מנהל: לא יכול לקרוא את התור המלא
    // (GET /admin/jynx-feedback נשאר admin-only בכוונה), אבל צריך לראות את
    // מה שהוא עצמו כתב — ראו GET /dev/jynx-feedback/mine.
    const jynxPromise = isAdmin
      ? fetchJynxFeedback().then((d) => d.filter((a) => a.route === route).map((a) => ({ ...a, kind: "jynx", authorName: a.authorName || "Admin" }))).catch(() => [])
      : canJynxComment
      ? fetchMyJynxFeedback().then((d) => d.filter((a) => a.route === route).map((a) => ({ ...a, kind: "jynx", authorName: a.authorName || "Admin" }))).catch(() => [])
      : Promise.resolve([]);
    Promise.all([appPromise, jynxPromise]).then(([app, jynx]) => setItems([...app, ...jynx]));
  }
  useEffect(() => {
    if (!active) return;
    reload();
    const t = setInterval(reload, 5000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, route, isAdmin, canJynxComment]);

  useEffect(() => {
    if (!active) return;
    function onLayoutChange() { setTick((t) => t + 1); }
    window.addEventListener("scroll", onLayoutChange, true);
    window.addEventListener("resize", onLayoutChange);
    const id = setInterval(onLayoutChange, 1500);
    return () => {
      window.removeEventListener("scroll", onLayoutChange, true);
      window.removeEventListener("resize", onLayoutChange);
      clearInterval(id);
    };
  }, [active]);

  const grouped = useMemo(() => {
    void tick;
    const byLabel = new Map();
    items.filter((a) => !a.resolved).forEach((a) => {
      if (!a.targetLabel) return;
      if (!byLabel.has(a.targetLabel)) byLabel.set(a.targetLabel, []);
      byLabel.get(a.targetLabel).push(a);
    });
    const out = [];
    byLabel.forEach((list, label) => {
      const el = document.querySelector(`[data-devblock="${CSS.escape(label)}"]`);
      if (el) out.push({ label, list, rect: el.getBoundingClientRect() });
    });
    return out;
  }, [items, tick]);

  function rectFor(a) {
    if (!a?.targetLabel) return null;
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
    items.forEach((a) => { if (a.authorName) names.add(a.authorName); });
    return [...names];
  }, [items]);
  const activeMentionQuery = useMemo(() => parseMentionQuery(replyText), [replyText]);
  const mentionMatches = useMemo(
    () => matchMentionCandidates(activeMentionQuery, mentionCandidates),
    [activeMentionQuery, mentionCandidates]
  );
  function insertMention(name) {
    setReplyText((prev) => insertMentionText(prev, name));
  }

  function jumpTo(a) {
    const found = rectFor(a);
    if (!found) return;
    found.el.scrollIntoView({ behavior: "smooth", block: "center" });
    setFlashId(a.id);
    window.setTimeout(() => setFlashId((f) => (f === a.id ? null : f)), 1600);
  }

  async function sendReply(a) {
    if (!replyText.trim()) return;
    if (a.kind === "jynx") await replyToJynxFeedback(a.id, replyText.trim());
    else await replyToAnnotation(a.id, replyText.trim());
    setReplyText("");
    reload();
  }

  async function saveEdit(a) {
    if (!editText.trim()) return;
    await editMyAnnotation(a.id, editText.trim());
    setEditingId(null);
    setEditText("");
    reload();
  }

  async function triggerAction(a) {
    await requestAnnotationAction(a.id);
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
    try {
      // אין צורך ב-targetLabel/סיכת מיקום — משוב כללי על Jynx עצמו, לא
      // מוצמד לאלמנט ספציפי (הבקאנד כבר מקבל targetLabel:null, ראו
      // data/routes/jynx-feedback.js). route כן נשלח, כדי שהפריט יופיע
      // ישר ברשימה הנוכחית (שמסוננת לפי מסך, ראו reload() למעלה).
      await submitJynxFeedback({ route, comment: jynxComposerText.trim() });
      setJynxComposerText("");
      setJynxComposerOpen(false);
      reload();
    } finally {
      setJynxComposerSending(false);
    }
  }

  if (!active) return null;

  const shown = items
    .filter((a) => (statusFilter === "open" ? !a.resolved : a.resolved))
    .filter((a) => !mineOnly || a.authorId === currentDevUserId);
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
            {shown.length === 0 && <div className="comments-sidebar-empty">No {statusFilter} comments on this screen.</div>}
            <div className="comments-sidebar-list">
              {shown.map((a) => {
                const replies = a.replies || [];
                // עריכה עצמית זמינה רק על הערות "אפליקציה" רגילות (kind
                // "app"/undefined) שאתה בעצמך כתבת — לא על משוב Jynx (תור
                // נפרד, אין לו endpoint עריכה מקביל, וממילא רק מנהל כותב שם).
                const canEdit = a.kind !== "jynx" && a.authorId === currentDevUserId;
                const isEditing = editingId === a.id;
                return (
                  <div key={a.id} className="comments-sidebar-item-wrap">
                    <div
                      className="comments-sidebar-item"
                      onMouseEnter={() => setHoveredListId(a.id)}
                      onMouseLeave={() => setHoveredListId((h) => (h === a.id ? null : h))}
                      onClick={() => !isEditing && jumpTo(a)}
                    >
                      {(a.targetLabel || a.kind === "jynx") && (
                        <span className="comments-sidebar-item-target">
                          {a.kind === "jynx" && <span className="comments-jynx-badge">🔮 Jynx</span>}
                          {a.targetLabel}
                          {a.resolved && <span className="comments-done-badge"><CheckCircle2 size={10} /> Done</span>}
                        </span>
                      )}
                      {isEditing ? (
                        <div className="comments-edit-box" onClick={(e) => e.stopPropagation()}>
                          <textarea autoFocus rows={3} value={editText} onChange={(e) => setEditText(e.target.value)} />
                          <div className="comments-edit-actions">
                            <button type="button" onClick={() => { setEditingId(null); setEditText(""); }}>Cancel</button>
                            <button type="button" className="primary" onClick={() => saveEdit(a)} disabled={!editText.trim()}>Save</button>
                          </div>
                        </div>
                      ) : (
                        <p className="comments-sidebar-item-comment">
                          {a.comment}
                          {canEdit && (
                            <button
                              type="button" className="comments-edit-btn" title="Edit your comment"
                              onClick={(e) => { e.stopPropagation(); setEditingId(a.id); setEditText(a.comment); }}
                            >
                              <Pencil size={11} />
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
                      <span className="comments-sidebar-item-meta">{a.authorName} · {new Date(a.createdAt).toLocaleString("en-US")}</span>
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
                      onClick={(e) => { e.stopPropagation(); setOpenThreadId(openThreadId === a.id ? null : a.id); }}
                    >
                      <MessageCircle size={11} /> {replies.length > 0 ? `${replies.length} repl${replies.length === 1 ? "y" : "ies"}` : "Reply"}
                    </button>
                    {openThreadId === a.id && (
                      <div className="comments-thread" onClick={(e) => e.stopPropagation()}>
                        {replies.map((r) => (
                          <div key={r.id} className="comments-thread-item"><b>{r.authorName}:</b> {renderWithMentions(r.text)}</div>
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
.comments-sidebar-filters{ padding:8px 10px 0; display:flex; align-items:center; justify-content:space-between; gap:8px; }
.comments-mine-toggle{
  background:none; border:1px solid var(--line); color:var(--text-dim); border-radius:14px; padding:3px 9px;
  font-size:10.5px; font-weight:700; cursor:pointer;
}
.comments-mine-toggle.active{ background:var(--jynx); border-color:var(--jynx); color:#fff; }
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
.comments-edit-box{ display:flex; flex-direction:column; gap:5px; margin:3px 0; }
.comments-edit-box textarea{
  width:100%; background:var(--bg); border:1px solid var(--jynx); border-radius:7px; padding:6px 8px;
  font-size:12.5px; font-family:var(--font-sans); color:var(--text); resize:vertical;
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
  flex:1; background:var(--panel); border:1px solid var(--line); border-radius:7px; padding:5px 8px; font-size:11.5px; color:var(--text);
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
  font-size:12px; font-family:var(--font-sans); color:var(--text); resize:vertical;
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
