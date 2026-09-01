import React, { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar, Cell,
} from "recharts";
import {
  Boxes, ClipboardList, Activity, TrendingUp, ChevronLeft, ListTree, Gauge, ShieldCheck, Timer,
  PieChart as PieChartIcon, History, EyeOff, Plus, RotateCcw, Wrench, Wallet, LayoutGrid,
} from "lucide-react";
import UnitEmblem from "../components/UnitEmblem.jsx";
import ScopePicker, { ALL_SCOPE, SCOPE_PICKER_CSS } from "../components/ScopePicker.jsx";
import PhotoTile from "../components/PhotoTile.jsx";
import ProductDossier from "./ProductDossier.jsx";
import Loading from "../components/Loading.jsx";
import SearchBar from "../components/SearchBar.jsx";
import FilterSelect from "../components/FilterSelect.jsx";
import { matchesSearch } from "../search.js";
import { StatusPill, STATUS_LABEL, TICKET_TYPE_LABELS } from "../opsData.jsx";
import { avgMinutesBetween, formatDuration, categoryBreakdown, breakdownBy, repairLeaderboard, procurementPendingCost } from "../analytics.js";
import { fetchUserPref, saveUserPref, clearUserPref } from "../api-client/userPrefsStore.js";
import { STRUCTURAL_ROLES } from "../roles.js";
import { fetchBrigadeUnits, fetchBrigadeCatalog, fetchBrigadeTickets, fetchBrigadeDashboard } from "../api-client/brigadeStore.js";

const STATUS_FILTER_OPTIONS = Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label }));

/* ================================================================== */
/* LEGO BLOCK — design tokens shared with the rest of the system.      */
/* ================================================================== */

const TOKENS = {
  panel: "var(--panel)", line: "var(--line)", text: "var(--text)", textDim: "var(--text-dim)",
  accent: "var(--accent)", green: "var(--green)", yellow: "var(--yellow)", red: "var(--red)",
};

/* ================================================================== */
/* LEGO BLOCK — widget registry. Every dashboard section is a "widget": */
/* a title/icon/size + which roles get it by default. The dashboard is  */
/* not a fixed report — each role gets a sensible starting preset (the  */
/* question their level actually needs answered), and every user can    */
/* drag to reorder, hide, and re-add widgets; that layout is saved      */
/* per-role in localStorage, same spirit as a real product dashboard.   */
/* ================================================================== */

const { UNIT_OFFICER, BRIGADE_OFFICER, SYSTEM_ADMIN } = STRUCTURAL_ROLES;
const OFFICER_PLUS = [UNIT_OFFICER, BRIGADE_OFFICER, SYSTEM_ADMIN];
const BRIGADE_PLUS = [BRIGADE_OFFICER, SYSTEM_ADMIN];
// ווידג'טים שמציגים פריטי קטלוג/דרישות ספציפיים או פעילות ברמת קצין/יחידה —
// מנהל מערכת רואה רק תמונת מצב כללית ומצטברת של החטיבה, לא את הפרטים
// הספציפיים שקצין אמל״ח או יחידה רואים.
const OFFICER_NO_ADMIN = [UNIT_OFFICER, BRIGADE_OFFICER];

const WIDGET_DEFS = {
  kpis: { title: "מדדים כלליים — כלל החטיבה", icon: Gauge, size: "full", roles: BRIGADE_PLUS },
  unitSummary: { title: "תמונת מצב — היחידה שלך", icon: ShieldCheck, size: "full", roles: [UNIT_OFFICER] },
  equipment: { title: "מצב ציוד", icon: Boxes, size: "full", roles: OFFICER_NO_ADMIN },
  openRequests: { title: "בקשות פתוחות", icon: ClipboardList, size: "half", roles: OFFICER_NO_ADMIN },
  readiness: { title: "מוכנות מערכת", icon: Activity, size: "half", roles: BRIGADE_PLUS },
  trend: { title: "מגמת דרישות — 14 יום אחרונים", icon: TrendingUp, size: "half", roles: OFFICER_PLUS },
  priority: { title: "תיעדוף דרישות מאושרות", icon: ListTree, size: "half", roles: BRIGADE_PLUS },
  responseTime: { title: "זמן מענה ממוצע", icon: Timer, size: "half", roles: OFFICER_PLUS },
  categoryAnalytics: { title: "התפלגות קטגוריות", icon: PieChartIcon, size: "half", roles: OFFICER_PLUS },
  ticketTypes: { title: "התפלגות סוגי דרישות", icon: LayoutGrid, size: "half", roles: OFFICER_PLUS },
  repairLeaderboard: { title: "פריטים עם תקלות חוזרות", icon: Wrench, size: "half", roles: OFFICER_NO_ADMIN },
  procurementCost: { title: "עלות רכש ממתינה", icon: Wallet, size: "half", roles: BRIGADE_PLUS },
  activityLog: { title: "יומן פעילות אחרון", icon: History, size: "full", roles: OFFICER_NO_ADMIN },
};

const DEFAULT_PRESETS = {
  [UNIT_OFFICER]: ["unitSummary", "openRequests", "responseTime", "categoryAnalytics", "ticketTypes", "repairLeaderboard", "trend", "equipment", "activityLog"],
  [BRIGADE_OFFICER]: ["kpis", "trend", "priority", "responseTime", "categoryAnalytics", "ticketTypes", "procurementCost", "repairLeaderboard", "openRequests", "readiness", "equipment", "activityLog"],
  [SYSTEM_ADMIN]: ["kpis", "trend", "priority", "responseTime", "categoryAnalytics", "ticketTypes", "procurementCost", "readiness"],
};

// הפריסה נשמרת פר-משתמש (userPrefsStore.js, לפי מספר אישי), לא פר-מכשיר
// ולא פר-תפקיד גרידא: התפקיד קובע רק את הפריסט ההתחלתי (מה שכל מי
// שמחזיק בתפקיד הזה רואה כברירת מחדל) — ברגע שמשתמש ספציפי גורר/מסתיר
// ווידג'ט, זו התאמה אישית שלו, שעוברת איתו לכל מחשב שהוא יתחבר ממנו.
function layoutNamespace(role) {
  return `dashboard-layout:${role}`;
}

