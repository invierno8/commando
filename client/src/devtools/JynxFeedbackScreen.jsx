import React, { useEffect, useState } from "react";
import { Check, Download, Loader2, GitPullRequest, CheckCircle2, XCircle } from "lucide-react";
import { fetchJynxFeedback, resolveJynxFeedback, exportJynxFeedbackMarkdown } from "./devApi.js";

const ACTION_STATUS_LABEL = { queued: "Queued", in_progress: "In progress", pr_opened: "PR opened", done: "Done", failed: "Failed" };
const ACTION_STATUS_ICON = { queued: Loader2, in_progress: Loader2, pr_opened: GitPullRequest, done: CheckCircle2, failed: XCircle };
const ACTION_STATUS_TONE = { queued: "blue", in_progress: "blue", pr_opened: "green", done: "green", failed: "red" };

/* תור המשוב על Jynx עצמו — נפרד לגמרי מ-DevAnnotationsScreen.jsx (משוב על
   האפליקציה). כל רשומה כאן נכתבה על ידי המנהל בלבד ותמיד מסומנת אוטומטית
   כפעולה, אז אין כאן כפתור "הפעל" ידני — רק סקירה, סימון-כטופל וייצוא. */
export default function JynxFeedbackScreen() {
  const [items, setItems] = useState(null);
  const [filter, setFilter] = useState("open");
  const [exported, setExported] = useState(null);

  function reload() {
    fetchJynxFeedback().then(setItems);
  }
  useEffect(() => {
    reload();
    const t = setInterval(reload, 5000);
    return () => clearInterval(t);
  }, []);

  async function toggleResolved(a) {
    await resolveJynxFeedback(a.id, !a.resolved);
    reload();
  }
  async function exportMd() {
    setExported(await exportJynxFeedbackMarkdown());
  }

  if (!items) return <div className="dev-admin-empty">Loading...</div>;
  const shown = filter === "open" ? items.filter((a) => !a.resolved) : items;

  return (
    <div className="dev-admin-tab">
      <p className="dev-admin-hint">🔮 Feedback about Jynx itself (the FAB, toolbar, admin panel) — a completely separate queue from the app's QA queue, for improving the dev tool over time.</p>
      <div className="dev-admin-annotations-head">
        <div className="pill-tabs">
          <button type="button" className={"pill-tab" + (filter === "open" ? " active" : "")} onClick={() => setFilter("open")}>Open</button>
          <button type="button" className={"pill-tab" + (filter === "all" ? " active" : "")} onClick={() => setFilter("all")}>All ({items.length})</button>
        </div>
        <button type="button" className="dev-admin-export-btn" onClick={exportMd}><Download size={13} /> Export Markdown</button>
      </div>
      {shown.length === 0 && <div className="dev-admin-empty">No {filter === "open" ? "open " : ""}feedback about Jynx right now.</div>}
      {shown.length > 0 && (
        <div className="dev-admin-annotation-list">
          {shown.map((a) => {
            const StatusIcon = ACTION_STATUS_ICON[a.actionStatus];
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
                  <p className="dev-admin-annotation-comment">{a.comment}</p>
                  <span className="dev-admin-annotation-meta">{new Date(a.createdAt).toLocaleString("en-US")}</span>
                  {a.actionStatus && (
                    <span className={`pill pill-${ACTION_STATUS_TONE[a.actionStatus] || "neutral"} dev-admin-action-pill`}>
                      {StatusIcon && <StatusIcon size={11} className={a.actionStatus === "queued" || a.actionStatus === "in_progress" ? "dev-admin-spin" : ""} />}
                      {ACTION_STATUS_LABEL[a.actionStatus]}
                      {a.actionPrUrl && (
                        <a href={a.actionPrUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>View PR</a>
                      )}
                    </span>
                  )}
                </div>
                <div className="dev-admin-annotation-actions">
                  <button
                    type="button"
                    className={"dev-admin-resolve-btn" + (a.resolved ? " active" : "")}
                    onClick={() => toggleResolved(a)}
                    title={a.resolved ? "Mark as unresolved" : "Mark as resolved"}
                  >
                    <Check size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {exported !== null && (
        <div className="dev-admin-export-box">
          <textarea readOnly rows={10} value={exported} onFocus={(e) => e.target.select()} />
          <button type="button" onClick={() => setExported(null)}>Close</button>
        </div>
      )}
    </div>
  );
}
