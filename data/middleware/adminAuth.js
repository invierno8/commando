import { resolveSession } from "../lib/sessions.js";

// שער אימות נפרד ומחמיר יותר משל משתמש-פיתוח רגיל — עוגייה נפרדת
// (hangar_admin_session), כדי שסשן דב־יוזר רגיל לעולם לא יעניק גישת מנהל.
export function requireAdmin(req, res, next) {
  const token = req.cookies?.hangar_admin_session;
  const isAdmin = !!resolveSession(token);
  if (!isAdmin) return res.status(401).json({ error: "נדרש אימות מנהל" });
  next();
}
