import React, { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Check, X as XIcon, Clock } from "lucide-react";
import ProductDossier from "./ProductDossier.jsx";
import PhotoTile from "../components/PhotoTile.jsx";
import Loading from "../components/Loading.jsx";
import SearchBar from "../components/SearchBar.jsx";
import FilterSelect from "../components/FilterSelect.jsx";
import Pagination from "../components/Pagination.jsx";
import { matchesSearch } from "../search.js";
import {
  fetchBrigadeCatalog, fetchBrigadeUnits, fetchBrigadeTickets,
  createCatalogItem, updateCatalogItem, deleteCatalogItem,
} from "../api-client/brigadeStore.js";
import { pushNotification, NOTIFICATION_TYPES } from "../api-client/notificationStore.js";
import { STRUCTURAL_ROLES } from "../roles.js";
import { CATALOG_ORIGINS, CATALOG_ORIGIN_LABELS } from "../opsData.jsx";
import { requiresTeamLeadApproval } from "../api-client/teamStore.js";

/* תפריט סינון לפי מקור/אחריות — לא FilterSelect רגיל (select) בכוונה:    */
/* ל"ייצור פנים" יש אפקט זוהר-מנצנץ עדין שהמשתמש ביקש שירגיש גם בפילטר,   */
/* ו-<option> תקני לא תומך ב-box-shadow/אנימציה בשום דפדפן — רק תפריט     */
/* נפתח מותאם (אותו דפוס כמו HiddenWidgetsMenu ב-DevDashboard.jsx) יכול.  */
const ORIGIN_FILTER_OPTIONS = [
  { value: CATALOG_ORIGINS.MATAL, label: CATALOG_ORIGIN_LABELS.matal },
  { value: CATALOG_ORIGINS.INDUSTRY, label: CATALOG_ORIGIN_LABELS.industry },
  { value: CATALOG_ORIGINS.IN_HOUSE, label: CATALOG_ORIGIN_LABELS.in_house },
];