function defaultLayout(role) {
  const allowedKeys = Object.keys(WIDGET_DEFS).filter((k) => WIDGET_DEFS[k].roles.includes(role));
  const preset = (DEFAULT_PRESETS[role] || allowedKeys).filter((k) => allowedKeys.includes(k));
  const hidden = allowedKeys.filter((k) => !preset.includes(k));
  return { order: preset, hidden };
}

function reconcileLayout(role, saved) {
  const allowedKeys = Object.keys(WIDGET_DEFS).filter((k) => WIDGET_DEFS[k].roles.includes(role));
  if (!saved || !Array.isArray(saved.order)) return defaultLayout(role);
  const order = saved.order.filter((k) => allowedKeys.includes(k));
  const missing = allowedKeys.filter((k) => !order.includes(k) && !(saved.hidden || []).includes(k));
  const hidden = (saved.hidden || []).filter((k) => allowedKeys.includes(k));
  return { order: [...order, ...missing], hidden };
}

/* ================================================================== */
/* LEGO BLOCK — derive everything from a single scope value, on top of */
/* whatever this brigade's dashboard dataset resolved from the store.  */
/* ================================================================== */

function getScopedData(scope, units, dash) {
  const scopedUnits = scope === ALL_SCOPE ? units : [scope];
  const rows = dash.ticketsByUnit.filter((r) => scopedUnits.includes(r.unit));

  const totals = rows.reduce(
    (acc, r) => ({ approved: acc.approved + r.approved, pending: acc.pending + r.pending, rejected: acc.rejected + r.rejected }),
    { approved: 0, pending: 0, rejected: 0 }
  );

  const priorityMap = { red: TOKENS.red, yellow: TOKENS.yellow, green: TOKENS.green };
  const priorityBreakdown = scopedUnits
    .flatMap((u) => dash.priorityByUnit[u] || [])
    .reduce((acc, p) => {
      const existing = acc.find((a) => a.key === p.key);
      if (existing) existing.value += p.value;
      else acc.push({ ...p });
      return acc;
    }, [])
    .sort((a, b) => (a.key === "red" ? -1 : b.key === "red" ? 1 : a.key === "yellow" ? -1 : 1))
    .map((p) => ({ ...p, color: priorityMap[p.key] }));

  const trend = dash.trendDays.map((d, i) => {
    const opened = scopedUnits.reduce((sum, u) => sum + (dash.trendByUnit[u]?.[i] || 0), 0);
    const approved = Math.round(opened * 0.78);
    // "הוזמן" = מתוך הדרישות שאושרו, אלו שכבר הפכו בפועל להזמנת רכש —
    // אותה לוגיקת יחס-קבוע כמו approved/rejected למעלה, כדי לשמור על
    // תצוגת דמו עקבית עד שיהיה מקור נתונים אמיתי להזמנות בפועל.
    return { d, opened, approved, ordered: Math.round(approved * 0.7), rejected: Math.round(opened * 0.12) };
  });

  const activity = scope === ALL_SCOPE ? dash.activityLog : dash.activityLog.filter((a) => a.unit === scope);
  const last7 = trend.slice(-7);
  const trendChangePct = last7.length >= 2
    ? Math.round(((last7[last7.length - 1].opened - last7[0].opened) / Math.max(1, last7[0].opened)) * 100)
    : 0;

  return {
    total: totals.approved + totals.pending + totals.rejected,
    totals, priorityBreakdown, trend, activity, trendChangePct,
  };
}

function conditionFor(qty) {
  if (qty >= 40) return { label: "תקין", tone: "green" };
  if (qty >= 10) return { label: "מוגבל", tone: "yellow" };
  return { label: "קריטי", tone: "red" };
}

function tooltipStyle() {
  return {
    contentStyle: { background: TOKENS.panel, border: `1px solid ${TOKENS.line}`, borderRadius: 8, fontFamily: "var(--font-mono)", fontSize: 12, color: TOKENS.text, boxShadow: "var(--shadow-md)" },
    labelStyle: { color: TOKENS.textDim },
    itemStyle: { color: TOKENS.text },
    cursor: { fill: "var(--panel-raised)" },
  };
}

const CATEGORY_BAR_COLORS = ["#3ECF8E", "#159865", "#F2C94C", "#EB5757", "#56CCF2", "#BB6BD9", "#F2994A", "#6FCF97", "#9B9B9B"];

/* ================================================================== */
/* Root                                                                */
/* ================================================================== */

