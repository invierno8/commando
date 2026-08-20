/* ================================================================== */
/* LEGO BLOCK — brigades known to the system, at the system-admin       */
/* level. HANGAR is built to serve the whole military (כלל-זרועי), not  */
/* a single brigade — this is the tenant list: every brigade using the  */
/* system, independent of any one brigade's own units/people/catalog.   */
/*                                                                      */
/* A brigade's lifecycle: a system admin provisions the shell here      */
/* (name + a first point-of-contact who will be auto-linked on their    */
/* first login) with status "pending" — the brigade doesn't need the    */
/* full install wizard to exist in the system. Once that contact (or    */
/* their own equipment officer) finishes the brigade-level setup wizard */
/* with their units/people, a system admin flips it to "active".        */
/* ================================================================== */

export const BRIGADE_STATUS = {
  PENDING: "pending",   // הוקמה במערכת, ממתינה להשלמת אשף ההתקנה על ידי החטיבה עצמה
  ACTIVE: "active",     // פעילה — סיימה הקמה
};

export const BRIGADE_STATUS_LABELS = {
  [BRIGADE_STATUS.PENDING]: "ממתינה להקמה",
  [BRIGADE_STATUS.ACTIVE]: "פעילה",
};

/* logo:null עד שהחטיבה מעלה תמונה אמיתית באשף ההתקנה שלה — עד אז מוצג      */
/* פולבק ניטרלי (BrigadeIcon). unitLogos/unitMissions מתמלאים באותו אופן,   */
/* פר יחידה — נקראים בחזרה על ידי אשף ההתקנה כדי שכניסה חוזרת לחטיבה שכבר   */
/* הוקמה תהיה עריכה של הנתונים הקיימים, לא יצירה מאפס.                     */
export const seedBrigades = [
  {
    id: "brg-commando", name: "חטיבת הקומנדו", logo: null, unitLogos: {}, unitMissions: {}, mission: "חטיבת עילית רב-זרועית",
    status: BRIGADE_STATUS.ACTIVE, units: 4, members: 268,
    contactRank: "רס״ן", contactName: "רוני כהן", contactPersonalNumber: "7134209",
    createdAt: "01/01/2026",
  },
  {
    id: "brg-golani", name: "חטיבת גולני", logo: null, unitLogos: {}, unitMissions: {}, mission: "חטיבה רגלית",
    status: BRIGADE_STATUS.ACTIVE, units: 4, members: 512,
    contactRank: "אל״ם", contactName: "דורון אשל", contactPersonalNumber: "6812345",
    createdAt: "05/03/2026",
  },
  {
    id: "brg-seven", name: "חטיבה 7", logo: null, unitLogos: {}, unitMissions: {}, mission: "",
    status: BRIGADE_STATUS.PENDING, units: 0, members: 0,
    contactRank: "סרן", contactName: "איתן ברוך", contactPersonalNumber: "7998211",
    createdAt: "18/08/2026",
  },
];

// isSuperAdmin — היררכיה בתוך מנהלי המערכת עצמם: מנהל עליון אחד (או יותר)
// שהוא היחיד שיכול לאשר סופית פעולה הרסנית (כמו מחיקת חטיבה) שמנהל מערכת
// רגיל התחיל — ראו ה"אישור כפול" ב-SystemAdmin.jsx. זוהה לפי מספר אישי,
// אותה זהות בדיוק שכבר משמשת להתאמה אישית של פריסת הדשבורד (userId).
export const seedSystemAdmins = [
  { id: "sa-1", rank: "רס״ן", name: "טל ברקאי", personalNumber: "6923456", email: "tal.barkai@hangar.mil", isSuperAdmin: true },
  { id: "sa-2", rank: "סרן", name: "עומר דגן", personalNumber: "7288341", email: "omer.dagan@hangar.mil", isSuperAdmin: false },
];
