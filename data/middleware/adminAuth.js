import { resolveSession } from "../lib/sessions.js";
import { readDevUsers } from "../lib/devUsers.js";

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

// שער חדש עבור "Jynx commenter" (data/routes/jynx-feedback.js POST/GET
// בלבד — סימון/מענה/ייצוא נשארים requireAdmin בלבד, אלה "האפשרויות הנוספות
// שנשארות למנהל" מהבקשה המקורית). מאפשר גישה גם למנהל מאומת וגם למשתמש-
// פיתוח רגיל (req.devUser, ממולא כבר גלובלית ב-attachDevUser ב-server.js)
// שסומן canJynxComment:true במרשם (data/config/dev-users.json). בודקים
// קודם את סשן המנהל (המחמיר יותר) ורק אם הוא לא תקף נופלים למשתמש-הפיתוח,
// כדי שההרשאה הרגילה-יותר לעולם לא "תנצח" סשן מנהל תקף בטעות. 403 (לא 401)
// לכל מי שהוא לא אחד מהשניים — "לא מחובר/ת" הוא מקרה פרטי של "אין הרשאה"
// כאן, לא שגיאה נפרדת.
export function requireAdminOrJynxCommenter(req, res, next) {
  const adminToken = req.headers["x-admin-session"] || req.cookies?.hangar_admin_session;
  if (resolveSession(adminToken)) {
    req.isAdminSession = true;
    return next();
  }
  if (req.devUser) {
    const record = readDevUsers().find((u) => u.id === req.devUser.id);
    if (record?.canJynxComment) {
      req.jynxCommenterUser = record;
      return next();
    }
  }
  return res.status(403).json({ error: "אין הרשאת Jynx commenter" });
}
