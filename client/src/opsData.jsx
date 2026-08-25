import React from "react";

/* ================================================================== */
/* LEGO BLOCK — small presentational helpers shared across screens.    */
/* Actual operational data (catalog/tickets/roster/dashboard) now lives */
/* per-brigade in brigadeStore.js — this file only holds the bits that */
/* don't belong to any one brigade.                                    */
/* ================================================================== */

const FIRST_NAMES = ["דניאל", "אביב", "יובל", "עומר", "איתי", "רוני", "נועה", "טל", "בר", "נדב"];
const LAST_NAMES = ["אור", "שמש", "נחמן", "זיו", "פלד", "גל", "שגיא", "כהן", "לוי", "ברק"];
const RANKS = ["טוראי", "רב״ט", "סמל", "סמ״ר", "רס״ל"];

/* ================================================================== */
/* LEGO BLOCK — demo member persona. בכניסה אמיתית הזהות מגיעה מה-SSO  */
/* ומשויכת ליחידה אוטומטית; כאן, לצורך הדגמה, בכל בחירה מחדש בתפקיד     */
/* "משתמש יחידה" נבחרת זהות אקראית בתוך היחידות של החטיבה הנוכחית —     */
/* כך שגם היקף הנתונים (רק דרישות של היחידה שלו) נבדק בכל פעם מול       */
/* יחידה אחרת, ותמיד בתוך החטיבה שנבחרת כרגע.                          */
/* ================================================================== */

export function randomMemberPersona(units) {
  const pool = units && units.length > 0 ? units : ["יחידה"];
  return {
    rank: RANKS[Math.floor(Math.random() * RANKS.length)],
    name: `${FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)]} ${LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)]}`,
    personalNumber: String(7000000 + Math.floor(Math.random() * 999999)),
    unit: pool[Math.floor(Math.random() * pool.length)],
  };
}

/* קטגוריית ציוד — אותה רשימה בדיוק משמשת גם דרישות וגם פריטי קטלוג, כדי  */
/* שדרישה תמיד תיוחס לאותו עולם-תוכן כמו הפריט שהיא מבקשת. זו רק רשימת    */
/* ברירת המחדל (הזרע) — מנהל מערכת יכול להרחיב/לצמצם אותה בפועל דרך       */
/* "ניהול מערכת ← קטגוריות אמל״ח" (App.jsx מחזיק את הרשימה החיה בסטייט     */
/* ומעביר אותה כ-prop לכל מסך שצריך אותה, בדיוק כמו brigades).             */
export const DEFAULT_CATEGORIES = [
  "תקשורת", "ראייה", "ציוד אישי", "אנרגיה", "רפואה", "לוגיסטיקה", "ניווט", "תאורה",
  "רחפנים וכטב״ם", "תצפית", "רובוטיקה", "אחר",
];

/* מבנה דרישה — היוזר בוחר "מה סוג הדרישה" בפתיחתה, וזה קובע אילו שדות     */
/* נוספים נפתחים: רכש דורש מחיר/קישור, תיקון/הצטיידות מקשרים לפריט קטלוג   */
/* קיים (וממנו אפשר גם לפתוח דרישה ישירות — הקישוריות דו-כיוונית), ורעיון/ */
/* בקשה כללית נשאר קופסת טקסט פתוחה בלבד, בלי שדות נוספים.                */
export const TICKET_TYPES = { IDEA: "idea", PROCUREMENT: "procurement", REPAIR: "repair", EQUIP: "equip" };
export const TICKET_TYPE_LABELS = {
  idea: "רעיון / בקשה כללית",
  procurement: "רכש",
  repair: "תיקון",
  equip: "הצטיידות",
};

