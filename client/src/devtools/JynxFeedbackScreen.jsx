import React, { useEffect, useMemo, useState } from "react";
import { Check, Download, Loader2, GitPullRequest, CheckCircle2, XCircle, MessageCircle, Undo2, Pencil } from "lucide-react";
import { fetchJynxFeedback, resolveJynxFeedback, exportJynxFeedbackMarkdown, replyToJynxFeedback, editJynxFeedback } from "./devApi.js";
import { parseMentionQuery, matchMentionCandidates, insertMentionText, renderWithMentions } from "./mentionUtils.jsx";

const ACTION_STATUS_LABEL = { queued: "Queued", in_progress: "In progress", pr_opened: "PR opened", done: "Done", failed: "Failed" };
const ACTION_STATUS_ICON = { queued: Loader2, in_progress: Loader2, pr_opened: GitPullRequest, done: CheckCircle2, failed: XCircle };
const ACTION_STATUS_TONE = { queued: "blue", in_progress: "blue", pr_opened: "green", done: "green", failed: "red" };

/* תור המשוב על Jynx עצמו — נפרד לגמרי מ-DevAnnotationsScreen.jsx (משוב על
   האפליקציה). מ-2026-08-21 לא רק המנהל כותב לכאן — גם משתמש-פיתוח שסומן
   canJynxComment:true (ראו data/routes/jynx-feedback.js), אבל עדיין תמיד
   אותו תור אחד, ותמיד מסומן אוטומטית כפעולה — אין כאן כפתור "הפעל" ידני,
   רק סקירה (כולל מי כתב מה, בשדה "meta" למטה), עריכת-טקסט, סימון-כטופל
   וייצוא — כל אלה עדיין מנהל-בלבד. */
