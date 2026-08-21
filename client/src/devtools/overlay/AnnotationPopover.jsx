import React, { useState } from "react";

/* קופסת התגובה שנפתחת ב-Ctrl/Cmd+קליק — לא נושאת <style> משלה בכוונה,      */
/* תמיד ממוסגרת בתוך ה-portal של DevOverlay.jsx וסומכת על ה-<style> היחיד   */
/* שהוא כבר מזריק (בדיוק כמו תת-רכיבי מודל בתוך מסך אחר בקודבייס הזה).      */
export default function AnnotationPopover({ x, y, label, secondaryTargets, pickingSecondary, isAdmin, onCancel, onSubmit, onAddSecondary, onRemoveSecondary }) {
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!comment.trim() || sending) return;
    setSending(true);
    setError("");
    try {
      await onSubmit(comment.trim());
    } catch (e) {
      setError(e.message || "שליחה נכשלה, נסה/י שוב");
    } finally {
      setSending(false);
    }
  }

  const top = Math.min(y, window.innerHeight - 200);
  const left = Math.min(x, window.innerWidth - 300);

  return (
    <div
      className="dev-overlay-ignore dev-annotate-popover"
      style={{ top, left }}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.key === "Escape" && onCancel()}
    >
      <div className="dev-annotate-popover-label">{label}</div>
      {isAdmin && <div className="dev-annotate-popover-admin-hint">⚡ מנהל — ההערה תופעל אוטומטית כפעולה</div>}
      <textarea
        autoFocus
        rows={3}
        placeholder="מה צריך לשנות/לבדוק כאן? (למשל: להעביר לכאן ←)"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />
      <div className="dev-annotate-secondary-block">
        {secondaryTargets.length > 0 && (
          <div className="dev-annotate-secondary-chips">
            {secondaryTargets.map((t) => (
              <span key={t} className="dev-annotate-secondary-chip">
                → {t}
                <button type="button" onClick={() => onRemoveSecondary(t)} title="הסרה">×</button>
              </span>
            ))}
          </div>
        )}
        {pickingSecondary ? (
          <div className="dev-annotate-picking-hint">בחר/י אלמנט נוסף על המסך... (Esc לביטול)</div>
        ) : (
          <button type="button" className="dev-annotate-add-secondary-btn" onClick={onAddSecondary}>
            + קישור לאלמנט נוסף (יעד/מיקום)
          </button>
        )}
      </div>
      {error && <div className="dev-login-error">{error}</div>}
      <div className="dev-annotate-popover-actions">
        <button type="button" className="dev-annotate-btn" onClick={onCancel} disabled={sending}>
          ביטול
        </button>
        <button type="button" className="dev-annotate-btn dev-annotate-btn-primary" onClick={submit} disabled={!comment.trim() || sending}>
          {sending ? "שולח..." : "שליחה"}
        </button>
      </div>
    </div>
  );
}
