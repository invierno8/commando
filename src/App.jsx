import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Home, Package, ClipboardList, Users, Settings, Bell, ChevronLeft, User, Building2, Star,
  Check, X, Flag, RefreshCw, UserCog, MessageSquare, CheckCheck, Inbox, ShieldOff, Network,
} from "lucide-react";
import Catalog from "./Catalog.jsx";
import Tickets from "./Tickets.jsx";
import PermissionsDashboard from "./PermissionsDashboard.jsx";
import BrigadeSetupWizard, { MissionBar } from "./BrigadeSetupWizard.jsx";
import DevDashboard from "./DevDashboard.jsx";
import SystemAdmin from "./SystemAdmin.jsx";
import ThemeToggle from "./ThemeToggle.jsx";
import { THEME_CSS, readStoredTheme, persistTheme } from "./theme.js";
import { STRUCTURAL_ROLES, ROLE_LABELS, ROLE_ORDER } from "./roles.js";
import { randomMemberPersona, DEFAULT_CATEGORIES } from "./opsData.jsx";
import { seedBrigades, BRIGADE_STATUS } from "./brigadesData.js";
import { fetchBrigadeUnits, fetchBrigadeTickets } from "./brigadeStore.js";
import { fetchNotifications, markNotificationsRead, markAllNotificationsRead, NOTIFICATION_TYPES } from "./notificationStore.js";
import { getLedTeam, getMemberTeamInfo, fetchBrigadeTeams } from "./teamStore.js";
import { isBlocked as fetchIsBlocked } from "./blockStore.js";
import UnitEmblem from "./UnitEmblem.jsx";

function ticketBadgeCount(role, tickets, persona, myUnit) {
  switch (role) {
    case STRUCTURAL_ROLES.MEMBER:
      return persona ? tickets.filter((t) => t.unit === persona.unit && t.status === "pending").length : 0;
    case STRUCTURAL_ROLES.UNIT_OFFICER:
      return myUnit ? tickets.filter((t) => t.unit === myUnit && t.status === "pending" && t.teamLeadGate !== "pending").length : 0;
    case STRUCTURAL_ROLES.BRIGADE_OFFICER:
      return tickets.filter((t) => t.status === "approved" && !t.priority).length;
    default:
      return tickets.filter((t) => t.status === "pending").length;
  }
}

const OFFICER_ROLES = [STRUCTURAL_ROLES.UNIT_OFFICER, STRUCTURAL_ROLES.BRIGADE_OFFICER, STRUCTURAL_ROLES.SYSTEM_ADMIN];

/* התראה היא דבר אישי, לא תיבה משותפת לפי תפקיד — כל אדם רואה רק את מה      */
/* שבאמת נוגע אליו: כותב/ת הדרישה, כל אחד מהשותפים שצורפו אליה (אם דרישה    */
/* משוייכת לכמה אנשים, כולם מקבלים את אותה התראה — לא רק הפותח/ת), וקצין    */
/* אמל״ח היחידה שלה. קצין אמל״ח חטיבה/מנהל מערכת רואים תמונה רחבה יותר      */
/* (כל מה שכבר הגיע לטיפולם ברמה החטיבתית) אבל לא אירועי "הוגש" גולמיים —   */
/* אלה עדיין לא הגיעו אליהם: קצין אמל״ח היחידה הוא זה שמקבל עדכון על הגשה,  */
/* וקצין אמל״ח החטיבה מקבל עדכון רק אחרי שהיא כבר אושרה ודורשת ממנו פעולה.  */
function isNotificationRelevant(n, role, persona, myUnit) {
  const personaLabel = persona ? `${persona.rank} ${persona.name}` : null;
  const isCollaborator = !!persona && (n.collaborators || []).some((c) => c.name === persona.name);
  // בקשת ארגון צוות (kind: "teamRequest") רלוונטית לראש הצוות שהגיש אותה
  // (מזוהה לפי requestedBy, לא persona אקראית) ולקצין אמל״ח היחידה שצריך
  // להחליט עליה — לא לקצין אמל״ח חטיבה, בדיוק כמו הגשת דרישה/פריט קטלוג רגילה.
  if (n.kind === "teamRequest") {
    if (role === STRUCTURAL_ROLES.UNIT_OFFICER) return !!myUnit && n.unit === myUnit && n.type === NOTIFICATION_TYPES.SUBMITTED;
    if (role === STRUCTURAL_ROLES.MEMBER) return n.type !== NOTIFICATION_TYPES.SUBMITTED;
    return false;
  }
  switch (role) {
    case STRUCTURAL_ROLES.MEMBER:
      return (!!personaLabel && n.requestedBy === personaLabel) || isCollaborator;
    case STRUCTURAL_ROLES.UNIT_OFFICER:
      return !!myUnit && n.unit === myUnit;
    case STRUCTURAL_ROLES.BRIGADE_OFFICER:
    case STRUCTURAL_ROLES.SYSTEM_ADMIN:
      return n.type !== NOTIFICATION_TYPES.SUBMITTED;
    default:
      return false;
  }
}

