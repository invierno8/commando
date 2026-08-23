import React, { useEffect, useState } from "react";
import { fetchDevUserDirectory } from "./devApi.js";
import { openUserProfile } from "./openUserProfile.js";

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

// שם->id, לא id->שם: מה שמופיע בטקסט הוא תמיד שם. אותה השוואה בדיוק כמו
// data/lib/mentions.js's normalize()/parseMentionedUsers() (שם מלא או שם
// פרטי בלבד, בלי רגישות לרווחים/אותיות) — כפולה בכוונה כאן (לקוח מול שרת,
// אי אפשר לשתף מודול ישירות), לא רפקטור-חוצה.
function normalize(s) {
  return s.toLowerCase().replace(/\s+/g, "");
}
function findUserIdByName(directory, typedName) {
  const t = normalize(typedName);
  const match = (directory || []).find((u) => {
    const full = normalize(u.name);
    const first = normalize(u.name.split(/\s+/)[0]);
    return full === t || first === t;
  });
  return match?.id || null;
}

// שולף (עם cache פשוט) את מרשם משתמשי-הפיתוח הפעילים {id,name} — פעם אחת
// לכל mount של קורא, לא בכל render. משמש גם למועמדי @mention (המרשם המלא,
// לא רק שמות שכבר נראו על המסך) וגם לפתרון "@שם" בטקסט חזרה ל-id בשביל
// UserProfileCard.jsx (ראו renderWithMentions למטה).
export function useDevUserDirectory() {
  const [directory, setDirectory] = useState([]);
  useEffect(() => {
    let cancelled = false;
    fetchDevUserDirectory().then((d) => { if (!cancelled) setDirectory(d); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);
  return directory;
}

// מדגיש @שם/@jynx בטקסט שכבר נשלח — אותו regex בדיוק כמו זה שהשרת מנתח
// מולו, רק לצורך תצוגה. הצבע עצמו (כחול, לא הסגול-מותג של Jynx) נקבע דרך
// class name שכל קורא מעביר משלו, לא כאן. `directory` (ראו
// useDevUserDirectory למעלה) הופך אזכור אמיתי (לא @jynx) ללחיץ — קליק פותח
// את כרטיס הפרופיל של אותו משתמש (openUserProfile.js) — כשאין directory
// (או שלא נמצאה התאמה) פשוט נשאר טקסט מודגש בלתי-לחיץ, לא שגיאה.
export function renderWithMentions(text, { mentionClassName, jynxClassName, directory } = {}) {
  const parts = text.split(/(@[\p{L}\p{N}_]+)/gu);
  return parts.map((part, i) => {
    if (!part.startsWith("@")) return part;
    const isJynx = part.toLowerCase() === "@jynx";
    const cls = [mentionClassName, isJynx ? jynxClassName : null].filter(Boolean).join(" ");
    const userId = !isJynx ? findUserIdByName(directory, part.slice(1)) : null;
    if (userId) {
      return (
        <span
          key={i} className={cls + " jynx-mention-clickable"} role="button" tabIndex={0}
          style={{ cursor: "pointer", textDecoration: "underline", textUnderlineOffset: "2px" }}
          onClick={(e) => { e.stopPropagation(); openUserProfile(userId); }}
          title="View profile"
        >
          {part}
        </span>
      );
    }
    return <span key={i} className={cls}>{part}</span>;
  });
}
