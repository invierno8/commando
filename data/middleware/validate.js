// בדיקת קלט מינימלית — לא ספריית סכימה מלאה (zod וכו׳), רק ולידציה ידנית
// לכל route: מספיק כדי לחסום כתיבות פגומות לקבצי ה-JSON, בלי משטח נוסף.
export function requireFields(body, fields) {
  const missing = fields.filter((f) => body?.[f] === undefined || body?.[f] === null || body?.[f] === "");
  if (missing.length) {
    const err = new Error(`שדות חסרים: ${missing.join(", ")}`);
    err.status = 400;
    throw err;
  }
}

// עוטף handler אסינכרוני כך שחריגה (throw) בתוכו מגיעה ל-errorHandler של
// express, במקום ליפול כ-unhandled rejection שתוקע את הבקשה.
export function asyncRoute(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}
