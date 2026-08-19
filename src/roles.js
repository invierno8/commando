/* ================================================================== */
/* LEGO BLOCK — structural roles. Single source of truth, shared by    */
/* the setup wizard, the app-level (dev-only) role switcher, and every */
/* screen that needs to gate content by role.                          */
/* ================================================================== */

export const STRUCTURAL_ROLES = {
  SYSTEM_ADMIN: "system_admin",       // מטמיע המערכת — לא שייך לחטיבה ספציפית
  BRIGADE_OFFICER: "brigade_officer", // קצין אמל״ח חטיבה
  UNIT_OFFICER: "unit_officer",       // קצין אמל״ח יחידה
  MEMBER: "member",                   // חייל/משתמש קצה
};

export const ROLE_LABELS = {
  [STRUCTURAL_ROLES.SYSTEM_ADMIN]: "מנהל מערכת",
  [STRUCTURAL_ROLES.BRIGADE_OFFICER]: "קצין אמל״ח חטיבה",
  [STRUCTURAL_ROLES.UNIT_OFFICER]: "קצין אמל״ח יחידה",
  [STRUCTURAL_ROLES.MEMBER]: "משתמש יחידה",
};

// סדר תצוגה קבוע להחלפת תפקיד (כלי דמו/פיתוח בלבד — בפרודקשן התפקיד מגיע מה-SSO)
export const ROLE_ORDER = [
  STRUCTURAL_ROLES.MEMBER,
  STRUCTURAL_ROLES.UNIT_OFFICER,
  STRUCTURAL_ROLES.BRIGADE_OFFICER,
  STRUCTURAL_ROLES.SYSTEM_ADMIN,
];