export default function JynxFeedbackScreen() {
  const [items, setItems] = useState(null);
  const [filter, setFilter] = useState("open");
  const [exported, setExported] = useState(null);
  const [exportError, setExportError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [resolvingId, setResolvingId] = useState(null);
  const [resolveNote, setResolveNote] = useState("");
  const [openThreadId, setOpenThreadId] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [editingId, setEditingId] = useState(null); // מי כרגע במצב עריכת-טקסט (פנקה→שדה→שמור/בטל)
  const [editText, setEditText] = useState("");

  function reload() {
    fetchJynxFeedback().then(setItems);
  }
  useEffect(() => {
    reload();
    const t = setInterval(reload, 5000);
    return () => clearInterval(t);
  }, []);

  async function confirmResolve(a) {
    await resolveJynxFeedback(a.id, true, resolveNote.trim() || null);
    setResolvingId(null);
    setResolveNote("");
    reload();
  }
  async function reopen(a) {
    await resolveJynxFeedback(a.id, false);
    reload();
  }
  async function exportMd() {
    setExportError("");
    setExporting(true);
    try {
      setExported(await exportJynxFeedbackMarkdown());
    } catch (e) {
      // ראו הערה מקבילה ב-DevAnnotationsScreen.jsx — בלי catch, כשל (סשן
      // מנהל שפג) היה נבלע בשקט ונראה כאילו הכפתור "לא עושה כלום".
      setExportError(e.message || "Export failed, please try again");
    } finally {
      // הבקאנד (Render חינמי) יכול לישון ולקחת עד ~30-50s להתעורר על הבקשה
      // הראשונה — בלי אינדיקציה חיה כאן, הכפתור נראה "תקוע/לא עושה כלום"
      // באותו חלון, בדיוק כמו התלונה שהתקבלה, גם כשההבקשה בסופו של דבר
      // מצליחה. ראו האינדיקציה המקבילה ב-DevAuthGate.jsx's checking state.
      setExporting(false);
    }
  }
  async function sendReply(a) {
    if (!replyText.trim()) return;
    await replyToJynxFeedback(a.id, replyText.trim());
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
    if (!editText.trim()) return;
    await editJynxFeedback(a.id, editText.trim());
    setEditingId(null);
    setEditText("");
    reload();
  }

  // מועמדי @mention — ראו ההערה המקבילה ב-DevAnnotationsScreen.jsx.
  const mentionCandidates = useMemo(() => {
    const names = new Set(["jynx"]);
    (items || []).forEach((a) => { if (a.authorName) names.add(a.authorName); });
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

  if (!items) return <div className="dev-admin-empty">Loading...</div>;
  const shown = filter === "open" ? items.filter((a) => !a.resolved) : filter === "done" ? items.filter((a) => a.resolved) : items;

  return (
    <div className="dev-admin-tab">
      <p className="dev-admin-hint">🔮 Feedback about Jynx itself (the FAB, toolbar, admin panel) — a completely separate queue from the app's QA queue, for improving the dev tool over time.</p>
      <div className="dev-admin-annotations-head">
        <div className="pill-tabs">
          <button type="button" className={"pill-tab" + (filter === "open" ? " active" : "")} onClick={() => setFilter("open")}>Open ({items.filter((a) => !a.resolved).length})</button>
          <button type="button" className={"pill-tab" + (filter === "done" ? " active" : "")} onClick={() => setFilter("done")}>Done ({items.filter((a) => a.resolved).length})</button>
          <button type="button" className={"pill-tab" + (filter === "all" ? " active" : "")} onClick={() => setFilter("all")}>All ({items.length})</button>
        </div>
        <button type="button" className="dev-admin-export-btn" onClick={exportMd} disabled={exporting}>
          {exporting ? <Loader2 size={13} className="dev-admin-spin" /> : <Download size={13} />} {exporting ? "Exporting..." : "Export Markdown"}
        </button>
      </div>
      {exportError && <div className="dev-admin-error">{exportError}</div>}
      {exported !== null && (
        <div className="dev-admin-export-box">
          <textarea readOnly rows={10} value={exported} onFocus={(e) => e.target.select()} />
          <button type="button" onClick={() => setExported(null)}>Close</button>
        </div>
      )}
      {shown.length === 0 && <div className="dev-admin-empty">No {filter === "all" ? "" : filter + " "}feedback about Jynx right now.</div>}
      {shown.length > 0 && (
        <div className="dev-admin-annotation-list">
          {shown.map((a) => {
            const StatusIcon = ACTION_STATUS_ICON[a.actionStatus];
            const replies = a.replies || [];
            return (
              <div className={"dev-admin-annotation-row jynx-feedback-row" + (a.resolved ? " resolved" : "")} key={a.id}>
                <div className="dev-admin-annotation-main">
                  {a.route && <span className="dev-admin-annotation-route">{a.route}</span>}
                  {a.targetLabel && (
                    <span className="dev-admin-annotation-target">
                      {a.targetLabel}
                      {a.secondaryTargets?.length > 0 && ` → ${a.secondaryTargets.join(", ")}`}
                    </span>
                  )}
                  {editingId === a.id ? (
                    <div className="dev-admin-resolve-note-box">
                      <textarea autoFocus rows={2} value={editText} onChange={(e) => setEditText(e.target.value)} />
                      <div className="dev-admin-resolve-note-actions">
                        <button type="button" onClick={cancelEdit}>Cancel</button>
                        <button type="button" className="primary" onClick={() => saveEdit(a)} disabled={!editText.trim()}>Save</button>
                      </div>
                    </div>
                  ) : (
                    <div className="dev-admin-comment-row">
                      <p className="dev-admin-annotation-comment">{a.comment}</p>
                      <button type="button" className="dev-admin-edit-btn" onClick={() => startEdit(a)} title="Edit comment text">
                        <Pencil size={11} />
                      </button>
                    </div>
                  )}
                  <span className="dev-admin-annotation-meta">
                    {a.authorName ? `${a.authorName} · ` : ""}{new Date(a.createdAt).toLocaleString("en-US")}
                  </span>
                  {a.actionStatus && a.actionStatus !== "none" && (
                    <span className={`pill pill-${ACTION_STATUS_TONE[a.actionStatus] || "neutral"} dev-admin-action-pill`}>
                      {StatusIcon && <StatusIcon size={11} className={a.actionStatus === "queued" || a.actionStatus === "in_progress" ? "dev-admin-spin" : ""} />}
                      {ACTION_STATUS_LABEL[a.actionStatus]}
                      {a.actionPrUrl && (
                        <a href={a.actionPrUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>View PR</a>
                      )}
                    </span>
                  )}
                  {a.resolved && a.resolutionNote && (
                    <div className="dev-admin-resolution-note"><CheckCircle2 size={12} /> {a.resolutionNote}</div>
                  )}
                  {resolvingId === a.id && (
                    <div className="dev-admin-resolve-note-box">
                      <textarea autoFocus rows={2} placeholder="What did you fix? (optional)" value={resolveNote} onChange={(e) => setResolveNote(e.target.value)} />
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
                          <b>{r.authorName}:</b> {renderWithMentions(r.text, { mentionClassName: "dev-admin-mention", jynxClassName: "dev-admin-mention-jynx" })}
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
                </div>
                <div className="dev-admin-annotation-actions">
                  {a.resolved ? (
                    <button type="button" className="dev-admin-resolve-btn active" onClick={() => reopen(a)} title="Reopen">
                      <Undo2 size={14} />
                    </button>
                  ) : (
                    <button type="button" className="dev-admin-resolve-btn" onClick={() => { setResolvingId(a.id); setResolveNote(""); }} title="Mark as resolved">
                      <Check size={14} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
