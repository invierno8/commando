import rateLimit from "express-rate-limit";

// חל על שני נקודות הכניסה הרגישות בלבד (התחברות דב-יוזר, אימות סוד מנהל) —
// לא על כל ה-API, כדי לא להוסיף חיכוך מיותר לפעולות רגילות.
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "יותר מדי ניסיונות התחברות — נסה/י שוב בעוד כמה דקות" },
});
