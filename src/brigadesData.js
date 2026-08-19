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

export const seedBrigades = [
  {
    id: "brg-commando", name: "חטיבת הקומנדו", icon: "shield", mission: "חטיבת עילית רב-זרועית",
    status: BRIGADE_STATUS.ACTIVE, units: 4, members: 268,
    contactRank: "רס״ן", contactName: "רוני כהן", contactPersonalNumber: "7134209",
    createdAt: "01/01/2026",
  },
  {
    id: "brg-golani", name: "חטיבת גולני", icon: "mountain", mission: "חטיבה רגלית",
    status: BRIGADE_STATUS.ACTIVE, units: 6, members: 512,
    contactRank: "אל״ם", contactName: "דורון אשל", contactPersonalNumber: "6812345",
    createdAt: "05/03/2026",
  },
  {
    id: "brg-seven", name: "חטיבה 7", icon: "target", mission: "",
    status: BRIGADE_STATUS.PENDING, units: 0, members: 0,
    contactRank: "סרן", contactName: "איתן ברוך", contactPersonalNumber: "7998211",
    createdAt: "18/08/2026",
  },
];

export const seedSystemAdmins = [
  { id: "sa-1", rank: "רס״ן", name: "טל ברקאי", personalNumber: "6923456", email: "tal.barkai@hangar.mil" },
];
