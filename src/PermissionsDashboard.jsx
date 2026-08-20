import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  X, User, Mail, IdCard, LogIn, Clock, Timer, TrendingUp, FileText, Package,
  ChevronDown, ChevronUp, ArrowUpRight, ShieldOff, ShieldAlert, Users2, UserPlus,
  Plus, Check, Bell, Network, Trash2, ToggleLeft, ToggleRight, Pencil, Move,
} from "lucide-react";
import UnitEmblem from "./UnitEmblem.jsx";
import LogoUpload from "./LogoUpload.jsx";
import ScopePicker, { ALL_SCOPE, SCOPE_PICKER_CSS } from "./ScopePicker.jsx";
import Loading from "./Loading.jsx";
import SearchBar from "./SearchBar.jsx";
import FilterSelect from "./FilterSelect.jsx";
import Pagination from "./Pagination.jsx";
import { matchesSearch } from "./search.js";
import { STRUCTURAL_ROLES } from "./roles.js";
import { fetchBrigadeUnits, fetchBrigadeRoster, fetchBrigadeTickets, fetchBrigadeCatalog } from "./brigadeStore.js";
import { StatusPill } from "./opsData.jsx";
import { parseStamp } from "./analytics.js";
import { fetchBlockedList, blockUser, unblockUser, BLOCK_SCOPE } from "./blockStore.js";
import {
  fetchBrigadeTeams, fetchTeamRequests, createTeam, updateTeam, deleteTeam,
  submitTeamRequest, decideTeamRequest, getMemberTeamInfo, TEAM_REQUEST_KIND,
} from "./teamStore.js";
import { pushNotification, NOTIFICATION_TYPES } from "./notificationStore.js";
import { logAction } from "./adminStore.js";

/* ================================================================== */
/* LEGO BLOCK — usePaged: tiny shared pagination-state helper so every  */
/* person/officer list on this screen (unit roster, brigade staff,     */
/* unit officers) pages the same way without repeating the wiring.      */
/* ================================================================== */
function usePaged(items, defaultSize = 10) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultSize);
  useEffect(() => { setPage(1); }, [items.length, pageSize]);
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const shownPage = Math.min(page, pageCount);
  const paged = useMemo(() => items.slice((shownPage - 1) * pageSize, shownPage * pageSize), [items, shownPage, pageSize]);
  return { paged, page: shownPage, pageSize, setPage, setPageSize, totalItems: items.length };
}

/* ================================================================== */
/* LEGO BLOCK — access model. זהה בדיוק למה שהוגדר באשף ההתקנה,        */
/* כדי שלא יהיו שני מקורות אמת. בפרודקשן זה ייבוא משותף אחד.           */
/* ================================================================== */

const CATALOG_ACCESS = { READ: "read", EDITOR: "editor", MANAGER: "manager" };
const TICKET_ACCESS = { NONE: "none", REQUESTER: "requester", MANAGER: "manager" };

const ACCESS_LABELS = {
  catalog: {
    [CATALOG_ACCESS.READ]: "קריאה בלבד",
    [CATALOG_ACCESS.EDITOR]: "עריכה — פריטים שהוספתי",
    [CATALOG_ACCESS.MANAGER]: "ניהול קטלוג מלא",
  },
  ticket: {
    [TICKET_ACCESS.NONE]: "ללא גישה",
    [TICKET_ACCESS.REQUESTER]: "דורש — דרישות אישיות",
    [TICKET_ACCESS.MANAGER]: "מנהל דרישות מלא",
  },
};

const CATALOG_ACCESS_FILTER_OPTIONS = Object.values(CATALOG_ACCESS).map((v) => ({ value: v, label: ACCESS_LABELS.catalog[v] }));

/* ================================================================== */
/* LEGO BLOCK — פעילות משתמש בכרטיס האישי. אין עדיין מערכת session/     */
/* login אמיתית באפליקציה הזו (אין SSO), אז כניסה ראשונה/נראה לאחרונה/  */
/* זמן ממוצע במערכת מדומים — אבל לא רנדומליים על כל רינדור: מבוססים על  */
/* seed קבוע (המספר האישי), כך שאותו אדם תמיד מציג אותם מספרים, בדיוק    */
/* כמו נתון אמיתי שהיה נשמר במסד. לעומת זאת, האנליטיקה (כמה דרישות הגיש, */
/* אחוזי אישור/סירוב, הבקשות האחרונות) היא לא מדומה בכלל — מחושבת ישירות */
/* מנתוני הדרישות/קטלוג האמיתיים של החטיבה (brigadeStore.js), מסוננת    */
/* לפי requestedBy/addedBy התואם לשם האדם הזה בדיוק.                    */
function seededRandom(seed) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return () => {
    h = (h * 1103515245 + 12345) >>> 0;
    return (h % 10000) / 10000;
  };
}

function simulatedActivity(person) {
  const rnd = seededRandom(String(person.personalNumber || person.id));
  const firstLoginDaysAgo = 30 + Math.floor(rnd() * 380);
  const lastSeenMinutesAgo = Math.floor(rnd() * rnd() * 60 * 24 * 6); // מוטה כלפי "לאחרונה"
  const avgSessionMinutes = 8 + Math.floor(rnd() * 38);
  const firstLogin = new Date(Date.now() - firstLoginDaysAgo * 86400000);
  const lastSeen = new Date(Date.now() - lastSeenMinutesAgo * 60000);
  return { firstLogin, lastSeen, avgSessionMinutes };
}

function timeAgoHe(date) {
  const diffMin = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
  if (diffMin < 2) return "ממש עכשיו";
  if (diffMin < 60) return `לפני ${diffMin} דק׳`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `לפני ${diffH} שע׳`;
  const diffD = Math.round(diffH / 24);
  return `לפני ${diffD} ימים`;
}

// כל הדרישות/הצעות הקטלוג שהוגשו על ידי האדם הזה בדיוק (לפי שם מלא תואם),
// ממוינות מהחדש לישן — משמש גם לאנליטיקה (אחוזי אישור) וגם לרשימת "בקשות אחרונות".
function personRequests(person, tickets, catalog) {
  const fullName = `${person.rank} ${person.name}`;
  const myTickets = (tickets || [])
    .filter((t) => t.requestedBy === fullName)
    .map((t) => ({ kind: "ticket", id: t.id, title: t.title, status: t.status, stamp: t.submittedAt, raw: t }));
  const myItems = (catalog || [])
    .filter((it) => it.addedBy === fullName)
    .map((it) => ({ kind: "catalogItem", id: it.id, title: it.name, status: it.status || "active", stamp: it.addedAt, raw: it }));
  return [...myTickets, ...myItems].sort((a, b) => {
    const da = parseStamp(a.stamp)?.getTime() ?? 0;
    const db = parseStamp(b.stamp)?.getTime() ?? 0;
    return db - da;
  });
}

function requestAnalytics(requests) {
  const total = requests.length;
  const approved = requests.filter((r) => r.status === "active" || r.status === "approved").length;
  const rejected = requests.filter((r) => r.status === "rejected").length;
  const pending = total - approved - rejected;
  return {
    total, approved, rejected, pending,
    approvedPct: total ? Math.round((approved / total) * 100) : 0,
    rejectedPct: total ? Math.round((rejected / total) * 100) : 0,
  };
}

const TEAM_REQUEST_KIND_LABEL = {
  [TEAM_REQUEST_KIND.CREATE_SUBTEAM]: "פתיחת תת-צוות חדש",
  [TEAM_REQUEST_KIND.ADD_MEMBER]: "הוספת חייל לתת-צוות",
};

