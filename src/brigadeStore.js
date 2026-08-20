/* ================================================================== */
/* LEGO BLOCK — the per-brigade data layer. HANGAR is כלל-זרועי: every  */
/* brigade in brigadesData.js has its own catalog, tickets, roster and  */
/* dashboard stats, isolated from every other brigade's.                */
/*                                                                      */
/* Every read goes through an async "fetchX(brigadeId)" function, on    */
/* purpose — even though today it just resolves an in-memory object     */
/* after a short simulated delay. The point is that every call site     */
/* already awaits a promise and handles a loading state, so swapping    */
/* the body of these functions for real `fetch("/api/brigades/:id/…")` */
/* calls to a real backend later is a contained change inside this one  */
/* file — no consuming screen needs to change.                          */
/* ================================================================== */

/* Demo media — placeholder photos/clip standing in for real uploaded  */
/* item photography (same spirit as PhotoTile's classification tile:   */
/* an honest stand-in, not fake product photography). Only a handful   */
/* of catalog items carry these, to demonstrate both the single-image  */
/* enlarge view and the multi-image/video gallery.                     */
import demoPhoto1 from "./assets/item-photo-1.jpg";
import demoPhoto2 from "./assets/item-photo-2.jpg";
import demoPhoto3 from "./assets/item-photo-3.jpg";
import demoClip from "./assets/item-demo-clip.mp4";
import demoClipPoster from "./assets/item-demo-clip-poster.jpg";

const LATENCY_MS = 220;

function resolve(value) {
  return new Promise((res) => setTimeout(() => res(value), LATENCY_MS));
}

const TREND_DAYS = ["1/8","2/8","3/8","4/8","5/8","6/8","7/8","8/8","9/8","10/8","11/8","12/8","13/8","14/8"];

/* ================================================================== */
/* חטיבת הקומנדו — הדאטהסט המקורי, פעיל ומלא.                          */
/* ================================================================== */

