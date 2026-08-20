/* ================================================================== */
/* LEGO BLOCK — brigades known to the system, at the system-admin       */
/* level. HANGAR is built to serve the whole military (כלל-זרועי), not  */
/* a single brigade — this is the tenant list. Real HTTP calls to       */
/* data/routes/brigades.js now — seedBrigades/seedSystemAdmins (plain   */
/* consts) are replaced by fetch/create/update/delete functions,        */
/* matching the pattern every other store in this app already uses.     */
/*                                                                      */
/* A brigade's lifecycle: a system admin provisions the shell here      */
/* (name + a first point-of-contact who will be auto-linked on their    */
/* first login) with status "pending". Once that contact (or their own  */
/* equipment officer) finishes the brigade-level setup wizard with      */
/* their units/people, a system admin flips it to "active".             */
/* ================================================================== */

import { http } from "./http.js";

export const BRIGADE_STATUS = {
  PENDING: "pending",   // הוקמה במערכת, ממתינה להשלמת אשף ההתקנה על ידי החטיבה עצמה
  ACTIVE: "active",     // פעילה — סיימה הקמה
};

export const BRIGADE_STATUS_LABELS = {
  [BRIGADE_STATUS.PENDING]: "ממתינה להקמה",
  [BRIGADE_STATUS.ACTIVE]: "פעילה",
};

export async function fetchBrigades() {
  return http.get(`/brigades`);
}
export async function createBrigade(data) {
  return http.post(`/brigades`, data);
}
export async function updateBrigade(id, patch) {
  return http.patch(`/brigades/${id}`, patch);
}
export async function deleteBrigade(id) {
  await http.delete(`/brigades/${id}`);
  return true;
}

// isSuperAdmin — היררכיה בתוך מנהלי המערכת עצמם: מנהל עליון אחד (או יותר)
// שהוא היחיד שיכול לאשר סופית פעולה הרסנית (כמו מחיקת חטיבה) שמנהל מערכת
// רגיל התחיל — ראו ה"אישור כפול" ב-SystemAdmin.jsx. זוהה לפי מספר אישי,
// אותה זהות בדיוק שכבר משמשת להתאמה אישית של פריסת הדשבורד (userId).
export async function fetchSystemAdmins() {
  return http.get(`/system-admins`);
}
export async function createSystemAdmin(data) {
  return http.post(`/system-admins`, data);
}
export async function deleteSystemAdmin(id) {
  await http.delete(`/system-admins/${id}`);
  return true;
}
