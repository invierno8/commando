import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  X, Camera, FileText, Paperclip, Image as ImageIcon, Wrench, PackagePlus, Lightbulb, ShoppingCart,
  ExternalLink, ArrowUpRight, ShieldAlert, UserCog, MessageSquare, ChevronDown, ChevronUp, RefreshCw as RefreshCwIcon, Archive,
  AlertTriangle, Save,
} from "lucide-react";
import UnitEmblem from "../components/UnitEmblem.jsx";
import CountUp from "../components/CountUp.jsx";
import Loading from "../components/Loading.jsx";
import SearchBar from "../components/SearchBar.jsx";
import FilterSelect from "../components/FilterSelect.jsx";
import Pagination from "../components/Pagination.jsx";
import { matchesSearch } from "../search.js";
import { parseStamp } from "../analytics.js";
import { StatusPill, PriorityDot, TICKET_TYPES, TICKET_TYPE_LABELS, PROGRESS_STATUS, PROGRESS_STATUS_LABELS, ProgressStatusPill } from "../opsData.jsx";
import {
  fetchBrigadeTickets, fetchBrigadeUnits, fetchBrigadeCatalog, fetchBrigadeRoster,
  createTicket, updateTicket,
} from "../api-client/brigadeStore.js";
import { pushNotification, NOTIFICATION_TYPES } from "../api-client/notificationStore.js";
import { fetchDraft, saveDraft, clearDraft } from "../api-client/draftStore.js";
import { STRUCTURAL_ROLES } from "../roles.js";
import { requiresTeamLeadApproval } from "../api-client/teamStore.js";

const TICKET_TYPE_ICONS = { idea: Lightbulb, procurement: ShoppingCart, repair: Wrench, equip: PackagePlus };

const PRIORITY_OPTIONS = [
  { value: "red", label: "דחוף" },
  { value: "yellow", label: "בינוני" },
  { value: "green", label: "שגרתי" },
];
const PRIORITY_LABEL = { red: "דחוף", yellow: "בינוני", green: "שגרתי" };

const STATUS_FILTER_OPTIONS = [
  { value: "approved", label: "אושרו" },
  { value: "rejected", label: "סורבו" },
  { value: "archived", label: "ארכיון" },
];
const SORT_OPTIONS = [
  { value: "submitted_desc", label: "הכי חדש שהוגש" },
  { value: "priority", label: "לפי דחיפות" },
];

// "תיקייה" בוטלה במכוון — במקום שתי לשוניות נפרדות לכל סטטוס (אושרו/סורבו)
// יש עכשיו לשונית אחת "כל הדרישות" עם פילטר סטטוס + מיון, כי קצין אמל״ח לא
// צריך שתי מגירות קבועות; הוא צריך תצוגה אחת דינמית שהוא שולט בה.
const ROLE_TABS = {
  [STRUCTURAL_ROLES.MEMBER]: [["myTickets", "הדרישות שלי"]],
  [STRUCTURAL_ROLES.UNIT_OFFICER]: [
    ["queue", "תור אישורים"],
    ["list", "כל הדרישות"],
  ],
  [STRUCTURAL_ROLES.BRIGADE_OFFICER]: [
    ["dashboard", "דשבורד חטיבתי"],
    ["list", "כל הדרישות"],
  ],
  [STRUCTURAL_ROLES.SYSTEM_ADMIN]: [
    ["dashboard", "דשבורד חטיבתי"],
    ["queue", "תור אישורים"],
    ["list", "כל הדרישות"],
  ],
};

const ROLE_HEAD = {
  [STRUCTURAL_ROLES.MEMBER]: { title: "דרישות וטיקטים", sub: "מעקב אחר הדרישות שפתחת מול הקטלוג" },
  [STRUCTURAL_ROLES.UNIT_OFFICER]: { title: "דרישות וטיקטים — קצין אמל״ח יחידה", sub: "אישור דרישות שנפתחו ביחידה ומעקב אחר החלטות" },
  [STRUCTURAL_ROLES.BRIGADE_OFFICER]: { title: "דרישות וטיקטים — קצין אמל״ח חטיבה", sub: "תיעדוף דרישות שאושרו ביחידות החטיבה" },
  [STRUCTURAL_ROLES.SYSTEM_ADMIN]: { title: "דרישות וטיקטים — תצוגת מנהל מערכת", sub: "תצוגה מלאה על כלל הדרישות במערכת" },
};