export default function DevDashboard({ brigadeId, role, userId, officerUnit, unitLogos, categories, crossNav, clearCrossNav, requestTicketForItem, viewTicketDetail }) {
  const isUnitOfficer = role === UNIT_OFFICER;
  const [scope, setScope] = useState(ALL_SCOPE);
  const [openItem, setOpenItem] = useState(null);
  const [loaded, setLoaded] = useState(null);
  const [equipQuery, setEquipQuery] = useState("");
  const [reqQuery, setReqQuery] = useState("");
  const [reqStatusFilter, setReqStatusFilter] = useState("all");
  const [layout, setLayout] = useState(() => defaultLayout(role));
  const [dragKey, setDragKey] = useState(null);
  const [dragOverKey, setDragOverKey] = useState(null);

  // מציגים מיד את ברירת המחדל של התפקיד (בלי הבהוב ריק), ואז מחליפים
  // בפריסה האישית של המשתמש (userPrefsStore.js) ברגע שהיא נטענת.
  useEffect(() => {
    let cancelled = false;
    setLayout(defaultLayout(role));
    fetchUserPref(userId, layoutNamespace(role)).then((saved) => {
      if (!cancelled) setLayout(reconcileLayout(role, saved));
    });
    return () => { cancelled = true; };
  }, [role, userId]);

  useEffect(() => {
    let cancelled = false;
    setLoaded(null);
    setScope(ALL_SCOPE);
    setEquipQuery("");
    setReqQuery("");
    setReqStatusFilter("all");
    Promise.all([
      fetchBrigadeUnits(brigadeId),
      fetchBrigadeCatalog(brigadeId),
      fetchBrigadeTickets(brigadeId),
      fetchBrigadeDashboard(brigadeId),
    ]).then(([units, catalog, tickets, dash]) => {
      if (!cancelled) setLoaded({ units, catalog, tickets, dash });
    });
    return () => { cancelled = true; };
  }, [brigadeId]);

  // קצין אמל״ח יחידה תמיד "מחזיק" ביחידה הראשונה של החטיבה (אין עדיין
  // זהות משתמש אמיתית) — ונעול אליה: השאלה הרלוונטית לרמה הזו היא "מה
  // קורה ביחידה שלי", לא תמונת מצב כלל-חטיבתית.
  useEffect(() => {
    if (isUnitOfficer) setScope(officerUnit || loaded?.units?.[0]);
  }, [isUnitOfficer, loaded, officerUnit]);

  // גשר ניווט צולב: הגעה מדרישה שמקושרת לפריט קטלוג ("צפייה במוצר") פותחת
  // ישירות את תעודת הזהות שלו מתוך תצוגת הדשבורד.
  useEffect(() => {
    if (crossNav?.kind === "catalogItem" && loaded) {
      const found = loaded.catalog.find((it) => it.id === crossNav.itemId);
      if (found) setOpenItem(found);
      clearCrossNav();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crossNav, loaded]);

  const data = useMemo(
    () => (loaded ? getScopedData(scope, loaded.units, loaded.dash) : null),
    [scope, loaded]
  );

  const scopedTickets = useMemo(() => {
    if (!loaded) return [];
    const scopedUnits = scope === ALL_SCOPE ? loaded.units : [scope];
    return loaded.tickets.filter((t) => scopedUnits.includes(t.unit));
  }, [loaded, scope]);

  const categoryData = useMemo(() => categoryBreakdown(scopedTickets), [scopedTickets]);
  const unitResponseMinutes = useMemo(() => avgMinutesBetween(scopedTickets, "submittedAt", "decidedAt"), [scopedTickets]);
  const brigadeResponseMinutes = useMemo(() => avgMinutesBetween(scopedTickets, "decidedAt", "prioritizedAt"), [scopedTickets]);
  const ticketTypeData = useMemo(
    () => breakdownBy(scopedTickets, (t) => TICKET_TYPE_LABELS[t.type] || TICKET_TYPE_LABELS.idea),
    [scopedTickets]
  );

  function reorder(fromKey, toKey) {
    setLayout((prev) => {
      const order = [...prev.order];
      const fromIdx = order.indexOf(fromKey);
      const toIdx = order.indexOf(toKey);
      if (fromIdx === -1 || toIdx === -1) return prev;
      order.splice(fromIdx, 1);
      order.splice(toIdx, 0, fromKey);
      const next = { ...prev, order };
      saveUserPref(userId, layoutNamespace(role), next);
      return next;
    });
  }
  function hideWidget(key) {
    setLayout((prev) => {
      const next = { order: prev.order.filter((k) => k !== key), hidden: [...prev.hidden, key] };
      saveUserPref(userId, layoutNamespace(role), next);
      return next;
    });
  }
  function showWidget(key) {
    setLayout((prev) => {
      const next = { order: [...prev.order, key], hidden: prev.hidden.filter((k) => k !== key) };
      saveUserPref(userId, layoutNamespace(role), next);
      return next;
    });
  }
  function resetLayout() {
    clearUserPref(userId, layoutNamespace(role));
    setLayout(defaultLayout(role));
  }

  // מנהל מערכת בלבד רשאי לעדכן את טאג המקור/אחריות (מחט״ל/תעשייה/ייצור
  // פנים) של פריט — לא קציני אמל״ח יחידה/חטיבה, שממשיכים לראות אותו כטאג
  // קריאה-בלבד גם דרך הקטלוג וגם כאן. השמירה נשארת מקומית לסשן, כמו כל
  // עריכת קטלוג אחרת באפליקציה הזו (אין עדיין קצה עורפי אמיתי).
  function saveOriginPatch(updated) {
    setLoaded((prev) => ({ ...prev, catalog: prev.catalog.map((it) => (it.id === updated.id ? updated : it)) }));
    setOpenItem(updated);
  }
  const isSystemAdmin = role === SYSTEM_ADMIN;

  if (!loaded) {
    return (
      <div dir="rtl" className="dash">
        <style>{CSS}</style>
        <Loading />
      </div>
    );
  }

  const { units, catalog, tickets } = loaded;

  if (units.length === 0) {
    return (
      <div dir="rtl" className="dash">
        <style>{CSS}</style>
        <div className="empty-state">
          לחטיבה זו עדיין אין נתונים — היא ממתינה שקצין אמל״ח החטיבה ישלים את אשף ההתקנה.
        </div>
      </div>
    );
  }

  const scopedCatalog = scope === ALL_SCOPE ? catalog : catalog.filter((it) => it.unit === scope);
  const repairBoard = repairLeaderboard(scopedTickets, scopedCatalog);
  const procCost = procurementPendingCost(scopedTickets);
  const filteredEquip = scopedCatalog.filter((it) =>
    matchesSearch([it.name, it.id, it.category, it.responsibleName, it.responsibleRank], equipQuery)
  );

  const reqIsFiltering = reqQuery.trim().length > 0 || reqStatusFilter !== "all";
  const openRequests = [...scopedTickets]
    .sort((a, b) => (a.status === "pending" ? -1 : 1))
    .filter(
      (r) =>
        matchesSearch([r.id, r.title, r.unit], reqQuery) &&
        (reqStatusFilter === "all" || r.status === reqStatusFilter)
    )
    .slice(0, reqIsFiltering ? 50 : 5);

  const WIDGET_CONTENT = {
    kpis: () => (
      <div className="dash-kpis">
        <MiniKpi label="סה״כ דרישות" value={data.total} devblock={`${WIDGET_DEFS.kpis.title} — סה״כ דרישות`} />
        <MiniKpi label="ממתינות" value={data.totals.pending} tone="yellow" devblock={`${WIDGET_DEFS.kpis.title} — ממתינות`} />
        <MiniKpi label="אושרו" value={data.totals.approved} tone="green" devblock={`${WIDGET_DEFS.kpis.title} — אושרו`} />
        <MiniKpi label="סורבו" value={data.totals.rejected} tone="red" devblock={`${WIDGET_DEFS.kpis.title} — סורבו`} />
      </div>
    ),
    unitSummary: () => (
      <div className="dash-kpis">
        <MiniKpi label="סה״כ דרישות היחידה" value={data.total} />
        <MiniKpi label="ממתינות להחלטתך" value={data.totals.pending} tone="yellow" />
        <MiniKpi label="אושרו" value={data.totals.approved} tone="green" />
        <MiniKpi label="סורבו" value={data.totals.rejected} tone="red" />
      </div>
    ),
    equipment: () => (
      <>
        <SearchBar value={equipQuery} onChange={setEquipQuery} placeholder="חיפוש ציוד לפי שם, מק״ט, קטגוריה או אחראי..." />
        {filteredEquip.length === 0 && <div className="empty-state">לא נמצא ציוד התואם את החיפוש.</div>}
        <div className="equip-scroll">
          {filteredEquip.map((it) => {
            const cond = conditionFor(it.qty);
            return (
              <button className="equip-card" key={it.id} onClick={() => setOpenItem(it)}>
                <div className="equip-card-info">
                  <div className="equip-card-name">{it.name}</div>
                  <div className="equip-card-id">{it.id}</div>
                  <div className="equip-card-row"><span>כמות</span><b>{it.qty}</b></div>
                  <div className="equip-card-row"><span>קטגוריה</span><b>{it.category}</b></div>
                  <div className="equip-card-row"><span>אחראי</span><b>{it.responsibleRank} {it.responsibleName}</b></div>
                  <span className={`pill pill-${cond.tone} equip-card-pill`}>{cond.label}</span>
                </div>
                <PhotoTile iconKey={it.icon} size={78} iconSize={30} ribbon={false} />
                <span className="equip-card-more">לתעודת זהות <ChevronLeft size={13} /></span>
              </button>
            );
          })}
        </div>
      </>
    ),
    openRequests: () => (
      <>
        <SearchBar value={reqQuery} onChange={setReqQuery} placeholder="חיפוש לפי מזהה, כותרת או יחידה...">
          <FilterSelect value={reqStatusFilter} onChange={setReqStatusFilter} options={STATUS_FILTER_OPTIONS} allLabel="כל הסטטוסים" ariaLabel="סינון לפי סטטוס" />
        </SearchBar>
        <div className="req-table">
          <div className="req-row req-head">
            <span>מזהה</span><span>סוג הדרישה</span><span>יחידה</span><span>סטטוס</span>
          </div>
          {openRequests.length === 0 && <div className="empty">לא נמצאו בקשות התואמות את החיפוש.</div>}
          {openRequests.map((r) => (
            <div className="req-row" key={r.id}>
              <span className="req-id">{r.id}</span>
              <span className="req-title">{r.title}</span>
              <span className="req-unit"><UnitEmblem name={r.unit} size={16} showRing={false} image={unitLogos?.[r.unit]} />{r.unit}</span>
              <span className="req-status"><StatusPill status={r.status} /></span>
            </div>
          ))}
        </div>
      </>
    ),
    readiness: () => (
      <div className="readiness-card-inner">
        <div className="readiness-main">
          <div className="readiness-big">99.8%</div>
          <div className="readiness-big-label">זמינות מערכת (30 יום)</div>
        </div>
        <div className="readiness-grid">
          <div className="readiness-stat"><span>משתמשים פעילים</span><b>37</b></div>
          <div className="readiness-stat"><span>פריטים בקטלוג</span><b>{scopedCatalog.length}</b></div>
          <div className="readiness-stat"><span>זמן אישור ממוצע</span><b>{formatDuration(unitResponseMinutes)}</b></div>
          <div className="readiness-stat"><span>גרסת מערכת</span><b>0.1.0</b></div>
        </div>
        <div className="readiness-strip">
          {data.trend.slice(-7).map((t) => (
            <div className="readiness-strip-day" key={t.d}>
              <span className="readiness-strip-val">{t.opened}</span>
              <span className="readiness-strip-day-label">{t.d}</span>
            </div>
          ))}
        </div>
      </div>
    ),
    trend: () => (
      <>
        <div className="widget-corner-badge">
          <span className={"trend-badge" + (data.trendChangePct < 0 ? " trend-down" : "")}>
            {data.trendChangePct >= 0 ? "+" : ""}{data.trendChangePct}%
          </span>
        </div>
        <div className="dot-legend-row">
          <span className="dot-legend"><i className="dot-legend-dot" style={{ background: "var(--accent)" }} />נפתחו (דרישות)</span>
          <span className="dot-legend"><i className="dot-legend-dot" style={{ background: "var(--green)" }} />אושרו</span>
          <span className="dot-legend"><i className="dot-legend-dot" style={{ background: "var(--yellow)" }} />הוזמנו (הזמנות)</span>
        </div>
        <ResponsiveContainer width="100%" height={210}>
          <AreaChart data={data.trend} margin={{ top: 6, right: 10, left: -18, bottom: 0 }}>
            <defs>
              <linearGradient id="trendFillOpened" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={TOKENS.accent} stopOpacity={0.4} />
                <stop offset="100%" stopColor={TOKENS.accent} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="trendFillApproved" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={TOKENS.green} stopOpacity={0.3} />
                <stop offset="100%" stopColor={TOKENS.green} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="trendFillOrdered" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={TOKENS.yellow} stopOpacity={0.3} />
                <stop offset="100%" stopColor={TOKENS.yellow} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={TOKENS.line} strokeDasharray="3 4" vertical={false} />
            <XAxis dataKey="d" stroke={TOKENS.textDim} fontSize={11} tickLine={false} />
            <YAxis stroke={TOKENS.textDim} fontSize={11} tickLine={false} axisLine={false} />
            <Tooltip {...tooltipStyle()} />
            <Area type="monotone" dataKey="opened" stroke={TOKENS.accent} strokeWidth={2} fill="url(#trendFillOpened)" />
            <Area type="monotone" dataKey="approved" stroke={TOKENS.green} strokeWidth={2} fill="url(#trendFillApproved)" />
            <Area type="monotone" dataKey="ordered" stroke={TOKENS.yellow} strokeWidth={2} fill="url(#trendFillOrdered)" />
          </AreaChart>
        </ResponsiveContainer>
      </>
    ),
    priority: () => (
      <>
        <div className="dot-legend-row">
          <span className="dot-legend"><i className="dot-legend-dot" style={{ background: "var(--red)" }} />דחוף</span>
          <span className="dot-legend"><i className="dot-legend-dot" style={{ background: "var(--yellow)" }} />בינוני</span>
          <span className="dot-legend"><i className="dot-legend-dot" style={{ background: "var(--green)" }} />שגרתי</span>
        </div>
        <div dir="ltr">
          <ResponsiveContainer width="100%" height={190}>
            <BarChart data={data.priorityBreakdown} layout="vertical" margin={{ top: 6, right: 20, left: 10, bottom: 0 }}>
              <CartesianGrid stroke={TOKENS.line} strokeDasharray="3 4" horizontal={false} />
              <XAxis type="number" stroke={TOKENS.textDim} fontSize={11} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="label" stroke={TOKENS.textDim} fontSize={12} tickLine={false} axisLine={false} width={72} />
              <Tooltip {...tooltipStyle()} />
              <Bar dataKey="value" radius={[0, 8, 8, 0]} maxBarSize={30}>
                {data.priorityBreakdown.map((p) => <Cell key={p.key} fill={p.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </>
    ),
    responseTime: () => (
      <div className="response-time-grid">
        <div className="response-time-card">
          <span className="response-time-label">זמן החלטה ממוצע — קצין אמל״ח יחידה</span>
          <span className="response-time-value">{formatDuration(unitResponseMinutes)}</span>
          <span className="response-time-sub">מרגע פתיחת הדרישה ועד אישור/סירוב</span>
        </div>
        <div className="response-time-card">
          <span className="response-time-label">זמן תיעדוף ממוצע — קצין אמל״ח חטיבה</span>
          <span className="response-time-value">{formatDuration(brigadeResponseMinutes)}</span>
          <span className="response-time-sub">מרגע האישור ועד קביעת עדיפות</span>
        </div>
      </div>
    ),
    categoryAnalytics: () => (
      categoryData.length === 0 ? (
        <div className="empty">אין עדיין דרישות בתצוגה זו.</div>
      ) : (
        <div dir="ltr">
          <ResponsiveContainer width="100%" height={Math.max(120, categoryData.length * 30)}>
            <BarChart data={categoryData} layout="vertical" margin={{ top: 4, right: 20, left: 10, bottom: 0 }}>
              <CartesianGrid stroke={TOKENS.line} strokeDasharray="3 4" horizontal={false} />
              <XAxis type="number" stroke={TOKENS.textDim} fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="category" stroke={TOKENS.textDim} fontSize={12} tickLine={false} axisLine={false} width={82} />
              <Tooltip {...tooltipStyle()} />
              <Bar dataKey="count" radius={[0, 8, 8, 0]} maxBarSize={20}>
                {categoryData.map((c, i) => <Cell key={c.category} fill={CATEGORY_BAR_COLORS[i % CATEGORY_BAR_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )
    ),
    ticketTypes: () => (
      ticketTypeData.length === 0 ? (
        <div className="empty">אין עדיין דרישות בתצוגה זו.</div>
      ) : (
        <div dir="ltr">
          <ResponsiveContainer width="100%" height={Math.max(120, ticketTypeData.length * 34)}>
            <BarChart data={ticketTypeData} layout="vertical" margin={{ top: 4, right: 20, left: 10, bottom: 0 }}>
              <CartesianGrid stroke={TOKENS.line} strokeDasharray="3 4" horizontal={false} />
              <XAxis type="number" stroke={TOKENS.textDim} fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="category" stroke={TOKENS.textDim} fontSize={12} tickLine={false} axisLine={false} width={92} />
              <Tooltip {...tooltipStyle()} />
              <Bar dataKey="count" radius={[0, 8, 8, 0]} maxBarSize={22}>
                {ticketTypeData.map((c, i) => <Cell key={c.category} fill={CATEGORY_BAR_COLORS[i % CATEGORY_BAR_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )
    ),
    repairLeaderboard: () => (
      repairBoard.length === 0 ? (
        <div className="empty">אין עדיין דרישות תיקון בתצוגה זו — סימן טוב.</div>
      ) : (
        <div className="repair-board">
          {repairBoard.map((r) => {
            const fullItem = catalog.find((it) => it.id === r.id);
            return (
              <button
                type="button"
                className="repair-board-row"
                key={r.id}
                onClick={() => fullItem && setOpenItem(fullItem)}
                disabled={!fullItem}
              >
                <span className="repair-board-name">{r.name}</span>
                <span className="repair-board-id">{r.id}</span>
                <span className="repair-board-count">{r.count} תקלות</span>
              </button>
            );
          })}
        </div>
      )
    ),
    procurementCost: () => (
      <div className="procurement-cost-inner">
        <div className="procurement-cost-big">{procCost.total.toLocaleString("he-IL")} ₪</div>
        <div className="procurement-cost-label">סה״כ עלות משוערת — {procCost.count} דרישות רכש פתוחות</div>
      </div>
    ),
    activityLog: () => (
      <div className="log-list">
        {data.activity.length === 0 && <div className="empty">אין פעילות רשומה עבור יחידה זו.</div>}
        {data.activity.map((a, idx) => (
          <div className="log-row" key={idx} style={{ animationDelay: `${idx * 60}ms` }}>
            <span className={`log-dot log-${a.tone}`} />
            <span className="log-time">{a.date} · {a.time}</span>
            <span className="log-actor">{a.actor}</span>
            <span className="log-unit-tag"><UnitEmblem name={a.unit} size={14} showRing={false} image={unitLogos?.[a.unit]} />{a.unit}</span>
            <span className="log-title">{a.title}</span>
            <span className="log-text">{a.action}</span>
          </div>
        ))}
      </div>
    ),
  };

  const hiddenDefs = layout.hidden.map((k) => ({ key: k, ...WIDGET_DEFS[k] }));

  return (
    <div dir="rtl" className="dash" data-devblock="Dashboard — main screen">
      <style>{CSS}</style>

      <div className="dash-toprow">
        <div className="dash-toprow-title">
          <h1>{isUnitOfficer ? `דשבורד יחידת ${scope}` : isSystemAdmin ? "דשבורד מנהל מערכת" : "דשבורד קצין אמל״ח"}</h1>
          <p>{isUnitOfficer ? "תמונת המצב של היחידה שלך — ניתן לגרור, להסתיר ולהוסיף ווידג׳טים." : isSystemAdmin ? "תמונת מצב כללית ומצטברת של החטיבה — ללא פרטי דרישות/ציוד ספציפיים." : "תצוגה מותאמת אישית — ניתן לגרור, להסתיר ולהוסיף ווידג׳טים."}</p>
        </div>
        <div className="dash-toprow-actions">
          {!isUnitOfficer && !isSystemAdmin && <ScopePicker scope={scope} setScope={setScope} units={units} unitLogos={unitLogos} />}
          <HiddenWidgetsMenu hiddenDefs={hiddenDefs} onShow={showWidget} />
          <ResetLayoutControl onReset={resetLayout} />
        </div>
      </div>

      <div className="dash-widgets">
        {layout.order.map((key) => {
          const def = WIDGET_DEFS[key];
          const content = WIDGET_CONTENT[key];
          if (!def || !content) return null;
          const Icon = def.icon;
          const isDragging = dragKey === key;
          const isDragOver = dragOverKey === key && dragKey && dragKey !== key;
          return (
            <section
              key={key}
              draggable
              className={
                "panel-card dash-section dash-widget"
                + (def.size === "half" ? " widget-half" : " widget-full")
                + (key === "readiness" ? " widget-readiness" : "")
                + (isDragging ? " dragging" : "")
                + (isDragOver ? " drag-over" : "")
              }
              onDragStart={() => setDragKey(key)}
              onDragEnd={() => { setDragKey(null); setDragOverKey(null); }}
              onDragOver={(e) => { e.preventDefault(); if (dragKey && dragKey !== key) setDragOverKey(key); }}
              onDragLeave={() => setDragOverKey((k) => (k === key ? null : k))}
              onDrop={() => { if (dragKey && dragKey !== key) reorder(dragKey, key); setDragKey(null); setDragOverKey(null); }}
              data-devblock={`Dashboard — widget: ${def.title}`}
            >
              <div className="panel-card-head widget-head">
                <div className="panel-card-title">
                  <Icon size={16} /> {def.title}
                </div>
                <button className="widget-hide-btn" onClick={() => hideWidget(key)} title="הסתרת ווידג׳ט">
                  <EyeOff size={13} />
                </button>
              </div>
              {content()}
            </section>
          );
        })}
      </div>

      {openItem && (
        <ProductDossier
          item={openItem}
          onClose={() => setOpenItem(null)}
          categories={categories}
          linkedTickets={tickets.filter((t) => t.linkedProductId === openItem.id)}
          relatedItems={catalog.filter((it) => it.id !== openItem.id && it.category === openItem.category).slice(0, 4)}
          onRequestTicket={requestTicketForItem ? (type) => requestTicketForItem(openItem, type) : undefined}
          onSelectRelated={(other) => setOpenItem(other)}
          onViewTicket={viewTicketDetail}
          canEditOrigin={isSystemAdmin}
          onSave={isSystemAdmin ? saveOriginPatch : undefined}
        />
      )}
    </div>
  );
}

function MiniKpi({ label, value, tone, devblock }) {
  return (
    <div
      className={"mini-kpi" + (tone ? ` mini-kpi-${tone}` : "")}
      {...(devblock ? { "data-devblock": devblock } : {})}
    >
      <div className="mini-kpi-value"><span className="count-up">{value}</span></div>
      <div className="mini-kpi-label">{label}</div>
    </div>
  );
}

/* רשימה נפתחת של ווידג'טים שהוסתרו — כל אחד ניתן להחזרה בנפרד, בלי      */
/* לאפס את כל הפריסה. מוצג רק כשיש לפחות ווידג'ט מוסתר אחד.               */
function HiddenWidgetsMenu({ hiddenDefs, onShow }) {
  const [open, setOpen] = useState(false);
  if (hiddenDefs.length === 0) return null;

  return (
    <div
      className="hidden-widgets-menu"
      tabIndex={-1}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false); }}
    >
      <button type="button" className="hidden-widgets-trigger" onClick={() => setOpen((o) => !o)}>
        <EyeOff size={13} />
        ווידג׳טים מוסתרים ({hiddenDefs.length})
        <span className={"hidden-widgets-arrow" + (open ? " open" : "")}>▾</span>
      </button>
      {open && (
        <div className="hidden-widgets-dropdown">
          {hiddenDefs.map((w) => (
            <button
              type="button"
              key={w.key}
              className="hidden-widgets-item"
              onClick={() => { onShow(w.key); setOpen(false); }}
            >
              <Plus size={13} /> {w.title}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* איפוס פריסה — פעולה הרסנית (מוחקת התאמה אישית), ולכן דו-שלבית: לחיצה   */
/* ראשונה רק חושפת אישור, מתבטלת מעצמה אחרי כמה שניות אם לא מאשרים.      */
function ResetLayoutControl({ onReset }) {
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!confirming) return;
    const t = setTimeout(() => setConfirming(false), 5000);
    return () => clearTimeout(t);
  }, [confirming]);

  if (confirming) {
    return (
      <span className="dash-reset-confirm">
        <span>לאפס את הפריסה האישית לברירת המחדל?</span>
        <button className="dash-reset-confirm-yes" onClick={() => { onReset(); setConfirming(false); }}>כן, איפוס</button>
        <button className="dash-reset-confirm-no" onClick={() => setConfirming(false)}>ביטול</button>
      </span>
    );
  }
  return (
    <button className="dash-reset-btn" onClick={() => setConfirming(true)} title="איפוס הפריסה האישית לברירת המחדל">
      <RotateCcw size={13} /> איפוס פריסה
    </button>
  );
}

/* ================================================================== */
/* CSS                                                                 */
/* ================================================================== */

const CSS = `
@keyframes fadeSlideUp{ from{ opacity:0; transform:translateY(8px); } to{ opacity:1; transform:translateY(0); } }

.dash{ display:flex; flex-direction:column; gap:16px; }
.dash-section{ padding:16px 18px 18px; position:relative; }
.panel-card-hint{ font-size:11.5px; color:var(--text-dim); }

.dash-toprow{ display:flex; align-items:flex-start; justify-content:space-between; gap:16px; flex-wrap:wrap; }
.dash-toprow-title h1{ font-family:var(--font-sans); font-weight:700; font-size:19px; margin:0 0 3px; }
.dash-toprow-title p{ font-size:13px; color:var(--text-dim); margin:0; }
.dash-toprow-actions{ display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
.dash-reset-btn{
  display:inline-flex; align-items:center; gap:6px; background:var(--panel); border:1px solid var(--line);
  border-radius:var(--radius-md); padding:8px 13px; font-size:12.5px; color:var(--text-dim); cursor:pointer;
  transition:border-color var(--t-fast) ease, color var(--t-fast) ease; font-family:var(--font-sans); flex:none;
}
.dash-reset-btn:hover{ border-color:var(--accent); color:var(--accent); }
.dash-reset-confirm{
  display:inline-flex; align-items:center; gap:8px; background:var(--panel-raised); border:1px solid var(--red);
  border-radius:var(--radius-md); padding:7px 10px 7px 13px; font-size:12px; color:var(--text); flex-wrap:wrap;
}
.dash-reset-confirm-yes, .dash-reset-confirm-no{
  border:none; border-radius:var(--radius-md); padding:5px 11px; font-size:12px; font-weight:700; cursor:pointer;
  font-family:var(--font-sans); transition:filter var(--t-fast) ease;
}
.dash-reset-confirm-yes{ background:var(--red); color:#fff; }
.dash-reset-confirm-yes:hover{ filter:brightness(1.1); }
.dash-reset-confirm-no{ background:none; color:var(--text-dim); border:1px solid var(--line); }
.dash-reset-confirm-no:hover{ color:var(--text); }
.dash-kpis{ display:flex; gap:10px; flex-wrap:wrap; }
.mini-kpi{
  background:var(--panel-raised); border:1px solid var(--line); border-radius:var(--radius-card); padding:12px 18px;
  min-width:110px; opacity:0; animation:fadeSlideUp var(--t-slow) ease forwards;
}
.mini-kpi-value{ font-weight:800; font-size:22px; }
.mini-kpi-label{ font-size:11.5px; color:var(--text-dim); margin-top:2px; }
.mini-kpi-yellow .mini-kpi-value{ color:var(--yellow); }
.mini-kpi-green .mini-kpi-value{ color:var(--green); }
.mini-kpi-red .mini-kpi-value{ color:var(--red); }

${SCOPE_PICKER_CSS}

.hidden-widgets-menu{ position:relative; flex:none; }
.hidden-widgets-trigger{
  display:inline-flex; align-items:center; gap:7px; background:var(--panel); border:1px solid var(--line);
  border-radius:var(--radius-md); padding:8px 13px; font-size:12.5px; color:var(--text-dim); cursor:pointer;
  font-family:var(--font-sans); transition:border-color var(--t-fast) ease, color var(--t-fast) ease; white-space:nowrap;
}
.hidden-widgets-trigger:hover{ border-color:var(--accent); color:var(--accent); }
.hidden-widgets-arrow{ font-size:10px; transition:transform .18s ease; }
.hidden-widgets-arrow.open{ transform:rotate(180deg); color:var(--accent); }
.hidden-widgets-dropdown{
  position:absolute; top:calc(100% + 6px); left:0; z-index:50; min-width:220px;
  background:var(--panel); border:1px solid var(--line); border-radius:var(--radius-lg);
  box-shadow:var(--shadow-md); padding:6px; animation:fadeSlideUp var(--t-fast) ease;
}
.hidden-widgets-item{
  width:100%; display:flex; align-items:center; gap:9px; background:transparent; border:none;
  color:var(--text); padding:9px 10px; border-radius:var(--radius-md); cursor:pointer; font-size:13px; text-align:right;
  font-family:var(--font-sans); transition:background var(--t-fast) ease, color var(--t-fast) ease;
}
.hidden-widgets-item:hover{ background:var(--panel-raised); color:var(--accent); }
.hidden-widgets-item svg{ color:var(--accent); flex:none; }

.dash-widgets{ display:grid; grid-template-columns:1fr 1fr; gap:16px; }
.widget-full{ grid-column:1 / -1; }
.widget-half{ grid-column:span 1; }
.dash-widget{
  cursor:grab;
  transition:opacity .18s ease, box-shadow .18s ease, transform .18s ease, border-color .18s ease;
}
.dash-widget.dragging{
  cursor:grabbing;
  opacity:.45; transform:scale(.97) rotate(-.6deg); box-shadow:var(--shadow-md);
  border-color:var(--accent); border-style:dashed; background:var(--brk-hot),var(--panel);
}
.dash-widget.drag-over{
  border-color:var(--accent); box-shadow:0 0 0 3px color-mix(in srgb, var(--accent) 18%, transparent);
  transform:scale(1.012); background:var(--brk-hot),var(--panel);
}
.widget-hide-btn{
  background:none; border:1px solid transparent; color:var(--text-dim); border-radius:var(--radius-md); padding:5px;
  cursor:pointer; opacity:0; transition:opacity var(--t-fast) ease, color var(--t-fast) ease, border-color var(--t-fast) ease; display:flex;
}
.dash-section:hover .widget-hide-btn{ opacity:1; }
.widget-hide-btn:hover{ color:var(--red); border-color:var(--red); }
.widget-corner-badge{ position:absolute; top:16px; left:18px; }

.equip-scroll{ display:flex; gap:14px; overflow-x:auto; padding:16px 2px 4px; scroll-snap-type:x proximity; }
.equip-card{
  scroll-snap-align:start; flex:none; width:260px; display:flex; align-items:flex-start; gap:12px;
  background:var(--panel-raised); border:1px solid var(--line); border-radius:var(--radius-card);
  padding:16px; text-align:right; cursor:pointer; color:var(--text); position:relative;
  transition:border-color var(--t-fast) ease, box-shadow var(--t-fast) ease;
}
.equip-card:hover{ border-color:var(--accent); box-shadow:var(--shadow-sm); }
.equip-card-info{ flex:1; display:flex; flex-direction:column; gap:5px; }
.equip-card-name{ font-weight:700; font-size:14.5px; }
.equip-card-id{ font-family:var(--font-mono); font-size:11px; color:var(--accent); margin-bottom:4px; }
.equip-card-row{ display:flex; justify-content:space-between; gap:8px; font-size:11.5px; color:var(--text-dim); }
.equip-card-row b{ color:var(--text); font-weight:600; }
.equip-card-pill{ margin-top:6px; align-self:flex-start; }
.equip-card-more{
  position:absolute; bottom:10px; left:16px; display:flex; align-items:center; gap:3px;
  font-size:10.5px; color:var(--text-dim);
}

.req-table{ display:flex; flex-direction:column; margin-top:10px; }
.req-row{ display:grid; grid-template-columns:80px 1fr 100px 150px; align-items:center; gap:10px; padding:11px 4px; border-bottom:1px solid var(--line); font-size:13px; }
.req-row:last-child{ border-bottom:none; }
.req-head{ font-family:var(--font-mono); font-size:10.5px; color:var(--text-dim); text-transform:uppercase; letter-spacing:.05em; }
.req-id{ font-family:var(--font-mono); font-size:12px; color:var(--accent); }
.req-title{ font-weight:600; }
.req-unit{ display:inline-flex; align-items:center; gap:6px; font-size:12.5px; color:var(--text-dim); }
.req-status{ display:flex; justify-content:center; min-width:0; }
.req-row .pill{ min-width:0; max-width:100%; white-space:normal; text-align:center; line-height:1.3; font-size:10px; padding:4px 8px; }

.widget-readiness{ display:flex; flex-direction:column; }
.readiness-card-inner{ display:flex; flex-direction:column; flex:1 1 auto; min-height:0; }
.readiness-main{ text-align:center; padding:10px 0 14px; border-bottom:1px solid var(--line); margin-bottom:14px; }
.readiness-big{ font-size:34px; font-weight:800; color:var(--accent); }
.readiness-big-label{ font-size:12px; color:var(--text-dim); margin-top:2px; }
.readiness-grid{ display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:14px; }
.readiness-stat{ background:var(--panel-raised); border:1px solid var(--line); border-radius:var(--radius-md); padding:9px 11px; font-size:11px; color:var(--text-dim); display:flex; flex-direction:column; gap:4px; min-width:0; }
.readiness-stat b{ font-size:15px; color:var(--text); font-family:var(--font-mono); font-weight:600; overflow-wrap:break-word; }
.readiness-strip{ display:flex; justify-content:space-between; gap:4px; margin-top:auto; padding-top:10px; border-top:1px solid var(--line); }
.readiness-strip-day{ display:flex; flex-direction:column; align-items:center; gap:3px; font-size:10px; color:var(--text-dim); flex:1 1 0; min-width:0; }
.readiness-strip-val{ font-family:var(--font-mono); font-weight:700; color:var(--text); font-size:12px; }

.response-time-grid{ display:flex; flex-direction:column; gap:10px; }
.response-time-card{ background:var(--panel-raised); border:1px solid var(--line); border-radius:var(--radius-lg); padding:13px 15px; display:flex; flex-direction:column; gap:4px; }
.response-time-label{ font-size:11.5px; color:var(--text-dim); }
.response-time-value{ font-family:var(--font-mono); font-size:22px; font-weight:700; color:var(--accent); }
.response-time-sub{ font-size:11px; color:var(--text-dim); }

.repair-board{ display:flex; flex-direction:column; gap:8px; }
.repair-board-row{
  display:grid; grid-template-columns:1fr auto auto; align-items:center; gap:12px; width:100%;
  background:var(--panel-raised); border:1px solid var(--line); border-radius:var(--radius-md); padding:10px 13px;
  cursor:pointer; font-family:var(--font-sans); text-align:right; transition:border-color var(--t-fast) ease;
}
.repair-board-row:hover:not(:disabled){ border-color:var(--accent); }
.repair-board-row:disabled{ cursor:default; }
.repair-board-name{ font-size:13.5px; font-weight:600; color:var(--text); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.repair-board-id{ font-family:var(--font-mono); font-size:11.5px; color:var(--text-dim); }
.repair-board-count{ font-size:12px; font-weight:700; color:var(--red); background:color-mix(in srgb, var(--red) 12%, transparent); border-radius:var(--radius-lg); padding:3px 10px; white-space:nowrap; }

.procurement-cost-inner{ display:flex; flex-direction:column; align-items:center; justify-content:center; gap:6px; padding:18px 0; text-align:center; }
.procurement-cost-big{ font-family:var(--font-mono); font-size:32px; font-weight:800; color:var(--accent); }
.procurement-cost-label{ font-size:12.5px; color:var(--text-dim); }

.dot-legend-row{ display:flex; gap:16px; margin:10px 2px 0; }

.trend-badge{ background:var(--panel-raised); border:1px solid var(--line); border-radius:var(--radius-lg); padding:3px 10px; }
.trend-badge.trend-down{ color:var(--red); }

.log-list{ display:flex; flex-direction:column; gap:10px; margin-top:10px; }
.log-row{
  display:flex; align-items:center; flex-wrap:wrap; gap:8px 10px; font-size:13px;
  opacity:0; animation:fadeSlideUp .25s ease forwards;
  border-bottom:1px solid var(--line); padding-bottom:9px;
}
.log-row:last-child{ border-bottom:none; padding-bottom:0; }
.log-dot{ width:6px; height:6px; border-radius:50%; flex:none; }
.log-green{ background:var(--green); } .log-yellow{ background:var(--yellow); } .log-red{ background:var(--red); }
.log-time{ font-family:var(--font-mono); color:var(--text-dim); flex:none; }
.log-actor{ font-weight:600; color:var(--text); }
.log-title{ font-weight:600; color:var(--accent); }
.log-unit-tag{ display:inline-flex; align-items:center; gap:4px; font-size:11px; color:var(--accent); background:var(--panel-raised); border:1px solid var(--line); border-radius:var(--radius-lg); padding:2px 9px; }
.log-text{ color:var(--text-dim); flex:1 1 100%; }
.empty{ color:var(--text-dim); font-size:13px; }

@media (max-width:900px){
  .dash-widgets{ grid-template-columns:1fr; }
  .widget-half{ grid-column:1 / -1; }
}
`;
