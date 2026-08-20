import React, { useEffect, useMemo, useRef, useState } from "react";
import { X, Plus, Check, Trash2, Tag, ShieldCheck, AlertTriangle, ScrollText, RotateCcw, History } from "lucide-react";
import { BrigadeIcon } from "./BrigadeSetupWizard.jsx";
import { RANK_OPTIONS } from "./PermissionsDashboard.jsx";
import SearchBar from "../components/SearchBar.jsx";
import FilterSelect from "../components/FilterSelect.jsx";
import { matchesSearch } from "../search.js";
import {
  BRIGADE_STATUS, BRIGADE_STATUS_LABELS,
  fetchSystemAdmins, createSystemAdmin, deleteSystemAdmin,
  createBrigade, updateBrigade as apiUpdateBrigade, deleteBrigade as apiDeleteBrigade,
} from "../api-client/brigadesData.js";
import { fetchPendingDeletions, requestDeletion, resolveDeletion, fetchAuditLog, logAction, markLogRestored } from "../api-client/adminStore.js";
import { restoreTeam } from "../api-client/teamStore.js";

const BRIGADE_STATUS_FILTER_OPTIONS = Object.entries(BRIGADE_STATUS_LABELS).map(([value, label]) => ({ value, label }));

const LOG_TARGET_TYPE_LABELS = { brigade: "חטיבה", admin: "מנהל מערכת", team: "צוות" };
const LOG_TYPE_FILTER_OPTIONS = Object.entries(LOG_TARGET_TYPE_LABELS).map(([value, label]) => ({ value, label }));

/* ================================================================== */
/* LEGO BLOCK — SystemAdmin: the one screen above brigade level.        */
/* HANGAR is built כלל-זרועי — to serve every brigade, not just this    */
/* one — so this is where a system admin provisions new brigades,       */
/* retires old ones, and manages who else holds system-admin rights.    */
/* Visible only to STRUCTURAL_ROLES.SYSTEM_ADMIN (gated in App.jsx).    */
/*                                                                      */
/* A brigade provisioned here has no logo yet on purpose — a real logo  */
/* is an uploaded image, and only the brigade's own setup wizard        */
/* collects that (BrigadeSetupWizard's "brigade" step). Until then it   */
/* shows BrigadeIcon's neutral fallback.                                */
/* ================================================================== */

