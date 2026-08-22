import React, { useEffect, useMemo, useRef, useState } from "react";
import { GripVertical, Paperclip, Zap } from "lucide-react";
import { useDraggableFab } from "../useDraggableFab.js";
import { devLogin } from "../devApi.js";

// גג-גודל לקובץ מצורף — data-URL זה מתחייב ל-git דרך githubPersist.js, אז
// אסור לתת לו לתפוח בלי גבול. אותו ההיגיון בדיוק כמו LogoUpload.jsx, רק עם
// בדיקת גודל מפורשת + הודעת שגיאה בטקסט (לא רק disabled — ראו הכלל הקבוע
// ב-FORCLAUDE.md: כפתור disabled בלבד לא מסביר למשתמש למה).
const MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024;

/* קופסת התגובה שנפתחת ב-Ctrl/Cmd+קליק — לא נושאת <style> משלה בכוונה,      */
/* תמיד ממוסגרת בתוך ה-portal של DevOverlay.jsx וסומכת על ה-<style> היחיד   */
/* שהוא כבר מזריק (בדיוק כמו תת-רכיבי מודל בתוך מסך אחר בקודבייס הזה).      */
/*                                                                            */
/* יעדים משניים: כל עוד הקופסה פתוחה, DevOverlay.jsx הופך Ctrl/Cmd+קליק על  */
/* אלמנט תקין בעמוד ליעד משני (קליק רגיל בלי Ctrl/Cmd עובר כרגיל לאפליקציה   */
/* מתחת, כדי לא להפריע ללחיצה על כפתורים וכו' — ראו onClickCapture שם) ומוסיף */
/* את התווית ל-secondaryTargets                                              */
/* — האפקט למטה קולט כל תוספת כזו ומזריק טוקן טקסט קריא ("[→ תווית]") ישירות */
/* לתוך ה-<textarea> במיקום הסמן, כך שהוא חלק אמיתי מהמשפט: ניתן לערוך/למחוק */
/* אותו כמו כל טקסט אחר. השרת מקבל secondaryTargets מנותח מחדש מתוך הטקסט    */
/* עצמו בזמן השליחה (ראו parseSecondaryTargetsFromComment ב-DevOverlay.jsx), */
/* לא ממערך נפרד — כך שהטקסט הוא תמיד מקור האמת היחיד.                       */
/*                                                                            */
/* גרירה: useDraggableFab (אותו hook בדיוק כמו CommentsPanel.jsx) — לא מצב   */
/* מקומי. המיקום הראשוני מחושב פעם אחת מנקודת הקליק שפתחה את הקופסה; גרירה   */
/* משם ואילך משתלטת ונשמרת ב-localStorage בדיוק כמו כל שאר כלי ה-Jynx.       */
export default function AnnotationPopover({ x, y, label, secondaryTargets, isAdmin, isJynxMeta, onCancel, onSubmit }) {
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  // "התנתקתי באמצע ולא רוצה לאבד את מה שכתבתי" — סשן-פיתוח (ולפעמים גם
  // סשן-מנהל) חי בזיכרון בלבד (ראו data/lib/sessions.js) ונמחק בכל
  // אתחול-מחדש של שרת Render בשכבה החינמית, גם הרבה לפני תפוגת ה-token
  // עצמו (שבוע) — כך שקבלת שגיאת "נדרש אימות..." תוך כדי כתיבת הערה היא
  // תרחיש אמיתי, לא רק תיאורטי. במקום לאלץ רענון-דף מלא (שהיה מאבד את
  // הטקסט/הקובץ המצורף שכבר הוכנו כאן), מציעים כניסה-מחדש דרך אותה תיבת
  // "/dev/login" בדיוק (מקבלת גם סיסמת משתמש-פיתוח וגם ה-ADMIN_SECRET
  // ישירות, ראו data/routes/dev-auth.js) בלי לסגור את הפופאובר — ה-state
  // המקומי (comment/attachment/actionOn) לא נוגע כלל, כך שאחרי כניסה
  // מחדש מוצלחת אפשר פשוט ללחוץ "Send" שוב.
  const [reauthOpen, setReauthOpen] = useState(false);
  const [reauthPassword, setReauthPassword] = useState("");
  const [reauthSubmitting, setReauthSubmitting] = useState(false);
  const [reauthError, setReauthError] = useState("");
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

  const textareaRef = useRef(null);
  const prevSecondaryLenRef = useRef(secondaryTargets.length);

  // כל תוספת ל-secondaryTargets (יעד משני חדש שנבחר בקליק על העמוד) מזריקה
  // טוקן טקסט "[→ תווית]" לתוך ה-textarea, במיקום הסמן האחרון הידוע (או בסוף
  // הטקסט אם אין), ואז ממקמת את הסמן מיד אחרי הטוקן שהוזרק כדי שאפשר להמשיך
  // להקליד בלי הפרעה.
  useEffect(() => {
    if (secondaryTargets.length > prevSecondaryLenRef.current) {
      const newOnes = secondaryTargets.slice(prevSecondaryLenRef.current);
      setComment((prev) => {
        const ta = textareaRef.current;
        const pos = ta && typeof ta.selectionStart === "number" ? ta.selectionStart : prev.length;
        const insertText = newOnes.map((t) => `[→ ${t}]`).join(" ") + " ";
        const next = prev.slice(0, pos) + insertText + prev.slice(pos);
        requestAnimationFrame(() => {
          if (!ta) return;
          const newPos = pos + insertText.length;
          ta.focus();
          ta.setSelectionRange(newPos, newPos);
        });
        return next;
      });
    }
    prevSecondaryLenRef.current = secondaryTargets.length;
  }, [secondaryTargets]);

  // מיקום ראשוני מחושב פעם אחת מנקודת הקליק שפתחה את הקופסה (top/left קלאסי,
  // מתורגם ל-left/bottom הפיזי ש-useDraggableFab עובד איתו).
  const initialPos = useMemo(() => {
    const top = Math.min(y, window.innerHeight - 200);
    const left = Math.min(x, window.innerWidth - 300);
    return { left, bottom: Math.max(4, window.innerHeight - top - 230) };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- קפוא במכוון בעת ה-mount, גרירה לוקחת שליטה אחרי
  }, []);
  const { pos, dragHandlers, sizeRef } = useDraggableFab("jynx-annotate-popover-pos", initialPos, "left");

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

  async function reauth() {
    if (!reauthPassword.trim() || reauthSubmitting) return;
    setReauthSubmitting(true);
    setReauthError("");
    try {
      await devLogin(reauthPassword.trim());
      setReauthOpen(false);
      setReauthPassword("");
      setError(""); // הטוקן החדש כבר ב-localStorage; הטקסט/הקובץ המצורף כאן לא נגעו, אז "Send" יעבוד עכשיו
    } catch (e) {
      setReauthError(e.message || "Sign-in failed");
    } finally {
      setReauthSubmitting(false);
    }
  }

  return (
    <div
      ref={sizeRef}
      className={"dev-overlay-ignore dev-annotate-popover jynx-ui" + (isJynxMeta ? " dev-annotate-popover-jynx" : "")}
      style={{ left: pos.left, bottom: pos.bottom }}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.key === "Escape" && onCancel()}
    >
      <div className="dev-annotate-popover-head">
        <span className="dev-annotate-popover-grip" {...dragHandlers} title="Drag to move">
          <GripVertical size={13} />
        </span>
        <div className={"dev-annotate-popover-label" + (isJynxMeta ? " dev-annotate-popover-label-jynx" : "")}>{label}</div>
      </div>
      {isJynxMeta && (
        <div className="dev-annotate-popover-jynx-hint">🔮 Feedback about Jynx itself — separate queue, unrelated to the app</div>
      )}
      {(isJynxMeta || isAdmin) && (
        <button
          type="button"
          className={"dev-annotate-action-toggle" + (actionOn ? " on" : "")}
          onClick={() => setActionOn((v) => !v)}
          title={actionOn ? "This comment will send as an action — click to cancel" : "This comment will send as a plain comment only — click to make it an action"}
        >
          <Zap size={12} /> {actionOn ? "Will send as action" : "Comment only (not action)"}
        </button>
      )}
      <textarea
        ref={textareaRef}
        autoFocus
        rows={3}
        placeholder={isJynxMeta ? "What should improve in the dev tool itself?" : "What needs to change/be checked here? (e.g. move this to →)"}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />
      <div className="dev-annotate-picking-hint">
        Ctrl/Cmd+click any element on screen to link it here — it'll appear as a tag in your comment
        {secondaryTargets.length > 0 && ` (${secondaryTargets.length} linked)`}
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
      {error && (
        <div className="dev-annotate-reauth">
          <div className="dev-login-error">{error}</div>
          {!reauthOpen ? (
            <button type="button" className="dev-annotate-reauth-btn" onClick={() => setReauthOpen(true)}>
              Log back in
            </button>
          ) : (
            <div className="dev-annotate-reauth-box">
              <input
                type="password"
                autoFocus
                placeholder="Password"
                value={reauthPassword}
                onChange={(e) => setReauthPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && reauth()}
                disabled={reauthSubmitting}
              />
              <button type="button" onClick={reauth} disabled={!reauthPassword.trim() || reauthSubmitting}>
                {reauthSubmitting ? "Signing in..." : "Sign in"}
              </button>
            </div>
          )}
          {reauthError && <div className="dev-login-error">{reauthError}</div>}
        </div>
      )}
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
