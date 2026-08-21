import React, { useEffect, useState } from "react";
import { Check, Download, Zap, Loader2, GitPullRequest, CheckCircle2, XCircle } from "lucide-react";
import { fetchAnnotations, resolveAnnotation, exportAnnotationsMarkdown, requestAnnotationAction } from "./devApi.js";

const ACTION_STATUS_LABEL = {
  none: null, queued: "בתור", in_progress: "בטיפול", pr_opened: "PR נפתח", done: "טופל", failed: "נכשל",
};
const ACTION_STATUS_ICON = { queued: Loader2, in_progress: Loader2, pr_opened: GitPullRequest, done: CheckCircle2, failed: XCircle };
const ACTION_STATUS_TONE = { queued: "blue", in_progress: "blue", pr_opened: "green", done: "green", failed: "red" };

export default function DevAnnotationsScreen() {
  const [items, setItems] = useState(null);
  const [filter, setFilter] = useState("open"); // open | all
  const [exported, setExported] = useState(null);

  function reload() {
    fetchAnnotations().then(setItems);
  }
  useEffect(() => {
    reload();
    const t = setInterval(reload, 5000); // מרענן מעצמו כדי לשקף התקדמות סוכן חי (queued → in_progress → PR)
    return () => clearInterval(t);
  }, []);

  async function toggleResolved(a) {
    await resolveAnnotation(a.id, !a.resolved);
    reload();
  }
  async function triggerAction(a) {
    await requestAnnotationAction(a.id);
    reload();
  }
  async function exportMd() {
    setExported(await exportAnnotationsMarkdown());
  }

  if (!items) return <div className="dev-admin-empty">טוען...</div>;
  const shown = filter === "open" ? items.filter((a) => !a.resolved) : items;

  return (
    <div className="dev-admin-tab">
      <div className="dev-admin-annotations-head">
        <div className="pill-tabs">
          <button type="button" className={"pill-tab" + (filter === "open" ? " active" : "")} onClick={() => setFilter("open")}>פתוחות</button>
          <button type="button" className={"pill-tab" + (filter === "all" ? " active" : "")} onClick={() => setFilter("all")}>הכל ({items.length})</button>
        </div>
        <button type="button" className="dev-admin-export-btn" onClick={exportMd}><Download size={13} /> ייצוא Markdown</button>
      </div>
      {shown.length === 0 && <div className="dev-admin-empty">אין הערות {filter === "open" ? "פתוחות" : ""} כרגע.</div>}
      {shown.length > 0 && (
        <div className="dev-admin-annotation-list">
          {shown.map((a) => {
            const StatusIcon = ACTION_STATUS_ICON[a.actionStatus];
            const hasAction = a.actionStatus && a.actionStatus !== "none";
            return (
              <div className={"dev-admin-annotation-row" + (a.resolved ? " resolved" : "")} key={a.id}>
                <div className="dev-admin-annotation-main">
                  <span className="dev-admin-annotation-route">{a.route}</span>
                  {a.targetLabel && (
                    <span className="dev-admin-annotation-target">
                      {a.targetLabel}
                      {a.secondaryTargets?.length > 0 && ` → ${a.secondaryTargets.join(", ")}`}
                    </span>
                  )}
                  <p className="dev-admin-annotation-comment">{a.comment}</p>
                  <span className="dev-admin-annotation-meta">{a.authorName} · {new Date(a.createdAt).toLocaleString("he-IL")}</span>
                  {hasAction && (
                    <span className={`pill pill-${ACTION_STATUS_TONE[a.actionStatus] || "neutral"} dev-admin-action-pill`}>
                      {StatusIcon && <StatusIcon size={11} className={a.actionStatus === "queued" || a.actionStatus === "in_progress" ? "dev-admin-spin" : ""} />}
                      {ACTION_STATUS_LABEL[a.actionStatus]}
                      {a.actionPrUrl && (
                        <a href={a.actionPrUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                          צפייה ב-PR
                        </a>
                      )}
                    </span>
                  )}
                  {a.actionLog && <span className="dev-admin-action-log">{a.actionLog}</span>}
                </div>
                <div className="dev-admin-annotation-actions">
                  {!hasAction && (
                    <button type="button" className="dev-admin-action-btn" onClick={() => triggerAction(a)} title="הפעל סוכן אוטומטי על ההערה הזו">
                      <Zap size={13} /> פעולה
                    </button>
                  )}
                  <button
                    type="button"
                    className={"dev-admin-resolve-btn" + (a.resolved ? " active" : "")}
                    onClick={() => toggleResolved(a)}
                    title={a.resolved ? "סימון כלא-טופל" : "סימון כטופל"}
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
          <button type="button" onClick={() => setExported(null)}>סגירה</button>
        </div>
      )}
    </div>
  );
}