const COMMANDO = {
  units: ["מגלן", "דובדבן", "אגוז", "יחידת מטה"],

  catalog: [
    { id: "VHF-07", name: 'מכשיר קשר טקטי', category: "תקשורת", qty: 42, icon: "radio", unit: "מגלן",
      desc: 'מכשיר קשר שדה טווח ארוך, עמיד למים ולזעזועים. כולל סוללה נטענת וכבל טעינה שדה.',
      origin: "industry", originCompany: "טאדיראן תקשורת בע״מ",
      notes: "יש להזמין מראש כבל טעינה שדה חלופי — הדגם הנוכחי מפסיק להיטען מתחת ל-5°C.",
      equipInstructions: "פתיחת דרישת 'הצטיידות' דרך הכרטיס הזה, בצירוף אישור מפקד פלוגה. איסוף בפועל ממחסן התקשורת החטיבתי בין 08:00-14:00, בתיאום מראש מול רס״ן רוני כהן.",
      responsibleRank: "רס״ן", responsibleName: "רוני כהן", responsiblePersonalNumber: "7134209", responsiblePhone: "050-1234567",
      addedAt: "02/03/2026", addedBy: "רס״ן רוני כהן",
      updatedAt: "15/08/2026 09:20", updatedBy: "רס״ן רוני כהן",
      media: [
        { type: "image", url: demoPhoto1, caption: "המכשיר במלואו — תצוגה קדמית" },
        { type: "image", url: demoPhoto2, caption: "פאנל בקרה ולחצני תדר" },
        { type: "image", url: demoPhoto3, caption: "עם אנטנה מורכבת ותיק נשיאה" },
        { type: "video", url: demoClip, poster: demoClipPoster, caption: "סרטון הדגמת הפעלה" },
      ] },
    { id: "NVG-03", name: 'משקפת ראיית לילה', category: "ראייה", qty: 17, icon: "nvg", unit: "דובדבן",
      desc: 'משקפת דור 3, הגברת אור שארית. מותקנת על קסדה או מוחזקת ביד. כוללת נרתיק הגנה.',
      origin: "industry", originCompany: "אלביט מערכות בע״מ",
      responsibleRank: "סרן", responsibleName: "עידן לוי", responsiblePersonalNumber: "7245831", responsiblePhone: "052-2345678",
      addedAt: "11/04/2026", addedBy: "סרן עידן לוי",
      updatedAt: "17/08/2026 20:22", updatedBy: "סרן עידן לוי",
      media: [{ type: "image", url: demoPhoto2, caption: "משקפת מותקנת על קסדה" }] },
    { id: "VST-09", name: 'אפוד נשיאה טקטי', category: "ציוד אישי", qty: 63, icon: "vest", unit: "מגלן",
      desc: 'אפוד מודולרי בשיטת MOLLE, מתאים לנשיאת מגזינים, ציוד עזרה ראשונה וציוד נלווה.',
      origin: "in_house", developmentLead: { rank: "סרן", name: "עידן לוי" }, productFiles: ["תיק_פיתוח_אפוד_v2.pdf", "מפרט_טכני_MOLLE.pdf"],
      responsibleRank: "רס״ן", responsibleName: "רוני כהן", responsiblePersonalNumber: "7134209", responsiblePhone: "050-1234567",
      addedAt: "02/03/2026", addedBy: "רס״ן רוני כהן",
      updatedAt: "10/07/2026 14:05", updatedBy: "רס״ר מאיה ברק", media: [] },
    { id: "BAT-12", name: 'סוללות ליתיום שדה', category: "אנרגיה", qty: 210, icon: "battery", unit: "אגוז",
      desc: 'מארז סוללות ליתיום להזנת ציוד תקשורת וראייה. אחסון בטמפרטורה מבוקרת בלבד.',
      origin: "industry", originCompany: "פאואר-טק תעשיות אנרגיה בע״מ",
      responsibleRank: "רס״ר", responsibleName: "מאיה ברק", responsiblePersonalNumber: "7356712", responsiblePhone: "054-3456789",
      addedAt: "20/01/2026", addedBy: "רס״ר מאיה ברק",
      updatedAt: "05/08/2026 11:40", updatedBy: "רס״ר מאיה ברק", media: [] },
    { id: "MED-04", name: 'אלונקת חילוץ קלה', category: "רפואה", qty: 9, icon: "medical", unit: "יחידת מטה",
      desc: 'אלונקה מתקפלת, משקל קל, מיועדת לפינוי בשטח פתוח ובמרחבים סגורים.',
      origin: "matal", originContact: { rank: "רס״ן", name: "תמר גולן", phone: "050-7778899" },
      responsibleRank: "סגן", responsibleName: "נועה שגיא", responsiblePersonalNumber: "7467123", responsiblePhone: "053-4567890",
      addedAt: "14/02/2026", addedBy: "סגן נועה שגיא",
      updatedAt: "14/08/2026 09:10", updatedBy: "סגן נועה שגיא",
      media: [
        { type: "image", url: demoPhoto3, caption: "מקופלת בתיק נשיאה" },
        { type: "image", url: demoPhoto1, caption: "פרוסה ומוכנה לשימוש" },
      ] },
    { id: "GEN-02", name: 'גנרטור שדה נייד', category: "אנרגיה", qty: 6, icon: "generator", unit: "אגוז",
      desc: 'גנרטור נייד להזנת עמדת פיקוד זמנית. כולל מתאם לטעינת ציוד תקשורת.',
      origin: "industry", originCompany: "גנרל-אנרגיה תעשיות בע״מ",
      responsibleRank: "רס״ר", responsibleName: "מאיה ברק", responsiblePersonalNumber: "7356712", responsiblePhone: "054-3456789",
      addedAt: "20/01/2026", addedBy: "רס״ר מאיה ברק",
      updatedAt: "17/08/2026 19:40", updatedBy: "רס״ן רוני כהן", media: [] },
    { id: "TNT-06", name: 'אוהל שטח 6 מקומות', category: "לוגיסטיקה", qty: 24, icon: "tent", unit: "יחידת מטה",
      desc: 'אוהל שטח בעל מסגרת קלה להקמה, כולל יתדות ורצועות עיגון.',
      origin: "industry", originCompany: "קמפינג-פרו ציוד שטח בע״מ",
      responsibleRank: "סגן", responsibleName: "טל אשכנזי", responsiblePersonalNumber: "7578934", responsiblePhone: "058-5678901",
      addedAt: "03/05/2026", addedBy: "סגן טל אשכנזי",
      updatedAt: "16/08/2026 15:40", updatedBy: "סגן טל אשכנזי", media: [] },
    { id: "NAV-01", name: 'מצפן דיגיטלי', category: "ניווט", qty: 55, icon: "nav", unit: "דובדבן",
      desc: 'מצפן דיגיטלי עם תאורה אחורית, עמיד למים, כולל מד גובה בסיסי.',
      origin: "matal", originContact: { rank: "סא״ל", name: "אורי פלד", phone: "052-4445566" },
      responsibleRank: "סרן", responsibleName: "עידן לוי", responsiblePersonalNumber: "7245831", responsiblePhone: "052-2345678",
      addedAt: "11/04/2026", addedBy: "סרן עידן לוי",
      updatedAt: "01/06/2026 08:00", updatedBy: "סרן עידן לוי", media: [] },
    { id: "LGT-05", name: 'פנס טקטי לקסדה', category: "תאורה", qty: 88, icon: "light", unit: "מגלן",
      desc: 'פנס עם שלושה מצבי עוצמה ומצב תאורה אדומה לשמירה על ראיית לילה.',
      origin: "in_house", developmentLead: { rank: "רס״ן", name: "רוני כהן" }, productFiles: ["תיק_פיתוח_פנס_LGT05.pdf"],
      responsibleRank: "רס״ן", responsibleName: "רוני כהן", responsiblePersonalNumber: "7134209", responsiblePhone: "050-1234567",
      addedAt: "02/03/2026", addedBy: "רס״ן רוני כהן",
      updatedAt: "18/06/2026 10:15", updatedBy: "רס״ן רוני כהן", media: [] },
  ],

  tickets: [
    { id: "REQ-1042", title: 'חוסר במשקפות ראיית לילה', desc: 'נדרשות 4 יחידות נוספות לפלוגה לקראת תרגיל.', unit: "מגלן",
      category: "ראייה", collaborators: [], raisedByUnitOfficer: false,
      type: "equip", linkedProductId: "NVG-03",
      damatz: "damatz_nvg_1042.pdf", extras: ["תמונת_מצאי.jpg"], status: "pending", priority: null,
      requestedBy: "רס״ל דניאל אור", createdAt: "היום, 08:12", submittedAt: "18/08/2026 08:12", decidedAt: null, decidedBy: null, prioritizedAt: null,
      dueDate: "", photoUploaded: true,
      progressStatus: null, progressNote: "", assignee: null, progressLog: [] },
    { id: "REQ-1041", title: 'תקלה בגנרטור שדה', desc: 'הגנרטור בעמדת הפיקוד אינו מניע עומס מלא.', unit: "דובדבן",
      category: "אנרגיה", collaborators: [{ rank: "רס״ר", name: "מאיה ברק" }], raisedByUnitOfficer: false,
      type: "repair", linkedProductId: "GEN-02",
      damatz: "damatz_gen_1041.pdf", extras: [], status: "approved", priority: "yellow",
      requestedBy: "סמל עידן לוי", createdAt: "אתמול, 19:40", submittedAt: "17/08/2026 19:40", decidedAt: "17/08/2026 20:05", decidedBy: "סרן עידן לוי", prioritizedAt: "17/08/2026 20:30",
      dueDate: "25/08/2026", photoUploaded: false,
      progressStatus: "in_progress", progressNote: "טכנאי חשמל בדרך לעמדת הפיקוד, צפי תיקון עד סוף היום.",
      assignee: { personalNumber: "7356712", rank: "רס״ר", name: "מאיה ברק" },
      progressLog: [
        { id: "lg-1", author: "רס״ן רוני כהן", authorRole: "brigade_officer", stamp: "17/08/2026 20:35", status: "waiting", statusChanged: true, text: "מקצה לטיפול את רס״ר מאיה ברק — נא לתאם מול דובדבן ולעדכן." },
        { id: "lg-2", author: "רס״ר מאיה ברק", authorRole: "assignee", stamp: "18/08/2026 07:10", status: "in_progress", statusChanged: true, text: "בדקתי מול היחידה — מדובר בתקלת הזנה, לא בתקלת מנוע כפי שדווח בהתחלה. הזמנתי טכנאי חשמל מהמאגר המרכזי, אמור להגיע היום אחה״צ. אעדכן ברגע שהוא יגיע ויבצע אבחון מלא בשטח." },
        { id: "lg-3", author: "סמל עידן לוי", authorRole: "unit_officer", stamp: "18/08/2026 09:00", status: "in_progress", statusChanged: false, text: "תודה על העדכון, נמתין. העמדה עדיין מתפקדת על גיבוי סוללות." },
      ] },
    { id: "REQ-1039", title: 'בקשה לאוהלי שטח נוספים', desc: 'הרחבת מוצב זמני, נדרשים 3 אוהלים.', unit: "אגוז",
      category: "לוגיסטיקה", collaborators: [], raisedByUnitOfficer: false,
      type: "equip", linkedProductId: "TNT-06",
      damatz: "damatz_tent_1039.pdf", extras: ["תרשים_מוצב.pdf"], status: "approved", priority: "green",
      requestedBy: "רס״ר מאיה ברק", createdAt: "לפני יומיים", submittedAt: "16/08/2026 11:20", decidedAt: "16/08/2026 15:40", decidedBy: "סגן טל אשכנזי", prioritizedAt: "16/08/2026 16:10",
      dueDate: "30/08/2026", photoUploaded: false,
      progressStatus: "waiting", progressNote: "ממתין להקצאת גורם אחראי.", assignee: null, progressLog: [] },
    { id: "REQ-1037", title: 'סוללות שדה — מלאי נמוך', desc: 'מלאי הסוללות ליחידת התקשורת עומד להיגמר.', unit: "מגלן",
      category: "אנרגיה", collaborators: [], raisedByUnitOfficer: false,
      type: "procurement", estimatedPrice: 4200, purchaseLink: "",
      damatz: "damatz_bat_1037.pdf", extras: [], status: "rejected", priority: null,
      requestedBy: "טל אשכנזי", createdAt: "לפני 3 ימים", submittedAt: "15/08/2026 09:00", decidedAt: "15/08/2026 14:22", decidedBy: "רס״ן רוני כהן", prioritizedAt: null,
      dueDate: "", photoUploaded: false, daysLeft: 27, rejectionReason: "המלאי הקיים מספיק לחודש הקרוב לפי דוח המלאי האחרון — יש להגיש שוב רק אם המצב משתנה.",
      progressStatus: null, progressNote: "", assignee: null, progressLog: [] },
    { id: "REQ-1033", title: 'אלונקת חילוץ פגומה', desc: 'רצועת נשיאה קרועה, נדרש חילוף מיידי.', unit: "יחידת מטה",
      category: "רפואה", collaborators: [{ rank: "רס״ן", name: "רוני כהן" }, { rank: "סרן", name: "עידן לוי" }], raisedByUnitOfficer: false,
      type: "repair", linkedProductId: "MED-04",
      damatz: "damatz_med_1033.pdf", extras: ["תמונה_נזק.jpg"], status: "approved", priority: "red",
      requestedBy: "נועה שגיא", createdAt: "לפני 4 ימים", submittedAt: "14/08/2026 07:55", decidedAt: "14/08/2026 09:10", decidedBy: "סגן נועה שגיא", prioritizedAt: "14/08/2026 09:20",
      dueDate: "19/08/2026", photoUploaded: true,
      progressStatus: "done", progressNote: "הרצועה הוחלפה, האלונקה נבדקה ואושרה לשימוש מחדש.",
      assignee: { personalNumber: "7467123", rank: "סגן", name: "נועה שגיא" },
      progressLog: [
        { id: "lg-4", author: "רס״ן רוני כהן", authorRole: "brigade_officer", stamp: "14/08/2026 09:25", status: "waiting", statusChanged: true, text: "דחוף — מקצה לטיפול את סגן נועה שגיא, פריט רפואי קריטי." },
        { id: "lg-5", author: "סגן נועה שגיא", authorRole: "assignee", stamp: "14/08/2026 11:00", status: "in_progress", statusChanged: true, text: "אותרה רצועה חלופית במלאי יחידת מטה, מבצעת החלפה עכשיו." },
        { id: "lg-6", author: "סגן נועה שגיא", authorRole: "assignee", stamp: "14/08/2026 12:40", status: "done", statusChanged: true, text: "הוחלפה ונבדקה. האלונקה תקינה וחזרה למלאי הפעיל." },
        { id: "lg-7", author: "נועה שגיא", authorRole: "member", stamp: "14/08/2026 13:05", status: "done", statusChanged: false, text: "תודה על הטיפול המהיר!" },
      ] },
    { id: "REQ-1019", title: 'אלונקת חילוץ — ידית שבורה', desc: 'ידית האחיזה השמאלית נשברה בשימוש שדה.', unit: "יחידת מטה",
      category: "רפואה", collaborators: [], raisedByUnitOfficer: false,
      type: "repair", linkedProductId: "MED-04",
      damatz: "damatz_med_1019.pdf", extras: [], status: "approved", priority: "yellow",
      requestedBy: "סגן נועה שגיא", createdAt: "לפני חודש", submittedAt: "19/07/2026 10:30", decidedAt: "19/07/2026 13:00", decidedBy: "סגן נועה שגיא", prioritizedAt: "19/07/2026 13:20",
      dueDate: "26/07/2026", photoUploaded: false,
      progressStatus: null, progressNote: "", assignee: null, progressLog: [] },
    { id: "REQ-1055", title: 'צורך דחוף בציוד תצפית נוסף לעמדה מתקדמת', desc: 'לאחר סיור שטח מזוהה חוסר במשקפות ראייה למוצב המתקדם — פתחתי ישירות כדי לזרז.', unit: "מגלן",
      category: "ראייה", collaborators: [], raisedByUnitOfficer: true,
      type: "equip", linkedProductId: "NVG-03",
      damatz: "damatz_obs_1055.pdf", extras: [], status: "approved", priority: null,
      requestedBy: "רס״ן רוני כהן", createdAt: "היום, 07:40", submittedAt: "18/08/2026 07:40", decidedAt: "18/08/2026 07:40", decidedBy: "רס״ן רוני כהן", prioritizedAt: null,
      dueDate: "", photoUploaded: false,
      progressStatus: null, progressNote: "", assignee: null, progressLog: [] },
  ],

  roster: {
    unitOfficers: [
      { id: "uo-1", unit: "מגלן", rank: "רס״ן", name: "רוני כהן", personalNumber: "7134209", email: "roni.cohen@example.mil" },
      { id: "uo-2", unit: "דובדבן", rank: "סרן", name: "עידן לוי", personalNumber: "7245831", email: "idan.levi@example.mil" },
      { id: "uo-3", unit: "אגוז", rank: "רס״ר", name: "מאיה ברק", personalNumber: "7356712", email: "maya.barak@example.mil" },
      { id: "uo-4", unit: "יחידת מטה", rank: "סגן", name: "טל אשכנזי", personalNumber: "7578934", email: "tal.ash@example.mil" },
    ],
    brigadeStaff: [
      { id: "bs-1", rank: "סגן", name: "נועה שגיא", personalNumber: "7467123", email: "noa.sagi@example.mil",
        catalogAccess: "manager", ticketAccess: "manager" },
    ],
    unitPeople: {
      "מגלן": [
        { id: "p-1", rank: "רס״ל", name: "דניאל אור", personalNumber: "7689012", email: "daniel.or@example.mil",
          catalogAccess: "editor", ticketAccess: "requester" },
        { id: "p-2", rank: "טוראי", name: "אביב שמש", personalNumber: "7790123", email: "aviv.shemesh@example.mil",
          catalogAccess: "read", ticketAccess: "none" },
      ],
      "דובדבן": [
        { id: "p-3", rank: "טוראי", name: "יובל נחמן", personalNumber: "7891234", email: "yuval.nachman@example.mil",
          catalogAccess: "read", ticketAccess: "requester" },
      ],
      "אגוז": [],
      "יחידת מטה": [],
    },
  },

  dashboard: {
    ticketsByUnit: [
      { unit: "מגלן", approved: 22, pending: 4, rejected: 3 },
      { unit: "דובדבן", approved: 19, pending: 5, rejected: 2 },
      { unit: "אגוז", approved: 15, pending: 3, rejected: 3 },
      { unit: "יחידת מטה", approved: 5, pending: 2, rejected: 1 },
    ],
    priorityByUnit: {
      "מגלן": [{ key: "red", label: "דחוף", value: 4 }, { key: "yellow", label: "בינוני", value: 8 }, { key: "green", label: "שגרתי", value: 10 }],
      "דובדבן": [{ key: "red", label: "דחוף", value: 3 }, { key: "yellow", label: "בינוני", value: 7 }, { key: "green", label: "שגרתי", value: 9 }],
      "אגוז": [{ key: "red", label: "דחוף", value: 3 }, { key: "yellow", label: "בינוני", value: 6 }, { key: "green", label: "שגרתי", value: 6 }],
      "יחידת מטה": [{ key: "red", label: "דחוף", value: 1 }, { key: "yellow", label: "בינוני", value: 3 }, { key: "green", label: "שגרתי", value: 1 }],
    },
    trendDays: TREND_DAYS,
    trendByUnit: {
      "מגלן": [4, 6, 3, 8, 5, 9, 6, 10, 5, 7, 11, 6, 9, 12],
      "דובדבן": [3, 5, 2, 6, 4, 7, 5, 8, 4, 6, 9, 5, 7, 10],
      "אגוז": [2, 3, 2, 4, 3, 5, 3, 5, 3, 4, 6, 4, 5, 6],
      "יחידת מטה": [1, 1, 1, 2, 1, 2, 1, 2, 1, 1, 3, 1, 2, 3],
    },
    activityLog: [
      { date: "17/8", time: "20:41", actor: "עידן לוי", unit: "דובדבן", title: "תקלה בגנרטור שדה", action: "אישר את REQ-1042", tone: "green" },
      { date: "17/8", time: "20:22", actor: "דניאל אור", unit: "מגלן", title: "חוסר במשקפות ראיית לילה", action: "פתח דרישה חדשה REQ-1058", tone: "yellow" },
      { date: "17/8", time: "19:58", actor: "מאיה ברק", unit: "אגוז", title: "סוללות שדה — מלאי נמוך", action: "דחתה את REQ-1037 — נכנסה לתיקיית סורבו (30 יום)", tone: "red" },
      { date: "17/8", time: "19:40", actor: "נועה שגיא", unit: "יחידת מטה", title: "אלונקת חילוץ פגומה", action: "עדכנה תיעדוף ל-REQ-1041", tone: "yellow" },
      { date: "16/8", time: "18:15", actor: "רוני כהן", unit: "מגלן", title: "משקפת ראיית לילה — NVG-04", action: "הוסיף פריט חדש לקטלוג", tone: "green" },
    ],
  },
};

