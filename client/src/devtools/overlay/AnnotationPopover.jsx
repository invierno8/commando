import React, { useState } from "react";

/* קופסת התגובה שנפתחת ב-Ctrl/Cmd+קליק — לא נושאת <style> משלה בכוונה,      */
/* תמיד ממוסגרת בתוך ה-portal של DevOverlay.jsx וסומכת על ה-<style> היחיד   */
/* שהוא כבר מזריק (בדיוק כמו תת-רכיבי מודל בתוך מסך אחר בקודבייס הזה).      */
export default function AnnotationPopover({ x, y, label, onCancel, onSubmit }) {
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);

  async function submit() {
    if (!comment.trim() || sending) return;
    setSending(true);
    await onSubmit(comment.trim());
    setSending(false);
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
      <textarea
        autoFocus
        rows={3}
        placeholder="מה צריך לשנות/לבדוק כאן?"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />
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
