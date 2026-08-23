import React, { useEffect, useMemo, useState } from "react";
import { Check, Download, Zap, Loader2, GitPullRequest, CheckCircle2, XCircle, MessageCircle, Undo2, Archive, ArchiveRestore, Pencil, Save, Trash2, X, Paperclip } from "lucide-react";
import { fetchAnnotations, resolveAnnotation, archiveAnnotation, editAnnotationComment, deleteAnnotation, exportAnnotationsMarkdown, requestAnnotationAction, replyToAnnotation } from "./devApi.js";
import { parseMentionQuery, matchMentionCandidates, insertMentionText, renderWithMentions, useDevUserDirectory } from "./mentionUtils.jsx";
import { openUserProfile } from "./openUserProfile.js";

const ACTION_STATUS_LABEL = {
  none: null, queued: "Queued", in_progress: "In progress", pr_opened: "PR opened", done: "Done", failed: "Failed",
};
const ACTION_STATUS_ICON = { queued: Loader2, in_progress: Loader2, pr_opened: GitPullRequest, done: CheckCircle2, failed: XCircle };
const ACTION_STATUS_TONE = { queued: "blue", in_progress: "blue", pr_opened: "green", done: "green", failed: "red" };

export default function DevAnnotationsScreen() {
  const userDirectory = useDevUserDirectory();
  const [items, setItems] = useState(null);
  const [filter, setFilter] = useState("open"); // open | done | all
  const [exported, setExported] = useState(null);
  const [exportError, setExportError] = useState("");
  const [resolvingId, setResolvingId] = useState(null); // מציג שדה "מה תיקנת?" למי
  const [resolveNote, setResolveNote] = useState("");
  const [openThreadId, setOpenThreadId] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [deletingId, setDeletingId] = useState(null); // אישור מחיקה מוטמע — לא window.confirm
  const [editingId, setEditingId] = useState(null); // עריכת טקסט התגובה עצמה
  const [editText, setEditText] = useState("");

  function reload() {
    fetchAnnotations().then(setItems);
  }
  useEffect(() => {
    reload();
    const t = setInterval(reload, 5000); // מרענן מעצמו כדי לשקף התקדמות סוכן חי (queued → in_progress → PR)
    return () => clearInterval(t);
  }, []);

  async function confirmResolve(a) {
    await resolveAnnotation(a.id, true, "Admin", resolveNote.trim() || null);
    setResolvingId(null);
    setResolveNote("");
    reload();
  }
  async function reopen(a) {
    await resolveAnnotation(a.id, false);
    reload();
  }
  async function toggleArchive(a) {
    await archiveAnnotation(a.id, !a.archived);
    reload();
  }
  async function triggerAction(a) {
    await requestAnnotationAction(a.id);
    reload();
  }
  async function exportMd() {
    setExportError("");
    try {
      setExported(await exportAnnotationsMarkdown());
    } catch (e) {
      // ללא try/catch כאן, שגיאה (למשל סשן מנהל שפג) הייתה נופלת כדחיית-
      // הבטחה לא-מטופלת בשקט — הכפתור "נראה כאילו לא עושה כלום" בלי שום
      // משוב, בדיוק כמו שדווח.
      setExportError(e.message || "Export failed, please try again");
    }
  }
  async function sendReply(a) {
    if (!replyText.trim()) return;
    await replyToAnnotation(a.id, replyText.trim());
    setReplyText("");
    reload();
  }
  function startEdit(a) {
    setEditingId(a.id);
    setEditText(a.comment);
  }
  function cancelEdit() {
    setEditingId(null);
    setEditText("");
  }
  async function saveEdit(a) {
    const text = editText.trim();
    if (!text) return;
    await editAnnotationComment(a.id, text);
    setEditingId(null);
    setEditText("");
    reload();
  }
  async function confirmDelete(a) {
    await deleteAnnotation(a.id);
    setDeletingId(null);
    reload();
  }

  // מועמדי @mention — מחברי ההערות הידועים בתור הזה, פלוס "jynx" השמור.
  // אותה פילוסופיה כמו CommentsPanel.jsx (הטקסט הוא מקור האמת, אין רשימת
  // אזכורים נפרדת שצריכה להישאר מסונכרנת).
  const mentionCandidates = useMemo(() => {
    const names = new Set(["jynx"]);
    userDirectory.forEach((u) => names.add(u.name));
    (items || []).forEach((a) => { if (a.authorName) names.add(a.authorName); });
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

  if (!items) return <div className="dev-admin-empty">Loading...</div>;
  const unarchived = items.filter((a) => !a.archived);
  const openCount = unarchived.filter((a) => !a.resolved).length;
  const shown =
    filter === "open" ? unarchived.filter((a) => !a.resolved)
    : filter === "done" ? unarchived.filter((a) => a.resolved)
    : filter === "archived" ? items.filter((a) => a.archived)
    : unarchived;

  return (
    <div className="dev-admin-tab">
      <div className="dev-admin-annotations-head">
        <div className="pill-tabs">
          <button type="button" className={"pill-tab" + (filter === "open" ? " active" : "")} onClick={() => setFilter("open")}>Open ({openCount})</button>
          <button type="button" className={"pill-tab" + (filter === "done" ? " active" : "")} onClick={() => setFilter("done")}>Done ({unarchived.filter((a) => a.resolved).length})</button>
          <button type="button" className={"pill-tab" + (filter === "all" ? " active" : "")} onClick={() => setFilter("all")}>All ({unarchived.length})</button>
          <button type="button" className={"pill-tab" + (filter === "archived" ? " active" : "")} onClick={() => setFilter("archived")}>Archived ({items.filter((a) => a.archived).length})</button>
        </div>
        {/* Export always exports open items only (a work-queue snapshot), regardless of
            which filter tab is being viewed — the count makes that scope explicit so it
            doesn't look unrelated/broken when clicked while viewing Done/All/Archived. */}
        <button type="button" className="dev-admin-export-btn" onClick={exportMd} title="Exports open comments only, regardless of the tab you're viewing"><Download size={13} /> Export Markdown ({openCount} open)</button>
      </div>
      {exportError && <div className="dev-admin-error">{exportError}</div>}
      {exported !== null && (
        <div className="dev-admin-export-box">
          <textarea readOnly rows={10} value={exported} onFocus={(e) => e.target.select()} />
          <button type="button" onClick={() => setExported(null)}>Close</button>
        </div>
      )}
      {shown.length === 0 && <div className="dev-admin-empty">No {filter === "all" ? "" : filter + " "}comments right now.</div>}
      {shown.length > 0 && (
        <div className="dev-admin-annotation-list">
          {shown.map((a) => {
            const StatusIcon = ACTION_STATUS_ICON[a.actionStatus];
            const hasAction = a.actionStatus && a.actionStatus !== "none";
            const replies = a.replies || [];
            return (
              <div className={"dev-admin-annotation-row" + (a.resolved || a.archived ? " resolved" : "")} key={a.id}>
                <div className="dev-admin-annotation-main">
                  <span className="dev-admin-annotation-route">{a.route}</span>
                  {a.targetLabel && (
                    <span className="dev-admin-annotation-target">
                      {a.targetLabel}
                      {a.secondaryTargets?.length > 0 && ` → ${a.secondaryTargets.join(", ")}`}
                    </span>
                  )}
                  {editingId === a.id ? (
                    <div className="dev-admin-edit-box">
                      <textarea autoFocus rows={2} value={editText} onChange={(e) => setEditText(e.target.value)} />
                      <div className="dev-admin-edit-box-actions">
                        <button type="button" onClick={cancelEdit}><X size={12} /> Cancel</button>
                        <button type="button" className="primary" onClick={() => saveEdit(a)} disabled={!editText.trim()}><Save size={12} /> Save</button>
                      </div>
                    </div>
                  ) : (
                    <p className="dev-admin-annotation-comment">{a.comment}</p>
                  )}
                  {a.attachment && (
                    a.attachment.startsWith("data:image/") ? (
                      <a href={a.attachment} target="_blank" rel="noreferrer" className="dev-admin-attachment-link">
                        <img src={a.attachment} alt={a.attachmentName || "attachment"} className="dev-admin-attachment-thumb" />
                      </a>
                    ) : (
                      <a href={a.attachment} download={a.attachmentName || "attachment"} className="dev-admin-attachment-link dev-admin-attachment-file">
                        <Paperclip size={11} /> {a.attachmentName || "attachment"}
                      </a>
                    )
                  )}
                  <span className="dev-admin-annotation-meta">
                    <span className="jynx-author-link" role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); openUserProfile(a.authorId); }}>
                      {a.authorName}
                    </span>
                    {" · "}{new Date(a.createdAt).toLocaleString("en-US")}
                  </span>
                  {hasAction && (
                    <span className={`pill pill-${ACTION_STATUS_TONE[a.actionStatus] || "neutral"} dev-admin-action-pill`}>
                      {StatusIcon && <StatusIcon size={11} className={a.actionStatus === "queued" || a.actionStatus === "in_progress" ? "dev-admin-spin" : ""} />}
                      {ACTION_STATUS_LABEL[a.actionStatus]}
                      {a.actionPrUrl && (
                        <a href={a.actionPrUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                          View PR
                        </a>
                      )}
                    </span>
                  )}
                  {a.actionLog && <span className="dev-admin-action-log">{a.actionLog}</span>}
                  {a.actionStatus === "pr_opened" && !a.resolved && (
                    <span className="dev-admin-pr-hint">Opening a PR doesn't auto-close this — once it's merged, click ✓ below to mark it Done.</span>
                  )}
                  {a.resolved && a.resolutionNote && (
                    <div className="dev-admin-resolution-note"><CheckCircle2 size={12} /> {a.resolutionNote}</div>
                  )}
                  {!a.resolved && a.reopenedNote && (
                    <div className="dev-admin-resolution-note reopened"><Undo2 size={12} /> {a.reopenedNote}</div>
                  )}
                  {resolvingId === a.id && (
                    <div className="dev-admin-resolve-note-box">
                      <textarea autoFocus rows={2} placeholder="What did you fix? (optional, notifies the author)" value={resolveNote} onChange={(e) => setResolveNote(e.target.value)} />
                      <div className="dev-admin-resolve-note-actions">
                        <button type="button" onClick={() => { setResolvingId(null); setResolveNote(""); }}>Cancel</button>
                        <button type="button" className="primary" onClick={() => confirmResolve(a)}>Mark done</button>
                      </div>
                    </div>
                  )}
                  <button type="button" className="dev-admin-thread-toggle" onClick={() => setOpenThreadId(openThreadId === a.id ? null : a.id)}>
                    <MessageCircle size={12} /> {replies.length > 0 ? `${replies.length} repl${replies.length === 1 ? "y" : "ies"}` : "Reply"}
                  </button>
                  {openThreadId === a.id && (
                    <div className="dev-admin-thread">
                      {replies.map((r) => (
                        <div key={r.id} className="dev-admin-thread-item">
                          <b className="jynx-author-link" role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); openUserProfile(r.authorId); }}>
                            {r.authorName}:
                          </b> {renderWithMentions(r.text, { mentionClassName: "dev-admin-mention", jynxClassName: "dev-admin-mention-jynx", directory: userDirectory })}
                          <span className="dev-admin-thread-time">{new Date(r.createdAt).toLocaleString("en-US")}</span>
                        </div>
                      ))}
                      <div className="dev-admin-thread-input-wrap">
                        {mentionMatches.length > 0 && (
                          <div className="dev-admin-mention-dropdown">
                            {mentionMatches.map((n) => (
                              <button key={n} type="button" onClick={() => insertMention(n)}>
                                {n === "jynx" ? "🔮 @jynx — re-open the PR for this" : `@${n}`}
                              </button>
                            ))}
                          </div>
                        )}
                        <div className="dev-admin-thread-input">
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
                  {deletingId === a.id && (
                    <div className="dev-admin-delete-confirm">
                      <span>Delete this comment permanently? This can't be undone.</span>
                      <div className="dev-admin-delete-confirm-actions">
                        <button type="button" onClick={() => setDeletingId(null)}>Cancel</button>
                        <button type="button" className="danger" onClick={() => confirmDelete(a)}>Delete</button>
                      </div>
                    </div>
                  )}
                </div>
                <div className="dev-admin-annotation-actions">
                  {!hasAction && (
                    <button type="button" className="dev-admin-action-btn" onClick={() => triggerAction(a)} title="Run the automated agent on this comment">
                      <Zap size={13} /> Action
                    </button>
                  )}
                  {a.resolved ? (
                    <button type="button" className="dev-admin-resolve-btn active" onClick={() => reopen(a)} title="Reopen">
                      <Undo2 size={14} />
                    </button>
                  ) : (
                    <button type="button" className="dev-admin-resolve-btn" onClick={() => { setResolvingId(a.id); setResolveNote(""); }} title="Mark as resolved">
                      <Check size={14} />
                    </button>
                  )}
                  <button type="button" className="dev-admin-archive-btn" onClick={() => toggleArchive(a)} title={a.archived ? "Unarchive" : "Archive (hide from the everyday comments view)"}>
                    {a.archived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
                  </button>
                  <button type="button" className="dev-admin-edit-btn" onClick={() => startEdit(a)} title="Edit comment text">
                    <Pencil size={13} />
                  </button>
                  <button type="button" className="dev-admin-delete-btn" onClick={() => setDeletingId(a.id)} title="Delete permanently">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
