import React from "react";

/* ================================================================== */
/* LEGO BLOCK — shared @mention logic for every reply/comment box in     */
/* the dev-tool chrome (CommentsPanel.jsx, DevAnnotationsScreen.jsx,      */
/* JynxFeedbackScreen.jsx). Mirrors data/lib/mentions.js's regex exactly  */
/* (the text is still the source of truth — no separate picker state     */
/* that has to stay in sync with what's actually typed), but adds the    */
/* WhatsApp-style "type @, see a list, pick one" flow QA asked for        */
/* (2026-08-23) on top of what was previously just plain @name typing.    */
/*                                                                        */
/* Deliberately JS-only, no CSS here — every file that renders mentions   */
/* still owns its own fully self-contained <style> block per this repo's  */
/* convention (see FORCLAUDE.md's "duplicate the CSS block" rule), so     */
/* each caller passes in its own class names for the highlighted token.   */
/* ================================================================== */

// טוקן חלקי בסוף הטקסט (התגובה היא input חד-שורתי/textarea קצר, אז "בסוף
// הטקסט הנוכחי" מספיק טוב בלי מעקב מיקום-סמן מדויק — כמו ב-CommentsPanel).
export function parseMentionQuery(text) {
  const m = text.match(/(?:^|\s)@([\p{L}\p{N}_]*)$/u);
  return m ? m[1] : null;
}

export function matchMentionCandidates(query, candidateNames, max = 6) {
  if (query === null || query === undefined) return [];
  const q = query.toLowerCase();
  return candidateNames.filter((n) => n.toLowerCase().replace(/\s+/g, "").startsWith(q)).slice(0, max);
}

// בוחרים שם מהרשימה: מחליף את הטוקן החלקי בשם המלא (רווחים מוסרים, כמו
// שהשרת עצמו מצפה — ראו normalize() ב-data/lib/mentions.js) — זה ה"תיקון
// לשם הנכון בזמן ההקלדה" שהתבקש, לא רק תיוג ויזואלי.
export function insertMentionText(text, name) {
  return text.replace(/(?:^|\s)@([\p{L}\p{N}_]*)$/u, (m) => (m.startsWith(" ") ? " " : "") + "@" + name.replace(/\s+/g, "") + " ");
}

// מדגיש @שם/@jynx בטקסט שכבר נשלח — אותו regex בדיוק כמו זה שהשרת מנתח
// מולו, רק לצורך תצוגה. הצבע עצמו (כחול, לא הסגול-מותג של Jynx) נקבע דרך
// class name שכל קורא מעביר משלו, לא כאן.
export function renderWithMentions(text, { mentionClassName, jynxClassName } = {}) {
  const parts = text.split(/(@[\p{L}\p{N}_]+)/gu);
  return parts.map((part, i) => {
    if (!part.startsWith("@")) return part;
    const isJynx = part.toLowerCase() === "@jynx";
    const cls = [mentionClassName, isJynx ? jynxClassName : null].filter(Boolean).join(" ");
    return <span key={i} className={cls}>{part}</span>;
  });
}