function AddBrigadeForm({ onAdd }) {
  const [name, setName] = useState("");
  const [rank, setRank] = useState(RANK_OPTIONS[0]);
  const [contactName, setContactName] = useState("");
  const [personalNumber, setPersonalNumber] = useState("");

  const canAdd = name.trim() && contactName.trim() && personalNumber.trim();

  function submit() {
    onAdd({
      id: crypto.randomUUID(), name, logo: null, unitLogos: {}, unitMissions: {}, mission: "",
      status: BRIGADE_STATUS.PENDING, units: 0, members: 0,
      contactRank: rank, contactName, contactPersonalNumber: personalNumber,
      createdAt: new Date().toLocaleDateString("he-IL"),
    });
    setName(""); setContactName(""); setPersonalNumber(""); setRank(RANK_OPTIONS[0]);
  }

  return (
    <div className="add-form">
      <label className="add-form-field">
        <span>שם החטיבה</span>
        <input placeholder="לדוגמה: חטיבת גבעתי" value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="add-form-field">
        <span>דרגת איש קשר ראשוני</span>
        <select value={rank} onChange={(e) => setRank(e.target.value)}>
          {RANK_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </label>
      <label className="add-form-field">
        <span>שם איש קשר ראשוני</span>
        <input placeholder="קצין אמל״ח החטיבה (זמני)" value={contactName} onChange={(e) => setContactName(e.target.value)} />
      </label>
      <label className="add-form-field">
        <span>מספר אישי</span>
        <input placeholder="יזוהה מול OpenID בכניסה ראשונה" value={personalNumber} inputMode="numeric"
          onChange={(e) => setPersonalNumber(e.target.value.replace(/\D/g, ""))} />
      </label>
      <button className="add-btn" disabled={!canAdd} onClick={submit}><Plus size={14} /> הוספת חטיבה</button>
    </div>
  );
}

/* פעולה הרסנית (מחיקת חטיבה/מנהל מערכת) עוברת ארבעה שלבי אישור לפני שהיא   */
/* אפילו מתבצעת: (1) לחיצה על כפתור המחיקה, (2) אישור אזהרה מפורשת,        */
/* (3) הקלדת השם המדויק של מה שנמחק (לא ניתן להקליק בלי לחשוב), (4) לחיצת   */
/* אישור סופית — וגם אז, אם מי שמבצע אינו מנהל עליון, הפעולה לא מתבצעת     */
/* בפועל אלא רק נרשמת כבקשה הממתינה לאישור כפול של מנהל עליון (ראו         */
/* PendingDeletionsPanel למטה) — רק כשהוא מאשר, המחיקה בפועל קורית.        */
function DestructiveConfirm({ label, targetType, targetId, targetLabel, snapshot, isSuperAdmin, actorLabel, onExecute }) {
  const [step, setStep] = useState(0);
  const [typed, setTyped] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function reset() { setStep(0); setTyped(""); }

  async function finalConfirm() {
    if (isSuperAdmin) {
      onExecute();
      await logAction({ actor: actorLabel, action: `מחיקה מיידית (מנהל עליון) — ${label}`, target: targetLabel, targetType, snapshot });
    } else {
      await requestDeletion({ targetType, targetId, targetLabel, requestedBy: actorLabel, snapshot });
      await logAction({ actor: actorLabel, action: `בקשת מחיקה נשלחה לאישור מנהל עליון — ${label}`, target: targetLabel });
      setSubmitted(true);
    }
    reset();
  }

  if (submitted) return <span className="destructive-submitted"><AlertTriangle size={12} /> נשלח לאישור מנהל עליון</span>;

  if (step === 0) {
    return <button className="person-remove" onClick={() => setStep(1)} title={label}><Trash2 size={14} /></button>;
  }
  return (
    <div className="destructive-confirm-box" onClick={(e) => e.stopPropagation()}>
      {step === 1 ? (
        <>
          <p><AlertTriangle size={13} /> פעולה זו אינה הפיכה. {isSuperAdmin ? "המחיקה תתבצע מיידית." : "היא תישלח לאישור מנהל עליון ותתבצע רק לאחר שיאשר."}</p>
          <div className="destructive-actions">
            <button type="button" className="btn-cancel" onClick={reset}>ביטול</button>
            <button type="button" className="destructive-continue" onClick={() => setStep(2)}>המשך</button>
          </div>
        </>
      ) : (
        <>
          <p>הקלד/י את השם המדויק <b>"{targetLabel}"</b> כדי לאשר.</p>
          <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={targetLabel} autoFocus />
          <div className="destructive-actions">
            <button type="button" className="btn-cancel" onClick={reset}>ביטול</button>
            <button type="button" className="destructive-continue" disabled={typed.trim() !== targetLabel} onClick={finalConfirm}>
              {isSuperAdmin ? "מחיקה סופית" : "שליחה לאישור מנהל עליון"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// גם אישור מנהל עליון עצמו הוא שני קליקים, לא אחד — "אישור" ראשוני חושף
// "אישור סופי, בלתי הפיך" נפרד, כדי שגם השלב האחרון בשרשרת לא יהיה טעות-קליק.
function PendingDeletionRow({ d, onDecide }) {
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="brigade-row pending-deletion-row">
      <div className="brigade-row-main">
        <div className="pending-deletion-title">{d.targetLabel} <span className="pill pill-neutral">{d.targetType === "brigade" ? "חטיבה" : "מנהל מערכת"}</span></div>
        <div className="brigade-row-meta">
          <span>ביקש/ה: {d.requestedBy}</span>
          <span>{new Date(d.requestedAt).toLocaleString("he-IL")}</span>
        </div>
      </div>
      {confirming ? (
        <div className="destructive-actions">
          <button type="button" className="btn-cancel" onClick={() => setConfirming(false)}>ביטול</button>
          <button type="button" className="destructive-continue" onClick={() => onDecide(d, "approved")}>אישור סופי, בלתי הפיך</button>
        </div>
      ) : (
        <div className="destructive-actions">
          <button type="button" className="btn-reject" onClick={() => onDecide(d, "rejected")}>דחייה</button>
          <button type="button" className="destructive-continue" onClick={() => setConfirming(true)}>אישור מחיקה</button>
        </div>
      )}
    </div>
  );
}

function BrigadeRow({ b, onUpdate, onActivate, onRemove, isSuperAdmin, actorLabel }) {
  return (
    <div className="brigade-row">
      <div className="brigade-row-icon"><BrigadeIcon image={b.logo} size={20} /></div>
      <div className="brigade-row-main">
        <input className="brigade-name-input" value={b.name} onChange={(e) => onUpdate(b.id, { name: e.target.value })} />
        <div className="brigade-row-meta">
          <span>{b.units} יחידות</span>
          <span>{b.members} אנשי כוח אדם</span>
          <span>נוצרה {b.createdAt}</span>
        </div>
      </div>
      <div className="brigade-row-contact">
        <span className="brigade-contact-name">{b.contactRank} {b.contactName}</span>
        <span className="brigade-contact-pn">מ.א. {b.contactPersonalNumber}</span>
      </div>
      <span className={"pill " + (b.status === BRIGADE_STATUS.ACTIVE ? "pill-green" : "pill-yellow")}>
        {BRIGADE_STATUS_LABELS[b.status]}
      </span>
      {b.status === BRIGADE_STATUS.PENDING && (
        <button className="brigade-activate-btn" onClick={() => onActivate(b.id)} title="סמן כפעילה">
          <Check size={14} /> הפעלה
        </button>
      )}
      <DestructiveConfirm
        label="מחיקת חטיבה מהמערכת"
        targetType="brigade"
        targetId={b.id}
        targetLabel={b.name}
        snapshot={b}
        isSuperAdmin={isSuperAdmin}
        actorLabel={actorLabel}
        onExecute={() => onRemove(b.id)}
      />
    </div>
  );
}

function BrigadeOrgTree({ brigades }) {
  return (
    <div className="org-tree">
      <div className="org-node">
        <div className="org-node-card">
          <div>
            <div className="org-node-title">האנגר — כלל הזרועות</div>
            <div className="org-node-sub">{brigades.length} חטיבות רשומות במערכת</div>
          </div>
        </div>
        <div className="org-node-children">
          {brigades.map((b) => (
            <div className="org-node" key={b.id}>
              <div className="org-node-card">
                <BrigadeIcon image={b.logo} size={20} />
                <div>
                  <div className="org-node-title">{b.name}</div>
                  <div className="org-node-sub">
                    {b.status === BRIGADE_STATUS.ACTIVE ? `${b.units} יחידות · ${b.members} אנשי כוח אדם` : "ממתינה להקמה"}
                  </div>
                </div>
                <span className={"pill " + (b.status === BRIGADE_STATUS.ACTIVE ? "pill-green" : "pill-yellow")}>
                  {BRIGADE_STATUS_LABELS[b.status]}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AddAdminForm({ onAdd }) {
  const [rank, setRank] = useState(RANK_OPTIONS[0]);
  const [name, setName] = useState("");
  const [personalNumber, setPersonalNumber] = useState("");
  const [email, setEmail] = useState("");
  const canAdd = name.trim() && personalNumber.trim();

  function submit() {
    onAdd({ id: crypto.randomUUID(), rank, name, personalNumber, email });
    setName(""); setPersonalNumber(""); setEmail(""); setRank(RANK_OPTIONS[0]);
  }

  return (
    <div className="add-form">
      <label className="add-form-field">
        <span>דרגה</span>
        <select value={rank} onChange={(e) => setRank(e.target.value)}>
          {RANK_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </label>
      <label className="add-form-field">
        <span>שם מלא</span>
        <input placeholder="שם מלא" value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="add-form-field">
        <span>מספר אישי</span>
        <input placeholder="יזוהה מול OpenID בכניסה" value={personalNumber} inputMode="numeric"
          onChange={(e) => setPersonalNumber(e.target.value.replace(/\D/g, ""))} />
      </label>
      <label className="add-form-field">
        <span>אימייל (אופציונלי)</span>
        <input placeholder="אימייל צוות תקשוב" value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <button className="add-btn" disabled={!canAdd} onClick={submit}><Plus size={14} /> הוספת מנהל מערכת</button>
    </div>
  );
}

/* ================================================================== */
/* ניהול קטגוריות אמל״ח — הרשימה הבסיסית והאוניברסלית (לדוגמה: רחפנים    */
/* וכטב״ם, תצפית, ציוד אישי, רובוטיקה) שמנהל מערכת מגדיר, ומשמשת גם      */
/* לתיוג פריטי קטלוג וגם לסיווג דרישות — כדי ששני העולמות תמיד מדברים    */
/* באותה שפה. הרשימה גלובלית (כלל-זרועית), לא פר-חטיבה, בכוונה.          */
/* ================================================================== */

function CategoryManager({ categories, setCategories }) {
  const [newCat, setNewCat] = useState("");

  function addCategory() {
    const v = newCat.trim();
    if (!v || categories.includes(v)) return;
    setCategories((prev) => [...prev, v]);
    setNewCat("");
  }
  function removeCategory(c) {
    setCategories((prev) => prev.filter((x) => x !== c));
  }
  function renameCategory(oldVal, newVal) {
    setCategories((prev) => prev.map((x) => (x === oldVal ? newVal : x)));
  }

  return (
    <div className="panel-card sa-section">
      <div className="section-title">קטגוריות אמל״ח ({categories.length})</div>
      <p className="sa-hint">
        רשימה אוניברסלית אחת המשותפת לכל החטיבות — משמשת גם לתיוג פריטי קטלוג וגם לסיווג דרישות בעת פתיחתן,
        כדי ששני העולמות תמיד יתייחסו לאותה קטגוריה. שינוי כאן משפיע על הבחירות הזמינות בכל מסך.
      </p>
      <div className="category-list">
        {categories.length === 0 && <div className="empty">אין עדיין קטגוריות מוגדרות.</div>}
        {categories.map((c) => (
          <div className="category-chip" key={c}>
            <Tag size={12} />
            <input
              className="category-chip-input"
              value={c}
              onChange={(e) => renameCategory(c, e.target.value)}
            />
            <button className="category-chip-remove" onClick={() => removeCategory(c)} title="הסרת קטגוריה">
              <X size={12} />
            </button>
          </div>
        ))}
      </div>
      <div className="section-title">הוספת קטגוריה חדשה</div>
      <div className="add-form" style={{ alignItems: "center" }}>
        <label className="add-form-field" style={{ flex: 1, minWidth: 200 }}>
          <span>שם הקטגוריה</span>
          <input
            placeholder="לדוגמה: רחפנים וכטב״ם"
            value={newCat}
            onChange={(e) => setNewCat(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addCategory()}
          />
        </label>
        <button className="add-btn" disabled={!newCat.trim() || categories.includes(newCat.trim())} onClick={addCategory}>
          <Plus size={14} /> הוספת קטגוריה
        </button>
      </div>
    </div>
  );
}

/* ================================================================== */
/* Root                                                                */
/* ================================================================== */

export default function SystemAdmin({ brigades, setBrigades, categories, setCategories, userId }) {
  const [admins, setAdmins] = useState([]);
  const [tab, setTab] = useState("brigades");
  // דיבאונס לעריכת שם חטיבה (input חופשי, onChange בכל הקשה) — עדכון ה-state
  // המקומי נשאר מיידי לתחושת הקלדה חלקה, אבל השמירה בפועל לשרת מתעכבת עד
  // שההקלדה נעצרת, כדי לא לירות בקשת רשת על כל תו (אותו רעיון בדיוק כמו
  // שמירת טיוטה אוטומטית ב-Tickets.jsx/ProductDossier.jsx).
  const brigadePatchTimers = useRef({});
  const [brigadeQuery, setBrigadeQuery] = useState("");
  const [brigadeStatusFilter, setBrigadeStatusFilter] = useState("all");
  const [adminQuery, setAdminQuery] = useState("");
  const [pendingDeletions, setPendingDeletions] = useState([]);
  const [auditLog, setAuditLog] = useState([]);
  const [auditQuery, setAuditQuery] = useState("");
  const [auditTypeFilter, setAuditTypeFilter] = useState("all");

  // הזהות היחידה שכבר קיימת ללא כניסת SSO אמיתית — אותו מספר אישי ששמור
  // בבורר תפקיד/חטיבה של סביבת הפיתוח (App.jsx). אם המספר לא תואם אף מנהל
  // מוכר, ברירת המחדל הבטוחה היא "לא מנהל עליון" — כלומר מחיקות דורשות
  // תמיד אישור כפול, לא ההפך.
  const currentAdmin = admins.find((a) => a.personalNumber === userId);
  const currentIsSuperAdmin = !!currentAdmin?.isSuperAdmin;
  const currentActorLabel = currentAdmin ? `${currentAdmin.rank} ${currentAdmin.name}` : "מנהל מערכת (לא מזוהה — נא להזין מ.א. בבורר הפיתוח)";

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      Promise.all([fetchPendingDeletions(), fetchAuditLog()]).then(([d, l]) => {
        if (cancelled) return;
        setPendingDeletions(d);
        setAuditLog(l);
      });
    };
    load();
    const t = setInterval(load, 1500);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchSystemAdmins().then((list) => { if (!cancelled) setAdmins(list); });
    return () => { cancelled = true; };
  }, []);

  const filteredBrigades = brigades.filter(
    (b) =>
      matchesSearch([b.name, b.contactName, b.contactRank, b.contactPersonalNumber, b.mission], brigadeQuery) &&
      (brigadeStatusFilter === "all" || b.status === brigadeStatusFilter)
  );
  const filteredAdmins = admins.filter((a) => matchesSearch([a.rank, a.name, a.personalNumber, a.email], adminQuery));
  const openDeletions = pendingDeletions.filter((d) => d.status === "pending");
  const filteredAuditLog = useMemo(
    () =>
      auditLog.filter(
        (l) =>
          matchesSearch([l.actor, l.action, l.target], auditQuery) &&
          (auditTypeFilter === "all" || l.targetType === auditTypeFilter)
      ),
    [auditLog, auditQuery, auditTypeFilter]
  );

  function updateBrigade(id, patch) {
    setBrigades((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
    clearTimeout(brigadePatchTimers.current[id]);
    brigadePatchTimers.current[id] = setTimeout(() => {
      apiUpdateBrigade(id, patch);
    }, 500);
  }
  function activateBrigade(id) {
    updateBrigade(id, { status: BRIGADE_STATUS.ACTIVE });
  }
  async function removeBrigade(id) {
    setBrigades((prev) => prev.filter((b) => b.id !== id));
    await apiDeleteBrigade(id);
  }
  async function addBrigade(b) {
    const created = await createBrigade(b);
    setBrigades((prev) => [...prev, created]);
  }
  async function addAdmin(a) {
    const created = await createSystemAdmin(a);
    setAdmins((prev) => [...prev, created]);
  }
  async function removeAdmin(id) {
    setAdmins((prev) => prev.filter((a) => a.id !== id));
    await deleteSystemAdmin(id);
  }

  // אישור סופי של מנהל עליון — רק כאן המחיקה שביקש מנהל מערכת רגיל באמת
  // מתבצעת בפועל, ורק אחרי שהמנהל העליון לוחץ אישור בעצמו (עוד שלב אישור).
  async function decideDeletion(d, decision) {
    await resolveDeletion(d.id, decision, currentActorLabel);
    if (decision === "approved") {
      if (d.targetType === "brigade") removeBrigade(d.targetId);
      else if (d.targetType === "admin") removeAdmin(d.targetId);
      await logAction({
        actor: currentActorLabel, action: `אישר/ה בקשת מחיקה של ${d.requestedBy} — ${d.targetLabel} נמחקה בפועל`,
        target: d.targetLabel, targetType: d.targetType, snapshot: d.snapshot,
      });
    } else {
      await logAction({ actor: currentActorLabel, action: `דחה/תה בקשת מחיקה של ${d.requestedBy} — ${d.targetLabel} נשארה במערכת`, target: d.targetLabel });
    }
    Promise.all([fetchPendingDeletions(), fetchAuditLog()]).then(([dl, l]) => { setPendingDeletions(dl); setAuditLog(l); });
  }

  // "היומן הוא גם גיבוי" — כל רשומת יומן שנושאת snapshot (עותק מלא של מה
  // שנמחק, ראו adminStore.js) ושעדיין לא שוחזרה, ניתנת לשחזור בלחיצה אחת.
  // שחזור חטיבה/מנהל מערכת מזריק את ה-snapshot בחזרה לרשימה החיה (הדאטהסט
  // התפעולי של החטיבה ב-brigadeStore.js מעולם לא נמחק בפועל — רק החטיבה
  // הוסרה מרשימת "החטיבות הידועות"), ושחזור צוות קורא ל-teamStore.js ישירות
  // עם ה-brigadeId שנשמר בתוך ה-snapshot עצמו.
  async function restoreLogEntry(l) {
    if (!l.snapshot || l.restored) return;
    if (l.targetType === "brigade") await addBrigade(l.snapshot);
    else if (l.targetType === "admin") await addAdmin(l.snapshot);
    else if (l.targetType === "team") await restoreTeam(l.snapshot.__brigadeId, l.snapshot);
    await markLogRestored(l.id);
    await logAction({ actor: currentActorLabel, action: `שחזר/ה פעולה מהיומן — ${l.action}`, target: l.target });
    fetchAuditLog().then(setAuditLog);
  }

  return (
    <div dir="rtl" className="sysadmin-view" data-devblock="ניהול מערכת — מסך ראשי">
      <style>{CSS}</style>

      <p className="view-sub">
        ניהול כלל-זרועי — האנגר משרת יותר מחטיבה אחת. כאן ניתן להקים חטיבות חדשות, לעקוב אחר סטטוס ההקמה שלהן,
        ולנהל מי מחזיק בהרשאת מנהל מערכת.
      </p>

      <div className="pill-tabs" style={{ marginBottom: 20 }}>
        <button className={"pill-tab" + (tab === "brigades" ? " active" : "")} onClick={() => setTab("brigades")}>חטיבות במערכת</button>
        <button className={"pill-tab" + (tab === "tree" ? " active" : "")} onClick={() => setTab("tree")}>עץ ארגוני</button>
        <button className={"pill-tab" + (tab === "admins" ? " active" : "")} onClick={() => setTab("admins")}>מנהלי מערכת</button>
        <button className={"pill-tab" + (tab === "categories" ? " active" : "")} onClick={() => setTab("categories")}>קטגוריות אמל״ח</button>
        {currentIsSuperAdmin && (
          <button className={"pill-tab" + (tab === "approvals" ? " active" : "")} onClick={() => setTab("approvals")}>
            אישורי מחיקה{openDeletions.length > 0 ? ` (${openDeletions.length})` : ""}
          </button>
        )}
        <button className={"pill-tab" + (tab === "auditLog" ? " active" : "")} onClick={() => setTab("auditLog")}>יומן פעולות</button>
      </div>

      {tab === "brigades" && (
        <div className="panel-card sa-section">
          <div className="section-title">חטיבות רשומות ({brigades.length})</div>
          <SearchBar value={brigadeQuery} onChange={setBrigadeQuery} placeholder="חיפוש לפי שם חטיבה או איש קשר...">
            <FilterSelect value={brigadeStatusFilter} onChange={setBrigadeStatusFilter} options={BRIGADE_STATUS_FILTER_OPTIONS} allLabel="כל הסטטוסים" ariaLabel="סינון לפי סטטוס" />
          </SearchBar>
          <div className="brigade-list">
            {filteredBrigades.length === 0 && <div className="empty">לא נמצאו חטיבות התואמות את החיפוש.</div>}
            {filteredBrigades.map((b) => (
              <BrigadeRow key={b.id} b={b} onUpdate={updateBrigade} onActivate={activateBrigade} onRemove={removeBrigade} isSuperAdmin={currentIsSuperAdmin} actorLabel={currentActorLabel} />
            ))}
          </div>
          <div className="section-title">הוספת חטיבה חדשה</div>
          <p className="sa-hint">
            לאחר ההוספה, ברגע שאיש הקשר הראשוני יתחבר להאנגר בפעם הראשונה, הוא ישויך אוטומטית לחטיבה זו —
            ומשם הוא (או קצין אמל״ח שימונה) ישלים את אשף ההתקנה ברמת החטיבה: יחידות, אנשי צוות והרשאות.
          </p>
          <AddBrigadeForm onAdd={addBrigade} />
        </div>
      )}

      {tab === "tree" && (
        <div className="panel-card sa-section">
          <div className="section-title">מבנה כלל-זרועי</div>
          <BrigadeOrgTree brigades={brigades} />
        </div>
      )}

      {tab === "admins" && (
        <div className="panel-card sa-section">
          <div className="section-title">מנהלי מערכת ({admins.length})</div>
          {admins.length > 0 && (
            <SearchBar value={adminQuery} onChange={setAdminQuery} placeholder="חיפוש לפי שם, מספר אישי או אימייל..." />
          )}
          <div className="brigade-list">
            {admins.length === 0 && <div className="empty">אין עדיין מנהלי מערכת נוספים.</div>}
            {admins.length > 0 && filteredAdmins.length === 0 && <div className="empty">לא נמצאו מנהלי מערכת התואמים את החיפוש.</div>}
            {filteredAdmins.map((a) => (
              <div className="person-row" key={a.id}>
                <div className="person-info">
                  <div className="person-name">
                    <span className="person-rank">{a.rank}</span> {a.name}
                    {a.isSuperAdmin && <span className="pill pill-outline-accent super-admin-pill"><ShieldCheck size={11} /> מנהל עליון</span>}
                  </div>
                  <div className="person-meta"><span>מ.א. {a.personalNumber}</span>{a.email && <span>{a.email}</span>}</div>
                </div>
                <DestructiveConfirm
                  label="הסרת מנהל מערכת"
                  targetType="admin"
                  targetId={a.id}
                  targetLabel={a.name}
                  snapshot={a}
                  isSuperAdmin={currentIsSuperAdmin}
                  actorLabel={currentActorLabel}
                  onExecute={() => removeAdmin(a.id)}
                />
              </div>
            ))}
          </div>
          <div className="section-title">הוספת מנהל מערכת</div>
          <AddAdminForm onAdd={addAdmin} />
        </div>
      )}

      {tab === "categories" && (
        <CategoryManager categories={categories} setCategories={setCategories} />
      )}

      {tab === "approvals" && currentIsSuperAdmin && (
        <div className="panel-card sa-section">
          <div className="section-title">אישורי מחיקה ממתינים ({openDeletions.length})</div>
          <p className="sa-hint">
            כל בקשת מחיקה שמנהל מערכת רגיל (לא עליון) שלח ממתינה כאן לאישורך. רק לאחר אישור — היא מבוצעת בפועל.
          </p>
          {openDeletions.length === 0 ? (
            <div className="empty">אין כרגע בקשות מחיקה הממתינות לאישור.</div>
          ) : (
            <div className="brigade-list">
              {openDeletions.map((d) => (
                <PendingDeletionRow key={d.id} d={d} onDecide={decideDeletion} />
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "auditLog" && (
        <div className="panel-card sa-section">
          <div className="section-title"><ScrollText size={16} /> יומן פעולות מנהלי מערכת ({auditLog.length})</div>
          <p className="sa-hint">
            רישום קבוע של כל פעולה משמעותית שביצעו מנהלי המערכת — בקשות מחיקה, אישורים ודחיות. רשומה שנושאת עותק מלא
            של מה שנמחק (<History size={11} style={{ verticalAlign: "-1px" }} /> מסומנת) משמשת גם כגיבוי — ניתן ללחוץ "שחזור" ולהחזיר אותה למערכת.
          </p>
          {auditLog.length > 0 && (
            <SearchBar value={auditQuery} onChange={setAuditQuery} placeholder="חיפוש לפי גורם מבצע, פעולה או יעד...">
              <FilterSelect value={auditTypeFilter} onChange={setAuditTypeFilter} options={LOG_TYPE_FILTER_OPTIONS} allLabel="כל סוגי היעד" ariaLabel="סינון לפי סוג יעד" />
            </SearchBar>
          )}
          {auditLog.length === 0 ? (
            <div className="empty">היומן ריק כרגע.</div>
          ) : filteredAuditLog.length === 0 ? (
            <div className="empty">לא נמצאו רשומות התואמות את החיפוש.</div>
          ) : (
            <div className="audit-log-list">
              {filteredAuditLog.map((l) => (
                <div className="audit-log-row" key={l.id}>
                  <span className="audit-log-actor">{l.actor}</span>
                  <span className="audit-log-action">
                    {l.snapshot && <History size={12} className="audit-log-backup-icon" title="רשומה זו נושאת גיבוי — ניתנת לשחזור" />}
                    {l.action}
                  </span>
                  <span className="dim audit-log-stamp">{new Date(l.ts).toLocaleString("he-IL")}</span>
                  {l.snapshot && (
                    l.restored ? (
                      <span className="audit-log-restored-tag"><Check size={11} /> שוחזר</span>
                    ) : (
                      <button type="button" className="audit-log-restore-btn" onClick={() => restoreLogEntry(l)}>
                        <RotateCcw size={12} /> שחזור
                      </button>
                    )
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ================================================================== */
/* CSS                                                                 */
/* ================================================================== */

const CSS = `
.sysadmin-view{ display:flex; flex-direction:column; gap:0; }
.view-sub{ color:var(--text-dim); font-size:14px; margin:0 0 20px; max-width:760px; line-height:1.6; }
.sa-section{ padding:20px 22px; }
.sa-hint{ font-size:12.5px; color:var(--text-dim); line-height:1.6; margin:0 0 14px; max-width:640px; }

.section-title{
  font-family:var(--font-mono); font-size:11.5px; color:var(--accent);
  text-transform:uppercase; letter-spacing:.06em; margin:22px 0 12px;
}
.section-title:first-child{ margin-top:0; }

.brigade-list{ display:flex; flex-direction:column; gap:10px; }
.brigade-row{
  display:flex; align-items:center; gap:14px; background:var(--panel-raised); border:1px solid var(--line);
  border-radius:12px; padding:12px 16px; flex-wrap:wrap;
}
.brigade-row-icon{
  width:38px; height:38px; border-radius:9px; background:var(--panel); border:1px solid var(--line);
  display:flex; align-items:center; justify-content:center; color:var(--accent); flex:none;
}
.brigade-row-main{ display:flex; flex-direction:column; gap:5px; min-width:160px; }
.brigade-name-input{
  background:transparent; border:1px solid transparent; border-radius:6px; padding:3px 6px; margin:-3px -6px;
  font-family:var(--font-sans); font-weight:700; font-size:14.5px; color:var(--text); width:180px;
  transition:border-color .15s ease, background .15s ease;
}
.brigade-name-input:hover, .brigade-name-input:focus{ border-color:var(--line); background:var(--panel); outline:none; }
.brigade-row-meta{ display:flex; gap:12px; font-size:11.5px; color:var(--text-dim); font-family:var(--font-mono); flex-wrap:wrap; }
.brigade-row-contact{ display:flex; flex-direction:column; gap:2px; font-size:12px; color:var(--text-dim); margin-inline-start:auto; text-align:left; }
.brigade-contact-name{ color:var(--text); font-weight:600; }
.brigade-contact-pn{ font-family:var(--font-mono); }
.brigade-activate-btn{
  display:inline-flex; align-items:center; gap:5px; background:transparent; border:1px solid var(--green);
  color:var(--green); border-radius:20px; padding:5px 12px; font-size:12px; font-weight:700; cursor:pointer;
  font-family:var(--font-sans); transition:background .15s ease;
}
.brigade-activate-btn:hover{ background:color-mix(in srgb, var(--green) 12%, transparent); }

.add-form{ display:flex; flex-wrap:wrap; gap:12px; align-items:flex-end; background:var(--panel-raised);
  border:1px dashed var(--line); border-radius:12px; padding:16px; }
.add-form-field{ display:flex; flex-direction:column; gap:5px; font-size:11.5px; color:var(--text-dim); }
.add-form-field input, .add-form-field select{ background:var(--bg); border:1px solid var(--line); border-radius:8px; color:var(--text);
  padding:9px 11px; font-size:13px; min-width:130px; }
.add-btn{ display:inline-flex; align-items:center; gap:6px; background:var(--accent); color:var(--accent-ink); border:none; border-radius:9px; padding:10px 18px;
  font-family:var(--font-sans); font-weight:700; font-size:14px; cursor:pointer; transition:filter .15s ease, box-shadow .15s ease; }
.add-btn:not(:disabled):hover{ filter:brightness(1.08); box-shadow:var(--shadow-sm); }
.add-btn:disabled{ opacity:.4; cursor:not-allowed; }

.person-row{
  display:flex; align-items:center; gap:14px; background:var(--panel-raised); border:1px solid var(--line);
  border-radius:12px; padding:12px 16px;
}
.person-info{ flex:1; min-width:140px; }
.person-name{ font-family:var(--font-sans); font-weight:600; font-size:15px; }
.person-rank{ color:var(--text-dim); font-weight:500; }
.person-meta{ display:flex; gap:12px; font-size:12px; color:var(--text-dim); font-family:var(--font-mono); margin-top:2px; }
.person-remove{ background:none; border:1px solid transparent; color:var(--text-dim); border-radius:8px;
  padding:6px; cursor:pointer; transition:color .15s ease, border-color .15s ease; display:flex; }
.person-remove:hover{ color:var(--red); border-color:var(--red); }

.empty{ color:var(--text-dim); font-size:14px; padding:16px 0; }

.category-list{ display:flex; flex-wrap:wrap; gap:9px; margin-bottom:6px; }
.category-chip{
  display:inline-flex; align-items:center; gap:7px; background:var(--panel-raised); border:1px solid var(--line);
  border-radius:20px; padding:6px 8px 6px 6px; color:var(--accent);
}
.category-chip-input{
  background:transparent; border:none; color:var(--text); font-family:var(--font-sans); font-size:13px;
  font-weight:600; width:auto; min-width:40px; max-width:160px; padding:2px 2px;
}
.category-chip-input:focus{ outline:none; }
.category-chip-remove{
  flex:none; background:none; border:1px solid transparent; color:var(--text-dim); border-radius:50%;
  padding:4px; cursor:pointer; display:flex; transition:color .15s ease, border-color .15s ease;
}
.category-chip-remove:hover{ color:var(--red); border-color:var(--red); }

.org-tree{ overflow-x:auto; padding-bottom:8px; }
.org-node{ display:inline-flex; flex-direction:column; align-items:center; }
.org-node-card{
  position:relative; display:flex; align-items:center; gap:10px; background:var(--panel); border:1px solid var(--line);
  border-radius:10px; padding:11px 16px; white-space:nowrap; box-shadow:var(--shadow-sm); z-index:1;
}
.org-node-title{ font-family:var(--font-sans); font-weight:700; font-size:14px; }
.org-node-sub{ font-size:11.5px; color:var(--text-dim); margin-top:1px; }
.org-node-children{
  display:flex; gap:16px; margin-top:-1px; padding:20px 20px 16px; flex-wrap:wrap; justify-content:center;
  background:var(--panel-raised); border:1px solid var(--line); border-top:none; border-radius:0 0 12px 12px;
}

/* פעולה הרסנית — תיבת אישור מדורגת שמופיעה במקום כפתור המחיקה הבודד. */
.destructive-confirm-box{
  display:flex; flex-direction:column; gap:8px; background:var(--bg); border:1px solid var(--red);
  border-radius:10px; padding:11px 13px; width:260px; animation:fadeSlideUp .15s ease;
}
.destructive-confirm-box p{ margin:0; font-size:12.5px; color:var(--text); line-height:1.5; display:flex; align-items:flex-start; gap:6px; }
.destructive-confirm-box p svg{ flex:none; color:var(--red); margin-top:1px; }
.destructive-confirm-box input{
  width:100%; background:var(--panel); border:1px solid var(--line); border-radius:7px; padding:7px 9px;
  font-size:12.5px; font-family:var(--font-mono); color:var(--text);
}
.destructive-confirm-box input:focus{ outline:none; border-color:var(--red); }
.destructive-actions{ display:flex; justify-content:flex-end; gap:6px; }
.btn-cancel{
  border:none; border-radius:8px; padding:7px 12px; font-family:var(--font-sans); font-weight:700; font-size:12px;
  cursor:pointer; background:var(--panel-raised); color:var(--text-dim);
}
.btn-reject{
  border:1px solid var(--red); border-radius:8px; padding:7px 12px; font-family:var(--font-sans); font-weight:700;
  font-size:12px; cursor:pointer; background:transparent; color:var(--red);
}
.destructive-continue{
  border:none; border-radius:8px; padding:7px 14px; font-family:var(--font-sans); font-weight:700; font-size:12px;
  cursor:pointer; background:var(--red); color:#fff; transition:filter .15s ease;
}
.destructive-continue:hover:not(:disabled){ filter:brightness(1.08); }
.destructive-continue:disabled{ opacity:.4; cursor:not-allowed; }
.destructive-submitted{ display:inline-flex; align-items:center; gap:5px; font-size:11.5px; color:var(--yellow); font-weight:600; }

.super-admin-pill{ margin-inline-start:8px; font-size:10px; padding:1px 8px; }
.pending-deletion-row{ align-items:flex-start; flex-wrap:wrap; }
.pending-deletion-title{ display:flex; align-items:center; gap:8px; font-family:var(--font-sans); font-weight:700; font-size:14px; }

.audit-log-list{ display:flex; flex-direction:column; gap:2px; }
.audit-log-row{
  display:flex; align-items:center; gap:12px; padding:9px 12px; border-bottom:1px solid var(--line); font-size:12.5px;
  flex-wrap:wrap;
}
.audit-log-row:last-child{ border-bottom:none; }
.audit-log-actor{ font-weight:700; color:var(--text); flex:none; }
.audit-log-action{ color:var(--text-dim); flex:1; min-width:200px; display:flex; align-items:center; gap:6px; }
.audit-log-stamp{ font-family:var(--font-mono); font-size:11px; flex:none; }
.audit-log-backup-icon{ color:var(--accent); flex:none; }
.audit-log-restore-btn{
  display:inline-flex; align-items:center; gap:5px; background:transparent; border:1px solid var(--accent);
  color:var(--accent); border-radius:8px; padding:5px 11px; font-size:11.5px; font-weight:700; cursor:pointer;
  font-family:var(--font-sans); flex:none; transition:background .15s ease;
}
.audit-log-restore-btn:hover{ background:color-mix(in srgb, var(--accent) 12%, transparent); }
.audit-log-restored-tag{ display:inline-flex; align-items:center; gap:4px; color:var(--green); font-size:11px; font-weight:600; flex:none; }

@media (max-width:760px){
  .brigade-row{ flex-direction:column; align-items:stretch; }
  .brigade-row-contact{ margin-inline-start:0; text-align:right; }
}
`;
