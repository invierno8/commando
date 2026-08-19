import React from "react";

/* ================================================================== */
/* LEGO BLOCK — UnitEmblem                                             */
/* מקבל שם יחידה, ומחזיר תג ויזואלי ייחודי לה. אין צורך בהעלאת קובץ.    */
/* ליחידות מוכרות מראש יש מוטיב מעוצב; לכל שם אחר — סמל אוטומטי לפי     */
/* גיבוב השם (צבע + צורה + אות ראשונה), כך שגם יחידה חדשה שתתווסף       */
/* מחר מקבלת תג עקבי מבלי שאף אחד יצייר אותו ידנית.                    */
/*                                                                      */
/* הערה: אלה סמלים מקוריים בהשראת משמעות השם (למשל אגוז → משושה),      */
/* לא שחזור של סמלי יחידות רשמיים.                                     */
/* ================================================================== */

const PALETTE = [
  { fill: "#2E6E96", tone: "blue" },
  { fill: "#2E7D74", tone: "teal" },
  { fill: "#5B6B7D", tone: "slate" },
  { fill: "#4A5578", tone: "indigo" },
  { fill: "#3E7A52", tone: "green" },
  { fill: "#8C3A32", tone: "rust" },
];

function hashStr(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

function shapePath(shape) {
  switch (shape) {
    case "hex":
      return "M20,4 L33.9,12 L33.9,28 L20,36 L6.1,28 L6.1,12 Z";
    case "diamond":
      return "M20,3 L37,20 L20,37 L3,20 Z";
    case "shield":
      return "M20,3 C27,3 34,6 34,6 L34,19 C34,29 28,34 20,38 C12,34 6,29 6,19 L6,6 C6,6 13,3 20,3 Z";
    default:
      return "M20,4 L33.9,12 L33.9,28 L20,36 L6.1,28 L6.1,12 Z";
  }
}

/* מוטיבים מקוריים ליחידות הפיילוט — בהשראת משמעות השם, לא סמל רשמי */
function KnownMotif({ name, color }) {
  const common = { fill: "none", stroke: color, strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" };
  if (name === "מגלן") {
    // רכסי הרים — יחידת הרים/סיור
    return <path d="M10,26 L15,17 L19,22 L25,12 L31,26" {...common} />;
  }
  if (name === "דובדבן") {
    // ענף דובדבן מופשט
    return (
      <g>
        <circle cx="16" cy="23" r="3.4" fill={color} />
        <circle cx="24" cy="20" r="3.4" fill={color} />
        <path d="M16,19.6 L19,11 M24,16.6 L19,11" {...common} strokeWidth={1.3} />
      </g>
    );
  }
  if (name === "אגוז") {
    // אגוז — משושה קטן בתוך המשושה הגדול
    return <path d="M20,14 L26,17.5 L26,24.5 L20,28 L14,24.5 L14,17.5 Z" {...common} />;
  }
  if (name === "יחידת מטה") {
    // מצפן — יחידת מטה/פיקוד
    return (
      <g>
        <circle cx="20" cy="21" r="9" {...common} />
        <path d="M20,15 L22.5,20.5 L20,27 L17.5,20.5 Z" fill={color} />
      </g>
    );
  }
  return null;
}

export default function UnitEmblem({ name = "", size = 36, showRing = true }) {
  const hash = hashStr(name || "?");
  const palette = PALETTE[hash % PALETTE.length];
  const shapes = ["hex", "diamond", "shield"];
  const shape = shapes[hash % shapes.length];
  const initial = (name || "?").trim().charAt(0) || "?";
  const known = ["מגלן", "דובדבן", "אגוז", "יחידת מטה"].includes(name);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      className={showRing ? "unit-emblem unit-emblem-ring" : "unit-emblem"}
    >
      <path d={shapePath(shape)} style={{ fill: "var(--panel-raised)" }} stroke={palette.fill} strokeWidth="2" />
      {known ? (
        <KnownMotif name={name} color={palette.fill} />
      ) : (
        <text
          x="20" y="26" textAnchor="middle"
          style={{ fontFamily: "var(--font-sans)" }} fontWeight="700" fontSize="15"
          fill={palette.fill}
        >
          {initial}
        </text>
      )}
    </svg>
  );
}
