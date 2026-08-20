import React, { useEffect, useState } from "react";
import { Check, Download } from "lucide-react";
import { fetchAnnotations, resolveAnnotation, exportAnnotationsMarkdown } from "./devApi.js";

export default function DevAnnotationsScreen() {
  const [items, setItems] = useState(null);
  const [filter, setFilter] = useState("open"); // open | all
  const [exported, setExported] = useState(null);

  function reload() {
    fetchAnnotations().then(setItems);
  }
  useEffect(() => { reload(); }, []);

  async function toggleResolved(a) {
    await resolveAnnotation(a.id, !a.resolved);
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
          {shown.map((a) => (
            <div className={"dev-admin-annotation-row" + (a.resolved ? " resolved" : "")} key={a.id}>
              <div className="dev-admin-annotation-main">
                <span className="dev-admin-annotation-route">{a.route}</span>
                {a.targetLabel && <span className="dev-admin-annotation-target">{a.targetLabel}</span>}
                <p className="dev-admin-annotation-comment">{a.comment}</p>
                <span className="dev-admin-annotation-meta">{a.authorName} · {new Date(a.createdAt).toLocaleString("he-IL")}</span>
              </div>
              <button
                type="button"
                className={"dev-admin-resolve-btn" + (a.resolved ? " active" : "")}
                onClick={() => toggleResolved(a)}
                title={a.resolved ? "סימון כלא-טופל" : "סימון כטופל"}
              >
                <Check size={14} />
              </button>
            </div>
          ))}
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