const NOTIF_ICON = {
  [NOTIFICATION_TYPES.SUBMITTED]: { Icon: Inbox, tone: "neutral" },
  [NOTIFICATION_TYPES.APPROVED]: { Icon: Check, tone: "green" },
  [NOTIFICATION_TYPES.REJECTED]: { Icon: X, tone: "red" },
  [NOTIFICATION_TYPES.PRIORITIZED]: { Icon: Flag, tone: "yellow" },
  [NOTIFICATION_TYPES.STATUS_CHANGED]: { Icon: RefreshCw, tone: "blue" },
  [NOTIFICATION_TYPES.ASSIGNED]: { Icon: UserCog, tone: "accent" },
  [NOTIFICATION_TYPES.COMMENTED]: { Icon: MessageSquare, tone: "neutral" },
};

function timeAgo(ts) {
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 45) return "עכשיו";
  if (diffSec < 3600) return `לפני ${Math.floor(diffSec / 60)} דק׳`;
  if (diffSec < 86400) return `לפני ${Math.floor(diffSec / 3600)} שע׳`;
  return `לפני ${Math.floor(diffSec / 86400)} ימ׳`;
}

/* מסך "מועדף" — עמוד הבית שכל תפקיד יראה מיד עם הכניסה, נבחר על ידי     */
/* המשתמש עצמו (כוכב ליד פריט התפריט) ונשמר פר-תפקיד, כי אין עדיין      */
/* זהות משתמש אמיתית — התפקיד הוא קרוב המשפחה הכי טוב שיש כרגע.          */
function favoriteKey(role) {
  return `hangar-favorite-view:${role}`;
}
function readFavorite(role) {
  try { return localStorage.getItem(favoriteKey(role)) || null; } catch { return null; }
}
function writeFavorite(role, key) {
  try {
    if (key) localStorage.setItem(favoriteKey(role), key);
    else localStorage.removeItem(favoriteKey(role));
  } catch { /* private browsing / storage disabled */ }
}

/* מצב ניווט נוכחי (תפקיד/חטיבה/מסך/זהות) נשמר כדי שרענון הדפדפן ישאיר    */
/* את המשתמש בדיוק במקום שבו הוא היה — לא קופץ למסך ברירת מחדל אחר.       */
const NAV_STATE_KEY = "hangar-nav-state";
function readNavState() {
  try {
    const raw = JSON.parse(localStorage.getItem(NAV_STATE_KEY));
    return raw && typeof raw === "object" ? raw : {};
  } catch { return {}; }
}
function writeNavState(patch) {
  try {
    localStorage.setItem(NAV_STATE_KEY, JSON.stringify({ ...readNavState(), ...patch }));
  } catch { /* ignore */ }
}

