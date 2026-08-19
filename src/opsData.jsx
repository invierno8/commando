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

export const STATUS_LABEL = {
  pending: "ממתין לאישור יחידה",
  approved: "אושר — הועבר לחטיבה",
  rejected: "סורב",
};

export function PriorityDot({ p }) {
  if (!p) return <span className="prio-dot prio-none" title="לא תועדף">—</span>;
  return <span className={`prio-dot prio-${p}`} title={p} />;
}

const STATUS_TONE = { pending: "yellow", approved: "green", rejected: "red" };

export function StatusPill({ status }) {
  return <span className={`pill pill-${STATUS_TONE[status]}`}>{STATUS_LABEL[status]}</span>;
}