function OriginFilterMenu({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const current = ORIGIN_FILTER_OPTIONS.find((o) => o.value === value);
  return (
    <div className="origin-filter-menu" tabIndex={-1} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false); }}>
      <button type="button" className="origin-filter-trigger" onClick={() => setOpen((o) => !o)}>
        {current && <span className={"origin-dot origin-dot-" + current.value} />}
        {current ? current.label : "כל המקורות"}
        <span className={"origin-filter-arrow" + (open ? " open" : "")}>▾</span>
      </button>
      {open && (
        <div className="origin-filter-dropdown">
          <button type="button" className={"origin-filter-item" + (!value || value === "all" ? " active" : "")} onClick={() => { onChange("all"); setOpen(false); }}>
            כל המקורות
          </button>
          {ORIGIN_FILTER_OPTIONS.map((o) => (
            <button
              type="button"
              key={o.value}
              className={"origin-filter-item" + (o.value === value ? " active" : "")}
              onClick={() => { onChange(o.value); setOpen(false); }}
            >
              <span className={"origin-dot origin-dot-" + o.value} />
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const CATALOG_STATUS = { ACTIVE: "active", PENDING: "pending", REJECTED: "rejected" };

function blankItem(unit, submittedBy) {
  return {
    id: "NEW-" + Math.floor(1000 + Math.random() * 9000),
    name: "", category: "", qty: 0, icon: "generator", unit,
    desc: "", responsibleRank: "", responsibleName: "", responsiblePersonalNumber: "", responsiblePhone: "",
    addedAt: new Date().toLocaleDateString("he-IL"), addedBy: submittedBy,
    updatedAt: new Date().toLocaleDateString("he-IL"), updatedBy: submittedBy,
    media: [], status: CATALOG_STATUS.ACTIVE, notes: "", rejectionReason: null, equipInstructions: "", interested: [],
    teamLeadGate: null, gateTeamId: null,
  };
}

// כפתור סירוב שדורש נימוק — אותו רכיב בדיוק כמו RejectWithReason ב-
// Tickets.jsx, משוכפל בכוונה כי כל קובץ מסך כאן עצמאי (ראו התיעוד שם).
function CatalogDecideRow({ onApprove, onReject }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  return (
    <div className="prod-card-decide">
      {!open ? (
        <>
          <button className="btn-approve" onClick={onApprove}><Check size={13} /> אישור</button>
          <button className="btn-reject" onClick={() => setOpen(true)}><XIcon size={13} /> סירוב</button>
        </>
      ) : (
        <div className="reject-reason-box" onClick={(e) => e.stopPropagation()}>
          <textarea autoFocus rows={2} placeholder="נדרש הסבר לסירוב..." value={reason} onChange={(e) => setReason(e.target.value)} />
          <div className="reject-reason-actions">
            <button type="button" className="btn-cancel" onClick={() => { setOpen(false); setReason(""); }}>ביטול</button>
            <button type="button" className="btn-reject" disabled={!reason.trim()} onClick={() => { onReject(reason.trim()); setOpen(false); setReason(""); }}>
              אישור סירוב
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Catalog({ brigadeId, role, persona, officerUnit, userId, effectiveMemberId, ledTeam, categories, crossNav, clearCrossNav, requestTicketForItem, viewTicketDetail }) {
  const [item, setItem] = useState(null);
  const [isNewItem, setIsNewItem] = useState(false);
  const [catalog, setCatalog] = useState(null);
  const [units, setUnits] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [originFilter, setOriginFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(24);
  const [tab, setTab] = useState("catalog");
  const [toast, setToast] = useState(null);
  const [myGateTeam, setMyGateTeam] = useState(null);
  const isTeamLead = role === STRUCTURAL_ROLES.MEMBER && !!ledTeam;

  // ה"תעודת זהות" הפתוחה (item) היא סנאפשוט נפרד מ-catalog, לא נגזרת ממנו
  // בכל רינדור — כל מוטטור (toggleInterest/reopenItem/handleSave) צריך אותה
  // מסונכרנת. אפקט אחד כאן, ולא setItem ידני שמפוזר בכל מוטטור בנפרד, כי
  // עדכון מבפנים ל-setCatalog בסטריקט-מוד של React מפעיל את ה-updater
  // פעמיים לצורך בדיקת טוהר — ותלות ב-side effect בתוכו (משתנה שנתפס
  // מבחוץ) לא אמינה כתוצאה מכך. עדיף מקור אמת אחד: item תמיד נגזר בפועל.
  useEffect(() => {
    if (item && !isNewItem && catalog) {
      const fresh = catalog.find((it) => it.id === item.id);
      if (fresh && fresh !== item) setItem(fresh);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalog]);

  useEffect(() => {
    let cancelled = false;
    setCatalog(null);
    setQuery("");
    setCategory("all");
    setOriginFilter("all");
    setItem(null);
    setPage(1);
    setTab("catalog");
    Promise.all([fetchBrigadeCatalog(brigadeId), fetchBrigadeUnits(brigadeId), fetchBrigadeTickets(brigadeId)]).then(([cat, u, tix]) => {
      if (cancelled) return;
      setCatalog(cat.map((it) => ({ ...it, status: it.status || CATALOG_STATUS.ACTIVE })));
      setUnits(u);
      setTickets(tix);
    });
    return () => { cancelled = true; };
  }, [brigadeId]);

  // גשר ניווט צולב: הגעה מדרישה שקושרה לפריט הזה ("הצג את המוצר") פותחת
  // ישירות את תעודת הזהות שלו, בלי שהמשתמש יצטרך לחפש אותו בעצמו.
  useEffect(() => {
    if (crossNav?.kind === "catalogItem" && catalog) {
      const found = catalog.find((it) => it.id === crossNav.itemId);
      if (found) setItem(found);
      clearCrossNav();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crossNav, catalog]);

  const isBrigadeOfficer = role === STRUCTURAL_ROLES.BRIGADE_OFFICER || role === STRUCTURAL_ROLES.SYSTEM_ADMIN;
  const isUnitOfficer = role === STRUCTURAL_ROLES.UNIT_OFFICER;
  const isMember = role === STRUCTURAL_ROLES.MEMBER;
  const myUnit = isMember ? persona?.unit : (officerUnit || units?.[0]);

  // בדמו הזה אין עדיין זהות משתמש אמיתית — קצין אמל"ח יחידה תמיד "מחזיק" ביחידה
  // הראשונה של החטיבה, אותה מוסכמה שכבר קיימת ב-PermissionsDashboard.jsx.
  const canControlCatalog = isBrigadeOfficer || isUnitOfficer;
  // כולם — כולל משתמשי יחידה רגילים — יכולים להציע פריט חדש לקטלוג; רק
  // הצעה של מי שאינו קצין אמל״ח עוברת דרך אישור קצין אמל״ח היחידה.
  const canProposeItem = canControlCatalog || isMember;
  const currentActor = isBrigadeOfficer ? "קצין אמל״ח חטיבה (הדגמה)" : isUnitOfficer ? "קצין אמל״ח יחידה (הדגמה)"
    : persona ? `${persona.rank} ${persona.name}` : "משתמש (הדגמה)";
  const draftIdentity = isMember ? persona?.personalNumber : userId;

  // שער אישור ראש צוות — נבדק מראש (לא סינכרוני בזמן handleSave עצמו), אותו
  // רעיון בדיוק כמו ב-Tickets.jsx: אם חברות בתת-צוות מסומנת requireLeadApproval,
  // הצעת קטלוג חדשה של אותו חבר נתקעת אצל ראש הצוות לפני תור קצין אמל״ח היחידה.
  useEffect(() => {
    let cancelled = false;
    if (!isMember) { setMyGateTeam(null); return; }
    const identity = { personalNumber: effectiveMemberId || persona?.personalNumber, fullName: persona ? `${persona.rank} ${persona.name}` : null };
    requiresTeamLeadApproval(brigadeId, identity).then((t) => { if (!cancelled) setMyGateTeam(t); });
    return () => { cancelled = true; };
  }, [brigadeId, isMember, effectiveMemberId, persona]);

  const scopedCatalog = useMemo(() => {
    if (!catalog) return [];
    if ((isUnitOfficer || isMember) && myUnit) return catalog.filter((it) => it.unit === myUnit);
    return catalog;
  }, [catalog, isUnitOfficer, isMember, myUnit]);

  const activeItems = useMemo(() => scopedCatalog.filter((it) => it.status === CATALOG_STATUS.ACTIVE), [scopedCatalog]);
  const pendingItems = useMemo(() => scopedCatalog.filter((it) => it.status === CATALOG_STATUS.PENDING && it.teamLeadGate !== "pending"), [scopedCatalog]);
  const rejectedItems = useMemo(() => scopedCatalog.filter((it) => it.status === CATALOG_STATUS.REJECTED), [scopedCatalog]);
  const teamGateItems = useMemo(
    () => (isTeamLead ? (catalog || []).filter((it) => it.status === CATALOG_STATUS.PENDING && it.teamLeadGate === "pending" && it.gateTeamId === ledTeam.id) : []),
    [catalog, isTeamLead, ledTeam]
  );

  function canEditItem(it) {
    // ממתין לאישור מוכרע דרך כפתורי אישור/סירוב (canDecideItem), לא נערך
    // ישירות; אבל פריט פעיל *וגם* פריט שנדחה (לצורך פתיחה מחדש ותיקון) —
    // שניהם כן ניתנים לעריכה על ידי מי שמחזיק סמכות על היחידה שלו.
    if (it.status === CATALOG_STATUS.PENDING) return false;
    if (isBrigadeOfficer) return true;
    if (isUnitOfficer) return it.unit === myUnit;
    return false;
  }
  function canDecideItem(it) {
    if (it.status !== CATALOG_STATUS.PENDING) return false;
    if (it.teamLeadGate === "pending") return false; // עדיין תקוע אצל ראש הצוות — לא הגיע לתור קצין אמל״ח היחידה
    if (isBrigadeOfficer) return true;
    if (isUnitOfficer) return it.unit === myUnit;
    return false;
  }

  const listForTab = tab === "catalog" ? activeItems : tab === "pending" ? pendingItems : tab === "teamGate" ? teamGateItems : rejectedItems;

  const categoryFilterOptions = useMemo(
    () => [...new Set(activeItems.map((it) => it.category).filter(Boolean))].map((c) => ({ value: c, label: c })),
    [activeItems]
  );

  const filtered = useMemo(() => {
    return listForTab.filter(
      (it) =>
        (tab !== "catalog" || category === "all" || it.category === category) &&
        (tab !== "catalog" || originFilter === "all" || it.origin === originFilter) &&
        matchesSearch([it.name, it.id, it.category, it.desc, it.responsibleName, it.responsibleRank], query)
    );
  }, [listForTab, query, category, originFilter, tab]);

  useEffect(() => { setPage(1); }, [query, category, originFilter, pageSize, tab]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pagedItems = useMemo(
    () => filtered.slice((Math.min(page, pageCount) - 1) * pageSize, Math.min(page, pageCount) * pageSize),
    [filtered, page, pageCount, pageSize]
  );

  function flash(msg) {
    setToast(msg);
    window.clearTimeout(flash._t);
    flash._t = window.setTimeout(() => setToast(null), 2800);
  }

  function notifyCatalog(it, type, message) {
    pushNotification(brigadeId, { kind: "catalogItem", itemId: it.id, ticketTitle: it.name, unit: it.unit, requestedBy: it.addedBy, type, message });
  }

  async function handleSave(updated) {
    const isCreating = !catalog.some((it) => it.id === updated.id);
    const gated = isCreating && !canControlCatalog && !!myGateTeam;
    const finalItem = isCreating
      ? { ...updated, status: canControlCatalog ? CATALOG_STATUS.ACTIVE : CATALOG_STATUS.PENDING, teamLeadGate: gated ? "pending" : null, gateTeamId: gated ? myGateTeam.id : null }
      : updated;
    if (isCreating) await createCatalogItem(brigadeId, finalItem);
    else await updateCatalogItem(brigadeId, finalItem.id, finalItem);
    setCatalog((prev) => (isCreating ? [finalItem, ...prev] : prev.map((it) => (it.id === finalItem.id ? finalItem : it))));
    setItem(finalItem);
    setIsNewItem(false);
    if (isCreating && finalItem.status === CATALOG_STATUS.PENDING) {
      if (gated) {
        flash(`הפריט "${finalItem.name}" נשלח — ממתין לאישור ראש/ת ${myGateTeam.name} לפני שיעבור לקצין האמל״ח ביחידה`);
      } else {
        flash(`הפריט "${finalItem.name}" נשלח לאישור קצין אמל״ח היחידה`);
        notifyCatalog(finalItem, NOTIFICATION_TYPES.SUBMITTED, `${currentActor} הציע/ה פריט קטלוג חדש — "${finalItem.name}" — הממתין להחלטתך`);
      }
    }
  }

  // הכרעת ראש צוות על הצעת קטלוג שנתקעה בשער שלו — אותו רעיון בדיוק כמו
  // decideTeamGate ב-Tickets.jsx (ראו שם התיעוד המלא).
  async function decideTeamGateItem(id, decision, reason) {
    const target = catalog.find((it) => it.id === id);
    if (!target) return;
    const updated =
      decision === "approved"
        ? { ...target, teamLeadGate: "approved" }
        : { ...target, teamLeadGate: "rejected", status: CATALOG_STATUS.REJECTED, updatedAt: new Date().toLocaleDateString("he-IL"), updatedBy: `${ledTeam.leadRank} ${ledTeam.leadName} (ראש צוות)`, rejectionReason: reason };
    await updateCatalogItem(brigadeId, id, updated);
    setCatalog((prev) => prev.map((it) => (it.id === id ? updated : it)));
    if (decision === "approved") {
      flash(`הפריט "${updated.name}" אושר על ידך והועבר לתור קצין האמל״ח ביחידה`);
      notifyCatalog(updated, NOTIFICATION_TYPES.SUBMITTED, `${updated.addedBy} הציע/ה פריט קטלוג חדש — "${updated.name}" — אושר על ידי ראש/ת הצוות והממתין להחלטתך`);
    } else {
      flash(`הפריט "${updated.name}" סורב על ידך`);
      notifyCatalog(updated, NOTIFICATION_TYPES.REJECTED, `"${updated.name}" סורב על ידי ראש/ת הצוות שלך: ${reason}`);
    }
  }
  async function handleDelete(id) {
    await deleteCatalogItem(brigadeId, id);
    setCatalog((prev) => prev.filter((it) => it.id !== id));
  }

  // "הבעת עניין" — לא הרשאה, לא זרימת אישור, רק אינדיקציה קלה של תחושת
  // עבודה משותפת: מי עוד ביחידה/בחטיבה עשוי לרצות את הפריט הזה, כדי שקצין
  // אמל״ח יידע מראש אם שווה להזמין כמות גדולה יותר לפני שדרישות בפועל מגיעות.
  async function toggleInterest(id) {
    const target = catalog.find((it) => it.id === id);
    if (!target) return;
    const already = (target.interested || []).some((p) => p.name === currentActor);
    const interested = already
      ? target.interested.filter((p) => p.name !== currentActor)
      : [...(target.interested || []), { name: currentActor }];
    await updateCatalogItem(brigadeId, id, { interested });
    setCatalog((prev) => prev.map((it) => (it.id === id ? { ...it, interested } : it)));
    // item (הכרטיס הפתוח) מסתנכרן אוטומטית מ-catalog באפקט למעלה.
  }
  async function decide(id, status, reason) {
    const target = catalog.find((it) => it.id === id);
    if (!target) return;
    const updated = {
      ...target, status, updatedAt: new Date().toLocaleDateString("he-IL"), updatedBy: currentActor,
      rejectionReason: status === CATALOG_STATUS.REJECTED ? reason : null,
    };
    await updateCatalogItem(brigadeId, id, updated);
    setCatalog((prev) => prev.map((it) => (it.id === id ? updated : it)));
    flash(status === CATALOG_STATUS.ACTIVE ? "הפריט אושר ונוסף לקטלוג" : "הפריט נדחה ועבר לתיקיית בקשות שסורבו");
    notifyCatalog(
      updated,
      status === CATALOG_STATUS.ACTIVE ? NOTIFICATION_TYPES.APPROVED : NOTIFICATION_TYPES.REJECTED,
      status === CATALOG_STATUS.ACTIVE
        ? `${currentActor} אישר/ה את ההצעה "${updated.name}" — נוספה לקטלוג`
        : `${currentActor} סירב/ה להצעה "${updated.name}": ${reason}`
    );
  }

  // פתיחה מחדש של הצעת פריט שנדחתה — handleSave כבר מטפל בשמירת העריכה;
  // כאן רק מאפסים את סימוני הסירוב ומחזירים לתור (או ישר ל-active אם מי
  // שעורך הוא בעל סמכות אישור עצמית, כמו כל הצעה חדשה שלו).
  async function reopenItem(id, edits) {
    const target = catalog.find((it) => it.id === id);
    if (!target) return;
    const updated = { ...target, ...edits, status: canControlCatalog ? CATALOG_STATUS.ACTIVE : CATALOG_STATUS.PENDING, rejectionReason: null };
    await updateCatalogItem(brigadeId, id, updated);
    setCatalog((prev) => prev.map((it) => (it.id === id ? updated : it)));
    flash(canControlCatalog ? "הפריט עודכן ואושר מחדש" : "הפריט נשלח מחדש לאישור קצין אמל״ח היחידה");
    // item (הכרטיס הפתוח) מסתנכרן אוטומטית מ-catalog באפקט למעלה.
  }
  function openNewItem() {
    setItem(blankItem(myUnit, currentActor));
    setIsNewItem(true);
  }
  function closeDossier() {
    setItem(null);
    setIsNewItem(false);
  }

  const subtitle = isBrigadeOfficer
    ? "קטלוג אמל״ח החטיבה — ניתן לערוך ולנהל את כל הפריטים בכל היחידות."
    : isUnitOfficer
    ? `קטלוג אמל״ח יחידת ${myUnit || "..."} — ניתן לערוך ולנהל את פריטי היחידה שלך, ולאשר או לדחות הצעות פריט חדשות.`
    : `מלאי ציוד יחידת ${myUnit || "..."}. אפשר להציע פריט חדש — ההצעה תישלח לאישור קצין אמל״ח היחידה.`;

  const TABS = canControlCatalog
    ? [
        ["catalog", "קטלוג", activeItems.length],
        ["pending", "ממתינות לאישור", pendingItems.length],
        ["rejected", "נדחו", rejectedItems.length],
      ]
    : isTeamLead
    ? [
        ["catalog", "קטלוג", activeItems.length],
        ["teamGate", "אישורי ראש צוות", teamGateItems.length],
      ]
    : null;

  return (
    <div dir="rtl" className="catalog-view" data-devblock="Catalog — main screen">
      <style>{CSS}</style>

      <div className="view-head-row" data-devblock="Catalog — header and description">
        <p className="view-sub">{subtitle}</p>
        {canProposeItem && catalog && (
          <button className="add-item-btn" onClick={openNewItem} data-devblock="Catalog — add item button">
            <Plus size={14} /> הוספת פריט לקטלוג
          </button>
        )}
      </div>

      {TABS && (
        <div className="pill-tabs" style={{ marginBottom: 20 }}>
          {TABS.map(([key, label, count]) => (
            <button key={key} className={"pill-tab" + (tab === key ? " active" : "")} onClick={() => setTab(key)}>
              {label}{count > 0 ? ` (${count})` : ""}
            </button>
          ))}
        </div>
      )}

      {catalog === null ? (
        <Loading />
      ) : scopedCatalog.length === 0 ? (
        <div className="empty-state">
          {isUnitOfficer || isMember
            ? "עדיין אין פריטים בקטלוג של היחידה שלך — הוספת פריט ראשון תתחיל את הקטלוג."
            : "אין עדיין פריטים בקטלוג של חטיבה זו — היא ממתינה להשלמת ההקמה."}
        </div>
      ) : listForTab.length === 0 ? (
        <div className="empty-state">
          {tab === "pending" ? "אין הצעות פריט הממתינות לאישור." : tab === "teamGate" ? "אין הצעות פריט הממתינות לאישורך כראש צוות." : tab === "rejected" ? "אין פריטים שנדחו." : "אין עדיין פריטים בתצוגה זו."}
        </div>
      ) : (
      <>
      {tab === "catalog" && (
        <SearchBar value={query} onChange={setQuery} placeholder="חיפוש לפי שם, מק״ט, קטגוריה או אחראי...">
          <FilterSelect value={category} onChange={setCategory} options={categoryFilterOptions} allLabel="כל הקטגוריות" ariaLabel="סינון לפי קטגוריה" />
          <OriginFilterMenu value={originFilter} onChange={setOriginFilter} />
        </SearchBar>
      )}
      {tab !== "catalog" && (
        <SearchBar value={query} onChange={setQuery} placeholder="חיפוש לפי שם, מק״ט או אחראי..." />
      )}

      {filtered.length === 0 ? (
        <div className="empty-state">לא נמצאו פריטים התואמים את החיפוש.</div>
      ) : (
      <div className="catalog-grid">
        {pagedItems.map((it, idx) => {
          const editable = canEditItem(it);
          const decidable = canDecideItem(it);
          const gateDecidable = isTeamLead && it.teamLeadGate === "pending" && it.gateTeamId === ledTeam.id;
          return (
            <div
              className={"prod-card-wrap" + (it.status !== CATALOG_STATUS.ACTIVE ? " " + it.status : "")}
              key={it.id}
              style={{ animationDelay: `${idx * 40}ms` }}
              data-devblock={`Catalog — item: ${it.name || "unnamed"} (${it.id})`}
            >
              <button className="prod-card" onClick={() => setItem(it)}>
                {editable && <span className="prod-card-edit-badge"><Pencil size={11} /></span>}
                {it.status === CATALOG_STATUS.PENDING && <span className="prod-card-status-badge pending"><Clock size={11} /></span>}
                {it.status === CATALOG_STATUS.REJECTED && <span className="prod-card-status-badge rejected"><XIcon size={11} /></span>}
                {it.origin && (
                  <span
                    className={"prod-card-origin-dot origin-dot-" + it.origin + (it.origin === CATALOG_ORIGINS.IN_HOUSE ? " origin-glow" : "")}
                    title={CATALOG_ORIGIN_LABELS[it.origin]}
                  />
                )}
                <PhotoTile iconKey={it.icon} size={72} iconSize={28} />
                <div className="prod-name">{it.name || "ללא שם"}</div>
                <div className="prod-id">{it.id}</div>
                {tab === "catalog" ? (
                  <div className="prod-qty">
                    <span className="prod-qty-dot" />
                    במלאי: {it.qty}
                  </div>
                ) : (
                  <div className="prod-submitted-by">הוצע ע״י {it.addedBy}</div>
                )}
              </button>
              {decidable && (
                <CatalogDecideRow onApprove={() => decide(it.id, CATALOG_STATUS.ACTIVE)} onReject={(reason) => decide(it.id, CATALOG_STATUS.REJECTED, reason)} />
              )}
              {gateDecidable && (
                <CatalogDecideRow onApprove={() => decideTeamGateItem(it.id, "approved")} onReject={(reason) => decideTeamGateItem(it.id, "rejected", reason)} />
              )}
            </div>
          );
        })}
      </div>
      )}
      {filtered.length > 0 && (
        <Pagination page={Math.min(page, pageCount)} pageSize={pageSize} totalItems={filtered.length} onPageChange={setPage} onPageSizeChange={setPageSize} />
      )}
      </>
      )}

      {item && (
        <ProductDossier
          item={item}
          isNew={isNewItem}
          onClose={closeDossier}
          canEdit={isNewItem || canEditItem(item)}
          onSave={handleSave}
          onReopen={isNewItem ? undefined : reopenItem}
          onToggleInterest={isNewItem ? undefined : () => toggleInterest(item.id)}
          currentActor={currentActor}
          draftUserId={isNewItem ? draftIdentity : undefined}
          onDelete={isNewItem ? undefined : (canEditItem(item) ? handleDelete : undefined)}
          availableUnits={isBrigadeOfficer ? units : undefined}
          categories={categories}
          linkedTickets={isNewItem ? [] : tickets.filter((t) => t.linkedProductId === item.id)}
          relatedItems={isNewItem ? [] : (catalog || []).filter((it) => it.id !== item.id && it.category === item.category && it.status === CATALOG_STATUS.ACTIVE).slice(0, 4)}
          onRequestTicket={isNewItem || !requestTicketForItem ? undefined : (type) => requestTicketForItem(item, type)}
          onSelectRelated={(other) => setItem(other)}
          onViewTicket={viewTicketDetail}
        />
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

const CSS = `
@keyframes cardIn{ from{ opacity:0; transform:translateY(6px); } to{ opacity:1; transform:translateY(0); } }
@keyframes fadeSlideUp{ from{ opacity:0; transform:translateY(10px); } to{ opacity:1; transform:translateY(0); } }

.view-head-row{ display:flex; align-items:flex-start; justify-content:space-between; gap:16px; margin-bottom:20px; flex-wrap:wrap; }
.view-sub{ color:var(--text-dim); font-size:14px; margin:0; max-width:640px; }
.add-item-btn{
  display:inline-flex; align-items:center; gap:6px; background:var(--accent); color:var(--accent-ink); border:none;
  border-radius:var(--radius-md); padding:9px 16px; font-family:var(--font-sans); font-weight:700; font-size:13.5px; cursor:pointer;
  transition:filter var(--t-fast) ease, box-shadow var(--t-fast) ease; flex:none;
}
.add-item-btn:hover{ filter:brightness(1.08); box-shadow:var(--shadow-sm); }

.catalog-grid{ display:grid; grid-template-columns:repeat(auto-fill,minmax(190px,1fr)); gap:16px; }
.prod-card-wrap{ display:flex; flex-direction:column; gap:8px; opacity:0; animation:cardIn var(--t-slow) ease forwards; }
.prod-card{
  position:relative; background:var(--panel); border:1px solid var(--line); border-radius:var(--radius-card);
  padding:22px 14px; text-align:center; cursor:pointer; color:var(--text); width:100%;
  display:flex; flex-direction:column; gap:10px; align-items:center;
  transition:border-color var(--t-fast) ease, box-shadow var(--t-fast) ease, transform var(--t-fast) ease;
}
.prod-card:hover{ border-color:var(--accent); box-shadow:var(--shadow-sm); transform:translateY(-2px); background:var(--brk-hot),var(--panel); }
.prod-card:hover .photo-tile{ border-color:var(--accent); }
.prod-card-wrap.pending .prod-card{ border-color:var(--yellow); }
.prod-card-wrap.rejected .prod-card{ border-color:var(--line); opacity:.75; }
.prod-card-edit-badge{
  position:absolute; top:10px; left:10px; width:22px; height:22px; border-radius:50%;
  background:var(--accent); color:var(--accent-ink); display:flex; align-items:center; justify-content:center;
}
.prod-card-status-badge{
  position:absolute; top:10px; left:10px; width:22px; height:22px; border-radius:50%;
  display:flex; align-items:center; justify-content:center; color:#fff;
}
.prod-card-status-badge.pending{ background:var(--yellow); }
.prod-card-status-badge.rejected{ background:var(--red); }
.prod-name{ font-family:var(--font-sans); font-weight:600; font-size:15.5px; }
.prod-id{ font-family:var(--font-mono); font-size:12px; color:var(--accent); }
.prod-qty{ font-size:12.5px; color:var(--text-dim); display:flex; align-items:center; gap:5px; }
.prod-qty-dot{ width:5px; height:5px; border-radius:50%; background:var(--green); }
.prod-submitted-by{ font-size:11.5px; color:var(--text-dim); }
.prod-card-decide{ display:flex; gap:8px; }
.prod-card-decide button{
  flex:1; display:inline-flex; align-items:center; justify-content:center; gap:5px; border:none; border-radius:var(--radius-md);
  padding:7px 0; font-family:var(--font-sans); font-weight:700; font-size:12px; cursor:pointer;
  transition:filter var(--t-fast) ease;
}
.prod-card-decide .btn-approve{ background:var(--green); color:#fff; }
.prod-card-decide .btn-approve:hover{ filter:brightness(1.08); }
.prod-card-decide .btn-reject{ background:transparent; color:var(--red); border:1px solid var(--red); }
.prod-card-decide .btn-reject:hover{ background:color-mix(in srgb, var(--red) 10%, transparent); }
.reject-reason-box{
  display:flex; flex-direction:column; gap:6px; background:var(--bg); border:1px solid var(--red);
  border-radius:var(--radius-md); padding:9px; width:100%; animation:fadeSlideUp var(--t-fast) ease;
}
.reject-reason-box textarea{
  width:100%; background:var(--panel); border:1px solid var(--line); border-radius:var(--radius-md); padding:7px 9px;
  font-size:12.5px; font-family:var(--font-sans); color:var(--text); resize:vertical;
}
.reject-reason-box textarea:focus{ outline:none; border-color:var(--red); }
.reject-reason-actions{ display:flex; justify-content:flex-end; gap:6px; }
.reject-reason-actions .btn-reject:disabled{ opacity:.4; cursor:not-allowed; }
.reject-reason-actions .btn-cancel{
  border:none; border-radius:var(--radius-md); padding:7px 12px; font-family:var(--font-sans); font-weight:700; font-size:12px;
  cursor:pointer; background:var(--panel-raised); color:var(--text-dim);
}

/* תג מקור/אחריות בפינה השמאלית-עליונה של הכרטיס הסגור — צורת תגית אמיתית  */
/* (מצולע עם חוד וחור תלייה מדומה, לא עיגול) לצד תג העריכה/סטטוס הקיים —   */
/* אותה שפת-צורה בדיוק כמו הגרסה הגדולה בתעודת הזהות המורחבת (ProductDossier),  */
/* רק קטנה ובלי טקסט (אין מקום ב-22px), כדי שהמשמעות "זו תגית" תיקרא ברור   */
/* גם בתצוגה הסגורה. צבע לכל סוג מקור: מחט״ל ירוק, תעשייה כחול, ייצור      */
/* פנים כתום עם זוהר עדין — --accent ו---green הם אותו גוון ירוק בדיוק      */
/* בשני ערכות הנושא של האפליקציה, ולכן חובה צבע נפרד לייצור פנים.          */
@keyframes originGlow{
  0%,100%{ box-shadow:0 0 0 0 rgba(224,138,52,.55); }
  50%{ box-shadow:0 0 5px 2px rgba(224,138,52,.55); }
}
.prod-card-origin-dot{
  position:absolute; top:10px; left:38px; width:22px; height:18px; z-index:1;
  clip-path:polygon(28% 0%, 100% 0%, 100% 100%, 28% 100%, 0% 50%);
}
.prod-card-origin-dot::before{
  content:""; position:absolute; left:6px; top:50%; transform:translateY(-50%);
  width:3px; height:3px; border-radius:50%; background:var(--panel);
}
.prod-card-origin-dot.origin-glow{ animation:originGlow 2.4s ease-in-out infinite; }
.origin-dot-matal{ background:var(--green); }
.origin-dot-industry{ background:#2F8FCE; }
.origin-dot-in_house{ background:#E08A34; }

.origin-filter-menu{ position:relative; flex:none; }
.origin-filter-trigger{
  display:inline-flex; align-items:center; gap:7px; background:var(--panel); border:1px solid var(--line);
  border-radius:var(--radius-md); padding:9px 13px; font-size:13px; color:var(--text); cursor:pointer;
  font-family:var(--font-sans); transition:border-color var(--t-fast) ease; white-space:nowrap;
}
.origin-filter-trigger:hover{ border-color:var(--accent); }
.origin-filter-arrow{ font-size:10px; color:var(--text-dim); transition:transform .18s ease; }
.origin-filter-arrow.open{ transform:rotate(180deg); color:var(--accent); }
.origin-filter-dropdown{
  position:absolute; top:calc(100% + 6px); right:0; z-index:50; min-width:170px;
  background:var(--panel); border:1px solid var(--line); border-radius:var(--radius-lg);
  box-shadow:var(--shadow-md); padding:6px; animation:fadeSlideUp var(--t-fast) ease;
}
.origin-filter-item{
  width:100%; display:flex; align-items:center; gap:9px; background:transparent; border:none;
  color:var(--text); padding:9px 10px; border-radius:var(--radius-md); cursor:pointer; font-size:13px; text-align:right;
  font-family:var(--font-sans); transition:background var(--t-fast) ease;
}
.origin-filter-item:hover{ background:var(--panel-raised); }
.origin-filter-item.active{ background:var(--panel-raised); font-weight:700; }
.origin-dot{ width:9px; height:9px; border-radius:50%; flex:none; }
.origin-dot.origin-dot-matal{ background:var(--green); }
.origin-dot.origin-dot-industry{ background:#2F8FCE; }
.origin-dot.origin-dot-in_house{ background:#E08A34; animation:originGlow 2.4s ease-in-out infinite; }

.toast{
  position:fixed; bottom:24px; left:50%; transform:translateX(-50%);
  background:var(--panel); border:1px solid var(--accent); color:var(--text);
  font-family:var(--font-mono); font-size:13px; padding:10px 20px; border-radius:var(--radius-lg);
  z-index:250; box-shadow:var(--shadow-md); animation:fadeSlideUp var(--t-base) ease;
}

@media (max-width:640px){
  .catalog-grid{ grid-template-columns:repeat(auto-fill,minmax(130px,1fr)); }
}
`;
