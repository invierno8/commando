import React, { useRef, useState } from "react";
import { Paperclip, Zap } from "lucide-react";

// גג-גודל לקובץ מצורף — data-URL זה מתחייב ל-git דרך githubPersist.js, אז
// אסור לתת לו לתפוח בלי גבול. אותו ההיגיון בדיוק כמו LogoUpload.jsx, רק עם
// בדיקת גודל מפורשת + הודעת שגיאה בטקסט (לא רק disabled — ראו הכלל הקבוע
// ב-FORCLAUDE.md: כפתור disabled בלבד לא מסביר למשתמש למה).
const MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024;

/* קופסת התגובה שנפתחת ב-Ctrl/Cmd+קליק — לא נושאת <style> משלה בכוונה,      */
/* תמיד ממוסגרת בתוך ה-portal של DevOverlay.jsx וסומכת על ה-<style> היחיד   */
/* שהוא כבר מזריק (בדיוק כמו תת-רכיבי מודל בתוך מסך אחר בקודבייס הזה).      */
export default function AnnotationPopover({ x, y, label, secondaryTargets, pickingSecondary, isAdmin, isJynxMeta, onCancel, onSubmit, onAddSecondary, onRemoveSecondary }) {
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  // כפתור פעולה מפורש — ברירת מחדל דלוקה למנהל (התנהגות ה"כל מה שאני כותב
  // הופך לפעולה" הקיימת), אבל עכשיו גם ניתן לכיבוי לפני שליחה, למי שרוצה
  // הפעם רק להשאיר הערה בלי להפעיל את הצינור האוטומטי.
  const [actionOn, setActionOn] = useState(true);
  // תמונת השראה / קובץ אחד לכל היותר, מצורף לתגובה — אותה קונבנציה בדיוק כמו
  // LogoUpload.jsx (FileReader.readAsDataURL, data-URL ב-state, אין אחסון
  // אמיתי). קיים רק בתגובות על האפליקציה עצמה, לא במשוב על Jynx (isJynxMeta).
  const [attachment, setAttachment] = useState(null); // { dataUrl, name, type } | null
  const fileInputRef = useRef(null);

  function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_ATTACHMENT_BYTES) {
      setError(`File too large (max ${Math.round(MAX_ATTACHMENT_BYTES / (1024 * 1024))}MB) — pick a smaller image/file`);
      return;
    }
    setError("");
    const reader = new FileReader();
    reader.onload = () => setAttachment({ dataUrl: reader.result, name: file.name, type: file.type });
    reader.readAsDataURL(file);
  }

  async function submit() {
    if (!comment.trim() || sending) return;
    setSending(true);
    setError("");
    try {
      await onSubmit(comment.trim(), actionOn, attachment);
    } catch (e) {
      setError(e.message || "Failed to send, please try again");
    } finally {
      setSending(false);
    }
  }

  const top = Math.min(y, window.innerHeight - 200);
  const left = Math.min(x, window.innerWidth - 300);

  return (
    <div
      className={"dev-overlay-ignore dev-annotate-popover jynx-ui" + (isJynxMeta ? " dev-annotate-popover-jynx" : "")}
      style={{ top, left }}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.key === "Escape" && onCancel()}
    >
      <div className={"dev-annotate-popover-label" + (isJynxMeta ? " dev-annotate-popover-label-jynx" : "")}>{label}</div>
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
      {!isJynxMeta && (
        <div className="dev-annotate-attachment-block">
          {attachment ? (
            <div className="dev-annotate-attachment-preview">
              {attachment.type?.startsWith("image/") ? (
                <img src={attachment.dataUrl} alt="" />
              ) : (
                <span className="dev-annotate-attachment-file"><Paperclip size={12} /> {attachment.name}</span>
              )}
              <button type="button" onClick={() => setAttachment(null)} title="Remove attachment">×</button>
            </div>
          ) : (
            <button type="button" className="dev-annotate-add-secondary-btn" onClick={() => fileInputRef.current?.click()}>
              <Paperclip size={12} /> Attach image or file
            </button>
          )}
          <input ref={fileInputRef} type="file" style={{ display: "none" }} onChange={handleFile} />
        </div>
      )}
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
