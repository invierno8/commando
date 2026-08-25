/* ================================================================== */
/* LEGO BLOCK — small pure-function analytics helpers shared by any     */
/* dashboard widget that needs to turn raw ticket timestamps/categories */
/* into numbers. Timestamps in this app are display strings, not real   */
/* Date objects ("DD/MM/YYYY HH:MM" or "DD/MM/YYYY") — parseStamp is    */
/* the one place that knows how to read them back.                     */
/* ================================================================== */

export function parseStamp(str) {
  if (!str) return null;
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/.exec(str.trim());
  if (!m) return null;
  const [, d, mo, y, h = "0", mi = "0"] = m;
  return new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi));
}

/* ממוצע דקות בין שני שדות חותמת-זמן על פני רשימת דרישות, מתעלם מדרישות  */
/* שאין להן עדיין את שני השדות (למשל דרישה שטרם הוחלטה).                */
export function avgMinutesBetween(tickets, fromField, toField) {
  const durations = tickets
    .map((t) => {
      const from = parseStamp(t[fromField]);
      const to = parseStamp(t[toField]);
      if (!from || !to) return null;
      return (to.getTime() - from.getTime()) / 60000;
    })
    .filter((v) => v !== null && v >= 0);
  if (durations.length === 0) return null;
  return durations.reduce((a, b) => a + b, 0) / durations.length;
}

export function formatDuration(minutes) {
  if (minutes === null || minutes === undefined) return "אין נתונים עדיין";
  const total = Math.round(minutes);
  const days = Math.floor(total / 1440);
  const hours = Math.floor((total % 1440) / 60);
  const mins = total % 60;
  if (days > 0) return `${days} ימ׳ ${hours} שע׳`;
  if (hours > 0) return `${hours} שע׳ ${mins} דק׳`;
  return `${mins} דק׳`;
}

export function breakdownBy(items, keyFn, fallbackLabel = "לא סווג") {
  const counts = {};
  items.forEach((it) => {
    const key = keyFn(it) || fallbackLabel;
    counts[key] = (counts[key] || 0) + 1;
  });
  return Object.entries(counts)
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);
}

export function categoryBreakdown(tickets) {
  return breakdownBy(tickets, (t) => t.category);
}

/* דירוג פריטים לפי מספר דרישות "תיקון" שנפתחו נגדם — מצביע על ציוד       */
/* שדורש תשומת לב תחזוקתית/החלפה חוזרת, לא רק על עומס דרישות כללי. כל     */
/* שורה נושאת גם את רשימת דרישות התיקון הגולמיות עצמן (repairs) — התאריך, */
/* היחידה, הפירוט והסטטוס של כל תקלה בפועל — כך שמסך הדשבורד יכול להציג   */
/* רובריקת פירוט (breakdown) לכל פריט, לא רק את המונה המצטבר.             */
export function repairLeaderboard(tickets, catalog) {
  const grouped = {};
  tickets.forEach((t) => {
    if (t.type !== "repair" || !t.linkedProductId) return;
    (grouped[t.linkedProductId] ||= []).push(t);
  });
  return Object.entries(grouped)
    .map(([id, list]) => {
      const item = catalog.find((it) => it.id === id);
      const repairs = list
        .slice()
        .sort((a, b) => (parseStamp(b.submittedAt)?.getTime() || 0) - (parseStamp(a.submittedAt)?.getTime() || 0))
        .map((t) => ({
          id: t.id, desc: t.desc, submittedAt: t.submittedAt,
          unit: t.unit, requestedBy: t.requestedBy, status: t.status,
        }));
      return { id, count: list.length, name: item?.name || id, qty: item?.qty, repairs };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

/* סך העלות המוערכת של דרישות רכש "חיות" (לא סורבו) — תמונת מצב תקציבית   */
/* גסה למה שממתין באמת, לא רק כמות הדרישות.                               */
export function procurementPendingCost(tickets) {
  const live = tickets.filter((t) => t.type === "procurement" && t.status !== "rejected" && t.estimatedPrice);
  const total = live.reduce((sum, t) => sum + Number(t.estimatedPrice || 0), 0);
  return { total, count: live.length };
}
