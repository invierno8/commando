import React, { useEffect, useMemo, useState } from "react";
import { Download, Loader2, GitPullRequest, CheckCircle2, XCircle } from "lucide-react";
import { fetchAnnotations, fetchJynxFeedback, exportAnnotationsMarkdown, exportJynxFeedbackMarkdown } from "./devApi.js";
import { openUserProfile } from "./openUserProfile.js";

const ACTION_STATUS_LABEL = { queued: "Queued", in_progress: "In progress", pr_opened: "PR opened", done: "Done", failed: "Failed" };
const ACTION_STATUS_ICON = { queued: Loader2, in_progress: Loader2, pr_opened: GitPullRequest, done: CheckCircle2, failed: XCircle };
const ACTION_STATUS_TONE = { queued: "blue", in_progress: "blue", pr_opened: "green", done: "green", failed: "red" };

/* ================================================================== */
/* Read-only "universal" log across every route — replaces the old        */
/* DevAnnotationsScreen.jsx/JynxFeedbackScreen.jsx tabs (added 2026-08-23,  */
/* per the work item asking that comment management move entirely to       */
/* CommentsPanel.jsx, "no need to manage comments on here"). This screen    */
/* keeps only the oversight/audit-trail half of what those two used to do   */
/* — reading actionStatus/actionPrUrl/actionLog for every comment, admin-   */
/* only, not filtered to one screen — and drops every interactive control    */
/* (resolve, edit, delete, archive, reply) since those now live where the   */
/* comment actually is, via CommentsPanel's "All pages" toggle. Export      */
/* Markdown is kept (reuses the existing per-queue export endpoints — no    */
/* new backend endpoint was added for a merged export, so this still        */
/* offers two separate downloads rather than inventing a combined format).  */
/* ================================================================== */
export default function DevLogsScreen() {
  const [annotations, setAnnotations] = useState(null);
  const [jynxFeedback, setJynxFeedback] = useState(null);
  const [filter, setFilter] = useState("open"); // open | done | all
  const [exported, setExported] = useState(null);
  const [exportError, setExportError] = useState("");

  function reload() {
    fetchAnnotations().then(setAnnotations);
    fetchJynxFeedback().then(setJynxFeedback);
  }
  useEffect(() => {
    reload();
    const t = setInterval(reload, 5000);
    return () => clearInterval(t);
  }, []);

  const items = useMemo(() => {
    const app = (annotations || []).filter((a) => !a.archived).map((a) => ({ ...a, kind: "app" }));
    const jynx = (jynxFeedback || []).map((a) => ({ ...a, kind: "jynx" }));
    return [...app, ...jynx].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [annotations, jynxFeedback]);

  async function exportApp() {
    setExportError("");
    try {
      setExported({ label: "App comments", text: await exportAnnotationsMarkdown() });
    } catch (e) {
      setExportError(e.message || "Export failed, please try again");
    }
  }
  async function exportJynx() {
    setExportError("");
    try {
      setExported({ label: "Jynx feedback", text: await exportJynxFeedbackMarkdown() });
    } catch (e) {
      setExportError(e.message || "Export failed, please try again");
    }
  }

  if (annotations === null || jynxFeedback === null) return <div className="dev-admin-empty">Loading...</div>;

  const shown = filter === "open" ? items.filter((a) => !a.resolved)
    : filter === "done" ? items.filter((a) => a.resolved)
    : items;

  return (
    <div className="dev-admin-tab">
      <p className="dev-admin-hint">
        Read-only, every screen at once — a comment's own status is managed from the Comments panel where it lives
        ("All pages" toggle shows everything from here too). This is oversight only: what's queued, what has a PR, what's done.
      </p>
      <div className="dev-admin-annotations-head">
        <div className="pill-tabs">
          <button type="button" className={"pill-tab" + (filter === "open" ? " active" : "")} onClick={() => setFilter("open")}>Open ({items.filter((a) => !a.resolved).length})</button>
          <button type="button" className={"pill-tab" + (filter === "done" ? " active" : "")} onClick={() => setFilter("done")}>Done ({items.filter((a) => a.resolved).length})</button>
          <button type="button" className={"pill-tab" + (filter === "all" ? " active" : "")} onClick={() => setFilter("all")}>All ({items.length})</button>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="dev-admin-export-btn" onClick={exportApp}><Download size={13} /> App comments</button>
          <button type="button" className="dev-admin-export-btn" onClick={exportJynx}><Download size={13} /> Jynx feedback</button>
        </div>
      </div>
      {exportError && <div className="dev-admin-error">{exportError}</div>}
      {exported !== null && (
        <div className="dev-admin-export-box">
          <p className="dev-admin-hint" style={{ margin: 0 }}>{exported.label}</p>
          <textarea readOnly rows={10} value={exported.text} onFocus={(e) => e.target.select()} />
          <button type="button" onClick={() => setExported(null)}>Close</button>
        </div>
      )}
      {shown.length === 0 && <div className="dev-admin-empty">No {filter === "all" ? "" : filter + " "}comments right now.</div>}
      {shown.length > 0 && (
        <div className="dev-admin-annotation-list">
          {shown.map((a) => {
            const StatusIcon = ACTION_STATUS_ICON[a.actionStatus];
            const hasAction = a.actionStatus && a.actionStatus !== "none";
            return (
              <div className={"dev-admin-annotation-row" + (a.kind === "jynx" ? " jynx-feedback-row" : "") + (a.resolved ? " resolved" : "")} key={`${a.kind}-${a.id}`}>
                <div className="dev-admin-annotation-main">
                  {a.kind === "jynx" && <span className="dev-admin-user-jynx-badge" style={{ alignSelf: "flex-start" }}>🔮 Jynx</span>}
                  {a.route && <span className="dev-admin-annotation-route">{a.route}</span>}
                  {a.targetLabel && (
                    <span className="dev-admin-annotation-target">
                      {a.targetLabel}
                      {a.secondaryTargets?.length > 0 && ` → ${a.secondaryTargets.join(", ")}`}
                    </span>
                  )}
                  <p className="dev-admin-annotation-comment">{a.comment}</p>
                  <span className="dev-admin-annotation-meta">
                    {a.authorName ? (
                      <>
                        <span className="jynx-author-link" role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); openUserProfile(a.authorId); }}>
                          {a.authorName}
                        </span>
                        {" · "}
                      </>
                    ) : ""}
                    {new Date(a.createdAt).toLocaleString("en-US")}
                  </span>
                  {hasAction && (
                    <span className={`pill pill-${ACTION_STATUS_TONE[a.actionStatus] || "neutral"} dev-admin-action-pill`}>
                      {StatusIcon && <StatusIcon size={11} className={a.actionStatus === "queued" || a.actionStatus === "in_progress" ? "dev-admin-spin" : ""} />}
                      {ACTION_STATUS_LABEL[a.actionStatus]}
                      {a.actionPrUrl && (
                        <a href={a.actionPrUrl} target="_blank" rel="noreferrer">View PR</a>
                      )}
                    </span>
                  )}
                  {a.actionLog && <span className="dev-admin-action-log">{a.actionLog}</span>}
                  {a.resolved && a.resolutionNote && (
                    <div className="dev-admin-resolution-note"><CheckCircle2 size={12} /> {a.resolutionNote}</div>
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
