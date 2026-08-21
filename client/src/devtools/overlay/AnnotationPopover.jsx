import React, { useRef, useState } from "react";
import { GripVertical, Zap } from "lucide-react";

/* קופסת התגובה שנפתחת ב-Ctrl/Cmd+קליק — לא נושאת <style> משלה בכוונה,      */
/* תמיד ממוסגרת בתוך ה-portal של DevOverlay.jsx וסומכת על ה-<style> היחיד   */
/* שהוא כבר מזריק (בדיוק כמו תת-רכיבי מודל בתוך מסך אחר בקודבייס הזה).      */
/* גרירה: מצב מקומי בלבד ({top,left}, מאותחל מ-x/y) — לא useDraggableFab,   */
/* כי הפופאובר הזה חולף (נוצר מחדש בכל פתיחה, נעלם בשליחה/ביטול) ולא צריך   */
/* להישמר בין רענונים כמו רכיבי ה-chrome הקבועים.                          */
export default function AnnotationPopover({ x, y, label, secondaryTargets, pickingSecondary, isAdmin, isJynxMeta, onCancel, onSubmit, onAddSecondary, onRemoveSecondary }) {
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  // כפתור פעולה מפורש — ברירת מחדל דלוקה למנהל (התנהגות ה"כל מה שאני כותב
  // הופך לפעולה" הקיימת), אבל עכשיו גם ניתן לכיבוי לפני שליחה, למי שרוצה
  // הפעם רק להשאיר הערה בלי להפעיל את הצינור האוטומטי.
  const [actionOn, setActionOn] = useState(true);
  const [pos, setPos] = useState(() => ({
    top: Math.min(y, window.innerHeight - 200),
    left: Math.min(x, window.innerWidth - 300),
  }));
  const dragRef = useRef({ dragging: false, startX: 0, startY: 0, startPos: pos });

  async function submit() {
    if (!comment.trim() || sending) return;
    setSending(true);
    setError("");
    try {
      await onSubmit(comment.trim(), actionOn);
    } catch (e) {
      setError(e.message || "Failed to send, please try again");
    } finally {
      setSending(false);
    }
  }

  function onGripPointerDown(e) {
    dragRef.current = { dragging: true, startX: e.clientX, startY: e.clientY, startPos: pos };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }
  function onGripPointerMove(e) {
    const d = dragRef.current;
    if (!d.dragging) return;
    setPos({ top: d.startPos.top + (e.clientY - d.startY), left: d.startPos.left + (e.clientX - d.startX) });
  }
  function onGripPointerUp(e) {
    dragRef.current.dragging = false;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  }

  return (
    <div
      className={"dev-overlay-ignore dev-annotate-popover jynx-ui" + (isJynxMeta ? " dev-annotate-popover-jynx" : "")}
      style={{ top: pos.top, left: pos.left }}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.key === "Escape" && onCancel()}
    >
      <div className="dev-annotate-popover-head">
        <span
          className="dev-annotate-popover-grip"
          onPointerDown={onGripPointerDown}
          onPointerMove={onGripPointerMove}
          onPointerUp={onGripPointerUp}
          title="Drag to move"
        >
          <GripVertical size={13} />
        </span>
        <div className={"dev-annotate-popover-label" + (isJynxMeta ? " dev-annotate-popover-label-jynx" : "")}>{label}</div>
      </div>
      {isJynxMeta ? (
        <div className="dev-annotate-popover-jynx-hint">🔮 Feedback about Jynx itself — separate queue, unrelated to the app</div>
      ) : (
        isAdmin && (
          <button
            type="button"
            className={"dev-annotate-action-toggle" + (actionOn ? " on" : "")}
            onClick={() => setActionOn((v) => !v)}
            title={actionOn ? "This comment will send as an action — click to cancel" : "This comment will send as a plain comment only — click to make it an action"}
          >
            <Zap size={12} /> {actionOn ? "Will send as action" : "Comment only (not action)"}
          </button>
        )
      )}
      <textarea
        autoFocus
        rows={3}
        placeholder={isJynxMeta ? "What should improve in the dev tool itself?" : "What needs to change/be checked here? (e.g. move this here ←)"}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />
      <div className="dev-annotate-secondary-block">
        {secondaryTargets.length > 0 && (
          <div className="dev-annotate-secondary-chips">
            {secondaryTargets.map((t) => (
              <span key={t} className="dev-annotate-secondary-chip">
                → {t}
                <button type="button" onClick={() => onRemoveSecondary(t)} title="Remove">×</button>
              </span>
            ))}
          </div>
        )}
        {pickingSecondary ? (
          <div className="dev-annotate-picking-hint">Pick another element on screen... (Esc to cancel)</div>
        ) : (
          <button type="button" className="dev-annotate-add-secondary-btn" onClick={onAddSecondary}>
            + Link another element (target/location)
          </button>
        )}
      </div>
      {error && <div className="dev-login-error">{error}</div>}
      <div className="dev-annotate-popover-actions">
        <button type="button" className="dev-annotate-btn" onClick={onCancel} disabled={sending}>
          Cancel
        </button>
        <button type="button" className="dev-annotate-btn dev-annotate-btn-primary" onClick={submit} disabled={!comment.trim() || sending}>
          {sending ? "Sending..." : "Send"}
        </button>
      </div>
    </div>
  );
}