/* חטיף "extra" — כל מה שנוסף מעבר לחמשת הפרמטרים הבסיסיים (תפקיד/פרסונה/  */
/* חטיבה/מרשם חטיבות/מזהה משתמש) מגיע כאובייקט אחד, כדי לא להנפיח את       */
/* חתימת ה-render לעשרות פרמטרים עמדתיים. כולל את רשימת הקטגוריות הגלובלית */
/* (מנוהלת ע״י מנהל מערכת) ואת גשר הניווט הצולב בין מוצר לדרישה —          */
/* crossNav מחזיק כוונה חד-פעמית ("פתח דרישה על הפריט הזה" / "הצג את      */
/* המוצר הזה" / "פתח את הדרישה הזו"), המסך היעד צורך אותה ומנקה אותה.      */
const NAV = [
  { key: "dashboard", label: "דשבורד", icon: Home, dev: true, visibleFor: OFFICER_ROLES, render: (role, persona, brigadeId, brigades, setBrigades, userId, extra) => <DevDashboard brigadeId={brigadeId} role={role} userId={userId} officerUnit={extra.officerUnit} unitLogos={brigades.find((b) => b.id === brigadeId)?.unitLogos} categories={extra.categories} crossNav={extra.crossNav} clearCrossNav={extra.clearCrossNav} requestTicketForItem={extra.requestTicketForItem} viewTicketDetail={extra.viewTicketDetail} /> },
  { key: "catalog", label: "קטלוג אמל״ח", icon: Package, visibleFor: [STRUCTURAL_ROLES.MEMBER, STRUCTURAL_ROLES.UNIT_OFFICER, STRUCTURAL_ROLES.BRIGADE_OFFICER], render: (role, persona, brigadeId, brigades, setBrigades, userId, extra) => <Catalog brigadeId={brigadeId} role={role} persona={persona} userId={userId} officerUnit={extra.officerUnit} effectiveMemberId={extra.effectiveMemberId} ledTeam={extra.ledTeam} categories={extra.categories} crossNav={extra.crossNav} clearCrossNav={extra.clearCrossNav} requestTicketForItem={extra.requestTicketForItem} viewTicketDetail={extra.viewTicketDetail} /> },
  { key: "tickets", label: "דרישות וטיקטים", icon: ClipboardList, render: (role, persona, brigadeId, brigades, setBrigades, userId, extra) => <Tickets role={role} persona={persona} brigadeId={brigadeId} userId={userId} officerUnit={extra.officerUnit} effectiveMemberId={extra.effectiveMemberId} ledTeam={extra.ledTeam} unitLogos={brigades.find((b) => b.id === brigadeId)?.unitLogos} categories={extra.categories} crossNav={extra.crossNav} clearCrossNav={extra.clearCrossNav} viewCatalogItem={extra.viewCatalogItem} /> },
  { key: "permissions", label: "ניהול הרשאות", icon: Users, visibleFor: OFFICER_ROLES, render: (role, persona, brigadeId, brigades, setBrigades, userId, extra) => <PermissionsDashboard role={role} brigadeId={brigadeId} brigadeName={brigades.find((b) => b.id === brigadeId)?.name} unitLogos={brigades.find((b) => b.id === brigadeId)?.unitLogos} officerUnit={extra.officerUnit} persona={persona} effectiveMemberId={extra.effectiveMemberId} ledTeam={extra.ledTeam} viewTicketDetail={extra.viewTicketDetail} viewCatalogItem={extra.viewCatalogItem} /> },
  { key: "wizard", label: "אשף התקנה", icon: Settings, visibleFor: [STRUCTURAL_ROLES.BRIGADE_OFFICER], render: (role, persona, brigadeId, brigades, setBrigades) => <BrigadeSetupWizard brigadeId={brigadeId} brigades={brigades} setBrigades={setBrigades} /> },
  { key: "sysadmin", label: "ניהול מערכת", icon: Building2, visibleFor: [STRUCTURAL_ROLES.SYSTEM_ADMIN], render: (role, persona, brigadeId, brigades, setBrigades, userId, extra) => <SystemAdmin brigades={brigades} setBrigades={setBrigades} categories={extra.categories} setCategories={extra.setCategories} userId={userId} /> },
];