/* ================================================================== */
/* חטיבת גולני — חטיבה שנייה פעילה, להוכחת בידוד הנתונים בין חטיבות.    */
/* ================================================================== */

const GOLANI = {
  units: ["גדוד 12", "גדוד 13", "גדוד 51", "מטה חטיבה"],

  catalog: [
    { id: "OPT-01", name: 'כוונת יום טקטית', category: "ראייה", qty: 74, icon: "nvg", unit: "גדוד 12",
      desc: 'כוונת יום מוגברת עם רתיכת רד-דוט, מותאמת לנשק אישי סטנדרטי.',
      origin: "industry", originCompany: "אלביט מערכות בע״מ",
      responsibleRank: "סרן", responsibleName: "עומר לביא", responsiblePersonalNumber: "6811023", responsiblePhone: "050-9871234",
      addedAt: "10/02/2026", addedBy: "סרן עומר לביא",
      updatedAt: "12/08/2026 10:00", updatedBy: "סרן עומר לביא", media: [] },
    { id: "IFAK-03", name: 'ערכת עזרה ראשונה אישית', category: "רפואה", qty: 12, icon: "medical", unit: "מטה חטיבה",
      desc: 'ערכת IFAK אישית להצמדה לאפוד, כוללת חוסם עורקים ותחבושת לחץ.',
      origin: "matal", originContact: { rank: "רס״ן", name: "תמר גולן", phone: "050-7778899" },
      responsibleRank: "רס״ן", responsibleName: "שירה נוי", responsiblePersonalNumber: "6923781", responsiblePhone: "052-8765432",
      addedAt: "22/01/2026", addedBy: "רס״ן שירה נוי",
      updatedAt: "16/08/2026 08:30", updatedBy: "רס״ן שירה נוי",
      media: [
        { type: "image", url: demoPhoto3, caption: "הערכה סגורה, מוצמדת לאפוד" },
        { type: "image", url: demoPhoto2, caption: "תכולת הערכה פרוסה" },
      ] },
    { id: "CER-06", name: 'אפוד קרמי דגם 4', category: "ציוד אישי", qty: 58, icon: "vest", unit: "גדוד 13",
      desc: 'אפוד מגן קרמי ברמת הגנה IV, כולל לוחות חזה וגב.',
      origin: "industry", originCompany: "מגן-שריון תעשיות בע״מ",
      responsibleRank: "סגן", responsibleName: "בר כספי", responsiblePersonalNumber: "7011234", responsiblePhone: "053-1122334",
      addedAt: "05/03/2026", addedBy: "סגן בר כספי",
      updatedAt: "09/08/2026 13:15", updatedBy: "סגן בר כספי", media: [] },
    { id: "RDO-04", name: 'רדיו טקטי כף יד', category: "תקשורת", qty: 33, icon: "radio", unit: "מטה חטיבה",
      desc: 'מכשיר קשר כף יד להצטיידות פלוגתית, טווח קצר-בינוני.',
      origin: "in_house", developmentLead: { rank: "רס״ן", name: "שירה נוי" }, productFiles: ["תיק_פיתוח_רדיו_RDO04.pdf"],
      responsibleRank: "רס״ן", responsibleName: "שירה נוי", responsiblePersonalNumber: "6923781", responsiblePhone: "052-8765432",
      addedAt: "18/01/2026", addedBy: "רס״ן שירה נוי",
      updatedAt: "14/08/2026 09:45", updatedBy: "רס״ן שירה נוי", media: [] },
    { id: "BAT-02", name: 'סוללת ליתיום נטענת', category: "אנרגיה", qty: 4, icon: "battery", unit: "גדוד 51",
      desc: 'סוללה נטענת לציוד קשר וראייה, קיבולת גבוהה.',
      origin: "industry", originCompany: "פאואר-טק תעשיות אנרגיה בע״מ",
      responsibleRank: "רס״ר", responsibleName: "גיא מזרחי", responsiblePersonalNumber: "6754321", responsiblePhone: "054-2233445",
      addedAt: "02/04/2026", addedBy: "רס״ר גיא מזרחי",
      updatedAt: "17/08/2026 07:50", updatedBy: "רס״ר גיא מזרחי", media: [] },
    { id: "NAV-02", name: 'מצפן צבאי', category: "ניווט", qty: 40, icon: "nav", unit: "גדוד 13",
      desc: 'מצפן לנסלר סטנדרטי, עמיד לזעזועים ולתנאי שטח.',
      origin: "matal", originContact: { rank: "סא״ל", name: "אורי פלד", phone: "052-4445566" },
      responsibleRank: "סגן", responsibleName: "בר כספי", responsiblePersonalNumber: "7011234", responsiblePhone: "053-1122334",
      addedAt: "05/03/2026", addedBy: "סגן בר כספי",
      updatedAt: "01/07/2026 12:00", updatedBy: "סגן בר כספי", media: [] },
    { id: "LGT-02", name: 'פנס ראש טקטי', category: "תאורה", qty: 61, icon: "light", unit: "מטה חטיבה",
      desc: 'פנס ראש עם תאורה לבנה ואדומה, רצועה מתכווננת לקסדה.',
      origin: "industry", originCompany: "לומינה אופטיקה בע״מ",
      responsibleRank: "רס״ן", responsibleName: "שירה נוי", responsiblePersonalNumber: "6923781", responsiblePhone: "052-8765432",
      addedAt: "22/01/2026", addedBy: "רס״ן שירה נוי",
      updatedAt: "20/06/2026 16:20", updatedBy: "רס״ן שירה נוי", media: [] },
  ],

  tickets: [
    { id: "REQ-2101", title: 'חוסר בכוונות יום', desc: 'נדרשות 6 כוונות נוספות לקראת מסע פלוגתי.', unit: "גדוד 12",
      category: "ראייה", collaborators: [], raisedByUnitOfficer: false,
      type: "equip", linkedProductId: "OPT-01",
      damatz: "damatz_opt_2101.pdf", extras: [], status: "pending", priority: null,
      requestedBy: "רב״ט עידו שני", createdAt: "היום, 07:30", submittedAt: "19/08/2026 07:30", decidedAt: null, decidedBy: null, prioritizedAt: null,
      dueDate: "", photoUploaded: false,
      progressStatus: null, progressNote: "", assignee: null, progressLog: [] },
    { id: "REQ-2098", title: 'מלאי סוללות קריטי', desc: 'מלאי הסוללות ירד משמעותית, נדרשת הזמנה דחופה.', unit: "מטה חטיבה",
      category: "אנרגיה", collaborators: [{ rank: "רס״ן", name: "שירה נוי" }], raisedByUnitOfficer: false,
      type: "procurement", estimatedPrice: 15000, purchaseLink: "https://supplier-portal.example.mil/orders/bat-02",
      damatz: "damatz_bat_2098.pdf", extras: ["דוח_מלאי.pdf"], status: "approved", priority: "red",
      requestedBy: "רס״ר גיא מזרחי", createdAt: "אתמול, 16:10", submittedAt: "18/08/2026 16:10", decidedAt: "18/08/2026 18:00", decidedBy: "רס״ן שירה נוי", prioritizedAt: "18/08/2026 18:15",
      dueDate: "22/08/2026", photoUploaded: false,
      progressStatus: "in_progress", progressNote: "הזמנה נשלחה לספק, ממתינים לאישור תקציבי לפני משלוח.",
      assignee: { personalNumber: "6754321", rank: "רס״ר", name: "גיא מזרחי" },
      progressLog: [
        { id: "lg-8", author: "רס״ן שירה נוי", authorRole: "brigade_officer", stamp: "18/08/2026 18:20", status: "waiting", statusChanged: true, text: "מקצה את רס״ר גיא מזרחי לטיפול — נא לפתוח מול הספק בדחיפות." },
        { id: "lg-9", author: "רס״ר גיא מזרחי", authorRole: "assignee", stamp: "19/08/2026 08:00", status: "in_progress", statusChanged: true, text: "הזמנה נשלחה לספק, ממתינים לאישור תקציבי לפני משלוח." },
      ] },
    { id: "REQ-2090", title: 'בקשת אפודים נוספים', desc: 'תגבור כוח אדם בגדוד, נדרשים 8 אפודים.', unit: "גדוד 13",
      category: "ציוד אישי", collaborators: [], raisedByUnitOfficer: false,
      type: "equip", linkedProductId: "CER-06",
      damatz: "damatz_vest_2090.pdf", extras: [], status: "approved", priority: "yellow",
      requestedBy: "סגן בר כספי", createdAt: "לפני יומיים", submittedAt: "17/08/2026 10:40", decidedAt: "17/08/2026 14:00", decidedBy: "רס״ן שירה נוי", prioritizedAt: "17/08/2026 14:45",
      dueDate: "27/08/2026", photoUploaded: false,
      progressStatus: "waiting", progressNote: "ממתין להקצאת גורם אחראי.", assignee: null, progressLog: [] },
    { id: "REQ-2081", title: 'רדיו תקול', desc: 'מכשיר קשר אינו נטען, דורש בדיקה או החלפה.', unit: "גדוד 51",
      category: "תקשורת", collaborators: [], raisedByUnitOfficer: false,
      type: "repair", linkedProductId: "RDO-04",
      damatz: "damatz_rdo_2081.pdf", extras: [], status: "rejected", priority: null,
      requestedBy: "טוראי נדב אור", createdAt: "לפני 4 ימים", submittedAt: "15/08/2026 09:20", decidedAt: "15/08/2026 15:00", decidedBy: "רס״ן שירה נוי", prioritizedAt: null,
      dueDate: "", photoUploaded: false, daysLeft: 29, rejectionReason: "טרם בוצעה בדיקה בסיסית של הכבל/שקע לפני הגשת הדרישה — נא לבצע בדיקה ראשונית מול קצין התקשורת ולהגיש שוב אם התקלה נמשכת.",
      progressStatus: null, progressNote: "", assignee: null, progressLog: [] },
    { id: "REQ-2065", title: 'רדיו טקטי — כשל טעינה חוזר', desc: 'שקע הטעינה רופף, הבעיה חוזרת על עצמה במכשירים נוספים — פתחתי ישירות כדי לזרז טיפול לפני שהתקלה תתפשט.', unit: "מטה חטיבה",
      category: "תקשורת", collaborators: [], raisedByUnitOfficer: true,
      type: "repair", linkedProductId: "RDO-04",
      damatz: "damatz_rdo_2065.pdf", extras: [], status: "approved", priority: "yellow",
      requestedBy: "רס״ן שירה נוי", createdAt: "לפני 3 שבועות", submittedAt: "29/07/2026 11:00", decidedAt: "29/07/2026 11:00", decidedBy: "רס״ן שירה נוי", prioritizedAt: "29/07/2026 14:00",
      dueDate: "05/08/2026", photoUploaded: false,
      progressStatus: "done", progressNote: "כלל המכשירים הפגומים הוחלפו במלאי טרי.",
      assignee: { personalNumber: "6923781", rank: "רס״ן", name: "שירה נוי" },
      progressLog: [
        { id: "lg-10", author: "רס״ן שירה נוי", authorRole: "brigade_officer", stamp: "29/07/2026 14:05", status: "in_progress", statusChanged: true, text: "מטפלת בעצמי מול היצרן — פנס בעיה בייצור אצווה." },
        { id: "lg-11", author: "רס״ן שירה נוי", authorRole: "assignee", stamp: "03/08/2026 10:00", status: "done", statusChanged: true, text: "כלל המכשירים הפגומים הוחלפו במלאי טרי." },
      ] },
  ],

  roster: {
    unitOfficers: [
      { id: "guo-1", unit: "גדוד 12", rank: "סרן", name: "עומר לביא", personalNumber: "6811023", email: "omer.lavi@example.mil" },
      { id: "guo-2", unit: "גדוד 13", rank: "סגן", name: "בר כספי", personalNumber: "7011234", email: "bar.caspi@example.mil" },
      { id: "guo-3", unit: "גדוד 51", rank: "רס״ר", name: "גיא מזרחי", personalNumber: "6754321", email: "guy.mizrahi@example.mil" },
      { id: "guo-4", unit: "מטה חטיבה", rank: "רס״ן", name: "שירה נוי", personalNumber: "6923781", email: "shira.noy@example.mil" },
    ],
    brigadeStaff: [
      { id: "gbs-1", rank: "אל״ם", name: "דורון אשל", personalNumber: "6812345", email: "doron.eshel@example.mil",
        catalogAccess: "manager", ticketAccess: "manager" },
    ],
    unitPeople: {
      "גדוד 12": [
        { id: "gp-1", rank: "רב״ט", name: "עידו שני", personalNumber: "7112233", email: "ido.shani@example.mil",
          catalogAccess: "read", ticketAccess: "requester" },
      ],
      "גדוד 13": [],
      "גדוד 51": [
        { id: "gp-2", rank: "טוראי", name: "נדב אור", personalNumber: "7223344", email: "nadav.or@example.mil",
          catalogAccess: "read", ticketAccess: "requester" },
      ],
      "מטה חטיבה": [],
    },
  },

  dashboard: {
    ticketsByUnit: [
      { unit: "גדוד 12", approved: 14, pending: 3, rejected: 1 },
      { unit: "גדוד 13", approved: 11, pending: 2, rejected: 2 },
      { unit: "גדוד 51", approved: 9, pending: 1, rejected: 3 },
      { unit: "מטה חטיבה", approved: 6, pending: 1, rejected: 0 },
    ],
    priorityByUnit: {
      "גדוד 12": [{ key: "red", label: "דחוף", value: 2 }, { key: "yellow", label: "בינוני", value: 5 }, { key: "green", label: "שגרתי", value: 7 }],
      "גדוד 13": [{ key: "red", label: "דחוף", value: 1 }, { key: "yellow", label: "בינוני", value: 4 }, { key: "green", label: "שגרתי", value: 6 }],
      "גדוד 51": [{ key: "red", label: "דחוף", value: 2 }, { key: "yellow", label: "בינוני", value: 3 }, { key: "green", label: "שגרתי", value: 4 }],
      "מטה חטיבה": [{ key: "red", label: "דחוף", value: 1 }, { key: "yellow", label: "בינוני", value: 2 }, { key: "green", label: "שגרתי", value: 3 }],
    },
    trendDays: TREND_DAYS,
    trendByUnit: {
      "גדוד 12": [2, 4, 3, 5, 3, 6, 4, 7, 4, 5, 6, 4, 6, 8],
      "גדוד 13": [1, 3, 2, 4, 2, 5, 3, 5, 3, 4, 5, 3, 4, 6],
      "גדוד 51": [2, 2, 1, 3, 2, 4, 2, 4, 2, 3, 4, 2, 3, 5],
      "מטה חטיבה": [1, 1, 1, 2, 1, 2, 1, 2, 1, 2, 2, 1, 2, 3],
    },
    activityLog: [
      { date: "18/8", time: "18:00", actor: "שירה נוי", unit: "מטה חטיבה", title: "מלאי סוללות קריטי", action: "אישרה את REQ-2098", tone: "green" },
      { date: "18/8", time: "16:10", actor: "גיא מזרחי", unit: "מטה חטיבה", title: "מלאי סוללות קריטי", action: "פתח דרישה דחופה REQ-2098", tone: "red" },
      { date: "17/8", time: "14:00", actor: "שירה נוי", unit: "גדוד 13", title: "בקשת אפודים נוספים", action: "אישרה את REQ-2090", tone: "green" },
      { date: "15/8", time: "15:00", actor: "שירה נוי", unit: "גדוד 51", title: "רדיו תקול", action: "דחתה את REQ-2081", tone: "yellow" },
    ],
  },
};