export default function Tickets({ role, persona, brigadeId, officerUnit, userId, effectiveMemberId, ledTeam, unitLogos, categories, crossNav, clearCrossNav, viewCatalogItem }) {
  const isTeamLead = role === STRUCTURAL_ROLES.MEMBER && !!ledTeam;
  const tabs = useMemo(() => {
    const base = ROLE_TABS[role] || ROLE_TABS[STRUCTURAL_ROLES.MEMBER];
    return isTeamLead ? [...base, ["teamGate", "אישורי ראש צוות"]] : base;
  }, [role, isTeamLead]);
  const [tab, setTab] = useState(tabs[0][0]);
  const [myGateTeam, setMyGateTeam] = useState(null);
  const [tickets, setTickets] = useState(null);
  const [units, setUnits] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [roster, setRoster] = useState(null);
  const [detailTicket, setDetailTicket] = useState(null);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [ticketDraft, setTicketDraft] = useState(null);
  const [toast, setToast] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [query, setQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [unitFilter, setUnitFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("approved");
  const [sortBy, setSortBy] = useState("submitted_desc");

  useEffect(() => {
    setTab(tabs[0][0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  useEffect(() => {
    let cancelled = false;
    setTickets(null);
    setQuery("");
    setPriorityFilter("all");
    setUnitFilter("all");
    setStatusFilter("approved");
    setSortBy("submitted_desc");
    Promise.all([fetchBrigadeTickets(brigadeId), fetchBrigadeUnits(brigadeId), fetchBrigadeCatalog(brigadeId), fetchBrigadeRoster(brigadeId)]).then(([t, u, cat, r]) => {
      if (cancelled) return;
      setTickets(t);
      setUnits(u);
      setCatalog(cat);
      setRoster(r);
      setLastUpdated(new Date());
    });
    return () => { cancelled = true; };
  }, [brigadeId]);

  // גשר ניווט צולב: הגעה מדרישה שנפתחה על פריט קטלוג ספציפי ("דיווח תקלה" /
  // "בקשת הצטיידות" בתעודת הזהות) פותחת ישירות את טופס הדרישה, מוכן וממוקד;
  // הגעה מלחיצה על דרישה מקושרת בתעודת זהות פותחת ישירות את פרטי הדרישה.
  useEffect(() => {
    if (!crossNav || tickets === null) return;
    if (crossNav.kind === "ticketDraft") {
      setTicketDraft(crossNav.draft);
      setShowTicketModal(true);
      clearCrossNav();
    } else if (crossNav.kind === "ticketDetail") {
      const found = tickets.find((t) => t.id === crossNav.ticketId);
      if (found) setDetailTicket(found);
      clearCrossNav();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crossNav, tickets]);

  // בדמו הזה אין עדיין זהות משתמש אמיתית — קצין אמל״ח יחידה תמיד "מחזיק"
  // ביחידה הראשונה של החטיבה, אותה מוסכמה שכבר קיימת ב-Catalog.jsx וב-DevDashboard.jsx.
  const isUnitOfficer = role === STRUCTURAL_ROLES.UNIT_OFFICER;
  const isBrigadeOfficerPlus = role === STRUCTURAL_ROLES.BRIGADE_OFFICER || role === STRUCTURAL_ROLES.SYSTEM_ADMIN;
  const myUnit = isUnitOfficer ? (officerUnit || units[0]) : persona?.unit;
  const currentActorLabel = isBrigadeOfficerPlus
    ? "קצין אמל״ח חטיבה (הדגמה)"
    : isUnitOfficer
    ? "קצין אמל״ח יחידה (הדגמה)"
    : persona
    ? `${persona.rank} ${persona.name}`
    : "משתמש נוכחי (הדגמה)";
  // מזהה שמור לטיוטות — חבר יחידה מזוהה לפי המספר האישי של הפרסונה המדומה
  // שלו (יש לו כזה תמיד), תפקידי קצונה לפי userId (הזיהוי שכבר קיים לצורך
  // פריסת הדשבורד האישית) — אותו רעיון בדיוק, מוחל גם על טיוטות.
  const draftIdentity = role === STRUCTURAL_ROLES.MEMBER ? persona?.personalNumber : userId;

  // שער אישור ראש צוות — נבדק מראש (לא בזמן ההגשה עצמה, כדי ש-submitTicket
  // יישאר סינכרוני) עבור חבר יחידה רגיל בלבד: אם השייכות שלו לתת-צוות כלשהו
  // מסומנת requireLeadApproval, הדרישה החדשה שלו "נתקעת" אצל ראש הצוות לפני
  // שהיא בכלל נכנסת לתור האישורים של קצין אמל״ח היחידה (ראו pendingForUnit).
  useEffect(() => {
    let cancelled = false;
    if (role !== STRUCTURAL_ROLES.MEMBER) { setMyGateTeam(null); return; }
    const identity = { personalNumber: effectiveMemberId || persona?.personalNumber, fullName: persona ? `${persona.rank} ${persona.name}` : null };
    requiresTeamLeadApproval(brigadeId, identity).then((t) => { if (!cancelled) setMyGateTeam(t); });
    return () => { cancelled = true; };
  }, [brigadeId, role, effectiveMemberId, persona]);

  // מועמדים לתפקיד "גורם אחראי" — כל מי שמופיע במרשם החטיבה (קציני יחידה,
  // סגל חטיבתי, אנשי יחידות), כדי שקצין אמל״ח חטיבה יוכל לבחור מרשימה ולא
  // רק להקליד מספר אישי בעיוור.
  const rosterCandidates = useMemo(() => {
    if (!roster) return [];
    const people = [
      ...roster.unitOfficers,
      ...roster.brigadeStaff,
      ...Object.values(roster.unitPeople || {}).flat(),
    ];
    return people.map((p) => ({ personalNumber: p.personalNumber, rank: p.rank, name: p.name }));
  }, [roster]);

  function nowStamp() {
    const d = new Date();
    return d.toLocaleDateString("he-IL") + " " + d.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
  }

  function flash(msg) {
    setToast(msg);
    window.clearTimeout(flash._t);
    flash._t = window.setTimeout(() => setToast(null), 2600);
  }

  // כל אירוע רלוונטי בחיי הדרישה נכתב פעם אחת לפיד ההתראות; ההתראה עצמה
  // אישית לגמרי — App.jsx (הפעמון) מחליט מי בדיוק רואה אותה: כותב/ת
  // הדרישה, השותפים שצורפו אליה (collaborators — אם משוייכת לכמה אנשים,
  // כולם מקבלים), וקצין אמל״ח היחידה שלה. זו לא "תיבה משותפת לפי תפקיד";
  // כל אחד רואה רק את מה שרלוונטי אליו אישית (ראו isNotificationRelevant).
  function notify(t, type, message) {
    pushNotification(brigadeId, {
      kind: "ticket", ticketId: t.id, ticketTitle: t.title, unit: t.unit, requestedBy: t.requestedBy,
      collaborators: t.collaborators || [], type, message,
    });
  }

  async function submitTicket(data) {
    const id = "REQ-" + Math.floor(1050 + Math.random() * 900);
    const stamp = nowStamp();
    // קצין אמל״ח יחידה יכול לפתוח דרישה גם הוא, לא רק חייל — ומכיוון שהוא
    // כבר בעל סמכות האישור על היחידה שלו, הדרישה שלו לא נכנסת לתור אישורים
    // (אישור עצמי היה מיותר, אותו עיקרון בדיוק כמו הצעת קטלוג של קצין).
    // raisedByUnitOfficer הוא מה שגורם לה להופיע מודגשת (מסגרת אדומה) אצל
    // קצין אמל״ח החטיבה — כדי שיידע שזו לא בקשה שגרתית של חייל.
    const t = {
      id, title: data.title, desc: data.desc, unit: myUnit || data.unit || units[0] || "",
      category: data.category, type: data.type || TICKET_TYPES.IDEA,
      estimatedPrice: data.estimatedPrice || null, purchaseLink: data.purchaseLink || "",
      linkedProductId: data.linkedProductId || null, linkedProductName: data.linkedProductName || null,
      damatz: data.damatz, extras: data.extras,
      status: isUnitOfficer ? "approved" : "pending", priority: null,
      requestedBy: currentActorLabel, raisedByUnitOfficer: isUnitOfficer,
      createdAt: "עכשיו", submittedAt: stamp,
      decidedAt: isUnitOfficer ? stamp : null, decidedBy: isUnitOfficer ? currentActorLabel : null, prioritizedAt: null,
      dueDate: "", photoUploaded: (data.extras || []).some((f) => /\.(jpg|jpeg|png)$/i.test(f)),
      collaborators: [], progressStatus: null, progressNote: "", assignee: null, progressLog: [], rejectionReason: null, archived: false,
      teamLeadGate: myGateTeam ? "pending" : null, gateTeamId: myGateTeam?.id || null,
    };
    await createTicket(brigadeId, t);
    setTickets((prev) => [t, ...prev]);
    setShowTicketModal(false);
    setTicketDraft(null);
    setLastUpdated(new Date());
    if (isUnitOfficer) {
      flash(`הדרישה ${id} נפתחה ואושרה — הועברה ישירות לקצין האמל״ח החטיבתי`);
      notify(t, NOTIFICATION_TYPES.APPROVED, `${currentActorLabel} פתח/ה ואישר/ה ישירות את "${t.title}" — הועברה לתיעדוף החטיבה`);
    } else if (myGateTeam) {
      flash(`הדרישה ${id} נפתחה — ממתינה לאישור ראש/ת ${myGateTeam.name} לפני שתעבור לקצין האמל״ח ביחידה`);
    } else {
      flash(`הדרישה ${id} נפתחה ונשלחה לקצין האמל״ח ביחידה`);
      notify(t, NOTIFICATION_TYPES.SUBMITTED, `${currentActorLabel} פתח/ה דרישה חדשה — "${t.title}" — הממתינה להחלטתך`);
    }
  }

  // הכרעת ראש צוות על דרישה שנתקעה בשער האישור שלו (myGateTeam) — אישור
  // משחרר אותה לתור הרגיל של קצין אמל״ח היחידה (ורק אז הוא מקבל עליה
  // התראה — לא בזמן ההגשה המקורית, כי עד עכשיו היא לא הייתה שלו לטפל בה).
  // סירוב נועל אותה ישירות כ"סורבה", עם נימוק, בדיוק כמו סירוב רגיל.
  async function decideTeamGate(id, decision, reason) {
    const target = tickets.find((t) => t.id === id);
    if (!target) return;
    const stamp = nowStamp();
    const updated =
      decision === "approved"
        ? { ...target, teamLeadGate: "approved" }
        : { ...target, teamLeadGate: "rejected", status: "rejected", decidedAt: stamp, decidedBy: `${ledTeam.leadRank} ${ledTeam.leadName} (ראש צוות)`, rejectionReason: reason, daysLeft: 30 };
    await updateTicket(brigadeId, id, updated);
    setTickets((prev) => prev.map((t) => (t.id === id ? updated : t)));
    setLastUpdated(new Date());
    if (decision === "approved") {
      flash(`${id} אושר/ה על ידך והועבר/ה לתור קצין האמל״ח ביחידה`);
      notify(updated, NOTIFICATION_TYPES.SUBMITTED, `${updated.requestedBy} פתח/ה דרישה חדשה — "${updated.title}" — אושרה על ידי ראש/ת הצוות והממתינה להחלטתך`);
    } else {
      flash(`${id} סורב/ה על ידך`);
      notify(updated, NOTIFICATION_TYPES.REJECTED, `"${updated.title}" סורבה על ידי ראש/ת הצוות שלך: ${reason}`);
    }
  }

  // סירוב מחייב הסבר בטקסט חופשי (rejectionReason) — לא ניתן לסרב בלי לנמק,
  // כדי שכותב/ת הדרישה תדע מה לתקן אם תחליט לפתוח אותה מחדש (ראו reopenTicket).
  async function decide(id, decision, reason) {
    const target = tickets.find((t) => t.id === id);
    if (!target) return;
    const stamp = nowStamp();
    const updated = {
      ...target, status: decision, decidedAt: stamp, decidedBy: currentActorLabel,
      rejectionReason: decision === "rejected" ? reason : null,
      daysLeft: decision === "rejected" ? 30 : undefined,
    };
    await updateTicket(brigadeId, id, updated);
    setTickets((prev) => prev.map((t) => (t.id === id ? updated : t)));
    setLastUpdated(new Date());
    flash(decision === "approved" ? `${id} אושר והועבר לחטיבה` : `${id} סורב — יימחק בעוד 30 ימים`);
    notify(
      updated,
      decision === "approved" ? NOTIFICATION_TYPES.APPROVED : NOTIFICATION_TYPES.REJECTED,
      decision === "approved"
        ? `"${updated.title}" אושרה על ידי ${currentActorLabel} והועברה לתיעדוף החטיבה`
        : `"${updated.title}" סורבה על ידי ${currentActorLabel}: ${reason}`
    );
  }

  // סגירת דרישה שטופלה בפועל — לא נמחקת (בניגוד לדרישה שסורבה, שנעלמת אחרי
  // 30 יום), רק עוברת לארכיון קבוע ויוצאת מרשימת "כל הדרישות" הפעילה.
  async function closeTicket(id) {
    const target = tickets.find((t) => t.id === id);
    if (!target) return;
    const updated = { ...target, archived: true };
    await updateTicket(brigadeId, id, updated);
    setTickets((prev) => prev.map((t) => (t.id === id ? updated : t)));
    setLastUpdated(new Date());
    flash(`${id} נסגרה והועברה לארכיון הקבוע`);
    notify(updated, NOTIFICATION_TYPES.STATUS_CHANGED, `${currentActorLabel} סגר/ה את "${updated.title}" והעביר/ה אותה לארכיון`);
  }

  // פתיחה מחדש של דרישה שסורבה — מחזירה אותה לתור האישורים עם התיקונים
  // שנעשו, ומאפסת את סימוני הסירוב הקודמים כדי שההחלטה תיבחן מחדש מאפס.
  async function reopenTicket(id, edits) {
    const target = tickets.find((t) => t.id === id);
    if (!target) return;
    const updated = { ...target, ...edits, status: "pending", decidedAt: null, decidedBy: null, rejectionReason: null, daysLeft: undefined };
    await updateTicket(brigadeId, id, updated);
    setTickets((prev) => prev.map((t) => (t.id === id ? updated : t)));
    setLastUpdated(new Date());
    flash(`${id} נפתחה מחדש ונשלחה שוב לאישור קצין האמל״ח ביחידה`);
    notify(updated, NOTIFICATION_TYPES.SUBMITTED, `${currentActorLabel} פתח/ה מחדש את "${updated.title}" לאחר עדכון — ממתינה להחלטתך`);
  }

  async function setPriority(id, priority) {
    const target = tickets.find((t) => t.id === id);
    if (!target) return;
    const stamp = nowStamp();
    const updated = { ...target, priority, prioritizedAt: target.prioritizedAt || stamp };
    await updateTicket(brigadeId, id, updated);
    setTickets((prev) => prev.map((t) => (t.id === id ? updated : t)));
    setLastUpdated(new Date());
    notify(updated, NOTIFICATION_TYPES.PRIORITIZED, `${currentActorLabel} עידכן/ה את עדיפות "${updated.title}" ל${PRIORITY_LABEL[priority] || priority}`);
  }

  // דיבאונס לשדה תג״ב (input חופשי, onChange בכל הקשה) — עדכון ה-state
  // המקומי נשאר מיידי, אבל השמירה בפועל לשרת מתעכבת עד שההקלדה נעצרת.
  const dueDateTimers = useRef({});
  function setDueDate(id, dueDate) {
    setTickets((prev) => prev.map((t) => (t.id === id ? { ...t, dueDate } : t)));
    setLastUpdated(new Date());
    clearTimeout(dueDateTimers.current[id]);
    dueDateTimers.current[id] = setTimeout(() => updateTicket(brigadeId, id, { dueDate }), 500);
  }

  async function addCollaborator(id, collaborator) {
    const target = tickets.find((t) => t.id === id);
    if (!target) return;
    const collaborators = [...(target.collaborators || []), collaborator];
    await updateTicket(brigadeId, id, { collaborators });
    setTickets((prev) => prev.map((t) => (t.id === id ? { ...t, collaborators } : t)));
    setLastUpdated(new Date());
  }
  async function removeCollaborator(id, idx) {
    const target = tickets.find((t) => t.id === id);
    if (!target) return;
    const collaborators = target.collaborators.filter((_, i) => i !== idx);
    await updateTicket(brigadeId, id, { collaborators });
    setTickets((prev) => prev.map((t) => (t.id === id ? { ...t, collaborators } : t)));
    setLastUpdated(new Date());
  }

  // רק קצין אמל״ח חטיבה קובע/מחליף את הגורם האחראי — לא הגורם עצמו ולא
  // קצין אמל״ח היחידה (ראו permission gating ב-TicketDetailModal).
  async function setAssignee(id, assignee) {
    const target = tickets.find((t) => t.id === id);
    if (!target) return;
    const updated = { ...target, assignee };
    await updateTicket(brigadeId, id, { assignee });
    setTickets((prev) => prev.map((t) => (t.id === id ? updated : t)));
    setLastUpdated(new Date());
    flash(assignee ? `${assignee.rank ? assignee.rank + " " : ""}${assignee.name} הוקצה/תה כגורם אחראי` : "הגורם האחראי הוסר");
    if (assignee) {
      notify(updated, NOTIFICATION_TYPES.ASSIGNED, `${currentActorLabel} הקצה/תה את ${assignee.rank ? assignee.rank + " " : ""}${assignee.name} לטיפול ב״${updated.title}״`);
    }
  }

  // כל רשומת יומן נושאת גם את הסטטוס הנוכחי בזמן הכתיבה — changesStatus=true
  // (רק קצין אמל״ח חטיבה או הגורם האחראי) מעדכן בפועל את progressStatus/
  // progressNote של הדרישה; אחרת זו הערה בלבד שנצמדת לסטטוס הקיים, בלי
  // לשנות אותו — כך שקצין אמל״ח היחידה וכותב הדרישה יכולים להגיב לשרשור
  // מבלי שתהיה להם סמכות לקבוע את השלב בפועל.
  async function addProgressLog(id, { text, status, changesStatus, author, authorRole }) {
    const target = tickets.find((t) => t.id === id);
    if (!target) return;
    const entry = { id: "lg-" + Date.now(), author, authorRole, stamp: nowStamp(), status, statusChanged: changesStatus, text };
    const patch = { progressLog: [...(target.progressLog || []), entry] };
    if (changesStatus) {
      patch.progressStatus = status;
      patch.progressNote = text;
    }
    const updated = { ...target, ...patch };
    await updateTicket(brigadeId, id, patch);
    setTickets((prev) => prev.map((t) => (t.id === id ? updated : t)));
    setLastUpdated(new Date());
    flash(changesStatus ? `סטטוס הטיפול עודכן ל״${PROGRESS_STATUS_LABELS[status]}״` : "התגובה נוספה ליומן הטיפול");
    notify(
      updated,
      changesStatus ? NOTIFICATION_TYPES.STATUS_CHANGED : NOTIFICATION_TYPES.COMMENTED,
      changesStatus
        ? `${author} עידכן/ה את הסטטוס של "${updated.title}" ל${PROGRESS_STATUS_LABELS[status]}`
        : `${author} הגיב/ה על "${updated.title}"`
    );
  }

  const searchFiltered = useMemo(
    () =>
      (tickets || []).filter(
        (t) =>
          matchesSearch([t.id, t.title, t.desc, t.unit, t.damatz], query) &&
          (unitFilter === "all" || t.unit === unitFilter) &&
          (priorityFilter === "all" || t.priority === priorityFilter)
      ),
    [tickets, query, unitFilter, priorityFilter]
  );

  const pendingForUnit = useMemo(() => searchFiltered.filter((t) => t.status === "pending" && t.teamLeadGate !== "pending"), [searchFiltered]);
  const teamGateQueue = useMemo(
    () => (isTeamLead ? (tickets || []).filter((t) => t.teamLeadGate === "pending" && t.gateTeamId === ledTeam.id) : []),
    [tickets, isTeamLead, ledTeam]
  );
  const approvedFolder = useMemo(() => searchFiltered.filter((t) => t.status === "approved" && !t.archived), [searchFiltered]);
  // "כל הדרישות" — לשונית אחת דינמית במקום תיקיית-אושרו/תיקיית-סורבו קבועות,
  // עם פילטר סטטוס (ברירת מחדל: מה שאושר) ומיון (הכי חדש שהוגש / לפי דחיפות).
  const historyList = useMemo(() => {
    const base = searchFiltered.filter((t) =>
      statusFilter === "archived"
        ? t.archived
        : !t.archived && (statusFilter === "all" ? t.status !== "pending" : t.status === statusFilter)
    );
    const sorted = [...base];
    if (sortBy === "priority") {
      const order = { red: 0, yellow: 1, green: 2, null: 3 };
      sorted.sort((a, b) => (order[a.priority] ?? 3) - (order[b.priority] ?? 3));
    } else {
      sorted.sort((a, b) => (parseStamp(b.submittedAt)?.getTime() || 0) - (parseStamp(a.submittedAt)?.getTime() || 0));
    }
    return sorted;
  }, [searchFiltered, statusFilter, sortBy]);
  const myUnitTickets = useMemo(
    () => (persona ? searchFiltered.filter((t) => t.unit === persona.unit) : searchFiltered),
    [searchFiltered, persona]
  );
  const unitOptions = useMemo(() => units.map((u) => ({ value: u, label: u })), [units]);
  const head = ROLE_HEAD[role] || ROLE_HEAD[STRUCTURAL_ROLES.MEMBER];

  if (tickets === null) {
    return (
      <div dir="rtl" className="tickets-view">
        <style>{CSS}</style>
        <Loading />
      </div>
    );
  }

  return (
    <div dir="rtl" className="tickets-view" data-devblock="Tickets — main screen">
      <style>{CSS}</style>

      <div className="view-head-row" data-devblock="Tickets — header and description">
        <p className="view-sub">
          {role === STRUCTURAL_ROLES.MEMBER && persona
            ? `מציג רק את דרישות ${persona.unit} — היחידה שלך`
            : head.sub}
          {" · "}עדכון אחרון: {lastUpdated.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </p>
        {(role === STRUCTURAL_ROLES.MEMBER || isUnitOfficer) && (
          <button className="new-ticket-btn" onClick={() => setShowTicketModal(true)} data-devblock="Tickets — open new ticket button">
            + פתיחת דרישה חדשה
          </button>
        )}
      </div>

      {tabs.length > 1 && (
        <div className="pill-tabs" style={{ marginBottom: 20 }}>
          {tabs.map(([key, label]) => (
            <button key={key} className={"pill-tab" + (tab === key ? " active" : "")} onClick={() => setTab(key)}>
              {label}
            </button>
          ))}
        </div>
      )}

      <SearchBar value={query} onChange={setQuery} placeholder="חיפוש לפי מזהה, כותרת, תיאור או יחידה...">
        {tab !== "myTickets" && units.length > 1 && (
          <FilterSelect value={unitFilter} onChange={setUnitFilter} options={unitOptions} allLabel="כל היחידות" ariaLabel="סינון לפי יחידה" />
        )}
        {tab === "dashboard" && (
          <FilterSelect value={priorityFilter} onChange={setPriorityFilter} options={PRIORITY_OPTIONS} allLabel="כל העדיפויות" ariaLabel="סינון לפי עדיפות" />
        )}
        {tab === "list" && (
          <>
            <FilterSelect value={statusFilter} onChange={setStatusFilter} options={STATUS_FILTER_OPTIONS} allLabel="אושרו וסורבו" ariaLabel="סינון לפי סטטוס" />
            <select className="filter-select" value={sortBy} onChange={(e) => setSortBy(e.target.value)} aria-label="מיון">
              {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </>
        )}
      </SearchBar>

      {tab === "myTickets" && (
        <TicketListView
          title={persona ? `דרישות ${persona.unit}` : "הדרישות שנפתחו על ידך"}
          tickets={myUnitTickets}
          showUnit={false}
          onOpen={setDetailTicket}
          unitLogos={unitLogos}
        />
      )}
      {tab === "queue" && (
        <ApprovalQueueView tickets={pendingForUnit} onDecide={decide} onOpen={setDetailTicket} unitLogos={unitLogos} />
      )}
      {tab === "teamGate" && (
        <ApprovalQueueView tickets={teamGateQueue} onDecide={decideTeamGate} onOpen={setDetailTicket} unitLogos={unitLogos} title="אישורי ראש צוות" />
      )}
      {tab === "list" && (
        <TicketListView title="כל הדרישות" subtitle="דרישות שכבר הוכרעו — מסונן וממוין לפי הבחירה למעלה" tickets={historyList} showUnit onOpen={setDetailTicket} unitLogos={unitLogos} />
      )}
      {tab === "dashboard" && (
        <BrigadeDashboard tickets={approvedFolder} onPriority={setPriority} onOpen={setDetailTicket} unitLogos={unitLogos} />
      )}

      {detailTicket && (
        <TicketDetailModal
          ticket={tickets.find((t) => t.id === detailTicket.id) || detailTicket}
          onClose={() => setDetailTicket(null)}
          onSetDueDate={setDueDate}
          onAddCollaborator={addCollaborator}
          onRemoveCollaborator={removeCollaborator}
          unitLogos={unitLogos}
          catalog={catalog}
          onViewProduct={viewCatalogItem}
          role={role}
          persona={persona}
          currentActorLabel={currentActorLabel}
          rosterCandidates={rosterCandidates}
          onSetAssignee={setAssignee}
          onAddProgressLog={addProgressLog}
          onReopen={reopenTicket}
          onArchive={closeTicket}
        />
      )}
      {showTicketModal && (
        <DamatzBotModal
          defaultUnit={myUnit}
          onClose={() => { setShowTicketModal(false); setTicketDraft(null); }}
          onSubmit={submitTicket}
          categories={categories}
          catalog={catalog}
          initialDraft={ticketDraft}
          draftUserId={draftIdentity}
        />
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Ticket list / cards                                                 */
/* ------------------------------------------------------------------ */

/* שורה אחת משותפת לכל תצוגות הרשימה (תור אישורים, הרשימה המאוחדת, דשבורד   */
/* חטיבה) — במקום שלוש טבלאות נפרדות עם עמודות קבועות. שתי שורות תוכן:     */
/* השורה הראשונה נושאת רק את מה שקובע פעולה/זיהוי (סטטוס, עדיפות, מזהה,     */
/* כותרת, סטטוס טיפול, פעולה); השנייה נושאת הקשר משני קטן ועדין (יחידה,     */
/* פותח/ת, תאריך, גורם אחראי, קבצים). `hidePriority` נמנע מהצגת עדיפות      */
/* פעמיים כשה-footer עצמו כבר מציג/קובע אותה (בורר העדיפות בדשבורד חטיבה).  */
function TicketRow({ t, showUnit = true, footer, hidePriority, hideStatus, delay = 0, onOpen, unitLogos }) {
  return (
    <div
      className={"ticket-row ticket-row-clickable" + (t.raisedByUnitOfficer ? " officer-raised" : "")}
      style={{ animationDelay: `${delay}ms` }}
      onClick={() => onOpen && onOpen(t)}
      data-devblock={`Tickets — ticket: ${t.title || "untitled"} (${t.id})`}
    >
      <div className="ticket-row-line1">
        {!hideStatus && <StatusPill status={t.status} />}
        {t.teamLeadGate === "pending" && <span className="team-gate-tag">ממתין לראש צוות</span>}
        {!hidePriority && <PriorityDot p={t.priority} label />}
        <span className="ticket-id">{t.id}</span>
        <span className="ticket-row-title">
          {t.raisedByUnitOfficer && <ShieldAlert size={13} className="officer-raised-icon" title="נפתח על ידי קצין אמל״ח היחידה" />}
          {t.title}
        </span>
        {t.progressStatus && <ProgressStatusPill status={t.progressStatus} />}
        {footer && <span className="ticket-row-actions" onClick={(e) => e.stopPropagation()}>{footer}</span>}
      </div>
      <div className="ticket-row-line2">
        {showUnit && (
          <span className="ticket-unit-tag">
            <UnitEmblem name={t.unit} size={14} showRing={false} image={unitLogos?.[t.unit]} />
            {t.unit}
          </span>
        )}
        <span className="ticket-row-requester">{t.requestedBy}</span>
        <span className="dim">{t.createdAt}</span>
        {t.assignee && (
          <span className="ticket-row-assignee"><UserCog size={12} /> {t.assignee.rank ? `${t.assignee.rank} ` : ""}{t.assignee.name}</span>
        )}
        {t.photoUploaded && <Camera size={13} className="ticket-row-icon" />}
        {t.extras?.length > 0 && <Paperclip size={13} className="ticket-row-icon" />}
        {t.dueDate && <span className="ticket-due">תג״ב {t.dueDate}</span>}
        {t.status === "rejected" && <span className="ticket-expiry-inline">נמחק בעוד {t.daysLeft ?? 30} י׳</span>}
      </div>
    </div>
  );
}

function TicketLegend() {
  return (
    <div className="legend">
      <span><i className="prio-dot prio-red" /> דחוף</span>
      <span><i className="prio-dot prio-yellow" /> בינוני</span>
      <span><i className="prio-dot prio-green" /> שגרתי</span>
    </div>
  );
}

function TicketListView({ title, subtitle, tickets, showUnit, onOpen, unitLogos, footer, hidePriority, hideStatus }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  useEffect(() => { setPage(1); }, [pageSize, tickets]);
  const pageCount = Math.max(1, Math.ceil(tickets.length / pageSize));
  const shownPage = Math.min(page, pageCount);
  const paged = tickets.slice((shownPage - 1) * pageSize, shownPage * pageSize);

  return (
    <div className="panel-card list-card">
      <div className="list-head">
        <h2>{title}</h2>
        <p><CountUp value={tickets.length} /> {subtitle || "דרישות — לחיצה על דרישה פותחת פרטים מלאים"}</p>
      </div>
      {tickets.length === 0 ? (
        <div className="empty">אין דרישות להצגה כרגע.</div>
      ) : (
        <>
          <div className="ticket-table">
            {paged.map((t, idx) => (
              <TicketRow key={t.id} t={t} showUnit={showUnit} footer={footer?.(t)} hidePriority={hidePriority} hideStatus={hideStatus} delay={idx * 25} onOpen={onOpen} unitLogos={unitLogos} />
            ))}
          </div>
          <Pagination page={shownPage} pageSize={pageSize} totalItems={tickets.length} onPageChange={setPage} onPageSizeChange={setPageSize} />
        </>
      )}
    </div>
  );
}

// כפתור סירוב שדורש נימוק — סירוב בלי הסבר אסור, כדי שכותב/ת הדרישה תדע
// בדיוק מה לתקן אם תבחר לפתוח אותה מחדש (ראו reopenTicket). אותו רכיב
// בדיוק נדרש גם ב-Catalog.jsx להצעות פריט שנדחות, ושוכפל שם בכוונה — כל
// קובץ מסך באפליקציה הזו עצמאי ולא תלוי ב-CSS/קומפוננטות של קובץ אחר.
function RejectWithReason({ onReject }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  if (!open) {
    return <button type="button" className="btn-reject" onClick={(e) => { e.stopPropagation(); setOpen(true); }}>סירוב</button>;
  }
  return (
    <div className="reject-reason-box" onClick={(e) => e.stopPropagation()}>
      <textarea autoFocus rows={2} placeholder="נדרש הסבר לסירוב..." value={reason} onChange={(e) => setReason(e.target.value)} />
      <div className="reject-reason-actions">
        <button type="button" className="btn-cancel" onClick={() => { setOpen(false); setReason(""); }}>ביטול</button>
        <button type="button" className="btn-reject" disabled={!reason.trim()} onClick={() => { onReject(reason.trim()); setOpen(false); setReason(""); }}>
          אישור סירוב
        </button>
      </div>
    </div>
  );
}

function ApprovalQueueView({ tickets, onDecide, onOpen, unitLogos, title = "תור אישורים" }) {
  return (
    <TicketListView
      title={title}
      subtitle="דרישות ממתינות להחלטה"
      tickets={tickets}
      showUnit
      onOpen={onOpen}
      unitLogos={unitLogos}
      hideStatus
      footer={(t) => (
        <div className="ticket-actions">
          <button className="btn-approve" onClick={() => onDecide(t.id, "approved")}>אישור</button>
          <RejectWithReason onReject={(reason) => onDecide(t.id, "rejected", reason)} />
        </div>
      )}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Brigade dashboard                                                   */
/* ------------------------------------------------------------------ */

// עיגול אחד שמציג את העדיפות הנוכחית (או "טרם" אם אין) — לחיצה עליו פותחת
// רשימה נפתחת מעוצבת לבחירת עדיפות, במקום שלושה כפתורים תמיד-גלויים לצידו.
const PRIORITY_ORDER = ["red", "yellow", "green"];
function PriorityPickerMenu({ value, onChange }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="prio-picker-menu" tabIndex={-1} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false); }}>
      <button
        type="button"
        className={"prio-picker-trigger" + (value ? " prio-picker-trigger-" + value : " prio-picker-trigger-none")}
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        title={value ? `עדיפות נוכחית: ${PRIORITY_LABEL[value]} — לחיצה לשינוי` : "טרם תועדף — לחיצה לקביעת עדיפות"}
      />
      {open && (
        <div className="prio-picker-dropdown" onClick={(e) => e.stopPropagation()}>
          {PRIORITY_ORDER.map((p) => (
            <button
              type="button"
              key={p}
              className={"prio-picker-item" + (value === p ? " active" : "")}
              onClick={() => { onChange(p); setOpen(false); }}
            >
              <i className={"prio-dot prio-" + p} />
              {PRIORITY_LABEL[p]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function BrigadeDashboard({ tickets, onPriority, onOpen, unitLogos }) {
  const order = { red: 0, yellow: 1, green: 2, null: 3 };
  const sorted = [...tickets].sort((a, b) => (order[a.priority] ?? 3) - (order[b.priority] ?? 3));

  return (
    <>
      <TicketLegend />
      <TicketListView
        title="דשבורד קצין אמל״ח — חטיבה"
        subtitle="דרישות מאושרות ביחידות החטיבה, ממוינות לפי דחיפות"
        tickets={sorted}
        showUnit
        onOpen={onOpen}
        unitLogos={unitLogos}
        hidePriority
        hideStatus
        footer={(t) => <PriorityPickerMenu value={t.priority} onChange={(p) => onPriority(t.id, p)} />}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Ticket detail modal                                                 */
/* ------------------------------------------------------------------ */

function TicketDetailModal({
  ticket, onClose, onSetDueDate, onAddCollaborator, onRemoveCollaborator, unitLogos, catalog, onViewProduct,
  role, persona, currentActorLabel, rosterCandidates, onSetAssignee, onAddProgressLog, onReopen, onArchive,
}) {
  const t = ticket;
  const [collabRank, setCollabRank] = useState("");
  const [collabName, setCollabName] = useState("");
  const linkedProduct = t.linkedProductId ? catalog?.find((it) => it.id === t.linkedProductId) : null;
  const TypeIcon = TICKET_TYPE_ICONS[t.type] || Lightbulb;

  const isBrigadeOfficerPlus = role === STRUCTURAL_ROLES.BRIGADE_OFFICER || role === STRUCTURAL_ROLES.SYSTEM_ADMIN;
  const isUnitOfficerRole = role === STRUCTURAL_ROLES.UNIT_OFFICER;
  const isRequester = role === STRUCTURAL_ROLES.MEMBER && persona && t.requestedBy === `${persona.rank} ${persona.name}`;

  function submitCollaborator() {
    if (!collabName.trim()) return;
    onAddCollaborator(t.id, { rank: collabRank.trim(), name: collabName.trim() });
    setCollabRank(""); setCollabName("");
  }

  return createPortal(
    <div className="overlay" onClick={onClose}>
      <div className="modal detail-modal" onClick={(e) => e.stopPropagation()} data-devblock={`Tickets — ticket detail: ${t.title || "untitled"} (${t.id})`}>
        <button className="drawer-close" onClick={onClose}><X size={16} /></button>

        <div className="detail-eyebrow">תיק דרישה — פרטים מלאים</div>

        <div className="modal-head">
          <div className="detail-id-row">
            <span className="ticket-id">{t.id}</span>
            <StatusPill status={t.status} />
            {t.status === "rejected" && (
              <span className="ticket-expiry-inline">יימחק אוטומטית בעוד {t.daysLeft ?? 30} ימים</span>
            )}
          </div>
          <h2>{t.title}</h2>
          <div className="detail-id-row">
            <div className="ticket-unit-tag">
              <UnitEmblem name={t.unit} size={18} showRing={false} image={unitLogos?.[t.unit]} />
              {t.unit}
            </div>
            {t.category && <span className="pill pill-neutral">{t.category}</span>}
            {t.type && <span className="pill pill-neutral detail-type-pill"><TypeIcon size={12} /> {TICKET_TYPE_LABELS[t.type]}</span>}
            {t.raisedByUnitOfficer && (
              <span className="pill pill-red detail-officer-pill">
                <ShieldAlert size={12} /> נפתחה על ידי קצין אמל״ח היחידה — לא חייל מן השורה
              </span>
            )}
          </div>
        </div>

        <div className="detail-body">
          <div className="detail-main">
            <div className="detail-section-title">תיאור הדרישה</div>
            <p className="detail-desc">{t.desc}</p>

            {t.type === TICKET_TYPES.PROCUREMENT && (t.estimatedPrice || t.purchaseLink) && (
              <>
                <div className="detail-section-title">פרטי רכש</div>
                <div className="detail-procurement-card">
                  {t.estimatedPrice && (
                    <div className="detail-field">
                      <span>עלות משוערת</span>
                      <b>{Number(t.estimatedPrice).toLocaleString("he-IL")} ₪</b>
                    </div>
                  )}
                  {t.purchaseLink && (
                    <a className="detail-procurement-link" href={t.purchaseLink} target="_blank" rel="noreferrer">
                      <ExternalLink size={13} /> קישור לרכישה
                    </a>
                  )}
                </div>
              </>
            )}

            {(t.type === TICKET_TYPES.REPAIR || t.type === TICKET_TYPES.EQUIP) && (t.linkedProductId || t.linkedProductName) && (
              <>
                <div className="detail-section-title">פריט קטלוג מקושר</div>
                <button
                  type="button"
                  className="detail-linked-product"
                  disabled={!onViewProduct}
                  onClick={() => onViewProduct && onViewProduct(t.linkedProductId)}
                >
                  <span className="linked-product-main">
                    <span className="linked-product-name">{linkedProduct?.name || t.linkedProductName || t.linkedProductId}</span>
                    <span className="linked-product-id">{t.linkedProductId}</span>
                  </span>
                  {onViewProduct && (
                    <span className="linked-product-cta">לתעודת הזהות <ArrowUpRight size={13} /></span>
                  )}
                </button>
              </>
            )}

            <div className="detail-section-title">קבצים מצורפים</div>
            <div className="detail-files">
              <div className="detail-file-row">
                <span className="file-chip"><FileText size={12} /> {t.damatz}</span>
                {t.extras?.map((f) => (
                  <span className="file-chip" key={f}><Paperclip size={12} /> {f}</span>
                ))}
              </div>
            </div>

            {t.photoUploaded ? (
              <div className="photo-placeholder">
                <ImageIcon size={20} className="photo-icon" />
                <span>תמונה מצורפת לדרישה (הדגמה — תצוגה מקדימה תתווסף בשלב הבא)</span>
              </div>
            ) : (
              <div className="photo-placeholder photo-placeholder-empty">לא הועלתה תמונה לדרישה זו</div>
            )}

            <label className="due-date-field">
              <span>תג״ב — תאריך גמר ביצוע</span>
              <input
                type="text"
                value={t.dueDate || ""}
                placeholder="לדוגמה: 30/08/2026"
                onChange={(e) => onSetDueDate(t.id, e.target.value)}
              />
            </label>
          </div>

          <div className="detail-side">
            <div className="detail-section-title">מעקב ותהליך</div>
            <div className="detail-stat-card">
              <div className="detail-field">
                <span>נפתח על ידי</span>
                <b>{t.requestedBy || "לא ידוע"} <i className="detail-field-when">· {t.submittedAt || t.createdAt}</i></b>
              </div>
              {t.decidedBy && (
                <div className="detail-field">
                  <span>הוחלט על ידי</span>
                  <b>{t.decidedBy} <i className="detail-field-when">· {t.decidedAt}</i></b>
                </div>
              )}
              <div className="detail-field-sep" />
              <div className="detail-field">
                <span>עדיפות</span>
                <b><PriorityDot p={t.priority} label /></b>
              </div>
            </div>

            {t.status === "rejected" && (
              <RejectedTicketPanel t={t} onReopen={onReopen} canReopen={isBrigadeOfficerPlus || isUnitOfficerRole || isRequester} />
            )}

            <div className="detail-section-title detail-collab-title">שותפים לדרישה</div>
            <div className="detail-collab-card">
              {(!t.collaborators || t.collaborators.length === 0) && (
                <div className="detail-collab-empty">אין עדיין שותפים מצורפים.</div>
              )}
              {t.collaborators?.map((c, idx) => (
                <div className="detail-collab-row" key={idx}>
                  <span>{c.rank ? `${c.rank} ` : ""}{c.name}</span>
                  <button onClick={() => onRemoveCollaborator(t.id, idx)} title="הסרה"><X size={12} /></button>
                </div>
              ))}
              <div className="detail-collab-add">
                <input value={collabRank} onChange={(e) => setCollabRank(e.target.value)} placeholder="דרגה" className="detail-collab-rank" />
                <input value={collabName} onChange={(e) => setCollabName(e.target.value)} placeholder="שם מלא" onKeyDown={(e) => e.key === "Enter" && submitCollaborator()} />
                <button onClick={submitCollaborator} disabled={!collabName.trim()}>+</button>
              </div>
            </div>
          </div>
        </div>

        {t.status === "approved" && (
          <ProgressTrackingSection
            t={t}
            isBrigadeOfficerPlus={isBrigadeOfficerPlus}
            isUnitOfficerRole={isUnitOfficerRole}
            isRequester={isRequester}
            currentActorLabel={currentActorLabel}
            rosterCandidates={rosterCandidates}
            onSetAssignee={onSetAssignee}
            onAddProgressLog={onAddProgressLog}
            onArchive={onArchive}
          />
        )}
      </div>
    </div>,
    document.body
  );
}

/* דרישה שסורבה תמיד נושאת נימוק (decide דורש אותו) — ולכל מי שרשאי (קצין   */
/* אמל״ח יחידה/חטיבה או כותב/ת הדרישה עצמו/ה) יש אפשרות לתקן ולשלוח שוב      */
/* במקום לפתוח דרישה חדשה מאפס. עריכה מינימלית (כותרת/תיאור/קטגוריה) —      */
/* מספיק כדי לתקן את מה שגרם לסירוב, לא בנייה מחדש מלאה של הטופס.           */
function RejectedTicketPanel({ t, onReopen, canReopen }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(t.title);
  const [desc, setDesc] = useState(t.desc);

  function submit() {
    if (!title.trim() || !desc.trim()) return;
    onReopen(t.id, { title: title.trim(), desc: desc.trim() });
    setEditing(false);
  }

  return (
    <div className="rejected-panel">
      <div className="detail-section-title">סיבת הסירוב</div>
      <p className="rejected-reason">{t.rejectionReason || "לא צויין נימוק."}</p>
      {canReopen && (
        editing ? (
          <div className="reopen-form">
            <input className="reopen-title-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="כותרת" />
            <textarea rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="תיאור" />
            <div className="reopen-form-actions">
              <button type="button" className="btn-cancel" onClick={() => setEditing(false)}>ביטול</button>
              <button type="button" className="btn-submit" disabled={!title.trim() || !desc.trim()} onClick={submit}>שליחה מחדש לאישור</button>
            </div>
          </div>
        ) : (
          <button type="button" className="reopen-btn" onClick={() => setEditing(true)}>
            <RefreshCwIcon size={13} /> עריכה ופתיחה מחדש
          </button>
        )
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* מעקב טיפול — סטטוס (רשימה+טקסט חופשי), גורם אחראי, ויומן התכתבות     */
/* מלא רק לדרישות שכבר אושרו: קצין אמל״ח חטיבה קובע גורם אחראי, הוא         */
/* וקצין אמל״ח החטיבה הם היחידים שיכולים לשנות את הסטטוס בפועל (רשימה +     */
/* הסבר חופשי כאחד, כפי שהתבקש), וקצין אמל״ח היחידה + כותב הדרישה יכולים    */
/* להוסיף תגובות לשרשור מבלי לשנות את הסטטוס עצמו.                         */
/* ------------------------------------------------------------------ */

const PROGRESS_STATUS_ORDER = [PROGRESS_STATUS.WAITING, PROGRESS_STATUS.IN_PROGRESS, PROGRESS_STATUS.DONE];

function ProgressTrackingSection({ t, isBrigadeOfficerPlus, isUnitOfficerRole, isRequester, currentActorLabel, rosterCandidates, onSetAssignee, onAddProgressLog, onArchive }) {
  const [assigning, setAssigning] = useState(false);
  const [assigneeMode, setAssigneeMode] = useState("list");
  const [assigneePersonalNumber, setAssigneePersonalNumber] = useState("");
  const [assigneeRank, setAssigneeRank] = useState("");
  const [assigneeName, setAssigneeName] = useState("");

  const [postingAs, setPostingAs] = useState("officer");
  const [newStatus, setNewStatus] = useState(t.progressStatus || PROGRESS_STATUS.WAITING);
  const [logText, setLogText] = useState("");

  const canChangeStatus = isBrigadeOfficerPlus; // כולל אופציית "פרסום בשם הגורם האחראי" למטה
  const canPlainComment = isBrigadeOfficerPlus || isUnitOfficerRole || isRequester;

  function pickFromList(p) {
    onSetAssignee(t.id, { personalNumber: p.personalNumber, rank: p.rank, name: p.name });
    setAssigning(false);
  }
  function submitManualAssignee() {
    if (!assigneeName.trim()) return;
    onSetAssignee(t.id, { personalNumber: assigneePersonalNumber.trim(), rank: assigneeRank.trim(), name: assigneeName.trim() });
    setAssigneePersonalNumber(""); setAssigneeRank(""); setAssigneeName("");
    setAssigning(false);
  }

  function submitLog() {
    if (!logText.trim()) return;
    if (canChangeStatus) {
      const author = postingAs === "assignee" && t.assignee ? `${t.assignee.rank ? t.assignee.rank + " " : ""}${t.assignee.name}` : currentActorLabel;
      const authorRole = postingAs === "assignee" ? "assignee" : "brigade_officer";
      onAddProgressLog(t.id, { text: logText.trim(), status: newStatus, changesStatus: true, author, authorRole });
    } else {
      const authorRole = isUnitOfficerRole ? "unit_officer" : "member";
      onAddProgressLog(t.id, { text: logText.trim(), status: t.progressStatus, changesStatus: false, author: currentActorLabel, authorRole });
    }
    setLogText("");
  }

  return (
    <div className="progress-section">
      <div className="detail-section-title-row">
        <div className="detail-section-title">מעקב טיפול</div>
        {t.archived ? (
          <span className="pill pill-neutral archived-pill"><Archive size={12} /> בארכיון הקבוע</span>
        ) : (
          t.progressStatus === PROGRESS_STATUS.DONE && isBrigadeOfficerPlus && onArchive && (
            <button type="button" className="archive-btn" onClick={() => onArchive(t.id)}>
              <Archive size={13} /> סגירה לארכיון
            </button>
          )
        )}
      </div>

      <div className="progress-top">
        <div className="progress-top-status">
          <span>סטטוס נוכחי</span>
          <ProgressStatusPill status={t.progressStatus} />
        </div>
        <div className="progress-top-assignee">
          <span>גורם אחראי</span>
          {t.assignee ? (
            <span className="progress-assignee-chip">
              <UserCog size={13} />
              {t.assignee.rank ? `${t.assignee.rank} ` : ""}{t.assignee.name}
              {t.assignee.personalNumber && <i className="progress-assignee-pn">מ.א. {t.assignee.personalNumber}</i>}
            </span>
          ) : (
            <span className="progress-assignee-empty">טרם הוקצה</span>
          )}
          {isBrigadeOfficerPlus && (
            <button type="button" className="progress-assign-btn" onClick={() => setAssigning((v) => !v)}>
              {t.assignee ? "החלפה" : "הקצאה"}
            </button>
          )}
        </div>
      </div>

      {assigning && (
        <div className="progress-assign-panel">
          <div className="pill-tabs">
            <button type="button" className={"pill-tab" + (assigneeMode === "list" ? " active" : "")} onClick={() => setAssigneeMode("list")}>בחירה מרשימה</button>
            <button type="button" className={"pill-tab" + (assigneeMode === "manual" ? " active" : "")} onClick={() => setAssigneeMode("manual")}>לפי מספר אישי</button>
          </div>
          {assigneeMode === "list" ? (
            <div className="progress-assign-list">
              {rosterCandidates.length === 0 && <div className="empty">אין אנשי מרשם זמינים.</div>}
              {rosterCandidates.map((p) => (
                <button type="button" key={p.personalNumber} className="progress-assign-candidate" onClick={() => pickFromList(p)}>
                  {p.rank} {p.name} <i>מ.א. {p.personalNumber}</i>
                </button>
              ))}
            </div>
          ) : (
            <div className="progress-assign-manual">
              <input placeholder="דרגה" value={assigneeRank} onChange={(e) => setAssigneeRank(e.target.value)} className="detail-collab-rank" />
              <input placeholder="שם מלא" value={assigneeName} onChange={(e) => setAssigneeName(e.target.value)} />
              <input placeholder="מספר אישי" value={assigneePersonalNumber} inputMode="numeric" onChange={(e) => setAssigneePersonalNumber(e.target.value.replace(/\D/g, ""))} />
              <button type="button" onClick={submitManualAssignee} disabled={!assigneeName.trim()}>שיוך</button>
            </div>
          )}
          {t.assignee && (
            <button type="button" className="progress-assign-remove" onClick={() => { onSetAssignee(t.id, null); setAssigning(false); }}>
              הסרת גורם אחראי
            </button>
          )}
        </div>
      )}

      <div className="progress-log">
        {(!t.progressLog || t.progressLog.length === 0) && (
          <div className="progress-log-empty">עדיין אין רשומות מעקב — {canChangeStatus ? "פתח/י את הטיפול למטה." : "ממתין לעדכון מקצין אמל״ח החטיבה או הגורם האחראי."}</div>
        )}
        {t.progressLog?.map((entry) => (
          <ProgressLogEntry key={entry.id} entry={entry} />
        ))}
      </div>

      {canChangeStatus && (
        <div className="progress-composer">
          {t.assignee && (
            <div className="progress-post-as">
              <span>מפרסם/ת בתור</span>
              <div className="pill-tabs">
                <button type="button" className={"pill-tab" + (postingAs === "officer" ? " active" : "")} onClick={() => setPostingAs("officer")}>{currentActorLabel}</button>
                <button type="button" className={"pill-tab" + (postingAs === "assignee" ? " active" : "")} onClick={() => setPostingAs("assignee")}>
                  {t.assignee.rank} {t.assignee.name} (הגורם האחראי)
                </button>
              </div>
            </div>
          )}
          <div className="progress-status-pick-row">
            {PROGRESS_STATUS_ORDER.map((s) => (
              <button type="button" key={s} className={"progress-status-pick status-" + s + (newStatus === s ? " active" : "")} onClick={() => setNewStatus(s)}>
                {PROGRESS_STATUS_LABELS[s]}
              </button>
            ))}
          </div>
          <textarea
            className="progress-composer-input"
            value={logText}
            onChange={(e) => setLogText(e.target.value)}
            rows={2}
            placeholder="מה קורה בשלב הזה? (חובה לעדכון סטטוס)"
          />
          <button type="button" className="progress-composer-submit" disabled={!logText.trim()} onClick={submitLog}>
            <MessageSquare size={13} /> עדכון סטטוס
          </button>
        </div>
      )}
      {!canChangeStatus && canPlainComment && (
        <div className="progress-composer">
          <textarea
            className="progress-composer-input"
            value={logText}
            onChange={(e) => setLogText(e.target.value)}
            rows={2}
            placeholder="הוספת תגובה לשרשור הטיפול..."
          />
          <button type="button" className="progress-composer-submit" disabled={!logText.trim()} onClick={submitLog}>
            <MessageSquare size={13} /> הוספת תגובה
          </button>
        </div>
      )}
    </div>
  );
}

const LOG_TEXT_LIMIT = 140;
const AUTHOR_ROLE_LABELS = {
  brigade_officer: "קצין אמל״ח חטיבה", assignee: "גורם אחראי", unit_officer: "קצין אמל״ח יחידה", member: "כותב/ת הדרישה",
};

function ProgressLogEntry({ entry }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = entry.text.length > LOG_TEXT_LIMIT;
  const shown = expanded || !isLong ? entry.text : entry.text.slice(0, LOG_TEXT_LIMIT).trimEnd() + "…";

  return (
    <div className="progress-log-entry">
      <div className="progress-log-entry-head">
        <span className="progress-log-author">{entry.author}</span>
        <span className="pill pill-neutral progress-log-role">{AUTHOR_ROLE_LABELS[entry.authorRole] || entry.authorRole}</span>
        {entry.statusChanged && <ProgressStatusPill status={entry.status} />}
        <span className="dim progress-log-stamp">{entry.stamp}</span>
      </div>
      <div className="progress-log-text">
        {shown}
        {isLong && (
          <button type="button" className="progress-log-expand" onClick={() => setExpanded((v) => !v)}>
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            {expanded ? "כווץ" : "הרחבה"}
          </button>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* DamatzBot modal (ticket creation)                                   */
/* ------------------------------------------------------------------ */

const TICKET_TYPE_HINTS = {
  idea: "בקשה או רעיון כלליים — מספיק לתאר את הצורך בטקסט חופשי ולצרף קבצים אם צריך.",
  procurement: "דרישת רכש — יש להוסיף עלות משוערת וקישור לרכישה אם קיים.",
  repair: "תיקון פריט קיים — יש לקשר לפריט הקטלוג הרלוונטי.",
  equip: "הצטיידות בפריט קיים — יש לקשר לפריט הקטלוג הרלוונטי.",
};

function DamatzBotModal({ onClose, onSubmit, defaultUnit, categories, catalog, initialDraft, draftUserId }) {
  const productLocked = !!initialDraft?.linkedProductId;
  const [type, setType] = useState(initialDraft?.type || TICKET_TYPES.IDEA);
  const [title, setTitle] = useState(
    initialDraft?.type === "repair" ? `תקלה ב${initialDraft.linkedProductName}`
    : initialDraft?.type === "equip" ? `בקשת הצטיידות — ${initialDraft.linkedProductName}`
    : ""
  );
  const [desc, setDesc] = useState("");
  const [category, setCategory] = useState(initialDraft?.linkedProductCategory || "");
  const [unit] = useState(defaultUnit || "");
  const [damatz, setDamatz] = useState(null);
  const [extras, setExtras] = useState([]);
  const [linkedProductId, setLinkedProductId] = useState(initialDraft?.linkedProductId || "");
  const [estimatedPrice, setEstimatedPrice] = useState("");
  const [purchaseLink, setPurchaseLink] = useState("");
  const [attempted, setAttempted] = useState(false);

  // טיוטה — לא נבדקת בכלל כשהגענו עם initialDraft (הקשר צולב עם כוונה     */
  // מפורשת כבר, למשל "דיווח תקלה" מתעודת זהות של פריט); אחרת, אם יש טיוטה */
  // שמורה מפעם קודמת שלא הושלמה, מציעים להמשיך אותה במקום להתחיל מאפס.    */
  const [savedDraft, setSavedDraft] = useState(undefined); // undefined=טוען, null=אין, אובייקט=יש
  const [draftResolved, setDraftResolved] = useState(!!initialDraft);
  useEffect(() => {
    if (initialDraft) return;
    let cancelled = false;
    fetchDraft(draftUserId, "ticket").then((d) => { if (!cancelled) setSavedDraft(d); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function resumeDraft() {
    const d = savedDraft.data;
    setType(d.type || TICKET_TYPES.IDEA);
    setTitle(d.title || "");
    setDesc(d.desc || "");
    setCategory(d.category || "");
    setDamatz(d.damatz || null);
    setExtras(d.extras || []);
    setLinkedProductId(d.linkedProductId || "");
    setEstimatedPrice(d.estimatedPrice || "");
    setPurchaseLink(d.purchaseLink || "");
    setDraftResolved(true);
  }
  function discardDraft() {
    clearDraft(draftUserId, "ticket");
    setDraftResolved(true);
  }

  // שמירה אוטומטית עם דיליי קטן, רק אחרי שהוכרע אם ממשיכים טיוטה קיימת או  */
  // לא — אחרת נדרוס את הטיוטה השמורה עוד לפני שהמשתמש הספיק להחליט.       */
  useEffect(() => {
    if (!draftResolved && savedDraft !== null) return;
    const t = setTimeout(() => {
      saveDraft(draftUserId, "ticket", { type, title, desc, category, damatz, extras, linkedProductId, estimatedPrice, purchaseLink });
    }, 500);
    return () => clearTimeout(t);
  }, [draftResolved, savedDraft, draftUserId, type, title, desc, category, damatz, extras, linkedProductId, estimatedPrice, purchaseLink]);

  const needsProduct = type === TICKET_TYPES.REPAIR || type === TICKET_TYPES.EQUIP;
  const linkedProductName = productLocked
    ? initialDraft.linkedProductName
    : catalog?.find((it) => it.id === linkedProductId)?.name;

  // כל שדה חובה מחזיק את הבדיקה שלו כדי שאפשר יהיה גם לדעת אם אפשר לשלוח
  // וגם — ברגע שניסו לשלוח ונכשלו — בדיוק אילו שדות להאדים באדום, במקום
  // שהמשתמש יתקע בלי לדעת מה חסר (ראו attempted וה-field-error למטה).
  const missing = {
    title: !title.trim(),
    desc: !desc.trim(),
    category: !category,
    damatz: !damatz,
    estimatedPrice: type === TICKET_TYPES.PROCUREMENT && !String(estimatedPrice).trim(),
    linkedProduct: needsProduct && !linkedProductId,
  };
  const canSubmit = !Object.values(missing).some(Boolean);
  function errClass(key) { return attempted && missing[key] ? " field-error" : ""; }

  function submit() {
    if (!canSubmit) { setAttempted(true); return; }
    clearDraft(draftUserId, "ticket");
    onSubmit({
      title, desc, category, unit, damatz, extras, type,
      estimatedPrice: type === TICKET_TYPES.PROCUREMENT ? Number(estimatedPrice) || null : null,
      purchaseLink: type === TICKET_TYPES.PROCUREMENT ? purchaseLink : "",
      linkedProductId: needsProduct ? linkedProductId : null,
      linkedProductName: needsProduct ? linkedProductName : null,
    });
  }

  return createPortal(
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="drawer-close" onClick={onClose}><X size={16} /></button>
        <div className="modal-head">
          <div className="modal-bot-badge">דמ״צבוט</div>
          <h2>פתיחת דרישה למסמך דמ״ץ</h2>
          <p>מלא/י את הפרטים. הבקשה תישלח לאישור קצין האמל״ח ביחידתך.</p>
        </div>

        {!draftResolved && savedDraft && (
          <div className="draft-resume-banner">
            <Save size={16} />
            <div className="draft-resume-text">
              <b>נמצאה טיוטה שמורה</b>
              <span>מ-{new Date(savedDraft.savedAt).toLocaleString("he-IL")} — להמשיך למלא אותה?</span>
            </div>
            <div className="draft-resume-actions">
              <button type="button" className="btn-cancel" onClick={discardDraft}>התחלה חדשה</button>
              <button type="button" className="btn-submit" onClick={resumeDraft}>המשך טיוטה</button>
            </div>
          </div>
        )}

        {(draftResolved || savedDraft === null) && (
        <>
        <label className="field">
          <span>סוג הדרישה</span>
          <div className="ticket-type-pick-row">
            {Object.values(TICKET_TYPES).map((tKey) => {
              const Icon = TICKET_TYPE_ICONS[tKey];
              return (
                <button
                  type="button"
                  key={tKey}
                  className={"ticket-type-pick" + (type === tKey ? " active" : "")}
                  onClick={() => setType(tKey)}
                >
                  <Icon size={13} /> {TICKET_TYPE_LABELS[tKey]}
                </button>
              );
            })}
          </div>
          <span className="ticket-type-hint">{TICKET_TYPE_HINTS[type]}</span>
        </label>

        {needsProduct && (
          <label className={"field" + errClass("linkedProduct")}>
            <span>פריט קטלוג מקושר (חובה)</span>
            {productLocked ? (
              <div className="file-chip locked-product-chip">{linkedProductName}</div>
            ) : (
              <select value={linkedProductId} onChange={(e) => setLinkedProductId(e.target.value)}>
                <option value="" disabled>בחר/י פריט מהקטלוג</option>
                {(catalog || []).map((it) => <option key={it.id} value={it.id}>{it.name} — {it.id}</option>)}
              </select>
            )}
            {attempted && missing.linkedProduct && <span className="field-error-msg">יש לבחור פריט מהקטלוג</span>}
          </label>
        )}

        {type === TICKET_TYPES.PROCUREMENT && (
          <>
            <label className={"field" + errClass("estimatedPrice")}>
              <span>עלות משוערת בש״ח (חובה)</span>
              <input type="number" min="0" value={estimatedPrice} onChange={(e) => setEstimatedPrice(e.target.value)} placeholder="לדוגמה: 4200" />
              {attempted && missing.estimatedPrice && <span className="field-error-msg">שדה חובה</span>}
            </label>
            <label className="field">
              <span>קישור לרכישה (אופציונלי)</span>
              <input value={purchaseLink} onChange={(e) => setPurchaseLink(e.target.value)} placeholder="https://..." />
            </label>
          </>
        )}

        <label className="field">
          <span>יחידה — נקבעת אוטומטית לפי המשתמש המחובר</span>
          <input value={unit} disabled />
        </label>

        <label className={"field" + errClass("title")}>
          <span>כותרת הדרישה</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="לדוגמה: חוסר בסוללות שדה" />
          {attempted && missing.title && <span className="field-error-msg">שדה חובה</span>}
        </label>

        <label className={"field" + errClass("desc")}>
          <span>תיאור</span>
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={4} placeholder="פרט/י את הצורך, הכמות והדחיפות" />
          {attempted && missing.desc && <span className="field-error-msg">שדה חובה</span>}
        </label>

        <label className={"field" + errClass("category")}>
          <span>קטגוריה (חובה)</span>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="" disabled>בחר/י קטגוריה</option>
            {(categories || []).map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          {attempted && missing.category && <span className="field-error-msg">יש לבחור קטגוריה</span>}
        </label>

        <label className={"field" + errClass("damatz")}>
          <span>קובץ דמ״ץ (חובה)</span>
          <input type="file" onChange={(e) => setDamatz(e.target.files?.[0]?.name ?? null)} />
          {damatz && <span className="file-chip">{damatz}</span>}
          {attempted && missing.damatz && <span className="field-error-msg">יש לצרף קובץ דמ״ץ</span>}
        </label>

        <label className="field">
          <span>קבצים נוספים (אופציונלי)</span>
          <input type="file" multiple onChange={(e) => setExtras(Array.from(e.target.files || []).map((f) => f.name))} />
          {extras.length > 0 && <span className="file-chip">{extras.length} קבצים נבחרו</span>}
        </label>

        {attempted && !canSubmit && (
          <div className="form-error-banner"><AlertTriangle size={14} /> יש למלא את כל השדות המסומנים באדום לפני השליחה.</div>
        )}
        <div className="modal-actions">
          <button className="btn-cancel" onClick={onClose}>ביטול</button>
          <button className={"btn-submit" + (!canSubmit ? " btn-submit-pending" : "")} onClick={submit}>
            שליחה לאישור
          </button>
        </div>
        </>
        )}
      </div>
    </div>,
    document.body
  );
}

/* ------------------------------------------------------------------ */
/* CSS                                                                 */
/* ------------------------------------------------------------------ */

const CSS = `
@keyframes fadeSlideUp{ from{ opacity:0; transform:translateY(8px); } to{ opacity:1; transform:translateY(0); } }
@keyframes overlayIn{ from{ opacity:0; } to{ opacity:1; } }
@keyframes modalIn{ from{ opacity:0; transform:translateY(8px); } to{ opacity:1; transform:translateY(0); } }
@keyframes urgentPulse{ 0%,100%{ opacity:1; } 50%{ opacity:.55; } }

.tickets-view{ display:flex; flex-direction:column; gap:16px; }
.view-sub{ color:var(--text-dim); font-size:13.5px; margin:0; }
.view-head-row{ display:flex; justify-content:space-between; align-items:flex-start; gap:16px; flex-wrap:wrap; }

.list-card{ padding:18px 20px; }
.list-head{ margin-bottom:18px; }
.list-head h2{ font-family:var(--font-sans); font-size:17px; font-weight:700; margin:0 0 4px; }
.list-head p{ color:var(--text-dim); font-size:13.5px; margin:0; }

.new-ticket-btn{
  background:var(--accent); color:var(--accent-ink); border:none; border-radius:var(--radius-md);
  font-family:var(--font-sans); font-weight:700; font-size:14px; padding:11px 18px; cursor:pointer;
  transition:filter var(--t-fast) ease, box-shadow var(--t-fast) ease;
}
.new-ticket-btn:hover{ filter:brightness(1.08); box-shadow:var(--shadow-sm); }

.ticket-id{ font-family:var(--font-mono); font-size:12px; color:var(--accent); }
.ticket-title-sm{ font-size:12.5px; color:var(--text-dim); }
.ticket-unit-tag{ display:inline-flex; align-items:center; gap:5px; }

/* שורה דו-שכבתית: שורה 1 = מה שקובע פעולה (סטטוס/עדיפות/מזהה/כותרת/פעולה), */
/* שורה 2 = הקשר משני עדין (יחידה/פותח/תאריך/אחראי/קבצים) — במקום טבלה עם   */
/* עמודות קבועות שדוחסת הכל לשורה אחת או משאירה שדות ריקים. ראו TicketRow.  */
.ticket-table{ display:flex; flex-direction:column; border:1px solid var(--line); border-radius:var(--radius-lg); overflow:hidden; }
.ticket-row{
  display:flex; flex-direction:column; gap:5px; padding:11px 14px; font-size:13px; color:var(--text);
  border-bottom:1px solid var(--line); background:var(--panel);
  opacity:0; animation:fadeSlideUp var(--t-base) ease forwards;
}
.ticket-row:last-child{ border-bottom:none; }
.ticket-row-clickable{ cursor:pointer; transition:background var(--t-fast) ease; }
.ticket-row-clickable:hover{ background:var(--panel-raised); }
.ticket-row-line1{ display:flex; align-items:center; gap:10px; }
.ticket-row-title{
  font-family:var(--font-sans); font-weight:600; font-size:13.5px; overflow:hidden; text-overflow:ellipsis;
  white-space:nowrap; flex:1; min-width:0;
}
.ticket-row-line2{
  display:flex; align-items:center; gap:12px; font-size:11.5px; color:var(--text-dim);
  font-family:var(--font-mono); flex-wrap:wrap; padding-inline-start:2px;
}
.ticket-row-requester{ font-family:var(--font-sans); }
.ticket-row-assignee{ display:inline-flex; align-items:center; gap:4px; color:var(--accent); }
.ticket-row-assignee svg{ flex:none; }
.ticket-row-icon{ color:var(--text-dim); flex:none; }
.ticket-row-actions{ display:flex; justify-content:flex-end; margin-inline-start:auto; }
.ticket-actions{ display:flex; gap:8px; }
.btn-approve, .btn-reject, .btn-cancel, .btn-submit{
  border:none; border-radius:var(--radius-md); padding:7px 14px; font-family:var(--font-sans);
  font-weight:700; font-size:12.5px; cursor:pointer;
  transition:filter var(--t-fast) ease, box-shadow var(--t-fast) ease;
}
.btn-approve{ background:var(--green); color:#FFFFFF; }
.btn-approve:hover{ filter:brightness(1.08); }
.btn-reject{ background:transparent; color:var(--red); border:1px solid var(--red); }
.btn-reject:hover{ background:var(--panel-raised); }

.reject-reason-box{
  display:flex; flex-direction:column; gap:6px; background:var(--bg); border:1px solid var(--red);
  border-radius:var(--radius-md); padding:9px; width:220px; animation:fadeSlideUp var(--t-fast) ease;
}
.reject-reason-box textarea{
  width:100%; background:var(--panel); border:1px solid var(--line); border-radius:var(--radius-md); padding:7px 9px;
  font-size:12.5px; font-family:var(--font-sans); color:var(--text); resize:vertical;
}
.reject-reason-box textarea:focus{ outline:none; border-color:var(--red); }
.reject-reason-actions{ display:flex; justify-content:flex-end; gap:6px; }
.reject-reason-actions .btn-reject:disabled{ opacity:.4; cursor:not-allowed; }

/* דרישה שנפתחה ישירות על ידי קצין אמל״ח היחידה (לא חייל) — מודגשת במסגרת   */
/* אדומה אצל קצין אמל״ח החטיבה, כדי שיידע מיד שזו לא בקשה שגרתית. פס-צבע   */
/* בצד ההתחלה (ימין ב-RTL) ולא מסגרת מלאה, כדי שלא יתחרה חזותית עם         */
/* pill הסטטוס/עדיפות שכבר תופסים תשומת לב באותה שורה.                     */
.ticket-row.officer-raised{ border-inline-start:3px solid var(--red); background:color-mix(in srgb, var(--red) 4%, var(--panel)); }
.officer-raised-icon{ color:var(--red); flex:none; margin-inline-end:5px; vertical-align:-2px; }
.team-gate-tag{
  font-family:var(--font-mono); font-size:9.5px; color:var(--accent); border:1px solid var(--accent);
  border-radius:var(--radius-md); padding:1px 6px; text-transform:uppercase; flex:none;
}

@media (max-width:900px){
  .ticket-row-line2{ display:none; }
}

.empty{ color:var(--text-dim); font-size:14px; padding:30px 0; text-align:center; }

.legend{ display:flex; gap:18px; font-size:13px; color:var(--text-dim); margin-bottom:16px; }
.legend span{ display:flex; align-items:center; gap:6px; }
.dim{ color:var(--text-dim); font-size:13px; }

.prio-dot{ width:10px; height:10px; border-radius:50%; display:inline-block; }
.prio-dot.prio-none{ width:auto;height:auto;color:var(--text-dim); font-size:13px; }
.prio-dot.prio-none-dot{ width:7px; height:7px; background:var(--line); }
.prio-green{ background:var(--green); }
.prio-yellow{ background:var(--yellow); }
.prio-red{ background:var(--red); animation:urgentPulse 1.8s ease-in-out infinite; }

/* גרסת-תווית של PriorityDot — משמשת עכשיו כמקור האמת היחיד לעדיפות בשורת   */
/* הרשימה (ראו TicketRow), כדי שלא תוצג פעמיים לצד בורר העדיפות בדשבורד.    */
.prio-inline{ display:inline-flex; align-items:center; gap:6px; font-size:12px; font-weight:700; font-family:var(--font-sans); }
.prio-inline i.prio-dot{ width:8px; height:8px; }
.prio-inline-red{ color:var(--red); }
.prio-inline-yellow{ color:var(--yellow); }
.prio-inline-green{ color:var(--green); }
.prio-inline.prio-none{ color:var(--text-dim); font-weight:600; }

/* עיגול תעדוף יחיד + רשימה נפתחת — במקום שלושה כפתורים תמיד-גלויים.       */
.prio-picker-menu{ position:relative; }
.prio-picker-trigger{
  width:22px; height:22px; border-radius:50%; cursor:pointer; flex:none;
  border:2px solid var(--panel); box-shadow:0 0 0 1.5px var(--line); transition:box-shadow var(--t-fast) ease, transform .12s ease;
}
.prio-picker-trigger:hover{ transform:scale(1.1); box-shadow:0 0 0 1.5px var(--accent); }
.prio-picker-trigger-red{ background:var(--red); }
.prio-picker-trigger-yellow{ background:var(--yellow); }
.prio-picker-trigger-green{ background:var(--green); }
.prio-picker-trigger-none{ background:var(--panel-raised); border-style:dashed; box-shadow:0 0 0 1.5px var(--line); }
.prio-picker-dropdown{
  position:absolute; top:calc(100% + 6px); left:50%; transform:translateX(-50%); z-index:60; min-width:130px;
  background:var(--panel); border:1px solid var(--line); border-radius:var(--radius-lg); box-shadow:var(--shadow-md);
  padding:6px; animation:fadeSlideUp var(--t-fast) ease; display:flex; flex-direction:column; gap:2px;
}
.prio-picker-item{
  width:100%; display:flex; align-items:center; gap:9px; background:transparent; border:none;
  color:var(--text); padding:8px 10px; border-radius:var(--radius-md); cursor:pointer; font-size:12.5px; text-align:right;
  font-family:var(--font-sans); font-weight:600; transition:background var(--t-fast) ease;
}
.prio-picker-item:hover{ background:var(--panel-raised); }
.prio-picker-item.active{ background:var(--panel-raised); }
.prio-picker-item.active::after{ content:"✓"; margin-inline-start:auto; color:var(--accent); font-weight:700; }
.prio-picker-item i.prio-dot{ width:9px; height:9px; flex:none; }

.overlay{ position:fixed; inset:0; background:rgba(6,8,10,.6); backdrop-filter:blur(2px); display:flex; align-items:center; justify-content:center; z-index:200; padding:24px; animation:overlayIn var(--t-fast) ease; }
.modal{
  width:440px; max-width:100%; max-height:88vh; overflow-y:auto;
  background:var(--panel); border:1px solid var(--line); border-radius:var(--radius-card); padding:28px;
  position:relative; box-shadow:var(--shadow-md); animation:modalIn var(--t-base) ease;
}
.drawer-close{ position:absolute; top:16px; left:16px; background:none; border:1px solid transparent; color:var(--text-dim); cursor:pointer; border-radius:var(--radius-md); padding:6px; display:flex; transition:color var(--t-fast) ease, border-color var(--t-fast) ease; }
.drawer-close:hover{ color:var(--red); border-color:var(--red); }
.modal-head{ margin-bottom:18px; }
.modal-bot-badge{ display:inline-block; font-family:var(--font-mono); font-size:11px; color:var(--accent-ink); background:var(--accent); padding:2px 10px; border-radius:var(--radius-lg); margin-bottom:10px; letter-spacing:.03em; }
.modal-head h2{ font-family:var(--font-sans); font-weight:700; font-size:20px; margin:0 0 6px; }
.modal-head p{ font-size:13px; color:var(--text-dim); margin:0; }

.field{ display:flex; flex-direction:column; gap:6px; margin-bottom:15px; font-size:13px; color:var(--text-dim); }
.field input, .field select, .field textarea{ background:var(--bg); border:1px solid var(--line); border-radius:var(--radius-md); color:var(--text); padding:10px 11px; font-family:var(--font-sans); font-size:14px; resize:vertical; transition:border-color var(--t-fast) ease, box-shadow var(--t-fast) ease; }
.field input:focus, .field select:focus, .field textarea:focus{ outline:none; border-color:var(--accent); box-shadow:0 0 0 3px color-mix(in srgb, var(--accent) 18%, transparent); }

/* מסמן באדום רק אחרי ניסיון שליחה כושל (attempted) — לא על טופס נקי,      */
/* כדי שלא "יצעק" על שדות שהמשתמש עוד לא הגיע אליהם. הכפתור עצמו תמיד       */
/* לחיץ (לא disabled אמיתי) בדיוק כדי שלחיצה עליו כשמשהו חסר תחשוף מה חסר —*/
/* כפתור disabled לא שולח אירוע click בכלל, אז זו הדרך היחידה "להיתקע" פחות.*/
.field.field-error input, .field.field-error select, .field.field-error textarea{
  border-color:var(--red); box-shadow:0 0 0 2px color-mix(in srgb, var(--red) 14%, transparent);
}
.field.field-error > span:first-child{ color:var(--red); }
.field-error-msg{ font-size:11.5px; color:var(--red); font-weight:600; }
.form-error-banner{
  display:flex; align-items:center; gap:8px; background:color-mix(in srgb, var(--red) 10%, transparent);
  border:1px solid var(--red); color:var(--red); border-radius:var(--radius-md); padding:9px 13px; font-size:12.5px;
  font-weight:600; margin-bottom:8px;
}
.btn-submit-pending{ opacity:.55; }

.draft-resume-banner{
  display:flex; align-items:center; gap:12px; background:color-mix(in srgb, var(--accent) 8%, transparent);
  border:1px solid var(--accent); border-radius:var(--radius-lg); padding:12px 14px; margin-bottom:16px;
}
.draft-resume-banner svg{ color:var(--accent); flex:none; }
.draft-resume-text{ display:flex; flex-direction:column; gap:2px; flex:1; font-size:12.5px; color:var(--text); }
.draft-resume-text b{ font-size:13.5px; }
.draft-resume-text span{ color:var(--text-dim); font-size:11.5px; }
.draft-resume-actions{ display:flex; gap:8px; flex:none; }
.file-chip{ display:inline-flex; align-items:center; gap:5px; align-self:flex-start; font-size:12px; background:var(--panel-raised); border:1px solid var(--line); border-radius:var(--radius-lg); padding:3px 10px; color:var(--text); font-family:var(--font-mono); }
.locked-product-chip{ font-family:var(--font-sans); font-weight:600; }

.ticket-type-pick-row{ display:flex; gap:7px; flex-wrap:wrap; margin-bottom:4px; }
.ticket-type-pick{
  display:inline-flex; align-items:center; gap:6px; background:var(--bg); border:1px solid var(--line);
  border-radius:var(--radius-lg); padding:7px 13px; font-size:12.5px; font-weight:600; color:var(--text-dim); cursor:pointer;
  font-family:var(--font-sans); transition:border-color var(--t-fast) ease, color var(--t-fast) ease, background var(--t-fast) ease;
}
.ticket-type-pick:hover{ border-color:var(--accent); color:var(--accent); }
.ticket-type-pick.active{ background:var(--accent); color:var(--accent-ink); border-color:var(--accent); }
.ticket-type-hint{ font-size:11.5px; color:var(--text-dim); line-height:1.5; }

.modal-actions{ display:flex; justify-content:flex-end; gap:10px; margin-top:8px; }
.btn-cancel{ background:transparent; color:var(--text-dim); border:1px solid var(--line); }
.btn-cancel:hover{ color:var(--text); border-color:var(--text-dim); }
.btn-submit{ background:var(--accent); color:var(--accent-ink); }
.btn-submit:not(:disabled):hover{ filter:brightness(1.08); }
.btn-submit:disabled{ opacity:.4; cursor:not-allowed; }

.toast{
  position:fixed; bottom:24px; left:50%; transform:translateX(-50%);
  background:var(--panel); border:1px solid var(--accent); color:var(--text);
  font-family:var(--font-mono); font-size:13px; padding:10px 20px; border-radius:var(--radius-lg);
  z-index:250; box-shadow:var(--shadow-md); animation:fadeSlideUp var(--t-base) ease;
}

.ticket-due{ color:var(--accent); }
.dash-row-clickable{ cursor:pointer; }

.detail-modal{ width:860px; padding:32px 36px 36px; }
.detail-eyebrow{
  font-family:var(--font-mono); font-size:11px; color:var(--text-dim); text-transform:uppercase;
  letter-spacing:.06em; border-bottom:1px solid var(--line); padding-bottom:12px; margin-bottom:20px; padding-inline-end:36px;
}
.detail-id-row{ display:flex; align-items:center; gap:10px; margin-bottom:8px; flex-wrap:wrap; }
.detail-modal h2{ font-family:var(--font-sans); font-weight:700; font-size:24px; margin:4px 0 12px; }
.modal-head{ margin-bottom:22px; }

.detail-body{ display:grid; grid-template-columns:1.5fr 1fr; gap:26px; align-items:start; }
.detail-section-title{
  font-family:var(--font-mono); font-size:11.5px; color:var(--accent); text-transform:uppercase;
  letter-spacing:.06em; margin:0 0 10px;
}
.detail-desc{ font-size:14.5px; color:var(--text); line-height:1.7; margin:0 0 22px; }
.detail-type-pill{ display:inline-flex; align-items:center; gap:5px; }

.detail-procurement-card{
  display:flex; align-items:center; gap:18px; flex-wrap:wrap; background:var(--panel-raised);
  border:1px solid var(--line); border-radius:var(--radius-lg); padding:13px 15px; margin-bottom:22px;
}
.detail-procurement-link{
  display:inline-flex; align-items:center; gap:6px; color:var(--accent); font-size:13px; font-weight:600;
  text-decoration:none; font-family:var(--font-sans);
}
.detail-procurement-link:hover{ text-decoration:underline; }

.detail-linked-product{
  display:flex; align-items:center; justify-content:space-between; gap:10px; width:100%;
  background:var(--panel-raised); border:1px solid var(--line); border-radius:var(--radius-lg); padding:12px 15px;
  cursor:pointer; text-align:right; font-family:var(--font-sans); margin-bottom:22px;
  transition:border-color var(--t-fast) ease;
}
.detail-linked-product:disabled{ cursor:default; }
.detail-linked-product:not(:disabled):hover{ border-color:var(--accent); }
.linked-product-main{ display:flex; flex-direction:column; gap:2px; }
.linked-product-name{ font-size:14px; font-weight:600; color:var(--text); }
.linked-product-id{ font-size:11.5px; color:var(--text-dim); font-family:var(--font-mono); }
.linked-product-cta{ display:inline-flex; align-items:center; gap:5px; font-size:12.5px; color:var(--accent); font-weight:600; flex:none; }

.detail-stat-card{
  background:var(--panel-raised); border:1px solid var(--line); border-radius:var(--radius-lg); padding:14px 16px;
  display:flex; flex-direction:column; gap:12px;
}
.detail-field{ display:flex; flex-direction:column; gap:3px; font-size:12px; color:var(--text-dim); }
.detail-field b{ font-size:14px; color:var(--text); font-family:var(--font-mono); font-weight:500; }
.detail-field-sep{ height:1px; background:var(--line); margin:2px 0; }

.detail-collab-title{ margin-top:22px; }
.detail-collab-card{
  background:var(--panel-raised); border:1px solid var(--line); border-radius:var(--radius-lg); padding:12px 14px;
  display:flex; flex-direction:column; gap:8px;
}
.detail-collab-empty{ color:var(--text-dim); font-size:12.5px; }
.detail-collab-row{
  display:flex; align-items:center; justify-content:space-between; gap:8px; background:var(--bg);
  border:1px solid var(--line); border-radius:var(--radius-md); padding:7px 10px; font-size:13px; color:var(--text);
}
.detail-collab-row button{
  flex:none; background:none; border:none; color:var(--text-dim); cursor:pointer; display:flex; padding:2px;
  border-radius:var(--radius-md); transition:color var(--t-fast) ease;
}
.detail-collab-row button:hover{ color:var(--red); }
.detail-collab-add{ display:flex; gap:6px; margin-top:2px; }
.detail-collab-add input{
  flex:1; min-width:0; background:var(--bg); border:1px solid var(--line); border-radius:var(--radius-md); padding:7px 9px;
  font-size:12.5px; color:var(--text); font-family:var(--font-sans);
}
.detail-collab-add input:focus{ outline:none; border-color:var(--accent); }
.detail-collab-rank{ flex:0 0 64px; }
.detail-collab-add button{
  flex:none; width:30px; background:var(--accent); color:var(--accent-ink); border:none; border-radius:var(--radius-md);
  font-size:16px; font-weight:700; cursor:pointer; line-height:1; transition:filter var(--t-fast) ease;
}
.detail-collab-add button:hover:not(:disabled){ filter:brightness(1.08); }
.detail-collab-add button:disabled{ opacity:.4; cursor:not-allowed; }

.detail-field-when{ font-style:normal; font-weight:500; color:var(--text-dim); font-size:12px; }

.rejected-panel{ margin-top:18px; padding-top:16px; border-top:1px dashed var(--red); }
.rejected-reason{ font-size:13px; color:var(--text); background:var(--bg); border:1px solid var(--line); border-radius:var(--radius-md); padding:10px 12px; margin:0 0 10px; line-height:1.6; }
.reopen-btn{
  display:inline-flex; align-items:center; gap:6px; background:none; border:1px solid var(--accent); color:var(--accent);
  border-radius:var(--radius-md); padding:7px 13px; font-size:12.5px; font-weight:700; cursor:pointer; font-family:var(--font-sans);
  transition:background var(--t-fast) ease;
}
.reopen-btn:hover{ background:color-mix(in srgb, var(--accent) 10%, transparent); }
.reopen-form{ display:flex; flex-direction:column; gap:8px; }
.reopen-title-input, .reopen-form textarea{
  width:100%; background:var(--bg); border:1px solid var(--line); border-radius:var(--radius-md); padding:8px 10px;
  font-size:13px; color:var(--text); font-family:var(--font-sans);
}
.reopen-title-input:focus, .reopen-form textarea:focus{ outline:none; border-color:var(--accent); }
.reopen-form-actions{ display:flex; justify-content:flex-end; gap:8px; }

.due-date-field{ display:flex; flex-direction:column; gap:6px; font-size:13px; color:var(--text-dim); margin-bottom:0; }
.due-date-field input{ background:var(--bg); border:1px solid var(--accent); border-radius:var(--radius-md); color:var(--accent); padding:10px 11px; font-family:var(--font-mono); font-size:14px; }
.due-date-field input:focus{ outline:none; box-shadow:0 0 0 3px color-mix(in srgb, var(--accent) 18%, transparent); }
.detail-files{ margin-bottom:14px; }
.detail-file-row{ display:flex; flex-wrap:wrap; gap:6px; margin-bottom:6px; }
.photo-placeholder{ display:flex; align-items:center; gap:10px; background:var(--bg); border:1px dashed var(--line); border-radius:var(--radius-lg); padding:14px; font-size:13px; color:var(--text-dim); margin-bottom:22px; }
.photo-icon{ width:22px; height:22px; flex:none; color:var(--text-dim); }
.photo-placeholder-empty{ justify-content:center; opacity:.7; }
.ticket-expiry-inline{
  display:inline-flex; align-items:center; font-size:11.5px; color:var(--red); font-family:var(--font-mono);
  border:1px solid var(--red); border-radius:var(--radius-lg); padding:2px 10px; margin-inline-start:auto;
}

.detail-officer-pill{ display:inline-flex; align-items:center; gap:6px; }

/* ================================================================== */
/* מעקב טיפול — סטטוס (רשימה+טקסט), גורם אחראי, יומן התכתבות            */
/* ================================================================== */
.progress-section{ border-top:1px solid var(--line); margin-top:26px; padding-top:22px; }
.detail-section-title-row{ display:flex; align-items:center; justify-content:space-between; gap:10px; }
.detail-section-title-row .detail-section-title{ margin:0; }
.archive-btn{
  display:inline-flex; align-items:center; gap:6px; background:none; border:1px solid var(--line); color:var(--text-dim);
  border-radius:var(--radius-md); padding:5px 11px; font-size:12px; font-weight:700; cursor:pointer; font-family:var(--font-sans);
  transition:border-color var(--t-fast) ease, color var(--t-fast) ease;
}
.archive-btn:hover{ border-color:var(--accent); color:var(--accent); }
.archived-pill{ display:inline-flex; align-items:center; gap:5px; }
.progress-top{ display:flex; flex-wrap:wrap; gap:24px; margin-bottom:16px; }
.progress-top-status, .progress-top-assignee{ display:flex; align-items:center; gap:10px; font-size:12.5px; color:var(--text-dim); }
.progress-assignee-chip{
  display:inline-flex; align-items:center; gap:6px; font-size:13px; font-weight:600; color:var(--text);
  background:var(--panel-raised); border:1px solid var(--line); border-radius:var(--radius-lg); padding:5px 12px;
}
.progress-assignee-chip svg{ color:var(--accent); flex:none; }
.progress-assignee-pn{ font-family:var(--font-mono); font-style:normal; color:var(--text-dim); font-size:11.5px; margin-inline-start:4px; }
.progress-assignee-empty{ font-size:12.5px; color:var(--text-dim); font-style:italic; }
.progress-assign-btn{
  background:none; border:1px solid var(--line); color:var(--accent); border-radius:var(--radius-md); padding:5px 11px;
  font-size:12px; font-weight:700; cursor:pointer; font-family:var(--font-sans); transition:border-color var(--t-fast) ease;
}
.progress-assign-btn:hover{ border-color:var(--accent); }

.progress-assign-panel{
  background:var(--panel-raised); border:1px solid var(--line); border-radius:var(--radius-lg); padding:14px; margin-bottom:18px;
  display:flex; flex-direction:column; gap:10px;
}
.progress-assign-list{ display:flex; flex-direction:column; gap:6px; max-height:180px; overflow-y:auto; }
.progress-assign-candidate{
  display:flex; align-items:center; justify-content:space-between; gap:8px; background:var(--bg);
  border:1px solid var(--line); border-radius:var(--radius-md); padding:8px 11px; font-size:12.5px; color:var(--text);
  cursor:pointer; text-align:right; font-family:var(--font-sans); transition:border-color var(--t-fast) ease;
}
.progress-assign-candidate:hover{ border-color:var(--accent); }
.progress-assign-candidate i{ font-style:normal; color:var(--text-dim); font-family:var(--font-mono); font-size:11px; }
.progress-assign-manual{ display:flex; gap:8px; flex-wrap:wrap; }
.progress-assign-manual input{
  flex:1; min-width:90px; background:var(--bg); border:1px solid var(--line); border-radius:var(--radius-md); padding:8px 10px;
  font-size:12.5px; color:var(--text); font-family:var(--font-sans);
}
.progress-assign-manual button{
  flex:none; background:var(--accent); color:var(--accent-ink); border:none; border-radius:var(--radius-md); padding:8px 16px;
  font-size:12.5px; font-weight:700; cursor:pointer; font-family:var(--font-sans);
}
.progress-assign-manual button:disabled{ opacity:.4; cursor:not-allowed; }
.progress-assign-remove{
  align-self:flex-start; background:none; border:none; color:var(--red); font-size:12px; cursor:pointer;
  font-family:var(--font-sans); text-decoration:underline; padding:0;
}

.progress-log{ display:flex; flex-direction:column; gap:10px; margin-bottom:18px; }
.progress-log-empty{ color:var(--text-dim); font-size:13px; font-style:italic; }
.progress-log-entry{
  background:var(--panel-raised); border:1px solid var(--line); border-radius:var(--radius-lg); padding:11px 14px;
}
.progress-log-entry-head{ display:flex; align-items:center; gap:9px; flex-wrap:wrap; margin-bottom:6px; }
.progress-log-author{ font-weight:700; font-size:13px; color:var(--text); }
.progress-log-role{ font-size:10.5px; }
.progress-log-stamp{ font-family:var(--font-mono); font-size:11px; margin-inline-start:auto; }
.progress-log-text{ font-size:13px; color:var(--text); line-height:1.6; }
.progress-log-expand{
  display:inline-flex; align-items:center; gap:3px; background:none; border:none; color:var(--accent);
  font-size:11.5px; font-weight:700; cursor:pointer; padding:0 0 0 6px; font-family:var(--font-sans);
  vertical-align:middle;
}

.progress-composer{ background:var(--bg); border:1px dashed var(--line); border-radius:var(--radius-lg); padding:14px; }
.progress-post-as{ display:flex; align-items:center; gap:10px; font-size:12px; color:var(--text-dim); margin-bottom:10px; flex-wrap:wrap; }
.progress-status-pick-row{ display:flex; gap:7px; margin-bottom:10px; flex-wrap:wrap; }
.progress-status-pick{
  background:var(--panel-raised); border:1px solid var(--line); border-radius:var(--radius-lg); padding:6px 14px;
  font-size:12px; font-weight:600; color:var(--text-dim); cursor:pointer; font-family:var(--font-sans);
  transition:border-color var(--t-fast) ease, color var(--t-fast) ease, background var(--t-fast) ease;
}
.progress-status-pick:hover{ border-color:var(--accent); }
.progress-status-pick.status-waiting.active{ background:var(--yellow); border-color:var(--yellow); color:#fff; }
.progress-status-pick.status-in_progress.active{ background:#2F8FCE; border-color:#2F8FCE; color:#fff; }
.progress-status-pick.status-done.active{ background:var(--green); border-color:var(--green); color:#fff; }
.progress-composer-input{
  width:100%; background:var(--panel); border:1px solid var(--line); border-radius:var(--radius-md); padding:10px 11px;
  font-size:13px; color:var(--text); font-family:var(--font-sans); resize:vertical; margin-bottom:10px;
}
.progress-composer-input:focus{ outline:none; border-color:var(--accent); box-shadow:0 0 0 3px color-mix(in srgb, var(--accent) 16%, transparent); }
.progress-composer-submit{
  display:inline-flex; align-items:center; gap:6px; background:var(--accent); color:var(--accent-ink);
  border:none; border-radius:var(--radius-md); padding:8px 16px; font-size:12.5px; font-weight:700; cursor:pointer;
  font-family:var(--font-sans); transition:filter var(--t-fast) ease;
}
.progress-composer-submit:disabled{ opacity:.4; cursor:not-allowed; }
.progress-composer-submit:not(:disabled):hover{ filter:brightness(1.08); }

@media (max-width:720px){
  .detail-modal{ padding:24px 20px 28px; }
  .detail-body{ grid-template-columns:1fr; }
  .detail-eyebrow{ padding-inline-end:0; }
}
@media (max-width:640px){
  .dash-row{ grid-template-columns:40px 1fr; row-gap:6px; }
}
`;