/* טאג שייכות ואחריות לפריט קטלוג — מקור הפריט קובע אילו פרטי קשר רלוונטיים: */
/* פריט מחט״ל → איש קשר ביחידת הפיתוח; פריט מתעשייה → שם החברה היצרנית;     */
/* ופריט ייצור-פנים (יוצר ביחידה עצמה) → אחראי פיתוח ותיק/קבצי מוצר.        */
export const CATALOG_ORIGINS = { MATAL: "matal", INDUSTRY: "industry", IN_HOUSE: "in_house" };
export const CATALOG_ORIGIN_LABELS = { matal: "מחט״ל", industry: "תעשייה", in_house: "ייצור פנים" };

export const STATUS_LABEL = {
  pending: "ממתין לאישור יחידה",
  approved: "אושר — הועבר לחטיבה",
  rejected: "סורב",
};

const PRIORITY_LABEL = { red: "דחוף", yellow: "בינוני", green: "שגרתי" };

export function PriorityDot({ p, label }) {
  if (!p) {
    return label ? <span className="prio-inline prio-none"><i className="prio-dot prio-none-dot" />טרם תועדף</span> : <span className="prio-dot prio-none" title="לא תועדף">—</span>;
  }
  if (label) {
    return (
      <span className={`prio-inline prio-inline-${p}`}>
        <i className={`prio-dot prio-${p}`} />
        {PRIORITY_LABEL[p]}
      </span>
    );
  }
  return <span className={`prio-dot prio-${p}`} title={PRIORITY_LABEL[p]} />;
}

const STATUS_TONE = { pending: "yellow", approved: "green", rejected: "red" };

export function StatusPill({ status }) {
  return <span className={`pill pill-${STATUS_TONE[status]}`}>{STATUS_LABEL[status]}</span>;
}

/* מעקב טיפול — רלוונטי רק לדרישות שכבר אושרו. בנפרד מ-status (שמתאר את     */
/* שלב האישור: ממתין/אושר/סורב), progressStatus מתאר את שלב הביצוע בפועל    */
/* אחרי שהדרישה כבר אושרה וקיבלה עדיפות — קצין אמל״ח חטיבה או הגורם האחראי  */
/* שהוא הגדיר הם היחידים שיכולים לשנות אותו (ראו addProgressLog ב-Tickets.jsx). */
export const PROGRESS_STATUS = { WAITING: "waiting", IN_PROGRESS: "in_progress", DONE: "done" };
export const PROGRESS_STATUS_LABELS = { waiting: "בהמתנה", in_progress: "בטיפול", done: "טופל" };
const PROGRESS_STATUS_TONE = { waiting: "yellow", in_progress: "blue", done: "green" };

export function ProgressStatusPill({ status }) {
  if (!status) return <span className="pill pill-neutral">טרם נפתח מעקב</span>;
  return <span className={`pill pill-${PROGRESS_STATUS_TONE[status]}`}>{PROGRESS_STATUS_LABELS[status]}</span>;
}

/* מצב הזמנה — שלב הרכש/אספקה הפיזי של פריט קטלוג ספציפי (לא לבלבל עם       */
/* progressStatus של דרישה: זה שדה עצמאי על הפריט עצמו, נקבע ידנית ע״י מי    */
/* שיכול לערוך את הפריט — ראו setProcurementStage ב-Catalog.jsx). ריק/undefined */
/* פירושו שאף שלב לא הוגדר לפריט עדיין.                                     */
export const PROCUREMENT_STAGE = { IN_PROCESS: "in_process", AWAITING_ORDER: "awaiting_order", IN_TRANSIT: "in_transit", FINAL_APPROVAL: "final_approval" };
export const PROCUREMENT_STAGE_LABELS = {
  in_process: "בתהליך",
  awaiting_order: "ממתין להזמנה",
  in_transit: "בדרך",
  final_approval: "אישור מזמין סופי",
};
const PROCUREMENT_STAGE_TONE = { in_process: "yellow", awaiting_order: "neutral", in_transit: "blue", final_approval: "green" };

export function ProcurementStagePill({ stage }) {
  if (!stage) return <span className="pill pill-neutral">לא הוגדר</span>;
  return <span className={`pill pill-${PROCUREMENT_STAGE_TONE[stage]}`}>{PROCUREMENT_STAGE_LABELS[stage]}</span>;
}