/* ================================================================== */
/* חטיבה 7 — נוצרה על ידי מנהל מערכת, עדיין ממתינה שהחטיבה עצמה תשלים   */
/* את אשף ההתקנה. אין לה עדיין שום נתון תפעולי — וזה בכוונה.            */
/* ================================================================== */

const EMPTY_BRIGADE = {
  units: [],
  catalog: [],
  tickets: [],
  roster: { unitOfficers: [], brigadeStaff: [], unitPeople: {} },
  dashboard: {
    ticketsByUnit: [], priorityByUnit: {}, trendDays: TREND_DAYS, trendByUnit: {}, activityLog: [],
  },
};

const BRIGADE_DATASETS = {
  "brg-commando": COMMANDO,
  "brg-golani": GOLANI,
  "brg-seven": EMPTY_BRIGADE,
};

function dataset(brigadeId) {
  return BRIGADE_DATASETS[brigadeId] || EMPTY_BRIGADE;
}

export async function fetchBrigadeUnits(brigadeId) {
  return resolve(dataset(brigadeId).units);
}
export async function fetchBrigadeCatalog(brigadeId) {
  return resolve(dataset(brigadeId).catalog);
}
export async function fetchBrigadeTickets(brigadeId) {
  return resolve(dataset(brigadeId).tickets);
}
export async function fetchBrigadeRoster(brigadeId) {
  return resolve(dataset(brigadeId).roster);
}
export async function fetchBrigadeDashboard(brigadeId) {
  return resolve(dataset(brigadeId).dashboard);
}

