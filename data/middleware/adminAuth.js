import { resolveSession } from "../lib/sessions.js";

// שער אימות נפרד ומחמיר יותר משל משתמש-פיתוח רגיל — טוקן נפרד לגמרי
// (כותרת X-Admin-Session, לא Authorization), כדי שסשן דב-יוזר רגיל לעולם
// לא יעניק גישת מנהל, גם לא בטעות. ראו middleware/auth.js להסבר למה
// כותרת/localStorage ולא עוגייה.
export function requireAdmin(req, res, next) {
  const token = req.headers["x-admin-session"] || req.cookies?.hangar_admin_session;
  const isAdmin = !!resolveSession(token);
  if (!isAdmin) return res.status(401).json({ error: "נדרש אימות מנהל" });
  next();
}

// בדיקה "רכה" — אותה לוגיקה כמו requireAdmin, בלי ה-401. עבור נתיבים
// שממילא מגודרים ב-requireDevUser (לא requireAdmin) אבל צריכים לדעת אם
// המשתמש המחובר הוא *גם* מנהל, כדי לאפשר יכולת נוספת מבלי לדרוש session
// מנהל בשביל שאר הנתיב (למשל תגובה "בשם Jynx" — ראו jynx-mt5ev53xof3v
// ב-routes/annotations.js).
export function isAdminRequest(req) {
  const token = req.headers["x-admin-session"] || req.cookies?.hangar_admin_session;
  return !!resolveSession(token);
}