/* ================================================================== */
/* LEGO BLOCK — חסימת משתמש. תמיד בשני שלבים בכוונה (לא כפתור בודד) —   */
/* שלב 1 דורש נימוק בטקסט חופשי, שלב 2 הוא אישור סופי עם תקציר — כדי     */
/* שאף אחד לא יחסום מישהו בטעות בלחיצה אחת.                             */
/* ================================================================== */
function BlockConfirmModal({ person, unit, scopeLabel, onConfirm, onClose }) {
  const [step, setStep] = useState(1);
  const [reason, setReason] = useState("");

  return createPortal(
    <div className="overlay" onClick={onClose}>
      <div className="block-confirm-modal" onClick={(e) => e.stopPropagation()}>
        <button className="drawer-close" onClick={onClose}><X size={16} /></button>
        <div className="block-confirm-icon"><ShieldAlert size={22} /></div>
        {step === 1 ? (
          <>
            <h3>חסימת {person.rank} {person.name}</h3>
            <p>הפעולה תמנע מהמשתמש/ת להשתמש במערכת {scopeLabel}. נדרש נימוק לפני המשך.</p>
            <textarea autoFocus rows={3} placeholder="סיבת החסימה..." value={reason} onChange={(e) => setReason(e.target.value)} />
            <div className="block-confirm-actions">
              <button type="button" className="btn-cancel" onClick={onClose}>ביטול</button>
              <button type="button" className="btn-reject" disabled={!reason.trim()} onClick={() => setStep(2)}>המשך לאישור סופי</button>
            </div>
          </>
        ) : (
          <>
            <h3>אישור סופי</h3>
            <p className="block-confirm-summary">
              את/ה עומד/ת לחסום את <b>{person.rank} {person.name}</b> (מ.א. {person.personalNumber}){unit ? <> מיחידת <b>{unit}</b></> : null} — פעולה זו הפיכה (ניתן לבטל חסימה מרשימת החסומים) אך תמנע ממנו/ה שימוש מיידי במערכת.
            </p>
            <div className="block-confirm-reason-echo">״{reason}״</div>
            <div className="block-confirm-actions">
              <button type="button" className="btn-cancel" onClick={() => setStep(1)}>חזרה</button>
              <button type="button" className="btn-block-confirm" onClick={() => onConfirm(reason.trim())}><ShieldOff size={13} /> אישור חסימה</button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}

/* ================================================================== */
/* LEGO BLOCK — מחיקת צוות: אותו דפוס דו-שלבי בדיוק כמו חסימת משתמש       */
/* (BlockConfirmModal למעלה — משתמש באותן מחלקות CSS בכוונה, זו אותה שפת   */
/* עיצוב ל"פעולה הרסנית עם נימוק"), רק בסמכות קצין אמל״ח (לא כל משתמש).    */
/* ================================================================== */
function TeamDeleteConfirmModal({ team, onConfirm, onClose }) {
  const [step, setStep] = useState(1);
  const [reason, setReason] = useState("");

  return createPortal(
    <div className="overlay" onClick={onClose}>
      <div className="block-confirm-modal" onClick={(e) => e.stopPropagation()}>
        <button className="drawer-close" onClick={onClose}><X size={16} /></button>
        <div className="block-confirm-icon"><Trash2 size={22} /></div>
        {step === 1 ? (
          <>
            <h3>מחיקת {team.name}</h3>
            <p>הפעולה תמחק את הצוות, כל תתי-הצוותים והחברים בו. הפעולה נרשמת ביומן מנהל המערכת וניתנת לשחזור משם. נדרש נימוק לפני המשך.</p>
            <textarea autoFocus rows={3} placeholder="סיבת המחיקה..." value={reason} onChange={(e) => setReason(e.target.value)} />
            <div className="block-confirm-actions">
              <button type="button" className="btn-cancel" onClick={onClose}>ביטול</button>
              <button type="button" className="btn-reject" disabled={!reason.trim()} onClick={() => setStep(2)}>המשך לאישור סופי</button>
            </div>
          </>
        ) : (
          <>
            <h3>אישור סופי</h3>
            <p className="block-confirm-summary">
              את/ה עומד/ת למחוק את <b>{team.name}</b> ({team.unit}), כולל {team.subteams.length} תתי-צוותים וכל החברים בהם.
            </p>
            <div className="block-confirm-reason-echo">״{reason}״</div>
            <div className="block-confirm-actions">
              <button type="button" className="btn-cancel" onClick={() => setStep(1)}>חזרה</button>
              <button type="button" className="btn-block-confirm" onClick={() => onConfirm(reason.trim())}><Trash2 size={13} /> אישור מחיקה</button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}

/* יצירת/עריכת צוות מתוך העץ הארגוני — אותם שדות בדיוק כמו TeamCreateForm/   */
/* TeamCard שבמסך הרשימה, רק כמודל צף כדי שיהיה נוח לפתוח ישירות מתוך העץ.  */
function TeamCreateModal({ unit, unitPeople, onClose, onCreate }) {
  return createPortal(
    <div className="overlay" onClick={onClose}>
      <div className="person-card-modal team-edit-modal" onClick={(e) => e.stopPropagation()}>
        <button className="drawer-close" onClick={onClose}><X size={16} /></button>
        <div className="person-card-section-title">צוות חדש ביחידת {unit}</div>
        <TeamCreateForm unit={unit} unitPeople={unitPeople} onCreate={onCreate} />
      </div>
    </div>,
    document.body
  );
}

function TeamEditModal({ team, unitPeople, onClose, onSave, onRequestDelete }) {
  const [name, setName] = useState(team.name);
  const [logo, setLogo] = useState(team.logo);
  const [leadPick, setLeadPick] = useState("");

  function save() {
    const leadPerson = unitPeople.find((p) => p.id === leadPick);
    onSave({
      name: name.trim() || team.name,
      logo,
      leadRank: leadPerson?.rank ?? team.leadRank,
      leadName: leadPerson?.name ?? team.leadName,
      leadPersonalNumber: leadPerson?.personalNumber ?? team.leadPersonalNumber,
    });
  }

  return createPortal(
    <div className="overlay" onClick={onClose}>
      <div className="person-card-modal team-edit-modal" onClick={(e) => e.stopPropagation()}>
        <button className="drawer-close" onClick={onClose}><X size={16} /></button>
        <div className="person-card-section-title">עריכת צוות</div>
        <LogoUpload compact label="לוגו הצוות" value={logo} onChange={setLogo} fallback={<Users2 size={18} />} />
        <label className="add-form-field" style={{ width: "100%" }}>
          <span>שם הצוות</span>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="add-form-field" style={{ width: "100%" }}>
          <span>ראש הצוות</span>
          <select value={leadPick} onChange={(e) => setLeadPick(e.target.value)}>
            <option value="">{team.leadRank} {team.leadName} (נוכחי — ללא שינוי)</option>
            {unitPeople.map((p) => <option key={p.id} value={p.id}>{p.rank} {p.name} — מ.א. {p.personalNumber}</option>)}
          </select>
        </label>
        <button type="button" className="add-btn" onClick={save}>שמירה</button>
        <div className="person-card-block-row">
          <button type="button" className="btn-block" onClick={onRequestDelete}><Trash2 size={13} /> מחיקת צוות</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ================================================================== */
/* LEGO BLOCK — MoveConfirmModal: אישור דו-שלבי לכל גרירה-ושחרור בעץ      */
/* הארגוני ששינתה בפועל את מיקומו של אדם (יחידה/צוות/תת-צוות) — בלי       */
/* נימוק חובה (זו לא פעולה הרסנית כמו חסימה/מחיקה, רק שיוך ארגוני), אבל   */
/* עדיין שני קליקים ברורים כדי שגרירה בטעות לא תזיז אף אחד בפועל.         */
/* ================================================================== */
function MoveConfirmModal({ personLabel, fromLabel, toLabel, onConfirm, onClose }) {
  const [step, setStep] = useState(1);
  return createPortal(
    <div className="overlay" onClick={onClose}>
      <div className="block-confirm-modal" onClick={(e) => e.stopPropagation()}>
        <button className="drawer-close" onClick={onClose}><X size={16} /></button>
        <div className="block-confirm-icon"><Move size={22} /></div>
        {step === 1 ? (
          <>
            <h3>העברת {personLabel}</h3>
            <p>מ־{fromLabel} אל {toLabel}. השיוך הארגוני יתעדכן מיידית.</p>
            <div className="block-confirm-actions">
              <button type="button" className="btn-cancel" onClick={onClose}>ביטול</button>
              <button type="button" className="btn-reject" onClick={() => setStep(2)}>המשך לאישור סופי</button>
            </div>
          </>
        ) : (
          <>
            <h3>אישור סופי</h3>
            <p className="block-confirm-summary">
              להעביר את <b>{personLabel}</b> מ־<b>{fromLabel}</b> אל <b>{toLabel}</b>?
            </p>
            <div className="block-confirm-actions">
              <button type="button" className="btn-cancel" onClick={() => setStep(1)}>חזרה</button>
              <button type="button" className="btn-block-confirm" onClick={onConfirm}><Move size={13} /> אישור העברה</button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}

/* ================================================================== */
/* LEGO BLOCK — reusable pieces                                        */
/* ================================================================== */

function AccessSelect({ label, value, onChange, options, labels }) {
  return (
    <label className="access-field">
      {label && <span>{label}</span>}
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {Object.values(options).map((v) => (
          <option key={v} value={v}>{labels[v]}</option>
        ))}
      </select>
    </label>
  );
}

function PersonTableHead({ showUnit }) {
  return (
    <div className={"perm-row perm-row-head" + (showUnit ? "" : " no-unit")}>
      <span>איש צוות</span>
      <span>פרטי קשר</span>
      {showUnit && <span>יחידה</span>}
      <span>הרשאת קטלוג</span>
      <span>הרשאת דרישות</span>
      <span></span>
    </div>
  );
}

function PersonRow({ person, onChange, onRemove, showUnit, unitLogos, delay = 0, onOpen, blocked }) {
  return (
    <div
      className={"perm-row" + (showUnit ? "" : " no-unit") + (onOpen ? " perm-row-clickable" : "") + (blocked ? " perm-row-blocked" : "")}
      style={{ animationDelay: `${delay}ms` }}
      onClick={onOpen}
      title={onOpen ? "לחיצה לפתיחת כרטיס משתמש" : undefined}
    >
      <span className="perm-person-name">
        <span className="person-rank">{person.rank}</span> {person.name}
        {blocked && <span className="perm-blocked-tag"><ShieldOff size={10} /> חסום/ה</span>}
      </span>
      <span className="perm-person-contact">
        <span>מ.א. {person.personalNumber}</span>
        {person.email && <span className="perm-person-email">{person.email}</span>}
      </span>
      {showUnit && (
        <span className="ticket-unit-tag">
          <UnitEmblem name={person.unit} size={15} showRing={false} image={unitLogos?.[person.unit]} />
          {person.unit}
        </span>
      )}
      <span onClick={(e) => e.stopPropagation()}>
        <AccessSelect
          value={person.catalogAccess}
          onChange={(v) => onChange({ ...person, catalogAccess: v })}
          options={CATALOG_ACCESS}
          labels={ACCESS_LABELS.catalog}
        />
      </span>
      <span onClick={(e) => e.stopPropagation()}>
        <AccessSelect
          value={person.ticketAccess}
          onChange={(v) => onChange({ ...person, ticketAccess: v })}
          options={TICKET_ACCESS}
          labels={ACCESS_LABELS.ticket}
        />
      </span>
      <button className="person-remove" onClick={(e) => { e.stopPropagation(); onRemove(person.id); }} title="הסרה"><X size={14} /></button>
    </div>
  );
}

export const RANK_OPTIONS = ["טוראי", "רב״ט", "סמל", "סמ״ר", "רס״ל", "סגן", "סרן", "רס״ן", "רס״ר", "סא״ל", "אל״ם"];

function AddPersonForm({ onAdd }) {
  const [rank, setRank] = useState(RANK_OPTIONS[0]);
  const [name, setName] = useState("");
  const [personalNumber, setPersonalNumber] = useState("");
  const [email, setEmail] = useState("");
  const [catalogAccess, setCatalogAccess] = useState(CATALOG_ACCESS.READ);
  const [ticketAccess, setTicketAccess] = useState(TICKET_ACCESS.NONE);

  const canAdd = name.trim() && personalNumber.trim();

  function submit() {
    onAdd({ id: crypto.randomUUID(), rank, name, personalNumber, email, catalogAccess, ticketAccess });
    setName(""); setPersonalNumber(""); setEmail("");
    setCatalogAccess(CATALOG_ACCESS.READ); setTicketAccess(TICKET_ACCESS.NONE);
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
        <input placeholder="לחיבור עתידי למשתמש" value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <AccessSelect label="קטלוג" value={catalogAccess} onChange={setCatalogAccess} options={CATALOG_ACCESS} labels={ACCESS_LABELS.catalog} />
      <AccessSelect label="דרישות" value={ticketAccess} onChange={setTicketAccess} options={TICKET_ACCESS} labels={ACCESS_LABELS.ticket} />
      <button className="add-btn" disabled={!canAdd} onClick={submit}>+ הוספה</button>
    </div>
  );
}

/* ================================================================== */
/* LEGO BLOCK — TeamsSection: ניהול צוותי היחידה, בסמכות קצין אמל״ח      */
/* היחידה (או קצין אמל״ח חטיבה כשהוא ניכנס לתצוגת יחידה ספציפית). יצירת  */
/* צוות ומינוי ראש צוות היא פעולה מיידית — הוא כבר בעל הסמכות המלאה על   */
/* היחידה. כל שינוי בתוך הצוות (תת-צוות/הוספת חייל) שראש הצוות מנסה      */
/* לעשות מגיע לכאן כבקשה ממתינה, כי זו הרשאה חלקית שהאצילו לו, לא שלו.   */
/* ================================================================== */

function TeamCreateForm({ unit, unitPeople, onCreate }) {
  const [name, setName] = useState("");
  const [logo, setLogo] = useState(null);
  const [leadPick, setLeadPick] = useState("");

  const leadPerson = unitPeople.find((p) => p.id === leadPick);
  const canCreate = name.trim() && leadPerson;

  function submit() {
    onCreate({ name: name.trim(), logo, leadRank: leadPerson.rank, leadName: leadPerson.name, leadPersonalNumber: leadPerson.personalNumber });
    setName(""); setLogo(null); setLeadPick("");
  }

  return (
    <div className="add-form team-create-form">
      <LogoUpload compact label="לוגו הצוות" value={logo} onChange={setLogo} fallback={<Users2 size={18} />} />
      <label className="add-form-field">
        <span>שם הצוות</span>
        <input placeholder="לדוגמה: צוות רובוטיקה" value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="add-form-field">
        <span>ראש הצוות</span>
        <select value={leadPick} onChange={(e) => setLeadPick(e.target.value)}>
          <option value="">בחירה מאנשי {unit}...</option>
          {unitPeople.map((p) => <option key={p.id} value={p.id}>{p.rank} {p.name} — מ.א. {p.personalNumber}</option>)}
        </select>
      </label>
      <button className="add-btn" disabled={!canCreate} onClick={submit}><Plus size={14} /> יצירת צוות</button>
    </div>
  );
}

function PendingTeamRequestRow({ req, teamName, onDecide }) {
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState("");
  return (
    <div className="team-request-row">
      <div className="team-request-main">
        <span className="team-request-kind">{TEAM_REQUEST_KIND_LABEL[req.kind]}</span>
        <span className="team-request-detail">
          צוות <b>{teamName}</b>
          {req.kind === TEAM_REQUEST_KIND.CREATE_SUBTEAM && <> — תת-צוות מבוקש: <b>{req.subteamName}</b></>}
          {req.kind === TEAM_REQUEST_KIND.ADD_MEMBER && <> — מועמד/ת: <b>{req.personIdentifier}</b>{req.personNote && <> ({req.personNote})</>}</>}
        </span>
        <span className="team-request-meta">הוגש ע״י {req.requestedBy}</span>
      </div>
      {!showReject ? (
        <div className="team-request-actions">
          <button type="button" className="btn-approve" onClick={() => onDecide(req.id, "approved")}><Check size={13} /> אישור</button>
          <button type="button" className="btn-reject" onClick={() => setShowReject(true)}><X size={13} /> סירוב</button>
        </div>
      ) : (
        <div className="reject-reason-box" onClick={(e) => e.stopPropagation()}>
          <textarea autoFocus rows={2} placeholder="נדרש הסבר לסירוב..." value={reason} onChange={(e) => setReason(e.target.value)} />
          <div className="reject-reason-actions">
            <button type="button" className="btn-cancel" onClick={() => { setShowReject(false); setReason(""); }}>ביטול</button>
            <button type="button" className="btn-reject" disabled={!reason.trim()} onClick={() => { onDecide(req.id, "rejected", reason.trim()); setShowReject(false); }}>אישור סירוב</button>
          </div>
        </div>
      )}
    </div>
  );
}

function TeamCard({ team, onUpdate, onRequestDelete }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(team.name);

  function saveName() {
    if (name.trim() && name.trim() !== team.name) onUpdate(team.id, { name: name.trim() });
    setEditing(false);
  }

  return (
    <div className="team-card">
      <div className="team-card-head">
        {team.logo ? <img className="team-card-logo" src={team.logo} alt="" /> : <span className="team-card-logo-fallback"><Users2 size={16} /></span>}
        <div className="team-card-title">
          {editing ? (
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onBlur={saveName} onKeyDown={(e) => e.key === "Enter" && saveName()} />
          ) : (
            <span onClick={() => setEditing(true)} title="לחיצה לעריכת שם">{team.name} <Pencil size={11} /></span>
          )}
          <span className="team-card-lead">ראש צוות: {team.leadRank} {team.leadName} · מ.א. {team.leadPersonalNumber}</span>
        </div>
        <button type="button" className="team-card-delete" title="מחיקת צוות" onClick={onRequestDelete}><Trash2 size={13} /></button>
      </div>
      <div className="team-card-toggle-row">
        <span>{team.requireLeadApproval ? <ToggleRight size={15} className="tone-green" /> : <ToggleLeft size={15} />} דרוש אישור ראש צוות לבקשות (נשלט על ידי ראש הצוות)</span>
      </div>
      {team.subteams.length === 0 ? (
        <div className="team-card-empty">אין עדיין תתי-צוותים.</div>
      ) : (
        <div className="team-card-subteams">
          {team.subteams.map((s) => (
            <div key={s.id} className="team-card-subteam">
              <Network size={12} /> {s.name} <span className="team-card-subteam-count">({s.members.length} חברים)</span>
              {s.members.length > 0 && (
                <span className="team-card-subteam-members">{s.members.map((m) => m.identifier).join(", ")}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TeamsSection({ brigadeId, unit, unitPeople, onChanged, actorLabel }) {
  const [teams, setTeams] = useState(null);
  const [requests, setRequests] = useState([]);
  const [deletingTeam, setDeletingTeam] = useState(null);

  function reload() {
    Promise.all([fetchBrigadeTeams(brigadeId), fetchTeamRequests(brigadeId)]).then(([t, r]) => {
      setTeams(t.filter((x) => x.unit === unit));
      setRequests(r.filter((x) => x.status === "pending" && x.unit === unit));
    });
    onChanged?.(); // מסנכרן גם את teams ברמת השורש (העץ הארגוני קורא משם, לא מה-state המקומי כאן)
  }
  useEffect(() => { setTeams(null); reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [brigadeId, unit]);

  async function handleCreate(data) {
    await createTeam(brigadeId, { unit, ...data });
    await logAction({ actor: actorLabel, action: `יצירת צוות — ${data.name} (${unit})`, target: `${unit} / ${data.name}` });
    reload();
  }
  async function handleUpdate(teamId, patch) {
    const team = teams?.find((t) => t.id === teamId);
    await updateTeam(brigadeId, teamId, patch);
    await logAction({ actor: actorLabel, action: `עריכת צוות — ${team?.name || teamId} (${unit})`, target: `${unit} / ${team?.name || teamId}` });
    reload();
  }
  // מחיקת צוות — רק בסמכות קצין אמל״ח (הרכיב הזה כבר נגיש רק מתוך מסך
  // הרשאות היחידה/החטיבה), ותמיד דרך אישור דו-שלבי עם נימוק (TeamDeleteConfirmModal)
  // כמו חסימת משתמש — לא לחיצה בודדת. הפעולה נרשמת ביומן עם snapshot מלא של
  // הצוות, כדי שמנהל מערכת יוכל לשחזר אותה משם (ראו adminStore.js/SystemAdmin.jsx).
  async function handleDelete(team, reason) {
    await deleteTeam(brigadeId, team.id);
    await logAction({
      actor: actorLabel, action: `מחיקת צוות — ${team.name} (${unit}) — סיבה: ${reason}`,
      target: `${unit} / ${team.name}`, targetType: "team", snapshot: { ...team, __brigadeId: brigadeId },
    });
    setDeletingTeam(null);
    reload();
  }
  async function handleDecide(reqId, decision, reason) {
    const req = requests.find((r) => r.id === reqId);
    await decideTeamRequest(brigadeId, reqId, decision, { reason, decidedBy: "קצין אמל״ח יחידה (הדגמה)" });
    if (req) {
      pushNotification(brigadeId, {
        kind: "teamRequest", unit, requestedBy: req.requestedBy,
        type: decision === "approved" ? NOTIFICATION_TYPES.APPROVED : NOTIFICATION_TYPES.REJECTED,
        message: decision === "approved"
          ? `הבקשה שלך (${TEAM_REQUEST_KIND_LABEL[req.kind]}) אושרה`
          : `הבקשה שלך (${TEAM_REQUEST_KIND_LABEL[req.kind]}) סורבה: ${reason}`,
      });
    }
    reload();
  }

  if (teams === null) return null;

  return (
    <>
      <div className="section-title">צוותי {unit}</div>
      {teams.length === 0 ? (
        <div className="empty">עדיין לא נוצרו צוותים ביחידה זו.</div>
      ) : (
        <div className="team-card-grid">
          {teams.map((t) => <TeamCard key={t.id} team={t} onUpdate={handleUpdate} onRequestDelete={() => setDeletingTeam(t)} />)}
        </div>
      )}

      {requests.length > 0 && (
        <>
          <div className="section-title">
            <Bell size={12} style={{ verticalAlign: "-2px" }} /> בקשות ארגון ממתינות ({requests.length})
          </div>
          <div className="team-request-list">
            {requests.map((r) => (
              <PendingTeamRequestRow key={r.id} req={r} teamName={teams.find((t) => t.id === r.teamId)?.name || "?"} onDecide={handleDecide} />
            ))}
          </div>
        </>
      )}

      <div className="section-title">יצירת צוות חדש</div>
      <TeamCreateForm unit={unit} unitPeople={unitPeople} onCreate={handleCreate} />

      {deletingTeam && (
        <TeamDeleteConfirmModal team={deletingTeam} onClose={() => setDeletingTeam(null)} onConfirm={(reason) => handleDelete(deletingTeam, reason)} />
      )}
    </>
  );
}

/* ================================================================== */
/* Unit officer dashboard — reduced scope: only their own unit          */
/* ================================================================== */

function UnitRoster({ unit, unitPeople, setUnitPeople, unitLogos, onOpenPerson, blockedNumbers }) {
  const people = unitPeople[unit] || [];
  const [query, setQuery] = useState("");
  const [accessFilter, setAccessFilter] = useState("all");

  useEffect(() => { setQuery(""); setAccessFilter("all"); }, [unit]);

  const filtered = people.filter(
    (p) =>
      matchesSearch([p.rank, p.name, p.personalNumber, p.email], query) &&
      (accessFilter === "all" || p.catalogAccess === accessFilter)
  );
  const { paged, page, pageSize, setPage, setPageSize, totalItems } = usePaged(filtered);

  function addPerson(p) {
    setUnitPeople((prev) => ({ ...prev, [unit]: [...(prev[unit] || []), p] }));
  }
  function updatePerson(updated) {
    setUnitPeople((prev) => ({
      ...prev,
      [unit]: prev[unit].map((p) => (p.id === updated.id ? updated : p)),
    }));
  }
  function removePerson(id) {
    setUnitPeople((prev) => ({ ...prev, [unit]: prev[unit].filter((p) => p.id !== id) }));
  }

  return (
    <>
      <div className="section-title">אנשי {unit}</div>
      {people.length > 0 && (
        <SearchBar value={query} onChange={setQuery} placeholder="חיפוש לפי שם, מספר אישי או אימייל...">
          <FilterSelect value={accessFilter} onChange={setAccessFilter} options={CATALOG_ACCESS_FILTER_OPTIONS} allLabel="כל רמות הגישה" ariaLabel="סינון לפי הרשאת קטלוג" />
        </SearchBar>
      )}
      {people.length === 0 && <div className="empty">עדיין לא נוספו אנשים ליחידה זו.</div>}
      {people.length > 0 && filtered.length === 0 && <div className="empty">לא נמצאו אנשים התואמים את החיפוש.</div>}
      {filtered.length > 0 && (
        <>
          <div className="perm-table">
            <PersonTableHead />
            {paged.map((p, idx) => (
              <PersonRow
                key={p.id} person={p} onChange={updatePerson} onRemove={removePerson} unitLogos={unitLogos} delay={idx * 30}
                onOpen={onOpenPerson ? () => onOpenPerson(p, "unit", unit) : undefined}
                blocked={blockedNumbers?.has(p.personalNumber)}
              />
            ))}
          </div>
          <Pagination page={page} pageSize={pageSize} totalItems={totalItems} onPageChange={setPage} onPageSizeChange={setPageSize} />
        </>
      )}

      <div className="section-title">הוספת איש צוות</div>
      <AddPersonForm onAdd={addPerson} />
    </>
  );
}

function UnitPermissionsView({ unit, unitPeople, setUnitPeople, unitLogos, onOpenPerson, blockedNumbers, brigadeId, onTeamsChanged, actorLabel }) {
  return (
    <div>
      <div className="view-head">
        <h1>ניהול הרשאות — יחידה</h1>
        <p>תצוגה מצומצמת: כל קצין אמל״ח יחידה מנהל רק את אנשי היחידה שלו.</p>
      </div>

      <div className="unit-context">
        <UnitEmblem name={unit} size={30} image={unitLogos?.[unit]} />
        <div>
          <div className="unit-context-label">היחידה שלך</div>
          <div className="unit-context-value">{unit}</div>
        </div>
      </div>

      <UnitRoster unit={unit} unitPeople={unitPeople} setUnitPeople={setUnitPeople} unitLogos={unitLogos} onOpenPerson={onOpenPerson} blockedNumbers={blockedNumbers} />

      <TeamsSection brigadeId={brigadeId} unit={unit} unitPeople={unitPeople[unit] || []} onChanged={onTeamsChanged} actorLabel={actorLabel} />
    </div>
  );
}

/* ================================================================== */
/* Brigade officer dashboard — full scope                              */
/* ================================================================== */

function BrigadePermissionsView({
  units, unitOfficers, setUnitOfficers, brigadeStaff, setBrigadeStaff,
  unitPeople, setUnitPeople, unitLogos, onOpenPerson, blockedNumbers, brigadeId, onTeamsChanged, actorLabel,
}) {
  const [drill, setDrill] = useState(ALL_SCOPE);
  const [officerQuery, setOfficerQuery] = useState("");
  const [staffQuery, setStaffQuery] = useState("");
  const [staffAccessFilter, setStaffAccessFilter] = useState("all");

  const filteredOfficers = unitOfficers.filter((o) =>
    matchesSearch([o.unit, o.rank, o.name, o.personalNumber], officerQuery)
  );
  const filteredStaff = brigadeStaff.filter(
    (p) =>
      matchesSearch([p.rank, p.name, p.personalNumber, p.email], staffQuery) &&
      (staffAccessFilter === "all" || p.catalogAccess === staffAccessFilter)
  );
  const officersPage = usePaged(filteredOfficers);
  const staffPage = usePaged(filteredStaff);

  function updateOfficer(id, patch) {
    setUnitOfficers((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  }
  function addStaff(p) {
    setBrigadeStaff((prev) => [...prev, p]);
  }
  function updateStaff(updated) {
    setBrigadeStaff((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  }
  function removeStaff(id) {
    setBrigadeStaff((prev) => prev.filter((p) => p.id !== id));
  }

  const drillOfficer = unitOfficers.find((o) => o.unit === drill);

  return (
    <div>
      <div className="view-head view-head-row">
        <div>
          <h1>ניהול הרשאות — חטיבה</h1>
          <p>
            {drill === ALL_SCOPE
              ? "תצוגה מלאה: הגדרת קציני אמל״ח ביחידות, וניהול צוות ברמת החטיבה."
              : `תצוגה אישית ליחידת ${drill} — נצפית דרך הרשאת החטיבה.`}
          </p>
        </div>
        <ScopePicker scope={drill} setScope={setDrill} units={units} allLabel="כלל החטיבה" allEmblemName="חטיבה" unitLogos={unitLogos} />
      </div>

      {drill === ALL_SCOPE ? (
        <>
          <div className="section-title">קציני אמל״ח ביחידות</div>
          {unitOfficers.length > 3 && (
            <SearchBar value={officerQuery} onChange={setOfficerQuery} placeholder="חיפוש לפי יחידה, שם או מספר אישי..." />
          )}
          {filteredOfficers.length === 0 ? (
            <div className="empty">לא נמצאו קציני אמל״ח התואמים את החיפוש.</div>
          ) : (
            <>
              <div className="officer-list">
                {officersPage.paged.map((o, idx) => (
                  <div className={"officer-row" + (blockedNumbers?.has(o.personalNumber) ? " perm-row-blocked" : "")} key={o.id} style={{ animationDelay: `${idx * 40}ms` }}>
                    <div className="officer-unit">
                      <UnitEmblem name={o.unit} size={26} image={unitLogos?.[o.unit]} />
                      {o.unit}
                      {blockedNumbers?.has(o.personalNumber) && <span className="perm-blocked-tag"><ShieldOff size={10} /> חסום/ה</span>}
                    </div>
                    <select className="officer-input officer-rank-input" value={o.rank} onChange={(e) => updateOfficer(o.id, { rank: e.target.value })}>
                      {RANK_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <input className="officer-input" value={o.name} onChange={(e) => updateOfficer(o.id, { name: e.target.value })} placeholder="שם קצין אמל״ח" />
                    <input className="officer-input" value={o.personalNumber} inputMode="numeric"
                      onChange={(e) => updateOfficer(o.id, { personalNumber: e.target.value.replace(/\D/g, "") })} placeholder="מספר אישי" />
                    {onOpenPerson && (
                      <button type="button" className="officer-open-card" title="פתיחת כרטיס משתמש" onClick={() => onOpenPerson(o, "officer", o.unit)}>
                        <User size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <Pagination page={officersPage.page} pageSize={officersPage.pageSize} totalItems={officersPage.totalItems} onPageChange={officersPage.setPage} onPageSizeChange={officersPage.setPageSize} />
            </>
          )}

          <div className="section-title">צוות חטיבתי נוסף</div>
          {brigadeStaff.length > 0 && (
            <SearchBar value={staffQuery} onChange={setStaffQuery} placeholder="חיפוש לפי שם, מספר אישי או אימייל...">
              <FilterSelect value={staffAccessFilter} onChange={setStaffAccessFilter} options={CATALOG_ACCESS_FILTER_OPTIONS} allLabel="כל רמות הגישה" ariaLabel="סינון לפי הרשאת קטלוג" />
            </SearchBar>
          )}
          {brigadeStaff.length === 0 && <div className="empty">אין עדיין אנשי צוות חטיבתיים נוספים.</div>}
          {brigadeStaff.length > 0 && filteredStaff.length === 0 && <div className="empty">לא נמצאו אנשי צוות התואמים את החיפוש.</div>}
          {filteredStaff.length > 0 && (
            <>
              <div className="perm-table">
                <PersonTableHead />
                {staffPage.paged.map((p, idx) => (
                  <PersonRow
                    key={p.id} person={p} onChange={updateStaff} onRemove={removeStaff} unitLogos={unitLogos} delay={idx * 30}
                    onOpen={onOpenPerson ? () => onOpenPerson(p, "staff", null) : undefined}
                    blocked={blockedNumbers?.has(p.personalNumber)}
                  />
                ))}
              </div>
              <Pagination page={staffPage.page} pageSize={staffPage.pageSize} totalItems={staffPage.totalItems} onPageChange={staffPage.setPage} onPageSizeChange={staffPage.setPageSize} />
            </>
          )}

          <div className="section-title">הוספת איש צוות חטיבתי</div>
          <AddPersonForm onAdd={addStaff} />
        </>
      ) : (
        <>
          {drillOfficer && (
            <div className="drill-officer-tag">
              <UnitEmblem name={drill} size={22} showRing={false} image={unitLogos?.[drill]} />
              קצין אמל״ח היחידה: <b>{drillOfficer.rank} {drillOfficer.name}</b>
              <span className="drill-officer-email">מ.א. {drillOfficer.personalNumber}</span>
            </div>
          )}
          <UnitRoster unit={drill} unitPeople={unitPeople} setUnitPeople={setUnitPeople} unitLogos={unitLogos} onOpenPerson={onOpenPerson} blockedNumbers={blockedNumbers} />
          <TeamsSection brigadeId={brigadeId} unit={drill} unitPeople={unitPeople[drill] || []} onChanged={onTeamsChanged} actorLabel={actorLabel} />
        </>
      )}
    </div>
  );
}

/* ================================================================== */
/* Org tree — LEGO BLOCK. שכבה אחת מעל ומתחת למי שצופה, או התרשים המלא. */
/* ================================================================== */

function OrgNode({
  title, sub, emblem, emblemImage, highlight, dashed, group, onClick, children,
  draggable, onDragStart, onDragOver, onDragLeave, onDrop, dropActive, dragging,
}) {
  const clickable = !!onClick;
  const Card = clickable || draggable ? "button" : "div";
  return (
    <div className={"org-node" + (highlight ? " org-node-you" : "")}>
      <Card
        type={clickable || draggable ? "button" : undefined}
        className={
          "org-node-card" + (clickable ? " org-node-card-clickable" : "") + (dashed ? " org-node-card-dashed" : "")
          + (group ? " org-node-card-group" : "") + (dropActive ? " org-node-card-drop-active" : "") + (dragging ? " org-node-card-dragging" : "")
        }
        onClick={onClick}
        draggable={draggable || undefined}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        title={clickable ? (dashed ? "לחיצה ליצירת צוות" : "לחיצה לפתיחת כרטיס/עריכה") : draggable ? "ניתן לגרירה למיקום אחר" : undefined}
      >
        {emblem && <UnitEmblem name={emblem} size={24} showRing={false} image={emblemImage} />}
        {clickable && !emblem && <span className="org-node-person-icon"><User size={14} /></span>}
        {!clickable && draggable && <span className="org-node-drag-handle"><Move size={12} /></span>}
        <div>
          <div className="org-node-title">{title}</div>
          {sub && <div className="org-node-sub">{sub}</div>}
        </div>
        {highlight && <span className="org-node-you-tag">אתה כאן</span>}
      </Card>
      {children && children.length > 0 && (
        <div className="org-node-children">
          {children.map((c, i) => <React.Fragment key={i}>{c}</React.Fragment>)}
        </div>
      )}
    </div>
  );
}

function OrgTree({
  role, brigadeName, myUnit, units, unitOfficers, brigadeStaff, unitPeople, unitLogos, teams, onSelectPerson,
  canManageUnit, onCreateTeam, onEditTeam, onRequestMove,
}) {
  // גרירה ושחרור — מצב מקומי לתצוגה בלבד (מי נגרר כרגע, על מה עכשיו רחפים);
  // השינוי בפועל לא קורה כאן, רק onRequestMove מודיע למעלה *מה* ביקשו
  // להזיז ולאן — השורש (PermissionsDashboard) הוא שמציג את אישור השני-
  // השלבים ומבצע את המהלך בפועל אחרי אישור.
  const [dragPerson, setDragPerson] = useState(null); // { person, fromUnit }
  const [dragOverKey, setDragOverKey] = useState(null);

  const personLeaf = (p, kind, unit) => {
    const canDrag = kind === "unit" && !!canManageUnit?.(unit);
    return (
      <OrgNode
        key={p.id}
        title={`${p.rank} ${p.name}`}
        sub={`מ.א. ${p.personalNumber}`}
        onClick={() => onSelectPerson({ person: p, kind, unit })}
        draggable={canDrag}
        dragging={dragPerson?.person.id === p.id}
        onDragStart={canDrag ? (e) => { e.dataTransfer.effectAllowed = "move"; setDragPerson({ person: p, fromUnit: unit }); } : undefined}
      />
    );
  };

  // צוותי היחידה — שכבה נוספת מתחת לאנשים הישירים, לא תחליף להם (unitPeople
  // הוא כל מרשם היחידה; team.subteams.members הם רק מזהים חופשיים שהוגשו
  // בבקשות תקן, לא רשומות אדם מלאות — לכן ענפי תת-הצוות/החברים אינם לחיצים,
  // אבל כרטיס הצוות עצמו כן לחיץ לעריכה, ותתי-הצוות הם יעדי גרירה תקפים.
  const teamNode = (team) => {
    const manageable = canManageUnit?.(team.unit);
    return (
      <OrgNode
        key={team.id} title={team.name} emblem={team.name} emblemImage={team.logo}
        sub={`ראש צוות: ${team.leadRank} ${team.leadName}`}
        onClick={manageable ? () => onEditTeam(team) : undefined}
      >
        {team.subteams.map((s) => {
          const dropKey = `subteam:${s.id}`;
          const canDropHere = !!dragPerson && manageable;
          return (
            <OrgNode
              key={s.id} title={s.name} sub={`${s.members.length} חברים`}
              dropActive={dragOverKey === dropKey}
              onDragOver={canDropHere ? (e) => { e.preventDefault(); setDragOverKey(dropKey); } : undefined}
              onDragLeave={canDropHere ? () => setDragOverKey((k) => (k === dropKey ? null : k)) : undefined}
              onDrop={
                canDropHere
                  ? (e) => {
                      e.preventDefault();
                      onRequestMove(dragPerson.person, dragPerson.fromUnit, team.unit, team.id, s.id);
                      setDragPerson(null); setDragOverKey(null);
                    }
                  : undefined
              }
            >
              {s.members.map((m, i) => <OrgNode key={i} title={m.identifier} sub={m.note || undefined} />)}
            </OrgNode>
          );
        })}
      </OrgNode>
    );
  };
  const teamsForUnit = (u) => (teams || []).filter((t) => t.unit === u);
  const addTeamNode = (u) =>
    canManageUnit?.(u) ? <OrgNode key="add-team" title="+ צוות חדש" sub="לחיצה ליצירה" dashed onClick={() => onCreateTeam(u)} /> : null;

  // ענף "אנשי אמל״ח היחידה" (אנשים ישירים) וענף "צוותים" — שני ענפים נפרדים
  // תחת כל יחידה, לא שורה אחת מעורבת של אנשים וצוותים זה לצד זה. יחידת הענף
  // עצמה (ולא צומת היחידה) היא יעד הגרירה ל"הוצאה מצוות בחזרה לאמל״ח הכללי",
  // וצומת היחידה עצמו הוא יעד הגרירה למעבר יחידה שלמה.
  function unitBranches(u) {
    const people = unitPeople[u] || [];
    const teamsInUnit = teamsForUnit(u);
    const peopleDropKey = `people:${u}`;
    const canDropOnPeople = !!dragPerson && canManageUnit?.(u);
    const peopleBranch = people.length > 0 && (
      <OrgNode
        key="people-group" title="אנשי אמל״ח היחידה" sub={`${people.length} אנשים`} group
        dropActive={dragOverKey === peopleDropKey}
        onDragOver={canDropOnPeople ? (e) => { e.preventDefault(); setDragOverKey(peopleDropKey); } : undefined}
        onDragLeave={canDropOnPeople ? () => setDragOverKey((k) => (k === peopleDropKey ? null : k)) : undefined}
        onDrop={
          canDropOnPeople
            ? (e) => { e.preventDefault(); onRequestMove(dragPerson.person, dragPerson.fromUnit, u, null, null); setDragPerson(null); setDragOverKey(null); }
            : undefined
        }
      >
        {people.map((p) => personLeaf(p, "unit", u))}
      </OrgNode>
    );
    const teamsBranch = (teamsInUnit.length > 0 || canManageUnit?.(u)) && (
      <OrgNode key="teams-group" title="צוותים" sub={teamsInUnit.length > 0 ? `${teamsInUnit.length} צוותים` : "אין עדיין צוותים"} group>
        {[...teamsInUnit.map(teamNode), addTeamNode(u)].filter(Boolean)}
      </OrgNode>
    );
    return [peopleBranch, teamsBranch].filter(Boolean);
  }

  if (role === STRUCTURAL_ROLES.UNIT_OFFICER) {
    const officer = unitOfficers.find((o) => o.unit === myUnit);
    const meDropKey = `unit:${myUnit}`;
    const canDropOnMe = !!dragPerson;
    return (
      <div className="org-tree">
        <OrgNode title={brigadeName} sub="שכבה אחת מעליך">
          {[
            <OrgNode
              key="me"
              title={myUnit}
              emblem={myUnit}
              emblemImage={unitLogos?.[myUnit]}
              sub={officer ? `${officer.rank} ${officer.name} — אתה` : undefined}
              highlight
              onClick={officer ? () => onSelectPerson({ person: officer, kind: "officer", unit: myUnit }) : undefined}
              dropActive={dragOverKey === meDropKey}
              onDragOver={canDropOnMe ? (e) => { e.preventDefault(); setDragOverKey(meDropKey); } : undefined}
              onDragLeave={canDropOnMe ? () => setDragOverKey((k) => (k === meDropKey ? null : k)) : undefined}
              onDrop={
                canDropOnMe
                  ? (e) => { e.preventDefault(); onRequestMove(dragPerson.person, dragPerson.fromUnit, myUnit, null, null); setDragPerson(null); setDragOverKey(null); }
                  : undefined
              }
            >
              {unitBranches(myUnit)}
            </OrgNode>,
          ]}
        </OrgNode>
      </div>
    );
  }

  // brigade officer / admin — full tree
  return (
    <div className="org-tree">
      <OrgNode title={brigadeName} sub={`${unitOfficers.length} יחידות · ${brigadeStaff.length} אנשי צוות חטיבתי`}>
        {[
          ...units.map((u) => {
            const officer = unitOfficers.find((o) => o.unit === u);
            const dropKey = `unit:${u}`;
            const canDropHere = !!dragPerson && canManageUnit?.(u);
            return (
              <OrgNode
                key={u}
                title={u}
                emblem={u}
                emblemImage={unitLogos?.[u]}
                sub={officer ? `${officer.rank} ${officer.name}` : "טרם מונה קצין"}
                onClick={officer ? () => onSelectPerson({ person: officer, kind: "officer", unit: u }) : undefined}
                dropActive={dragOverKey === dropKey}
                onDragOver={canDropHere ? (e) => { e.preventDefault(); setDragOverKey(dropKey); } : undefined}
                onDragLeave={canDropHere ? () => setDragOverKey((k) => (k === dropKey ? null : k)) : undefined}
                onDrop={
                  canDropHere
                    ? (e) => { e.preventDefault(); onRequestMove(dragPerson.person, dragPerson.fromUnit, u, null, null); setDragPerson(null); setDragOverKey(null); }
                    : undefined
                }
              >
                {unitBranches(u)}
              </OrgNode>
            );
          }),
          brigadeStaff.length > 0 && (
            <OrgNode key="staff" title="צוות חטיבתי" sub="ישירות תחת מפקדת החטיבה">
              {brigadeStaff.map((p) => personLeaf(p, "staff", null))}
            </OrgNode>
          ),
        ].filter(Boolean)}
      </OrgNode>
    </div>
  );
}

/* כרטיס משתמש — נפתח בלחיצה על אדם בעץ הארגוני (ראו OrgTree), כדי       */
/* שקצין יוכל לראות פרטים ולערוך הרשאות ישירות מהעץ, בלי לעבור למסך        */
/* הרשימה. עורך את אותם שני שדות בדיוק (הרשאת קטלוג/דרישות) שכל שורה       */
/* ברשימה כבר עורכת — אין כאן מודל הרשאות נפרד, רק כניסה נוספת אליו.       */
const REQUEST_KIND_ICON = { ticket: FileText, catalogItem: Package };
const REQUEST_KIND_LABEL = { ticket: "דרישה", catalogItem: "פריט קטלוג" };

function PersonCardModal({
  person, unit, kind, unitLogos, tickets, catalog, onChange, onClose, onViewTicket, onViewCatalogItem,
  canBlock, blockedEntry, onBlock, onUnblock, teamInfo,
}) {
  const [showAllRequests, setShowAllRequests] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const isOfficer = kind === "officer";

  const activity = useMemo(() => simulatedActivity(person), [person.id, person.personalNumber]);
  const requests = useMemo(() => personRequests(person, tickets, catalog), [person, tickets, catalog]);
  const analytics = useMemo(() => requestAnalytics(requests), [requests]);
  const shownRequests = showAllRequests ? requests : requests.slice(0, 3);

  function openRequest(r) {
    onClose();
    if (r.kind === "ticket") onViewTicket?.(r.id);
    else onViewCatalogItem?.(r.id);
  }

  return createPortal(
    <div className="overlay" onClick={onClose}>
      <div className="person-card-modal" onClick={(e) => e.stopPropagation()}>
        <button className="drawer-close" onClick={onClose}><X size={16} /></button>
        <div className="person-card-head">
          <div className="person-card-avatar"><User size={22} /></div>
          <div>
            <div className="person-card-name"><span className="person-rank">{person.rank}</span> {person.name}</div>
            {unit && (
              <div className="person-card-unit">
                <UnitEmblem name={unit} size={15} showRing={false} image={unitLogos?.[unit]} />
                {unit}
              </div>
            )}
          </div>
        </div>

        <div className="person-card-meta">
          <span><IdCard size={13} /> מ.א. {person.personalNumber}</span>
          {person.email && <span><Mail size={13} /> {person.email}</span>}
          {teamInfo && <span><Users2 size={13} /> צוות {teamInfo.team.name} — {teamInfo.subteam.name}</span>}
        </div>

        {blockedEntry && (
          <div className="person-card-blocked-banner">
            <ShieldOff size={14} />
            <span>משתמש/ת זה/ו חסום/ה {blockedEntry.scope === BLOCK_SCOPE.BRIGADE ? "ברמת החטיבה" : "ביחידה"} — סיבה: {blockedEntry.reason}</span>
          </div>
        )}

        <div className="person-card-section-title">פעילות במערכת</div>
        <div className="person-card-stat-grid">
          <div className="person-card-stat">
            <span><LogIn size={12} /> כניסה ראשונה</span>
            <b>{activity.firstLogin.toLocaleDateString("he-IL")}</b>
          </div>
          <div className="person-card-stat">
            <span><Clock size={12} /> נראה לאחרונה</span>
            <b>{timeAgoHe(activity.lastSeen)}</b>
          </div>
          <div className="person-card-stat">
            <span><Timer size={12} /> זמן ממוצע במערכת</span>
            <b>{activity.avgSessionMinutes} דק׳ לכניסה</b>
          </div>
        </div>

        <div className="person-card-section-title">אנליטיקת בקשות</div>
        <div className="person-card-stat-grid">
          <div className="person-card-stat">
            <span><TrendingUp size={12} /> סה״כ הוגשו</span>
            <b>{analytics.total}</b>
          </div>
          <div className="person-card-stat person-card-stat-green">
            <span>אושרו</span>
            <b>{analytics.approvedPct}%</b>
          </div>
          <div className="person-card-stat person-card-stat-red">
            <span>נדחו</span>
            <b>{analytics.rejectedPct}%</b>
          </div>
        </div>
        {analytics.total > 0 && (
          <div className="person-card-bar">
            <span className="person-card-bar-approved" style={{ width: `${analytics.approvedPct}%` }} />
            <span className="person-card-bar-pending" style={{ width: `${100 - analytics.approvedPct - analytics.rejectedPct}%` }} />
            <span className="person-card-bar-rejected" style={{ width: `${analytics.rejectedPct}%` }} />
          </div>
        )}

        <div className="person-card-section-title-row">
          <span className="person-card-section-title">בקשות אחרונות ({analytics.total})</span>
          {requests.length > 3 && (
            <button type="button" className="person-card-toggle" onClick={() => setShowAllRequests((v) => !v)}>
              {showAllRequests ? <><ChevronUp size={12} /> הצג פחות</> : <><ChevronDown size={12} /> הצג הכל</>}
            </button>
          )}
        </div>
        {requests.length === 0 ? (
          <div className="person-card-empty">טרם הוגשו בקשות על ידי משתמש זה.</div>
        ) : (
          <div className="person-card-requests">
            {shownRequests.map((r) => {
              const Icon = REQUEST_KIND_ICON[r.kind];
              return (
                <button type="button" key={r.kind + r.id} className="person-card-request-row" onClick={() => openRequest(r)}>
                  <Icon size={13} className="person-card-request-icon" />
                  <span className="person-card-request-main">
                    <span className="person-card-request-title">{r.title}</span>
                    <span className="person-card-request-meta">{REQUEST_KIND_LABEL[r.kind]} · {r.id} · {r.stamp}</span>
                  </span>
                  <StatusPill status={r.status === "active" ? "approved" : r.status} />
                  <ArrowUpRight size={13} className="person-card-request-arrow" />
                </button>
              );
            })}
          </div>
        )}

        {isOfficer ? (
          <div className="person-card-officer-note">קצין/ת אמל״ח — הרשאה מלאה על יחידת {unit}, אינה נשלטת דרך שדות הרשאה רגילים.</div>
        ) : (
          <>
            <div className="person-card-section-title">הרשאות גישה</div>
            <div className="person-card-access">
              <AccessSelect
                label="הרשאת קטלוג"
                value={person.catalogAccess}
                onChange={(v) => onChange({ ...person, catalogAccess: v })}
                options={CATALOG_ACCESS}
                labels={ACCESS_LABELS.catalog}
              />
              <AccessSelect
                label="הרשאת דרישות"
                value={person.ticketAccess}
                onChange={(v) => onChange({ ...person, ticketAccess: v })}
                options={TICKET_ACCESS}
                labels={ACCESS_LABELS.ticket}
              />
            </div>
          </>
        )}

        {canBlock && (
          <div className="person-card-block-row">
            {blockedEntry ? (
              <button type="button" className="btn-unblock" onClick={() => onUnblock(blockedEntry.id)}>ביטול חסימה</button>
            ) : (
              <button type="button" className="btn-block" onClick={() => setShowBlockModal(true)}><ShieldOff size={13} /> חסימת משתמש</button>
            )}
          </div>
        )}
      </div>

      {showBlockModal && (
        <BlockConfirmModal
          person={person}
          unit={unit}
          scopeLabel={unit ? `ביחידת ${unit}` : "בחטיבה"}
          onClose={() => setShowBlockModal(false)}
          onConfirm={(reason) => { onBlock(reason); setShowBlockModal(false); }}
        />
      )}
    </div>,
    document.body
  );
}

/* ================================================================== */
/* LEGO BLOCK — BlockedListPanel: רשימת החסומים, בהיקף הצפייה של הקצין —  */
/* קצין אמל״ח יחידה רואה רק את חסימות היחידה שלו, קצין אמל״ח חטיבה/מנהל   */
/* מערכת רואה את כל החטיבה (חסימות חטיבה + כל חסימות היחידות).           */
/* ================================================================== */
function BlockedListPanel({ isBrigadeScope, myUnit, blockedList, unitLogos, onUnblock }) {
  const scoped = isBrigadeScope ? blockedList : blockedList.filter((b) => b.scope === BLOCK_SCOPE.UNIT && b.unit === myUnit);
  return (
    <div>
      <div className="view-head">
        <h1>משתמשים חסומים</h1>
        <p>{isBrigadeScope ? "כלל החסימות בחטיבה — ברמת חטיבה וברמת יחידה." : `חסימות ביחידת ${myUnit} בלבד.`}</p>
      </div>
      {scoped.length === 0 ? (
        <div className="empty">אין כרגע אף משתמש חסום {isBrigadeScope ? "בחטיבה" : "ביחידה"}.</div>
      ) : (
        <div className="blocked-list">
          {scoped.map((b, idx) => (
            <div className="blocked-row" key={b.id} style={{ animationDelay: `${idx * 30}ms` }}>
              <div className="blocked-row-main">
                <span className="perm-person-name"><span className="person-rank">{b.rank}</span> {b.name}</span>
                <span className="perm-person-contact"><span>מ.א. {b.personalNumber}</span></span>
                {b.unit && (
                  <span className="ticket-unit-tag">
                    <UnitEmblem name={b.unit} size={14} showRing={false} image={unitLogos?.[b.unit]} />
                    {b.unit}
                  </span>
                )}
                <span className={"blocked-scope-tag" + (b.scope === BLOCK_SCOPE.BRIGADE ? " scope-brigade" : "")}>
                  {b.scope === BLOCK_SCOPE.BRIGADE ? "חסימת חטיבה" : "חסימת יחידה"}
                </span>
              </div>
              <div className="blocked-row-reason">״{b.reason}״ — {b.blockedBy}, {new Date(b.blockedAt).toLocaleDateString("he-IL")}</div>
              <button type="button" className="btn-unblock" onClick={() => onUnblock(b.id)}>ביטול חסימה</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ================================================================== */
/* LEGO BLOCK — TeamLeadView: התצוגה המצומצמת שמקבל MEMBER שמזוהה כראש   */
/* צוות (ראו isTeamLead ב-App.jsx). לא מסך הרשאות רגיל — רק תיאור הצוות   */
/* (השדה היחיד שהוא כן שולט בו ישירות), בקשות ארגון לתתי-צוותים/הוספת    */
/* חיילים (הכל מוגש כבקשה לקצין אמל״ח היחידה — ראו teamStore.js), ומיני   */
/* אנליטיקה על כל מי שתחתיו — משתמש שוב ב-personRequests/requestAnalytics */
/* שכבר קיימים כאן בשביל PersonCardModal, רק על פני כמה אנשים ולא אחד.    */
/* ================================================================== */
function TeamMemberRequestForm({ onSubmit }) {
  const [identifier, setIdentifier] = useState("");
  const [note, setNote] = useState("");
  return (
    <div className="team-lead-add-member-form">
      <input placeholder="שם או מספר אישי" value={identifier} onChange={(e) => setIdentifier(e.target.value)} />
      <input placeholder="הערה (לא חובה)" value={note} onChange={(e) => setNote(e.target.value)} />
      <button
        type="button" className="add-btn" disabled={!identifier.trim()}
        onClick={() => { onSubmit(identifier.trim(), note.trim()); setIdentifier(""); setNote(""); }}
      >
        <UserPlus size={13} /> בקשת תקן
      </button>
    </div>
  );
}

function TeamLeadView({ brigadeId, ledTeam, tickets, catalog, unitPeople }) {
  const [team, setTeam] = useState(ledTeam);
  const [description, setDescription] = useState(ledTeam.description || "");
  const [savedTick, setSavedTick] = useState(false);
  const [newSubteamName, setNewSubteamName] = useState("");
  const [requests, setRequests] = useState([]);
  const leadLabel = `${ledTeam.leadRank} ${ledTeam.leadName}`;

  function reload() {
    Promise.all([fetchBrigadeTeams(brigadeId), fetchTeamRequests(brigadeId)]).then(([teams, allReq]) => {
      const fresh = teams.find((t) => t.id === ledTeam.id);
      if (fresh) setTeam(fresh); // הטקסט בתיאור נשאר בשליטת ה-textarea המקומי — לא נדרס מרענון רקע
      setRequests(allReq.filter((r) => r.teamId === ledTeam.id));
    });
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { reload(); }, [brigadeId, ledTeam.id]);

  function saveDescription() {
    updateTeam(brigadeId, team.id, { description }).then(() => {
      setSavedTick(true);
      window.setTimeout(() => setSavedTick(false), 1800);
      reload();
    });
  }

  function notifyOfficer(message) {
    pushNotification(brigadeId, { kind: "teamRequest", unit: team.unit, requestedBy: leadLabel, type: NOTIFICATION_TYPES.SUBMITTED, message });
  }

  function requestSubteam() {
    if (!newSubteamName.trim()) return;
    submitTeamRequest(brigadeId, { teamId: team.id, unit: team.unit, kind: TEAM_REQUEST_KIND.CREATE_SUBTEAM, subteamName: newSubteamName.trim(), requestedBy: leadLabel })
      .then(() => {
        notifyOfficer(`${leadLabel} (ראש ${team.name}) ביקש/ה לפתוח תת-צוות חדש — "${newSubteamName.trim()}"`);
        setNewSubteamName("");
        reload();
      });
  }

  function requestAddMember(subteam, identifier, note) {
    submitTeamRequest(brigadeId, { teamId: team.id, unit: team.unit, kind: TEAM_REQUEST_KIND.ADD_MEMBER, subteamId: subteam.id, personIdentifier: identifier, personNote: note, requestedBy: leadLabel })
      .then(() => {
        notifyOfficer(`${leadLabel} (ראש ${team.name}) ביקש/ה לצרף את ${identifier} לתת-הצוות "${subteam.name}"`);
        reload();
      });
  }

  function toggleApprovalGate() {
    updateTeam(brigadeId, team.id, { requireLeadApproval: !team.requireLeadApproval }).then(reload);
  }

  const resolvedMembers = useMemo(() => {
    const all = [];
    team.subteams.forEach((s) =>
      s.members.forEach((m) => {
        const person = (unitPeople || []).find(
          (p) => p.personalNumber === m.identifier || p.name === m.identifier || `${p.rank} ${p.name}` === m.identifier
        );
        all.push({ subteamName: s.name, identifier: m.identifier, person });
      })
    );
    return all;
  }, [team, unitPeople]);

  const aggregatedRequests = useMemo(
    () => resolvedMembers.filter((m) => m.person).flatMap((m) => personRequests(m.person, tickets, catalog)),
    [resolvedMembers, tickets, catalog]
  );
  const analytics = useMemo(() => requestAnalytics(aggregatedRequests), [aggregatedRequests]);
  const pendingRequests = requests.filter((r) => r.status === "pending");

  return (
    <div>
      <div className="view-head">
        <h1>ניהול {team.name}</h1>
        <p>מוגדר/ת כראש/ת צוות — תצוגה מצומצמת: תיאור הצוות, תתי-הצוותים שלך, והאנשים תחתיך בלבד.</p>
      </div>

      <div className="team-lead-head-card">
        {team.logo ? <img className="team-card-logo" src={team.logo} alt="" /> : <span className="team-card-logo-fallback"><Users2 size={20} /></span>}
        <div>
          <div className="team-card-title" style={{ fontSize: 16 }}>{team.name}</div>
          <div className="unit-context-label">{team.unit}</div>
        </div>
      </div>

      <div className="section-title">תיאור הצוות</div>
      <div className="team-lead-desc-box">
        <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="תיאור קצר של ייעוד הצוות..." />
        <button type="button" className="add-btn" onClick={saveDescription}>{savedTick ? <><Check size={13} /> נשמר</> : "שמירה"}</button>
      </div>

      <div className="section-title">שער אישור ראש צוות</div>
      <button type="button" className="team-lead-gate-toggle" onClick={toggleApprovalGate}>
        {team.requireLeadApproval ? <ToggleRight size={20} className="tone-green" /> : <ToggleLeft size={20} />}
        {team.requireLeadApproval
          ? "פעיל — בקשות/דרישות של אנשי הצוות עוברות דרכך לאישור לפני קצין אמל״ח היחידה"
          : "כבוי — בקשות אנשי הצוות עוברות ישירות לקצין אמל״ח היחידה"}
      </button>

      <div className="section-title">אנליטיקת הצוות</div>
      <div className="person-card-stat-grid" style={{ gridTemplateColumns: "repeat(4,1fr)" }}>
        <div className="person-card-stat"><span>חברים</span><b>{resolvedMembers.length}</b></div>
        <div className="person-card-stat"><span>סה״כ בקשות</span><b>{analytics.total}</b></div>
        <div className="person-card-stat person-card-stat-green"><span>אושרו</span><b>{analytics.approvedPct}%</b></div>
        <div className="person-card-stat person-card-stat-red"><span>נדחו</span><b>{analytics.rejectedPct}%</b></div>
      </div>

      <div className="section-title">תתי-צוותים ({team.subteams.length}/3)</div>
      {team.subteams.length === 0 && <div className="empty">עדיין אין תתי-צוותים.</div>}
      <div className="team-lead-subteam-list">
        {team.subteams.map((s) => (
          <div key={s.id} className="team-lead-subteam-card">
            <div className="team-lead-subteam-head"><Network size={13} /> {s.name} <span className="team-card-subteam-count">({s.members.length})</span></div>
            {s.members.length > 0 && (
              <div className="team-lead-subteam-members">
                {s.members.map((m, i) => <span key={i}>{m.identifier}{m.note ? ` — ${m.note}` : ""}</span>)}
              </div>
            )}
            <TeamMemberRequestForm onSubmit={(id, note) => requestAddMember(s, id, note)} />
          </div>
        ))}
      </div>

      {team.subteams.length < 3 && (
        <div className="add-form" style={{ marginTop: 12 }}>
          <label className="add-form-field">
            <span>שם תת-צוות חדש</span>
            <input value={newSubteamName} onChange={(e) => setNewSubteamName(e.target.value)} placeholder="לדוגמה: תת-צוות תכנות" />
          </label>
          <button type="button" className="add-btn" disabled={!newSubteamName.trim()} onClick={requestSubteam}><Plus size={14} /> הגשת בקשה ליצירה</button>
        </div>
      )}

      {pendingRequests.length > 0 && (
        <>
          <div className="section-title">בקשות ממתינות לאישור קצין אמל״ח היחידה ({pendingRequests.length})</div>
          <div className="team-request-list">
            {pendingRequests.map((r) => (
              <div key={r.id} className="team-request-row">
                <div className="team-request-main">
                  <span className="team-request-kind">{TEAM_REQUEST_KIND_LABEL[r.kind]}</span>
                  <span className="team-request-detail">
                    {r.kind === TEAM_REQUEST_KIND.CREATE_SUBTEAM ? <>תת-צוות: <b>{r.subteamName}</b></> : <>מועמד/ת: <b>{r.personIdentifier}</b></>}
                  </span>
                </div>
                <StatusPill status="pending" />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ================================================================== */
/* Root                                                                */
/* ================================================================== */

export default function PermissionsDashboard({ role, brigadeId, brigadeName, unitLogos, officerUnit, persona, effectiveMemberId, ledTeam, viewTicketDetail, viewCatalogItem }) {
  const [units, setUnits] = useState(null);
  const [unitPeople, setUnitPeople] = useState({});
  const [unitOfficers, setUnitOfficers] = useState([]);
  const [brigadeStaff, setBrigadeStaff] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [teams, setTeams] = useState([]);
  const [blockedList, setBlockedList] = useState([]);
  const [view, setView] = useState("list");
  // כרטיס משתמש שנפתח מהעץ הארגוני/הרשימה — לא תלוי ביחידה ספציפית (בניגוד
  // ל-updatePerson/removePerson הפנימיים של UnitRoster) כי בעץ החטיבתי המלא
  // אפשר ללחוץ על אדם מכל יחידה, על קצין אמל״ח יחידה, ואפילו על איש צוות
  // חטיבתי (מקור נתונים אחר לגמרי — brigadeStaff). ה-kind קובע לאיזה state
  // לכתוב שינוי הרשאה, ואיזה היקף חסימה חל (unit / staff→brigade / officer).
  const [selectedPerson, setSelectedPerson] = useState(null); // { person, kind: "unit"|"staff"|"officer", unit }
  const [selectedPersonTeamInfo, setSelectedPersonTeamInfo] = useState(null);
  // ניהול צוותים ישירות מהעץ הארגוני — יצירה/עריכה/מחיקה, מקביל למה ש-
  // TeamsSection כבר מאפשרת במסך הרשימה, רק כמודלים שנפתחים מתוך צומת בעץ.
  const [treeCreateUnit, setTreeCreateUnit] = useState(null); // שם יחידה, או null
  const [treeEditTeam, setTreeEditTeam] = useState(null); // אובייקט צוות, או null
  const [treeDeleteTeam, setTreeDeleteTeam] = useState(null); // אובייקט צוות, או null
  // גרירה-ושחרור בעץ הארגוני — pendingMove מוצג תמיד דרך MoveConfirmModal
  // (שני שלבים) לפני שהמהלך בפועל מתבצע; ראו requestMove/executeMove למטה.
  const [pendingMove, setPendingMove] = useState(null);

  function openPerson(person, kind, unit) {
    setSelectedPerson({ person, kind, unit });
  }

  function updateSelectedPerson(updated) {
    setSelectedPerson((prev) => (prev ? { ...prev, person: updated } : prev));
    if (selectedPerson?.kind === "staff") {
      setBrigadeStaff((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    } else if (selectedPerson?.kind === "unit") {
      const u = selectedPerson.unit;
      setUnitPeople((prev) => ({ ...prev, [u]: (prev[u] || []).map((p) => (p.id === updated.id ? updated : p)) }));
    } else if (selectedPerson?.kind === "officer") {
      setUnitOfficers((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
    }
  }

  function reloadTeamsAndBlocks() {
    Promise.all([fetchBrigadeTeams(brigadeId), fetchBlockedList(brigadeId)]).then(([t, bl]) => { setTeams(t); setBlockedList(bl); });
  }

  useEffect(() => {
    let cancelled = false;
    setUnits(null);
    Promise.all([
      fetchBrigadeUnits(brigadeId), fetchBrigadeRoster(brigadeId), fetchBrigadeTickets(brigadeId),
      fetchBrigadeCatalog(brigadeId), fetchBrigadeTeams(brigadeId), fetchBlockedList(brigadeId),
    ]).then(([u, roster, tix, cat, tm, bl]) => {
      if (cancelled) return;
      setUnits(u);
      setUnitOfficers(roster.unitOfficers);
      setBrigadeStaff(roster.brigadeStaff);
      setUnitPeople(roster.unitPeople);
      setTickets(tix);
      setCatalog(cat);
      setTeams(tm);
      setBlockedList(bl);
    });
    return () => { cancelled = true; };
  }, [brigadeId]);

  useEffect(() => {
    if (!selectedPerson) { setSelectedPersonTeamInfo(null); return; }
    let cancelled = false;
    getMemberTeamInfo(brigadeId, { personalNumber: selectedPerson.person.personalNumber, fullName: `${selectedPerson.person.rank} ${selectedPerson.person.name}` })
      .then((info) => { if (!cancelled) setSelectedPersonTeamInfo(info); });
    return () => { cancelled = true; };
  }, [brigadeId, selectedPerson]);

  const isBrigadeScope = role === STRUCTURAL_ROLES.BRIGADE_OFFICER || role === STRUCTURAL_ROLES.SYSTEM_ADMIN;
  const myUnit = role === STRUCTURAL_ROLES.UNIT_OFFICER ? (officerUnit || units?.[0]) : units?.[0];

  // MEMBER מגיע לכאן אך ורק כי הוא מזוהה כראש צוות (ראו visibleNav ב-
  // App.jsx) — מקבל תצוגה נפרדת לגמרי, לא את מסך ההרשאות הרגיל.
  if (role === STRUCTURAL_ROLES.MEMBER) {
    if (!ledTeam) {
      return (
        <div dir="rtl" className="permissions-view panel-card">
          <style>{CSS}</style>
          <Loading />
        </div>
      );
    }
    return (
      <div dir="rtl" className="permissions-view panel-card">
        <style>{CSS}</style>
        <TeamLeadView brigadeId={brigadeId} ledTeam={ledTeam} tickets={tickets} catalog={catalog} unitPeople={unitPeople[ledTeam.unit] || []} />
      </div>
    );
  }

  if (units === null) {
    return (
      <div dir="rtl" className="permissions-view panel-card">
        <style>{CSS}</style>
        <Loading />
      </div>
    );
  }

  if (units.length === 0) {
    return (
      <div dir="rtl" className="permissions-view panel-card">
        <style>{CSS}</style>
        <div className="empty-state">
          לחטיבה זו עדיין אין מבנה ארגוני — היא ממתינה שקצין אמל״ח החטיבה ישלים את אשף ההתקנה.
        </div>
      </div>
    );
  }

  const actorLabel = isBrigadeScope ? "קצין אמל״ח חטיבה (הדגמה)" : "קצין אמל״ח יחידה (הדגמה)";
  // מי מורשה לנהל (ליצור/לערוך/למחוק) צוותים ביחידה נתונה — קצין אמל״ח חטיבה
  // תמיד, קצין אמל״ח יחידה רק ביחידה שלו עצמו.
  function canManageUnitTeams(u) {
    return isBrigadeScope || (role === STRUCTURAL_ROLES.UNIT_OFFICER && u === myUnit);
  }

  // איפה האדם משוייך כרגע (לצורך תווית "מ-" במודל האישור) — מחפש בכל
  // הצוותים הידועים אם מספרו האישי מופיע כחבר באיזשהו תת-צוות.
  function findCurrentMembership(person) {
    for (const t of teams) {
      for (const s of t.subteams) {
        if (s.members.some((m) => m.identifier === person.personalNumber)) return { team: t, subteam: s };
      }
    }
    return null;
  }

  // גרירה בעץ הארגוני מבקשת מהלך, לא מבצעת אותו — ה-UI רק פותח את המודל הדו-
  // שלבי (pendingMove), executeMove הוא מי שבאמת כותב ל-state כשמאשרים.
  function requestMove(person, fromUnit, toUnit, toTeamId, toSubteamId) {
    const current = findCurrentMembership(person);
    const noChange = fromUnit === toUnit && (current?.team.id || null) === toTeamId && (current?.subteam.id || null) === toSubteamId;
    if (noChange) return;
    const fromLabel = current ? `תת-צוות ${current.subteam.name} (${current.team.name}, ${fromUnit})` : `יחידת ${fromUnit} — ללא שיוך צוותי`;
    const toTeam = toTeamId ? teams.find((t) => t.id === toTeamId) : null;
    const toSubteam = toTeam?.subteams.find((s) => s.id === toSubteamId);
    const toLabel = toSubteam ? `תת-צוות ${toSubteam.name} (${toTeam.name}, ${toUnit})` : `יחידת ${toUnit} — ללא שיוך צוותי`;
    setPendingMove({ person, fromUnit, toUnit, toTeamId, toSubteamId, fromLabel, toLabel });
  }

  // מבצע את המהלך שאושר: אם היחידה משתנה — מעביר את הרשומה בין unitPeople[];
  // בכל מקרה מנקה קודם כל שיוך תת-צוות קודם באותה יחידה (בין אם היחידה
  // השתנתה ובין אם לא — כדי שלא יישארו רשומות "רפאים" בשני מקומות), ורק אז
  // מוסיף לתת-הצוות היעד אם נבחר אחד. נרשם ביומן מנהל המערכת כמו כל שינוי
  // ארגוני אחר מהעץ.
  async function executeMove() {
    const { person, fromUnit, toUnit, toTeamId, toSubteamId, fromLabel, toLabel } = pendingMove;
    if (fromUnit !== toUnit) {
      setUnitPeople((prev) => ({
        ...prev,
        [fromUnit]: (prev[fromUnit] || []).filter((p) => p.id !== person.id),
        [toUnit]: [...(prev[toUnit] || []), person],
      }));
    }
    const relevantTeams = teams.filter((t) => t.unit === fromUnit || t.unit === toUnit);
    await Promise.all(
      relevantTeams.map((t) => {
        let nextSubteams = t.subteams.map((s) => ({ ...s, members: s.members.filter((m) => m.identifier !== person.personalNumber) }));
        if (t.id === toTeamId && toSubteamId) {
          nextSubteams = nextSubteams.map((s) => (s.id === toSubteamId ? { ...s, members: [...s.members, { identifier: person.personalNumber, note: "" }] } : s));
        }
        return updateTeam(brigadeId, t.id, { subteams: nextSubteams });
      })
    );
    await logAction({ actor: actorLabel, action: `העברת ${person.rank} ${person.name} — מ־${fromLabel} אל ${toLabel}`, target: `${person.rank} ${person.name}` });
    setPendingMove(null);
    reloadTeamsAndBlocks();
  }

  async function handleTreeCreateTeam(data) {
    const unit = treeCreateUnit;
    await createTeam(brigadeId, { unit, ...data });
    await logAction({ actor: actorLabel, action: `יצירת צוות מהעץ הארגוני — ${data.name} (${unit})`, target: `${unit} / ${data.name}` });
    setTreeCreateUnit(null);
    reloadTeamsAndBlocks();
  }
  async function handleTreeUpdateTeam(patch) {
    const team = treeEditTeam;
    await updateTeam(brigadeId, team.id, patch);
    await logAction({ actor: actorLabel, action: `עריכת צוות מהעץ הארגוני — ${team.name} (${team.unit})`, target: `${team.unit} / ${team.name}` });
    setTreeEditTeam(null);
    reloadTeamsAndBlocks();
  }
  async function handleTreeDeleteTeam(reason) {
    const team = treeDeleteTeam;
    await deleteTeam(brigadeId, team.id);
    await logAction({
      actor: actorLabel, action: `מחיקת צוות מהעץ הארגוני — ${team.name} (${team.unit}) — סיבה: ${reason}`,
      target: `${team.unit} / ${team.name}`, targetType: "team", snapshot: { ...team, __brigadeId: brigadeId },
    });
    setTreeDeleteTeam(null);
    setTreeEditTeam(null);
    reloadTeamsAndBlocks();
  }

  const blockedNumbers = new Set(blockedList.map((b) => b.personalNumber));

  let canBlock = false;
  let blockedEntry = null;
  if (selectedPerson) {
    const { person, kind, unit } = selectedPerson;
    canBlock = isBrigadeScope ? true : kind === "unit" && unit === myUnit;
    const scopeUnit = kind === "staff" ? null : unit;
    blockedEntry = blockedList.find(
      (b) => b.personalNumber === person.personalNumber && (b.scope === BLOCK_SCOPE.BRIGADE || (b.scope === BLOCK_SCOPE.UNIT && b.unit === scopeUnit))
    ) || null;
  }

  function handleBlock(reason) {
    const { person, kind, unit } = selectedPerson;
    const scope = kind === "staff" ? BLOCK_SCOPE.BRIGADE : BLOCK_SCOPE.UNIT;
    blockUser(brigadeId, {
      scope, unit: kind === "staff" ? null : unit, personalNumber: person.personalNumber,
      rank: person.rank, name: person.name, reason, blockedBy: actorLabel,
    }).then(reloadTeamsAndBlocks);
  }
  function handleUnblock(blockId) {
    unblockUser(brigadeId, blockId).then(reloadTeamsAndBlocks);
  }

  return (
    <div dir="rtl" className="permissions-view panel-card">
      <style>{CSS}</style>

      <div className="pill-tabs" style={{ marginBottom: 22 }}>
        <button className={"pill-tab" + (view === "list" ? " active" : "")} onClick={() => setView("list")}>
          רשימה
        </button>
        <button className={"pill-tab" + (view === "tree" ? " active" : "")} onClick={() => setView("tree")}>
          עץ ארגוני
        </button>
        <button className={"pill-tab" + (view === "blocked" ? " active" : "")} onClick={() => setView("blocked")}>
          <ShieldOff size={12} style={{ verticalAlign: "-2px" }} /> חסומים{blockedList.length > 0 ? ` (${blockedList.length})` : ""}
        </button>
      </div>

      <div key={view} className="scope-body">
        {view === "tree" ? (
          <>
            <div className="view-head">
              <h1>מבנה ארגוני</h1>
              <p>
                {isBrigadeScope
                  ? "תרשים החטיבה המלא — כלל היחידות, הצוותים ואנשי הצוות."
                  : "התצוגה שלך: שכבה אחת מעליך (החטיבה) ומה שתחתיך (אנשי היחידה והצוותים)."}
              </p>
            </div>
            <OrgTree
              role={role} brigadeName={brigadeName} myUnit={myUnit} units={units}
              unitOfficers={unitOfficers} brigadeStaff={brigadeStaff} unitPeople={unitPeople} unitLogos={unitLogos}
              teams={teams}
              onSelectPerson={(o) => openPerson(o.person, o.kind, o.unit)}
              canManageUnit={canManageUnitTeams}
              onCreateTeam={setTreeCreateUnit}
              onEditTeam={setTreeEditTeam}
              onRequestMove={requestMove}
            />
          </>
        ) : view === "blocked" ? (
          <BlockedListPanel isBrigadeScope={isBrigadeScope} myUnit={myUnit} blockedList={blockedList} unitLogos={unitLogos} onUnblock={handleUnblock} />
        ) : isBrigadeScope ? (
          <BrigadePermissionsView
            units={units}
            unitOfficers={unitOfficers} setUnitOfficers={setUnitOfficers}
            brigadeStaff={brigadeStaff} setBrigadeStaff={setBrigadeStaff}
            unitPeople={unitPeople} setUnitPeople={setUnitPeople} unitLogos={unitLogos}
            onOpenPerson={openPerson} blockedNumbers={blockedNumbers} brigadeId={brigadeId} onTeamsChanged={reloadTeamsAndBlocks} actorLabel={actorLabel}
          />
        ) : (
          <UnitPermissionsView
            unit={myUnit} unitPeople={unitPeople} setUnitPeople={setUnitPeople} unitLogos={unitLogos}
            onOpenPerson={openPerson} blockedNumbers={blockedNumbers} brigadeId={brigadeId} onTeamsChanged={reloadTeamsAndBlocks} actorLabel={actorLabel}
          />
        )}
      </div>

      {selectedPerson && (
        <PersonCardModal
          person={selectedPerson.person}
          unit={selectedPerson.unit}
          kind={selectedPerson.kind}
          unitLogos={unitLogos}
          tickets={tickets}
          catalog={catalog}
          onChange={updateSelectedPerson}
          onClose={() => setSelectedPerson(null)}
          onViewTicket={viewTicketDetail}
          onViewCatalogItem={viewCatalogItem}
          canBlock={canBlock}
          blockedEntry={blockedEntry}
          onBlock={handleBlock}
          onUnblock={handleUnblock}
          teamInfo={selectedPersonTeamInfo}
        />
      )}

      {treeCreateUnit && (
        <TeamCreateModal
          unit={treeCreateUnit}
          unitPeople={unitPeople[treeCreateUnit] || []}
          onClose={() => setTreeCreateUnit(null)}
          onCreate={handleTreeCreateTeam}
        />
      )}
      {treeEditTeam && !treeDeleteTeam && (
        <TeamEditModal
          team={treeEditTeam}
          unitPeople={unitPeople[treeEditTeam.unit] || []}
          onClose={() => setTreeEditTeam(null)}
          onSave={handleTreeUpdateTeam}
          onRequestDelete={() => setTreeDeleteTeam(treeEditTeam)}
        />
      )}
      {treeDeleteTeam && (
        <TeamDeleteConfirmModal team={treeDeleteTeam} onClose={() => setTreeDeleteTeam(null)} onConfirm={handleTreeDeleteTeam} />
      )}
      {pendingMove && (
        <MoveConfirmModal
          personLabel={`${pendingMove.person.rank} ${pendingMove.person.name}`}
          fromLabel={pendingMove.fromLabel}
          toLabel={pendingMove.toLabel}
          onClose={() => setPendingMove(null)}
          onConfirm={executeMove}
        />
      )}
    </div>
  );
}

/* ================================================================== */
/* CSS                                                                 */
/* ================================================================== */

const CSS = `
@keyframes fadeSlideUp{ from{ opacity:0; transform:translateY(8px); } to{ opacity:1; transform:translateY(0); } }

.permissions-view{ color:var(--text); font-family:var(--font-sans); padding:22px 24px; }

.scope-body{ animation:fadeSlideUp .25s ease; }
.view-head h1{ font-family:var(--font-sans); font-weight:700; font-size:21px; margin:0 0 4px; }
.view-head p{ color:var(--text-dim); font-size:14px; margin:0 0 20px; }
.view-head-row{ display:flex; justify-content:space-between; align-items:flex-start; gap:16px; flex-wrap:wrap; }
.view-head-row .view-head, .view-head-row > div{ margin:0; }

${SCOPE_PICKER_CSS}

.unit-context{ display:flex; align-items:center; gap:12px; background:var(--panel); border:1px solid var(--line);
  border-radius:6px; padding:12px 16px; margin-bottom:20px; }
.unit-context-label{ font-size:11.5px; color:var(--text-dim); font-family:var(--font-mono); text-transform:uppercase; letter-spacing:.05em; }
.unit-context-value{ font-family:var(--font-sans); font-weight:700; font-size:15px; margin-top:2px; }

.drill-officer-tag{
  display:flex; align-items:center; gap:8px; background:var(--panel); border:1px solid var(--line);
  border-radius:6px; padding:10px 14px; font-size:13px; color:var(--text-dim); margin-bottom:18px;
}
.drill-officer-tag b{ color:var(--text); }
.drill-officer-email{ font-family:var(--font-mono); color:var(--accent); margin-right:auto; }

.section-title{ font-family:var(--font-mono); font-size:12px; color:var(--accent);
  text-transform:uppercase; letter-spacing:.06em; margin:22px 0 10px; }

.person-rank{ color:var(--text-dim); font-weight:500; }

.perm-table{ display:flex; flex-direction:column; border:1px solid var(--line); border-radius:10px; overflow:hidden; }
.perm-row{
  display:grid; grid-template-columns:1.3fr 1.3fr 130px 1fr 1fr 34px;
  align-items:center; gap:10px; padding:9px 14px; background:var(--panel); border-bottom:1px solid var(--line);
  opacity:0; animation:fadeSlideUp .2s ease forwards;
}
.perm-row.no-unit{ grid-template-columns:1.3fr 1.3fr 1fr 1fr 34px; }
.perm-row:last-child{ border-bottom:none; }
.perm-row:hover{ background:var(--panel-raised); }
.perm-row-head{
  background:var(--panel-raised); font-family:var(--font-mono); font-size:11px; color:var(--text-dim);
  text-transform:uppercase; letter-spacing:.05em; padding:9px 14px; opacity:1; animation:none;
}
.perm-row-head:hover{ background:var(--panel-raised); }
.perm-person-name{ font-family:var(--font-sans); font-weight:600; font-size:13.5px; }
.perm-person-contact{ display:flex; flex-direction:column; gap:1px; font-size:11.5px; color:var(--text-dim); font-family:var(--font-mono); }
.perm-person-email{ opacity:.85; }

.access-field{ display:flex; flex-direction:column; gap:3px; font-size:11px; color:var(--text-dim); min-width:0; }
.add-form .access-field{ min-width:150px; }
.access-field select{ background:var(--bg); border:1px solid var(--line); border-radius:6px; color:var(--text);
  padding:7px 9px; font-size:12px; width:100%; transition:border-color .15s ease; }
.access-field select:hover, .access-field select:focus{ border-color:var(--accent); outline:none; }

.person-remove{ background:none; border:1px solid transparent; color:var(--text-dim); border-radius:4px;
  padding:4px 8px; cursor:pointer; transition:color .15s ease, border-color .15s ease; }
.person-remove:hover{ color:var(--red); border-color:var(--red); }

.add-form{ display:flex; flex-wrap:wrap; gap:12px; align-items:flex-end; background:var(--panel);
  border:1px dashed var(--line); border-radius:6px; padding:16px; }
.add-form-field{ display:flex; flex-direction:column; gap:5px; font-size:11.5px; color:var(--text-dim); }
.add-form-field input, .add-form-field select{ background:var(--bg); border:1px solid var(--line); border-radius:4px; color:var(--text);
  padding:9px 11px; font-size:13px; min-width:130px; }
.add-btn{ background:var(--accent); color:var(--accent-ink); border:none; border-radius:4px; padding:10px 18px;
  font-family:var(--font-sans); font-weight:700; font-size:14px; cursor:pointer; transition:filter .15s ease, box-shadow .15s ease; }
.add-btn:not(:disabled):hover{ filter:brightness(1.08); box-shadow:var(--shadow-sm); }
.add-btn:disabled{ opacity:.4; cursor:not-allowed; }

.officer-list{ display:flex; flex-direction:column; gap:8px; }
.officer-row{
  display:grid; grid-template-columns:110px 100px 1fr 1fr 34px; gap:10px; align-items:center;
  background:var(--panel); border:1px solid var(--line); border-radius:6px; padding:12px 16px;
  opacity:0; animation:fadeSlideUp .25s ease forwards;
}
.officer-unit{ font-family:var(--font-sans); font-weight:600; color:var(--accent); font-size:14px; display:flex; align-items:center; gap:8px; }
.officer-input{ background:var(--bg); border:1px solid var(--line); border-radius:4px; color:var(--text);
  padding:8px 10px; font-size:13px; }
.officer-rank-input{ font-family:var(--font-mono); }

.empty{ color:var(--text-dim); font-size:14px; padding:16px 0; }

/* org tree — nested, shaded groups read the hierarchy without fragile     */
/* hand-drawn connector lines.                                             */
/* עץ ארגוני — ממורכז, עם קווי חיבור אמיתיים בין הורה לילדים (לא קופסאות    */
/* מקוננות כמו קודם). הטריק ה-CSS-בלבד הסטנדרטי: כל ילד מקבל קו אנכי       */
/* יורד אליו (::before) וקטע קו אופקי (::after) שמתחבר לאחיו — הראשון      */
/* מקבל רק חצי ימני, האחרון רק חצי שמאלי, יחיד בכלל לא מקבל — כך שזה עובד   */
/* נכון לכל מספר ילדים בלי חישובי פיקסלים שבירים. gap:0 בכוונה (הרווח       */
/* מגיע מה-padding של כל ילד) כי החישוב תלוי בכך שילדים סמוכים ללא רווח.    */
.org-tree{ overflow-x:auto; padding:12px 8px 20px; display:flex; justify-content:center; }
.org-node{ display:inline-flex; flex-direction:column; align-items:center; }
.org-node-card{
  position:relative; display:flex; align-items:center; gap:10px; background:var(--panel); border:1px solid var(--line);
  border-radius:10px; padding:11px 18px; white-space:nowrap; box-shadow:var(--shadow-sm); z-index:1;
  font-family:inherit; transition:border-color .15s ease, box-shadow .15s ease, transform .12s ease;
}
.org-node-card-clickable{ cursor:pointer; }
.org-node-card-clickable:hover{ border-color:var(--accent); box-shadow:var(--shadow-md); transform:translateY(-2px); }
.org-node-card-clickable:active{ transform:translateY(0); }
.org-node-card-dashed{ border-style:dashed; border-color:var(--accent); background:transparent; }
.org-node-card-dashed .org-node-title{ color:var(--accent); }
.org-node-card-dashed:hover{ background:color-mix(in srgb, var(--accent) 6%, transparent); }
/* ענפי קיבוץ ("אנשי אמל״ח היחידה" / "צוותים") — עדינים יותר מכרטיס ישות     */
/* אמיתית (אדם/צוות/יחידה), כדי שהעין תבחין מיד בין "כותרת קבוצה" לפריט.    */
.org-node-card-group{
  background:transparent; border-style:dotted; border-color:var(--text-dim); box-shadow:none; opacity:.9;
}
.org-node-card-group .org-node-title{ font-weight:600; color:var(--text-dim); font-size:12.5px; text-transform:uppercase; letter-spacing:.03em; font-family:var(--font-mono); }
/* גרירה ושחרור — כרטיס נגרר דוהה מעט, יעד תקף מודגש בירוק בזמן ריחוף מעליו. */
.org-node-drag-handle{ color:var(--text-dim); flex:none; cursor:grab; }
.org-node-card[draggable="true"]{ cursor:grab; }
.org-node-card-dragging{ opacity:.4; }
.org-node-card-drop-active{
  border-color:var(--green) !important; box-shadow:0 0 0 3px color-mix(in srgb, var(--green) 22%, transparent);
  background:color-mix(in srgb, var(--green) 10%, var(--panel));
}
.org-node-you .org-node-card{ border-color:var(--accent); background:color-mix(in srgb, var(--accent) 6%, var(--panel)); }
.org-node-person-icon{
  width:24px; height:24px; border-radius:50%; background:var(--panel-raised); color:var(--accent);
  display:flex; align-items:center; justify-content:center; flex:none;
}
.org-node-title{ font-family:var(--font-sans); font-weight:700; font-size:14px; }
.org-node-sub{ font-size:11.5px; color:var(--text-dim); margin-top:1px; }
.org-node-you-tag{ font-family:var(--font-mono); font-size:9.5px; color:var(--accent); border:1px solid var(--accent);
  border-radius:3px; padding:1px 6px; margin-right:4px; text-transform:uppercase; }

.org-node-children{ display:flex; flex-wrap:nowrap; gap:0; padding-top:28px; position:relative; }
.org-node-children::before{
  content:""; position:absolute; top:0; right:50%; width:1px; height:28px; background:var(--line);
}
.org-node-children > .org-node{ position:relative; padding:28px 14px 0; }
.org-node-children > .org-node::before{
  content:""; position:absolute; top:0; right:50%; width:1px; height:28px; background:var(--line);
}
.org-node-children > .org-node::after{
  content:""; position:absolute; top:0; right:0; left:0; height:1px; background:var(--line);
}
.org-node-children > .org-node:first-child::after{ right:50%; }
.org-node-children > .org-node:last-child::after{ left:50%; }
.org-node-children > .org-node:only-child::after{ display:none; }

.overlay{ position:fixed; inset:0; background:rgba(6,8,10,.6); backdrop-filter:blur(2px); display:flex; align-items:center; justify-content:center; z-index:200; padding:24px; animation:overlayIn .15s ease; }
@keyframes overlayIn{ from{ opacity:0; } to{ opacity:1; } }
@keyframes modalIn{ from{ opacity:0; transform:translateY(10px) scale(.98); } to{ opacity:1; transform:translateY(0) scale(1); } }
.drawer-close{
  position:absolute; top:16px; left:16px; background:none; border:1px solid var(--line); color:var(--text-dim);
  border-radius:8px; padding:6px; cursor:pointer; transition:color .15s ease, border-color .15s ease;
}
.drawer-close:hover{ color:var(--text); border-color:var(--text-dim); }

.person-card-modal{
  width:440px; max-width:100%; max-height:88vh; overflow-y:auto; position:relative;
  background:var(--panel); border:1px solid var(--line); border-radius:var(--radius-card); padding:28px;
  box-shadow:var(--shadow-md); animation:modalIn .2s ease;
}
.team-edit-modal{ width:380px; display:flex; flex-direction:column; gap:14px; }
.team-edit-modal .add-form-field select{ background:var(--bg); border:1px solid var(--line); border-radius:8px; color:var(--text); padding:9px 11px; font-size:13px; width:100%; }
.person-card-head{ display:flex; align-items:center; gap:14px; margin-bottom:16px; padding-inline-end:30px; }
.person-card-avatar{
  width:48px; height:48px; border-radius:50%; background:var(--panel-raised); color:var(--accent);
  display:flex; align-items:center; justify-content:center; flex:none; border:1px solid var(--line);
}
.person-card-name{ font-family:var(--font-sans); font-weight:700; font-size:16px; }
.person-card-unit{ display:flex; align-items:center; gap:6px; font-size:12px; color:var(--text-dim); margin-top:3px; }
.person-card-meta{ display:flex; flex-direction:column; gap:6px; background:var(--bg); border:1px solid var(--line); border-radius:10px; padding:11px 14px; margin-bottom:20px; }
.person-card-meta span{ display:flex; align-items:center; gap:8px; font-size:12.5px; color:var(--text); font-family:var(--font-mono); }
.person-card-meta svg{ color:var(--text-dim); flex:none; }
.person-card-section-title{ font-family:var(--font-mono); font-size:11px; color:var(--accent); text-transform:uppercase; letter-spacing:.06em; margin-bottom:10px; }
.person-card-section-title-row{ display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; }
.person-card-section-title-row .person-card-section-title{ margin-bottom:0; }
.person-card-toggle{
  display:inline-flex; align-items:center; gap:4px; background:none; border:none; color:var(--accent);
  font-size:11px; font-weight:700; cursor:pointer; font-family:var(--font-sans); padding:0;
}
.person-card-access{ display:flex; flex-direction:column; gap:12px; margin-bottom:6px; }
.person-card-access .access-field select{ padding:10px 11px; font-size:13px; }

.person-card-stat-grid{ display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin-bottom:14px; }
.person-card-stat{
  display:flex; flex-direction:column; gap:5px; background:var(--bg); border:1px solid var(--line);
  border-radius:9px; padding:9px 10px; text-align:center;
}
.person-card-stat span{ display:flex; align-items:center; justify-content:center; gap:4px; font-size:10px; color:var(--text-dim); }
.person-card-stat b{ font-family:var(--font-sans); font-size:13px; color:var(--text); }
.person-card-stat-green b{ color:var(--green); }
.person-card-stat-red b{ color:var(--red); }
.person-card-bar{ display:flex; height:6px; border-radius:4px; overflow:hidden; background:var(--bg); margin-bottom:22px; }
.person-card-bar-approved{ background:var(--green); }
.person-card-bar-pending{ background:var(--yellow); }
.person-card-bar-rejected{ background:var(--red); }

.person-card-empty{ font-size:12px; color:var(--text-dim); font-style:italic; margin-bottom:22px; }
.person-card-requests{ display:flex; flex-direction:column; gap:6px; margin-bottom:22px; }
.person-card-request-row{
  display:flex; align-items:center; gap:9px; width:100%; background:var(--bg); border:1px solid var(--line);
  border-radius:9px; padding:8px 11px; cursor:pointer; text-align:right; font-family:var(--font-sans);
  transition:border-color .15s ease;
}
.person-card-request-row:hover{ border-color:var(--accent); }
.person-card-request-icon{ color:var(--text-dim); flex:none; }
.person-card-request-main{ display:flex; flex-direction:column; gap:1px; min-width:0; flex:1; text-align:right; }
.person-card-request-title{ font-size:12.5px; font-weight:600; color:var(--text); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.person-card-request-meta{ font-size:10.5px; color:var(--text-dim); font-family:var(--font-mono); }
.person-card-request-arrow{ color:var(--text-dim); flex:none; }
.person-card-request-row:hover .person-card-request-arrow{ color:var(--accent); }

.tone-green{ color:var(--green); }

/* שורות לחיצות (רשימה) — פותחות את כרטיס המשתמש, בדיוק כמו העץ הארגוני.    */
.perm-row-clickable{ cursor:pointer; }
.perm-row-clickable:hover{ background:var(--panel-raised); border-color:var(--accent); }
.perm-row-blocked{ opacity:.6; }
.perm-blocked-tag{
  display:inline-flex; align-items:center; gap:3px; font-family:var(--font-mono); font-size:9px; color:var(--red);
  border:1px solid var(--red); border-radius:3px; padding:1px 5px; margin-inline-start:6px; text-transform:uppercase;
}
.officer-open-card{
  background:none; border:1px solid var(--line); color:var(--text-dim); border-radius:6px; padding:7px 9px;
  cursor:pointer; transition:color .15s ease, border-color .15s ease;
}
.officer-open-card:hover{ color:var(--accent); border-color:var(--accent); }

/* אישור/סירוב — משוכפל בכוונה מ-Tickets.jsx/Catalog.jsx (כל קובץ מסך כאן   */
/* עצמאי, ראו התיעוד למעלה על ה-<style> הפר-רכיבי).                        */
.btn-approve, .btn-reject, .btn-cancel{
  border:none; border-radius:8px; padding:7px 14px; font-family:var(--font-sans);
  font-weight:700; font-size:12.5px; cursor:pointer; transition:filter .15s ease, box-shadow .15s ease;
}
.btn-approve{ background:var(--green); color:#FFFFFF; }
.btn-approve:hover{ filter:brightness(1.08); }
.btn-reject{ background:transparent; color:var(--red); border:1px solid var(--red); }
.btn-reject:hover{ background:var(--panel-raised); }
.btn-reject:disabled{ opacity:.4; cursor:not-allowed; }
.btn-cancel{ background:transparent; color:var(--text-dim); border:1px solid var(--line); }
.btn-cancel:hover{ color:var(--text); border-color:var(--text-dim); }
.reject-reason-box{
  display:flex; flex-direction:column; gap:6px; background:var(--bg); border:1px solid var(--red);
  border-radius:9px; padding:9px; width:240px; animation:fadeSlideUp .15s ease;
}
.reject-reason-box textarea{
  width:100%; background:var(--panel); border:1px solid var(--line); border-radius:7px; padding:7px 9px;
  font-size:12.5px; font-family:var(--font-sans); color:var(--text); resize:vertical;
}
.reject-reason-box textarea:focus{ outline:none; border-color:var(--red); }
.reject-reason-actions{ display:flex; justify-content:flex-end; gap:6px; }

/* חסימה — מודל דו-שלבי */
.block-confirm-modal{
  width:420px; max-width:100%; position:relative; background:var(--panel); border:1px solid var(--line);
  border-radius:var(--radius-card); padding:28px; box-shadow:var(--shadow-md); animation:modalIn .2s ease;
  display:flex; flex-direction:column; gap:12px; text-align:center; align-items:center;
}
.block-confirm-icon{ color:var(--red); background:color-mix(in srgb, var(--red) 12%, transparent); border-radius:50%; padding:12px; }
.block-confirm-modal h3{ font-family:var(--font-sans); font-size:16px; margin:0; }
.block-confirm-modal p{ color:var(--text-dim); font-size:13px; margin:0; }
.block-confirm-summary b{ color:var(--text); }
.block-confirm-modal textarea{
  width:100%; background:var(--bg); border:1px solid var(--line); border-radius:9px; padding:9px 11px;
  font-size:13px; font-family:var(--font-sans); color:var(--text); resize:vertical;
}
.block-confirm-modal textarea:focus{ outline:none; border-color:var(--red); }
.block-confirm-reason-echo{ font-size:12.5px; color:var(--text-dim); font-style:italic; background:var(--bg); border-radius:8px; padding:8px 12px; width:100%; }
.block-confirm-actions{ display:flex; gap:8px; justify-content:center; width:100%; }
.btn-block-confirm{
  background:var(--red); color:#fff; border:none; border-radius:8px; padding:8px 16px; font-family:var(--font-sans);
  font-weight:700; font-size:12.5px; cursor:pointer; display:inline-flex; align-items:center; gap:5px;
}
.btn-block-confirm:hover{ filter:brightness(1.1); }

.person-card-blocked-banner{
  display:flex; align-items:center; gap:8px; background:color-mix(in srgb, var(--red) 10%, var(--panel));
  border:1px solid var(--red); border-radius:9px; padding:9px 12px; font-size:12px; color:var(--red); margin-bottom:16px;
}
.person-card-officer-note{ color:var(--text-dim); font-size:12.5px; background:var(--bg); border:1px solid var(--line); border-radius:9px; padding:10px 12px; margin-bottom:6px; }
.person-card-block-row{ margin-top:16px; padding-top:16px; border-top:1px solid var(--line); }
.btn-block, .btn-unblock{
  width:100%; display:flex; align-items:center; justify-content:center; gap:6px; border-radius:8px; padding:9px;
  font-family:var(--font-sans); font-weight:700; font-size:12.5px; cursor:pointer; transition:filter .15s ease;
}
.btn-block{ background:transparent; border:1px solid var(--red); color:var(--red); }
.btn-block:hover{ background:color-mix(in srgb, var(--red) 8%, transparent); }
.btn-unblock{ background:var(--accent); border:none; color:var(--accent-ink); }
.btn-unblock:hover{ filter:brightness(1.08); }

/* רשימת חסומים */
.blocked-list{ display:flex; flex-direction:column; gap:8px; }
.blocked-row{
  background:var(--panel); border:1px solid var(--line); border-radius:10px; padding:12px 16px;
  display:flex; flex-wrap:wrap; align-items:center; gap:10px 14px; opacity:0; animation:fadeSlideUp .2s ease forwards;
}
.blocked-row-main{ display:flex; align-items:center; gap:14px; flex-wrap:wrap; }
.blocked-row-reason{ color:var(--text-dim); font-size:12px; flex:1; min-width:200px; }
.blocked-scope-tag{
  font-family:var(--font-mono); font-size:9.5px; text-transform:uppercase; border:1px solid var(--text-dim);
  color:var(--text-dim); border-radius:3px; padding:2px 6px;
}
.blocked-scope-tag.scope-brigade{ border-color:var(--accent); color:var(--accent); }

/* צוותים — כרטיסי צוות בתצוגת הקצין */
.team-create-form{ align-items:flex-end; }
.team-card-grid{ display:flex; flex-direction:column; gap:10px; }
.team-card{ background:var(--panel); border:1px solid var(--line); border-radius:10px; padding:14px 16px; }
.team-card-head{ display:flex; align-items:center; gap:10px; }
.team-card-logo{ width:32px; height:32px; border-radius:8px; object-fit:cover; flex:none; }
.team-card-logo-fallback{
  width:32px; height:32px; border-radius:8px; background:var(--panel-raised); color:var(--accent);
  display:flex; align-items:center; justify-content:center; flex:none;
}
.team-card-title{ display:flex; flex-direction:column; gap:2px; flex:1; min-width:0; }
.team-card-title > span{ font-family:var(--font-sans); font-weight:700; font-size:14px; cursor:pointer; display:inline-flex; align-items:center; gap:5px; color:var(--text-dim); }
.team-card-title > span:hover{ color:var(--text); }
.team-card-title input{ background:var(--bg); border:1px solid var(--accent); border-radius:6px; padding:5px 8px; font-size:13px; font-family:var(--font-sans); color:var(--text); }
.team-card-lead{ font-size:11.5px; color:var(--text-dim); font-family:var(--font-mono); }
.team-card-delete{ background:none; border:1px solid transparent; color:var(--text-dim); border-radius:6px; padding:6px; cursor:pointer; }
.team-card-delete:hover{ color:var(--red); border-color:var(--red); }
.team-card-toggle-row{ display:flex; align-items:center; gap:6px; font-size:11.5px; color:var(--text-dim); margin-top:10px; }
.team-card-empty{ color:var(--text-dim); font-size:12px; margin-top:8px; }
.team-card-subteams{ display:flex; flex-direction:column; gap:5px; margin-top:10px; }
.team-card-subteam{ display:flex; align-items:center; gap:6px; font-size:12.5px; background:var(--bg); border-radius:7px; padding:6px 10px; flex-wrap:wrap; }
.team-card-subteam-count{ color:var(--text-dim); }
.team-card-subteam-members{ font-size:11px; color:var(--text-dim); font-family:var(--font-mono); }

/* בקשות ארגון ממתינות (תור אישור קצין אמל״ח יחידה) */
.team-request-list{ display:flex; flex-direction:column; gap:8px; }
.team-request-row{
  display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap;
  background:var(--panel); border:1px solid var(--line); border-radius:10px; padding:11px 15px;
}
.team-request-main{ display:flex; flex-direction:column; gap:3px; }
.team-request-kind{ font-family:var(--font-mono); font-size:10.5px; color:var(--accent); text-transform:uppercase; }
.team-request-detail{ font-size:13px; }
.team-request-meta{ font-size:11px; color:var(--text-dim); }
.team-request-actions{ display:flex; gap:8px; }

/* תצוגת ראש צוות */
.team-lead-head-card{ display:flex; align-items:center; gap:12px; background:var(--panel); border:1px solid var(--line); border-radius:10px; padding:12px 16px; margin-bottom:20px; }
.team-lead-desc-box{ display:flex; flex-direction:column; gap:8px; align-items:flex-end; }
.team-lead-desc-box textarea{
  width:100%; background:var(--panel); border:1px solid var(--line); border-radius:9px; padding:10px 12px;
  font-size:13.5px; font-family:var(--font-sans); color:var(--text); resize:vertical;
}
.team-lead-desc-box textarea:focus{ outline:none; border-color:var(--accent); }
.team-lead-gate-toggle{
  display:flex; align-items:center; gap:8px; background:var(--panel); border:1px solid var(--line); border-radius:10px;
  padding:11px 15px; font-size:12.5px; color:var(--text-dim); cursor:pointer; width:100%; text-align:right; font-family:var(--font-sans);
  transition:border-color .15s ease;
}
.team-lead-gate-toggle:hover{ border-color:var(--accent); }
.team-lead-subteam-list{ display:flex; flex-direction:column; gap:10px; }
.team-lead-subteam-card{ background:var(--panel); border:1px solid var(--line); border-radius:10px; padding:12px 16px; }
.team-lead-subteam-head{ display:flex; align-items:center; gap:6px; font-weight:700; font-size:13.5px; font-family:var(--font-sans); }
.team-lead-subteam-members{ display:flex; flex-direction:column; gap:2px; font-size:11.5px; color:var(--text-dim); font-family:var(--font-mono); margin-top:6px; }
.team-lead-add-member-form{ display:flex; gap:8px; margin-top:10px; flex-wrap:wrap; }
.team-lead-add-member-form input{
  flex:1; min-width:120px; background:var(--bg); border:1px solid var(--line); border-radius:6px; padding:7px 10px;
  font-size:12.5px; color:var(--text); font-family:var(--font-sans);
}

@media (max-width:900px){
  .perm-row{ grid-template-columns:1fr 1fr 34px; }
  .perm-row > *:nth-child(3):not(:last-child), .perm-row > *:nth-child(4), .perm-row > *:nth-child(5){ display:none; }
  .perm-row-head > *:nth-child(3), .perm-row-head > *:nth-child(4), .perm-row-head > *:nth-child(5){ display:none; }
}
@media (max-width:700px){
  .officer-row{ grid-template-columns:1fr; }
}
`;