export default function App() {
  const [role, setRole] = useState(() => readNavState().role || STRUCTURAL_ROLES.MEMBER);
  const [brigades, setBrigades] = useState(seedBrigades);
  const [brigadeId, setBrigadeId] = useState(() => {
    const stored = readNavState().brigadeId;
    return stored && seedBrigades.some((b) => b.id === stored) ? stored : seedBrigades[0].id;
  });
  const [persona, setPersona] = useState(randomMemberPersona);
  const [view, setView] = useState(() => {
    const stored = readNavState();
    return stored.view || readFavorite(stored.role || STRUCTURAL_ROLES.MEMBER) || "catalog";
  });
  const [favoriteView, setFavoriteView] = useState(() => readFavorite(readNavState().role || STRUCTURAL_ROLES.MEMBER));
  const [userId, setUserId] = useState(() => readNavState().userId || "");
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [crossNav, setCrossNav] = useState(null);
  const [theme, setTheme] = useState(readStoredTheme);
  const [now, setNow] = useState(new Date());
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [ticketsForBadge, setTicketsForBadge] = useState([]);
  const [brigadeUnits, setBrigadeUnits] = useState([]);
  // באיזו יחידה "מחזיק" קצין אמל״ח היחידה המדומה — ניתן לבחירה ולא קבוע
  // תמיד ליחידה הראשונה, כי חבר/ת יחידה מדומה מקבל/ת יחידה אקראית בכל
  // הגרלה מחדש (rerollPersona), ובלי בורר כאן, לרוב הן פשוט לא מתאימות —
  // וזו בדיוק הסיבה שקצין יחידה "לא רואה" בקשות שחברי היחידה שלו פתחו.
  const [officerUnit, setOfficerUnit] = useState("");
  const [notifications, setNotifications] = useState([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [devPanelOpen, setDevPanelOpen] = useState(false);
  const [ledTeam, setLedTeam] = useState(null);
  const [myTeamInfo, setMyTeamInfo] = useState(null);
  const [myBlock, setMyBlock] = useState(null);
  const [devTeams, setDevTeams] = useState([]);
  // מצב הזהות של חבר יחידה בבורר הפיתוח — "random" (הגרלה רגילה, ברירת
  // המחדל), "lead" (התחזות לראש צוות קיים) או "teamMember" (התחזות לחבר
  // תת-צוות קיים) — ראו ה"בורר תפקיד/חטיבה" למטה. מתאפס ל-random בכל הגרלה
  // אוטומטית (rerollPersona) כדי שלא יישאר "תקוע" על זהות מדומה מהתפקיד הקודם.
  const [memberIdentityMode, setMemberIdentityMode] = useState("random");

  const currentBrigade = brigades.find((b) => b.id === brigadeId) || brigades[0];

  async function rerollPersona(forBrigadeId) {
    const units = await fetchBrigadeUnits(forBrigadeId);
    setPersona(randomMemberPersona(units));
    setMemberIdentityMode("random");
    setUserId("");
  }

  function becomeRandomMember(unit) {
    setMemberIdentityMode("random");
    setUserId("");
    setPersona(randomMemberPersona(unit ? [unit] : brigadeUnits));
  }
  function becomeTeamLead(team) {
    setMemberIdentityMode("lead");
    setPersona({ rank: team.leadRank, name: team.leadName, personalNumber: team.leadPersonalNumber, unit: team.unit });
    setUserId(team.leadPersonalNumber);
  }
  function becomeTeamMember(entry) {
    setMemberIdentityMode("teamMember");
    setPersona({ rank: "טוראי", name: `חבר ${entry.subteamName}`, personalNumber: entry.identifier, unit: entry.unit });
    setUserId(entry.identifier);
  }

  function chooseRole(r) {
    setRole(r);
    if (r === STRUCTURAL_ROLES.MEMBER) rerollPersona(brigadeId);
  }

  function chooseBrigade(id) {
    setBrigadeId(id);
    if (role === STRUCTURAL_ROLES.MEMBER) rerollPersona(id);
  }

  /* גשר הניווט הצולב בין מוצר לדרישה — "למה המשתמש הגיע לכאן?" הוא בדיוק  */
  /* השאלה שהפיצ׳רים האלה עונים עליה: מתעודת הזהות של פריט אפשר לפתוח     */
  /* ישירות דרישת תיקון/הצטיידות שכבר מקושרת אליו, ומתוך דרישה מקושרת      */
  /* אפשר לקפוץ ישירות לתעודת הזהות של הפריט או לפרטי דרישה אחרת שנמצאה.   */
  function requestTicketForItem(item, ticketType) {
    setCrossNav({ kind: "ticketDraft", draft: { type: ticketType, linkedProductId: item.id, linkedProductName: item.name, linkedProductCategory: item.category } });
    setView("tickets");
  }
  function viewCatalogItem(itemId) {
    setCrossNav({ kind: "catalogItem", itemId });
    setView("catalog");
  }
  function viewTicketDetail(ticketId) {
    setCrossNav({ kind: "ticketDetail", ticketId });
    setView("tickets");
  }
  function clearCrossNav() {
    setCrossNav(null);
  }

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    persistTheme(theme);
  }, [theme]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // אין עדיין ערוץ push אמיתי — הפעמון "מתעדכן חי" על ידי רענון קריאת
  // ההתראות (מבנה זיכרון בלבד, ראו notificationStore.js) בכל טיק של השעון
  // שכבר קיים למעלה, בדיוק כמו ה"עודכן לאחרונה" שמופיע בכל מסך.
  useEffect(() => {
    let cancelled = false;
    fetchNotifications(brigadeId).then((list) => { if (!cancelled) setNotifications(list); });
    return () => { cancelled = true; };
  }, [brigadeId, now]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchBrigadeTickets(brigadeId), fetchBrigadeUnits(brigadeId)]).then(([tickets, units]) => {
      if (cancelled) return;
      setTicketsForBadge(tickets);
      setBrigadeUnits(units);
      setOfficerUnit((prev) => (prev && units.includes(prev) ? prev : units[0] || ""));
    });
    return () => { cancelled = true; };
  }, [brigadeId]);

  // "זהות אמיתית" לצורך בדיקות שתלויות באדם הספציפי (ראש צוות / חסימה) —
  // ל-MEMBER יש persona אקראית לגמרי בכל הגרלה, אז אם מולאה בכוונה תעודת
  // זהות (userId) היא זו שקובעת; אחרת נופלים חזרה למספר האישי המדומה.
  const effectiveMemberId = role === STRUCTURAL_ROLES.MEMBER ? (userId || persona?.personalNumber) : userId;
  const unitForGate = role === STRUCTURAL_ROLES.MEMBER ? persona?.unit : (officerUnit || brigadeUnits[0]);

  useEffect(() => {
    let cancelled = false;
    if (role !== STRUCTURAL_ROLES.MEMBER || !effectiveMemberId) { setLedTeam(null); return; }
    getLedTeam(brigadeId, effectiveMemberId).then((t) => { if (!cancelled) setLedTeam(t); });
    return () => { cancelled = true; };
  }, [brigadeId, role, effectiveMemberId]);

  // חברות רגילה בתת-צוות (לא ראש צוות) — נבדקת בנפרד מ-ledTeam, כי מי שאינו
  // ראש צוות עדיין עשוי להיות "משוייך לצוות" (ראו סמל הצוות בסיידבר למטה).
  useEffect(() => {
    let cancelled = false;
    if (role !== STRUCTURAL_ROLES.MEMBER || !effectiveMemberId) { setMyTeamInfo(null); return; }
    getMemberTeamInfo(brigadeId, { personalNumber: effectiveMemberId, fullName: persona ? `${persona.rank} ${persona.name}` : null })
      .then((info) => { if (!cancelled) setMyTeamInfo(info); });
    return () => { cancelled = true; };
  }, [brigadeId, role, effectiveMemberId, persona]);

  // רשימת הצוותים בחטיבה הנוכחית — לצורך בורר "התחזות" בפאנל הפיתוח בלבד
  // (ראש צוות / חבר צוות קיימים), לא נצרכת על ידי שום מסך תפעולי. תלויה גם
  // ב-now (אותו טיק שכבר מרענן התראות) כדי להישאר מסונכרנת כשצוותים
  // נוצרים/נמחקים במסך ניהול הרשאות באותה סשן — בלי זה הבורר נשאר "תקוע"
  // עם רשימה ישנה עד החלפת חטיבה.
  useEffect(() => {
    let cancelled = false;
    fetchBrigadeTeams(brigadeId).then((t) => { if (!cancelled) setDevTeams(t); });
    return () => { cancelled = true; };
  }, [brigadeId, now]);

  const teamMemberOptions = useMemo(() => {
    const out = [];
    devTeams.forEach((t) => t.subteams.forEach((s) => s.members.forEach((m) => {
      out.push({ identifier: m.identifier, teamName: t.name, subteamName: s.name, unit: t.unit });
    })));
    return out;
  }, [devTeams]);

  // שער חסימה — נבדק רק עבור חייל/קצין אמל״ח יחידה (מי שבאמת "בתוך" יחידה),
  // לא עבור קציני אמל״ח חטיבה/מנהלי מערכת שמנהלים את החסימות עצמן.
  useEffect(() => {
    let cancelled = false;
    if (!(role === STRUCTURAL_ROLES.MEMBER || role === STRUCTURAL_ROLES.UNIT_OFFICER) || !effectiveMemberId) { setMyBlock(null); return; }
    fetchIsBlocked(brigadeId, effectiveMemberId, unitForGate).then((b) => { if (!cancelled) setMyBlock(b); });
    return () => { cancelled = true; };
  }, [brigadeId, role, effectiveMemberId, unitForGate]);

  const isTeamLead = role === STRUCTURAL_ROLES.MEMBER && !!ledTeam;
  // הזהות שמוצגת בסיידבר — חטיבה תמיד, יחידה רק לתפקיד ששייך בפועל ליחידה
  // אחת (חייל / קצין אמל״ח יחידה — לא קצין אמל״ח חטיבה/מנהל מערכת), וסמל
  // צוות רק אם המשתמש משוייך לצוות *וללצוות יש לוגו* — אחרת מציגים עד היחידה.
  const sidebarUnitName = role === STRUCTURAL_ROLES.MEMBER ? persona?.unit : role === STRUCTURAL_ROLES.UNIT_OFFICER ? (officerUnit || brigadeUnits[0]) : null;
  const identityTeam = ledTeam || myTeamInfo?.team || null;
  const visibleNav = useMemo(
    () => NAV.filter((n) => !n.visibleFor || n.visibleFor.includes(role) || (n.key === "permissions" && isTeamLead)),
    [role, isTeamLead]
  );
  const ticketsBadge = useMemo(
    () => ticketBadgeCount(role, ticketsForBadge, persona, officerUnit || brigadeUnits[0]),
    [role, ticketsForBadge, persona, officerUnit, brigadeUnits]
  );

  const myUnitForNotif = role === STRUCTURAL_ROLES.UNIT_OFFICER ? (officerUnit || brigadeUnits[0]) : persona?.unit;
  const relevantNotifications = useMemo(
    () => notifications.filter((n) => isNotificationRelevant(n, role, persona, myUnitForNotif)),
    [notifications, role, persona, myUnitForNotif]
  );
  const unreadNotifCount = useMemo(() => relevantNotifications.filter((n) => !n.read).length, [relevantNotifications]);

  function openNotification(n) {
    markNotificationsRead(brigadeId, [n.id]).then(() => fetchNotifications(brigadeId).then(setNotifications));
    if (n.kind === "catalogItem") viewCatalogItem(n.itemId);
    else if (n.kind === "teamRequest") setView("permissions");
    else viewTicketDetail(n.ticketId);
    setNotifOpen(false);
  }
  function markAllNotifsRead() {
    markAllNotificationsRead(brigadeId).then(() => fetchNotifications(brigadeId).then(setNotifications));
  }

  const isFirstRoleEffect = useRef(true);
  useEffect(() => {
    const fav = readFavorite(role);
    setFavoriteView(fav);
    if (isFirstRoleEffect.current) {
      // טעינה ראשונה של הדף (כולל רענון) — נשארים בדיוק על המסך שהיה שמור,
      // לא קופצים למועדף. קופצים למועדף רק כשמחליפים תפקיד בפועל למטה.
      isFirstRoleEffect.current = false;
      if (!visibleNav.some((n) => n.key === view)) {
        setView(fav && visibleNav.some((n) => n.key === fav) ? fav : (visibleNav[0]?.key || "tickets"));
      }
      return;
    }
    if (fav && visibleNav.some((n) => n.key === fav)) {
      setView(fav);
    } else if (!visibleNav.some((n) => n.key === view)) {
      setView(visibleNav[0]?.key || "tickets");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  useEffect(() => { writeNavState({ role }); }, [role]);
  useEffect(() => { writeNavState({ brigadeId }); }, [brigadeId]);
  useEffect(() => { writeNavState({ view }); }, [view]);
  useEffect(() => { writeNavState({ userId }); }, [userId]);

  function toggleFavorite(key, e) {
    e.stopPropagation();
    const next = favoriteView === key ? null : key;
    setFavoriteView(next);
    writeFavorite(role, next);
  }

  const active = visibleNav.find((n) => n.key === view) || visibleNav[0];
  const currentUserName = role === STRUCTURAL_ROLES.MEMBER ? `${persona.rank} ${persona.name}` : "משתמש הדגמה";

  return (
    <div dir="rtl" className="app-shell">
      <style>{THEME_CSS}</style>
      <div className="app-glow" aria-hidden="true" />

      <aside className={"app-sidebar" + (sidebarOpen ? " expanded" : "")}>
        <div className="sidebar-mark">HGR</div>
        {(currentBrigade || sidebarUnitName) && (
          <div className="sidebar-identity">
            {currentBrigade && (
              <div className="sidebar-identity-item" title={currentBrigade.name}>
                <UnitEmblem name={currentBrigade.name} size={sidebarOpen ? 26 : 22} showRing={false} image={currentBrigade.logo} />
                {sidebarOpen && <span className="sidebar-identity-label">{currentBrigade.name}</span>}
              </div>
            )}
            {sidebarUnitName && (
              <div className="sidebar-identity-item" title={sidebarUnitName}>
                <UnitEmblem name={sidebarUnitName} size={sidebarOpen ? 22 : 19} showRing={false} image={currentBrigade?.unitLogos?.[sidebarUnitName]} />
                {sidebarOpen && <span className="sidebar-identity-label">{sidebarUnitName}</span>}
              </div>
            )}
            {sidebarUnitName && identityTeam?.logo && (
              <div className="sidebar-identity-item" title={identityTeam.name}>
                <img className="sidebar-identity-team-img" src={identityTeam.logo} alt="" />
                {sidebarOpen && <span className="sidebar-identity-label">{identityTeam.name}</span>}
              </div>
            )}
          </div>
        )}
        <nav className="sidebar-nav">
          {visibleNav.map((n) => {
            const Icon = n.icon;
            return (
              <button
                key={n.key}
                className={"sidebar-btn" + (view === n.key ? " active" : "")}
                title={n.label}
                onClick={() => setView(n.key)}
              >
                <span className="sidebar-btn-icon-wrap">
                  <Icon size={19} />
                  {n.key === "tickets" && ticketsBadge > 0 && (
                    <span className="sidebar-btn-badge">{ticketsBadge > 99 ? "99+" : ticketsBadge}</span>
                  )}
                </span>
                <span className="sidebar-btn-label">
                  {n.label}
                  {n.key === "tickets" && ticketsBadge > 0 && (
                    <span className="sidebar-btn-badge-inline">{ticketsBadge > 99 ? "99+" : ticketsBadge}</span>
                  )}
                </span>
                <span
                  className={"sidebar-btn-fav" + (favoriteView === n.key ? " active" : "")}
                  onClick={(e) => toggleFavorite(n.key, e)}
                  title={favoriteView === n.key ? "הסרה מעמוד הבית" : "הגדרה כעמוד הבית"}
                  role="button"
                  tabIndex={-1}
                >
                  <Star size={13} />
                </span>
                {n.dev && <span className="sidebar-btn-dev-dot" title="DEV בלבד" />}
              </button>
            );
          })}
        </nav>
        <div className="sidebar-spacer" />
        <button className="sidebar-toggle" onClick={() => setSidebarOpen((o) => !o)} title="הרחבת תפריט">
          <ChevronLeft size={16} />
        </button>
      </aside>

      <div className="app-main-col">
        <div className="app-topbar">
          <div className="app-topbar-title">
            <div>
              <h1>{active?.label}</h1>
              <div className="app-topbar-crumb">HANGAR · {currentBrigade?.name}</div>
            </div>
          </div>

          <div className="app-topbar-right">
            <div className="notif-menu" tabIndex={-1} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setNotifOpen(false); }}>
              <button className="icon-btn" title="התראות" onClick={() => setNotifOpen((v) => !v)}>
                <Bell size={16} />
                {unreadNotifCount > 0 && <span className="icon-btn-dot">{unreadNotifCount > 99 ? "99+" : unreadNotifCount}</span>}
              </button>
              {notifOpen && (
                <div className="notif-dropdown">
                  <div className="notif-dropdown-head">
                    <span>התראות</span>
                    {unreadNotifCount > 0 && (
                      <button type="button" className="notif-mark-all" onClick={markAllNotifsRead}>
                        <CheckCheck size={12} /> סמן הכל כנקרא
                      </button>
                    )}
                  </div>
                  {relevantNotifications.length === 0 ? (
                    <div className="notif-empty">אין התראות חדשות כרגע.</div>
                  ) : (
                    <div className="notif-list">
                      {relevantNotifications.slice(0, 20).map((n) => {
                        const cfg = NOTIF_ICON[n.type] || NOTIF_ICON[NOTIFICATION_TYPES.COMMENTED];
                        const Icon = cfg.Icon;
                        return (
                          <button type="button" key={n.id} className={"notif-item" + (n.read ? "" : " unread")} onClick={() => openNotification(n)}>
                            <span className={"notif-item-icon tone-" + cfg.tone}><Icon size={13} /></span>
                            <span className="notif-item-body">
                              <span className="notif-item-msg">{n.message}</span>
                              <span className="notif-item-meta">
                                <i className="notif-item-id">{n.kind === "catalogItem" ? n.itemId : n.ticketId}</i>
                                <span>· {timeAgo(n.ts)}</span>
                              </span>
                            </span>
                            {!n.read && <span className="notif-item-dot" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
            <ThemeToggle theme={theme} setTheme={setTheme} />
            <div className="user-chip">
              <div className="user-chip-text">
                <div className="user-chip-name">{currentUserName}</div>
                <div className="user-chip-role">{ROLE_LABELS[role]}</div>
              </div>
              <div className="user-avatar"><User size={17} /></div>
            </div>
          </div>
        </div>

        {currentBrigade && (
          <div className="app-mission-strip">
            <MissionBar brigade={currentBrigade} />
          </div>
        )}

        <div className="env-strip">
          <span>
            <span className="env-strip-tag">DEV</span>{" "}
            סביבת פיתוח / דמו — נתונים מדומים, אינם מחוברים למקור אמת מבצעי
          </span>
          <span className="env-strip-clock">
            עדכון אחרון: {now.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </span>
        </div>

        <div className="app-body">
          {myBlock ? (
            <div className="blocked-gate panel-card">
              <ShieldOff size={34} />
              <h2>הגישה למערכת חסומה</h2>
              <p>{myBlock.blockedBy} חסם/ה את הגישה שלך {myBlock.scope === "brigade" ? "ברמת החטיבה" : `ביחידת ${myBlock.unit}`}.</p>
              <div className="blocked-gate-reason">סיבה: {myBlock.reason}</div>
              <span className="blocked-gate-hint">פנה/י לקצין אמל״ח היחידה/החטיבה לבירור. (סביבת פיתוח — ניתן להחליף תפקיד/זהות מהבורר הצף.)</span>
            </div>
          ) : (
            active && active.render(role, persona, brigadeId, brigades, setBrigades, userId, {
              categories, setCategories, crossNav, clearCrossNav, requestTicketForItem, viewCatalogItem, viewTicketDetail,
              officerUnit: officerUnit || brigadeUnits[0], effectiveMemberId, ledTeam,
            })
          )}
        </div>
      </div>

      {/* בורר תפקיד/חטיבה של סביבת הפיתוח — מנוי צף בפינה הימנית-תחתונה,       */}
      {/* לא רצועה קבועה שתופסת מקום בראש כל מסך. זהו כלי דמו/פיתוח בלבד       */}
      {/* (בפרודקשן הזהות תגיע מה-SSO), ולכן ה"dev-only" נשאר גם כאן.          */}
      <div className="dev-fab-wrap" tabIndex={-1} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDevPanelOpen(false); }}>
        {devPanelOpen && (
          <div className="dev-fab-panel dev-only">
            <span className="dev-only-tag">DEV — סימולציית תפקיד וחטיבה</span>
            <div className="pill-tabs">
              {ROLE_ORDER.map((r) => (
                <button
                  key={r}
                  className={"pill-tab" + (role === r ? " active" : "")}
                  style={{ padding: "5px 11px", fontSize: 12 }}
                  onClick={() => chooseRole(r)}
                >
                  {ROLE_LABELS[r]}
                </button>
              ))}
            </div>
            <div className="pill-tabs" style={{ marginTop: 6 }}>
              {brigades.map((b) => (
                <button
                  key={b.id}
                  className={"pill-tab" + (brigadeId === b.id ? " active" : "")}
                  style={{ padding: "5px 11px", fontSize: 12 }}
                  onClick={() => chooseBrigade(b.id)}
                  title={b.status === BRIGADE_STATUS.PENDING ? "חטיבה ממתינה להקמה — ללא נתונים עדיין" : undefined}
                >
                  {b.name}{b.status === BRIGADE_STATUS.PENDING ? " (ממתינה)" : ""}
                </button>
              ))}
            </div>
            {role === STRUCTURAL_ROLES.MEMBER && (
              <div className="env-strip-member-block">
                <span className="env-strip-persona">
                  מחובר כ: {persona.rank} {persona.name} · {persona.unit}
                </span>
                <div className="pill-tabs member-identity-tabs">
                  <button type="button" className={"pill-tab" + (memberIdentityMode === "random" ? " active" : "")} onClick={() => becomeRandomMember()}>חייל רגיל</button>
                  <button type="button" className={"pill-tab" + (memberIdentityMode === "lead" ? " active" : "")} onClick={() => setMemberIdentityMode("lead")}>ראש צוות</button>
                  <button type="button" className={"pill-tab" + (memberIdentityMode === "teamMember" ? " active" : "")} onClick={() => setMemberIdentityMode("teamMember")}>חבר צוות</button>
                </div>
                {memberIdentityMode === "random" && brigadeUnits.length > 1 && (
                  <label className="env-strip-identity officer-unit-pick">
                    <span>יחידה לחייל רגיל</span>
                    <select value={persona.unit} onChange={(e) => becomeRandomMember(e.target.value)}>
                      {brigadeUnits.map((u) => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </label>
                )}
                {memberIdentityMode === "lead" && (
                  devTeams.length === 0 ? (
                    <span className="env-strip-hint">אין עדיין צוותים בחטיבה זו — ניתן ליצור דרך ניהול הרשאות ← עץ ארגוני.</span>
                  ) : (
                    <label className="env-strip-identity officer-unit-pick">
                      <span>בחירת צוות להתחזות כראש שלו</span>
                      <select value={ledTeam?.id || ""} onChange={(e) => { const t = devTeams.find((tt) => tt.id === e.target.value); if (t) becomeTeamLead(t); }}>
                        <option value="">בחר/י צוות...</option>
                        {devTeams.map((t) => <option key={t.id} value={t.id}>{t.name} — {t.unit}</option>)}
                      </select>
                    </label>
                  )
                )}
                {memberIdentityMode === "teamMember" && (
                  teamMemberOptions.length === 0 ? (
                    <span className="env-strip-hint">אין עדיין חברי תת-צוות בחטיבה זו.</span>
                  ) : (
                    <label className="env-strip-identity officer-unit-pick">
                      <span>בחירת חבר צוות להתחזות אליו</span>
                      <select value={userId} onChange={(e) => { const entry = teamMemberOptions.find((o) => o.identifier === e.target.value); if (entry) becomeTeamMember(entry); }}>
                        <option value="">בחר/י חבר צוות...</option>
                        {teamMemberOptions.map((o, i) => <option key={o.identifier + i} value={o.identifier}>{o.identifier} — {o.teamName}/{o.subteamName} ({o.unit})</option>)}
                      </select>
                    </label>
                  )
                )}
              </div>
            )}
            {role === STRUCTURAL_ROLES.UNIT_OFFICER && brigadeUnits.length > 1 && (
              <label className="env-strip-identity officer-unit-pick">
                <span>יחידה — לאיזו יחידה קצין האמל״ח שייך (חברי יחידה מדומים מקבלים יחידה אקראית, לכן זה לא תמיד מסתנכרן לבד)</span>
                <select value={officerUnit || brigadeUnits[0]} onChange={(e) => setOfficerUnit(e.target.value)}>
                  {brigadeUnits.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </label>
            )}
            <label className="env-strip-identity">
              <span>
                {role === STRUCTURAL_ROLES.MEMBER
                  ? "מספר אישי אמיתי (אופציונלי) — דורס את הפרסונה האקראית, כדי לבדוק זיהוי כראש צוות או חסימה"
                  : "זיהוי משתמש (מ.א.) — פריסת הדשבורד האישית שלך עוברת איתך בין מכשירים"}
              </span>
              <input
                value={userId}
                onChange={(e) => setUserId(e.target.value.replace(/\D/g, ""))}
                placeholder="לדוגמה: 7134209"
                inputMode="numeric"
              />
            </label>
            {isTeamLead && (
              <span className="env-strip-persona"><Network size={12} style={{ verticalAlign: "-2px" }} /> מזוהה כראש צוות: {ledTeam.name}</span>
            )}
          </div>
        )}
        <button type="button" className="dev-fab" onClick={() => setDevPanelOpen((v) => !v)} title="בורר תפקיד/חטיבה (DEV)">
          <span className="dev-fab-tag">DEV</span>
          <ChevronLeft size={14} className={"dev-fab-arrow" + (devPanelOpen ? " open" : "")} />
        </button>
      </div>
    </div>
  );
}