/* ================================================================== */
/* Write-back from the setup wizard. Units/roster are the only pieces   */
/* the wizard collects, so that's all this touches — catalog/tickets/   */
/* dashboard stay whatever they already were (or start empty for a      */
/* brand-new brigade). Never mutates EMPTY_BRIGADE directly — it's a    */
/* shared fallback object reused by every not-yet-provisioned brigade,  */
/* so a first-time save clones it into a real per-brigade entry first.  */
/* ================================================================== */
export async function saveBrigadeSetup(brigadeId, { units }) {
  const existing = BRIGADE_DATASETS[brigadeId];
  const base = existing && existing !== EMPTY_BRIGADE ? existing : {
    units: [], catalog: [], tickets: [],
    roster: { unitOfficers: [], brigadeStaff: [], unitPeople: {} },
    dashboard: { ticketsByUnit: [], priorityByUnit: {}, trendDays: TREND_DAYS, trendByUnit: {}, activityLog: [] },
  };

  const unitNames = units.map((u) => u.name);
  const prevOfficers = base.roster.unitOfficers;
  const unitOfficers = units
    .filter((u) => u.officerName.trim())
    .map((u) => {
      const prev = prevOfficers.find((o) => o.unit === u.name);
      return {
        id: prev?.id || crypto.randomUUID(),
        unit: u.name,
        rank: prev?.rank || "",
        name: u.officerName,
        personalNumber: u.officerEmail || prev?.personalNumber || "",
        email: prev?.email || "",
      };
    });
  const unitPeople = {};
  unitNames.forEach((name) => { unitPeople[name] = base.roster.unitPeople[name] || []; });

  BRIGADE_DATASETS[brigadeId] = {
    ...base,
    units: unitNames,
    roster: { ...base.roster, unitOfficers, unitPeople },
  };
  return resolve(true);
}
