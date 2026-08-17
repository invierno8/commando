import React, { useState, useMemo } from "react";
import UnitEmblem from "./UnitEmblem.jsx";

/* ------------------------------------------------------------------ */
/* Mock data                                                          */
/* ------------------------------------------------------------------ */

const CATALOG = [
  { id: "VHF-07", name: 'מכשיר קשר טקטי', category: "תקשורת", qty: 42, icon: "📻",
    desc: 'מכשיר קשר שדה טווח ארוך, עמיד למים ולזעזועים. כולל סוללה נטענת וכבל טעינה שדה.' },
  { id: "NVG-03", name: 'משקפת ראיית לילה', category: "ראייה", qty: 17, icon: "🔭",
    desc: 'משקפת דור 3, הגברת אור שארית. מותקנת על קסדה או מוחזקת ביד. כוללת נרתיק הגנה.' },
  { id: "VST-09", name: 'אפוד נשיאה טקטי', category: "ציוד אישי", qty: 63, icon: "🦺",
    desc: 'אפוד מודולרי בשיטת MOLLE, מתאים לנשיאת מגזינים, ציוד עזרה ראשונה וציוד נלווה.' },
  { id: "BAT-12", name: 'סוללות ליתיום שדה', category: "אנרגיה", qty: 210, icon: "🔋",
    desc: 'מארז סוללות ליתיום להזנת ציוד תקשורת וראייה. אחסון בטמפרטורה מבוקרת בלבד.' },
  { id: "MED-04", name: 'אלונקת חילוץ קלה', category: "רפואה", qty: 9, icon: "🩺",
    desc: 'אלונקה מתקפלת, משקל קל, מיועדת לפינוי בשטח פתוח ובמרחבים סגורים.' },
  { id: "GEN-02", name: 'גנרטור שדה נייד', category: "אנרגיה", qty: 6, icon: "⚙️",
    desc: 'גנרטור נייד להזנת עמדת פיקוד זמנית. כולל מתאם לטעינת ציוד תקשורת.' },
  { id: "TNT-06", name: 'אוהל שטח 6 מקומות', category: "לוגיסטיקה", qty: 24, icon: "⛺",
    desc: 'אוהל שטח בעל מסגרת קלה להקמה, כולל יתדות ורצועות עיגון.' },
  { id: "NAV-01", name: 'מצפן דיגיטלי', category: "ניווט", qty: 55, icon: "🧭",
    desc: 'מצפן דיגיטלי עם תאורה אחורית, עמיד למים, כולל מד גובה בסיסי.' },
  { id: "LGT-05", name: 'פנס טקטי לקסדה', category: "תאורה", qty: 88, icon: "🔦",
    desc: 'פנס עם שלושה מצבי עוצמה ומצב תאורה אדומה לשמירה על ראיית לילה.' },
];

const UNITS = ["גדוד 71", "גדוד 84", "גדוד 12", "יחידת מטה"];

const seedTickets = [
  { id: "REQ-1042", title: 'חוסר במשקפות ראיית לילה', desc: 'נדרשות 4 יחידות נוספות לפלוגה לקראת תרגיל.', unit: "גדוד 71",
    damatz: "damatz_nvg_1042.pdf", extras: ["תמונת_מצאי.jpg"], status: "pending", priority: null, createdAt: "היום, 08:12" },
  { id: "REQ-1041", title: 'תקלה בגנרטור שדה', desc: 'הגנרטור בעמדת הפיקוד אינו מניע עומס מלא.', unit: "גדוד 84",
    damatz: "damatz_gen_1041.pdf", extras: [], status: "approved", priority: "yellow", createdAt: "אתמול, 19:40" },
  { id: "REQ-1039", title: 'בקשה לאוהלי שטח נוספים', desc: 'הרחבת מוצב זמני, נדרשים 3 אוהלים.', unit: "גדוד 12",
    damatz: "damatz_tent_1039.pdf", extras: ["תרשים_מוצב.pdf"], status: "approved", priority: "green", createdAt: "לפני יומיים" },
  { id: "REQ-1037", title: 'סוללות שדה — מלאי נמוך', desc: 'מלאי הסוללות ליחידת התקשורת עומד להיגמר.', unit: "גדוד 71",
    damatz: "damatz_bat_1037.pdf", extras: [], status: "rejected", priority: null, createdAt: "לפני 3 ימים", daysLeft: 27 },
  { id: "REQ-1033", title: 'אלונקת חילוץ פגומה', desc: 'רצועת נשיאה קרועה, נדרש חילוף מיידי.', unit: "יחידת מטה",
    damatz: "damatz_med_1033.pdf", extras: ["תמונה_נזק.jpg"], status: "approved", priority: "red", createdAt: "לפני 4 ימים" },
];

/* ------------------------------------------------------------------ */
/* Small presentational helpers                                       */
/* ------------------------------------------------------------------ */

const STATUS_LABEL = {
  pending: "ממתין לאישור יחידה",
  approved: "אושר — הועבר לחטיבה",
  rejected: "סורב",
};

function PriorityDot({ p }) {
  if (!p) return <span className="prio-dot prio-none" title="לא תועדף">—</span>;
  return <span className={`prio-dot prio-${p}`} title={p} />;
}

function StatusPill({ status }) {
  return <span className={`status-pill status-${status}`}>{STATUS_LABEL[status]}</span>;
}

/* ------------------------------------------------------------------ */
/* Main component                                                     */
/* ------------------------------------------------------------------ */

export default function TacticalSystem() {
  const [role, setRole] = useState("user"); // user | unitOfficer | brigadeOfficer
  const [tab, setTab] = useState("catalog");
  const [tickets, setTickets] = useState(seedTickets);
  const [product, setProduct] = useState(null);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [toast, setToast] = useState(null);

  function flash(msg) {
    setToast(msg);
    window.clearTimeout(flash._t);
    flash._t = window.setTimeout(() => setToast(null), 2600);
  }

  function submitTicket(data) {
    const id = "REQ-" + Math.floor(1050 + Math.random() * 900);
    const t = {
      id, title: data.title, desc: data.desc, unit: data.unit || UNITS[0],
      damatz: data.damatz, extras: data.extras, status: "pending", priority: null,
      createdAt: "עכשיו",
    };
    setTickets((prev) => [t, ...prev]);
    setShowTicketModal(false);
    flash(`הדרישה ${id} נפתחה ונשלחה לקצין האמל״ח ביחידה`);
  }

  function decide(id, decision) {
    setTickets((prev) =>
      prev.map((t) =>
        t.id === id
          ? { ...t, status: decision, daysLeft: decision === "rejected" ? 30 : undefined }
          : t
      )
    );
    flash(decision === "approved" ? `${id} אושר והועבר לחטיבה` : `${id} סורב — יימחק בעוד 30 ימים`);
  }

  function setPriority(id, priority) {
    setTickets((prev) => prev.map((t) => (t.id === id ? { ...t, priority } : t)));
  }

  const pendingForUnit = useMemo(() => tickets.filter((t) => t.status === "pending"), [tickets]);
  const approvedFolder = useMemo(() => tickets.filter((t) => t.status === "approved"), [tickets]);
  const rejectedFolder = useMemo(() => tickets.filter((t) => t.status === "rejected"), [tickets]);

  const roleTabs = {
    user: [["catalog", "קטלוג אמל״ח"], ["myTickets", "הדרישות שלי"]],
    unitOfficer: [["queue", "תור אישורים"], ["approvedFolder", "תיקיית אושרו"], ["rejectedFolder", "תיקיית סורבו"]],
    brigadeOfficer: [["dashboard", "דשבורד חטיבתי"]],
  };

  React.useEffect(() => {
    setTab(roleTabs[role][0][0]);
  }, [role]);

  return (
    <div dir="rtl" className="app">
      <style>{CSS}</style>
      <div className="bg-fx" aria-hidden="true" />

      <div className="classbar">
        <span className="classbar-scan" aria-hidden="true" />
        <span>מערכת ניטור אמל״ח ובקרת דרישות — סביבת פיתוח / דמו</span>
        <span className="classbar-tag">לא לשימוש מבצעי</span>
      </div>

      <div className="shell">
        <aside className="sidebar">
          <div className="brand">
            <div className="brand-mark">א/ח</div>
            <div>
              <div className="brand-title">אמל״ח־נט</div>
              <div className="brand-sub">בקרת ציוד ודרישות</div>
            </div>
          </div>

          <div className="role-select">
            <div className="role-select-label">תצוגת תפקיד</div>
            {[
              ["user", "משתמש יחידה"],
              ["unitOfficer", "קצין אמל״ח — יחידה"],
              ["brigadeOfficer", "קצין אמל״ח — חטיבה"],
            ].map(([key, label]) => (
              <button
                key={key}
                className={"role-btn" + (role === key ? " active" : "")}
                onClick={() => setRole(key)}
              >
                <span className="role-btn-led" />
                {label}
              </button>
            ))}
          </div>

          <nav className="nav">
            {roleTabs[role].map(([key, label]) => (
              <button
                key={key}
                className={"nav-btn" + (tab === key ? " active" : "")}
                onClick={() => setTab(key)}
              >
                {label}
              </button>
            ))}
          </nav>

          {role === "user" && (
            <button className="new-ticket-btn" onClick={() => setShowTicketModal(true)}>
              + פתיחת דרישה חדשה
            </button>
          )}
        </aside>

        <main className="main" key={tab}>
          {tab === "catalog" && (
            <CatalogView items={CATALOG} onOpen={setProduct} />
          )}

          {tab === "myTickets" && (
            <TicketListView title="הדרישות שנפתחו על ידך" tickets={tickets} showUnit={false} />
          )}

          {tab === "queue" && (
            <ApprovalQueueView tickets={pendingForUnit} onDecide={decide} />
          )}

          {tab === "approvedFolder" && (
            <TicketListView title="תיקיית אושרו" tickets={approvedFolder} showUnit />
          )}

          {tab === "rejectedFolder" && (
            <TicketListView title="תיקיית סורבו" tickets={rejectedFolder} showUnit showExpiry />
          )}

          {tab === "dashboard" && (
            <BrigadeDashboard tickets={approvedFolder} onPriority={setPriority} />
          )}
        </main>
      </div>

      {product && <ProductDrawer item={product} onClose={() => setProduct(null)} />}
      {showTicketModal && (
        <DamatzBotModal onClose={() => setShowTicketModal(false)} onSubmit={submitTicket} />
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Catalog                                                             */
/* ------------------------------------------------------------------ */

function CatalogView({ items, onOpen }) {
  return (
    <div>
      <div className="view-head">
        <h1>קטלוג אמל״ח</h1>
        <p>מלאי ציוד זמין ליחידה. לחיצה על פריט פותחת קלף מוצר מלא.</p>
      </div>
      <div className="catalog-grid">
        {items.map((it, idx) => (
          <button
            className="prod-card"
            key={it.id}
            style={{ animationDelay: `${idx * 45}ms` }}
            onClick={() => onOpen(it)}
          >
            <div className="prod-icon-ring">
              <div className="prod-icon">{it.icon}</div>
            </div>
            <div className="prod-name">{it.name}</div>
            <div className="prod-id">{it.id}</div>
            <div className="prod-qty">
              <span className="prod-qty-dot" />
              במלאי: {it.qty}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function ProductDrawer({ item, onClose }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="drawer" onClick={(e) => e.stopPropagation()}>
        <button className="drawer-close" onClick={onClose}>✕</button>
        <div className="drawer-icon">{item.icon}</div>
        <div className="drawer-id">{item.id}</div>
        <h2>{item.name}</h2>
        <div className="drawer-tag">{item.category}</div>
        <div className="drawer-row">
          <span>כמות במלאי</span>
          <b>{item.qty}</b>
        </div>
        <p className="drawer-desc">{item.desc}</p>
        <div className="drawer-note">
          שדות נוספים לקלף המוצר (מיקום אחסון, סטטוס תחזוקה, קישור לדרישה) יתווספו בשלב האפיון הבא.
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Ticket list / cards                                                 */
/* ------------------------------------------------------------------ */

function TicketCard({ t, showUnit, showExpiry, footer, delay = 0 }) {
  return (
    <div className="ticket-card" style={{ animationDelay: `${delay}ms` }}>
      <div className="ticket-top">
        <div>
          <div className="ticket-id">{t.id}</div>
          <div className="ticket-title">{t.title}</div>
        </div>
        <StatusPill status={t.status} />
      </div>
      <p className="ticket-desc">{t.desc}</p>
      <div className="ticket-meta">
        {showUnit && (
          <span className="ticket-unit-tag">
            <UnitEmblem name={t.unit} size={16} showRing={false} />
            {t.unit}
          </span>
        )}
        <span>נפתח: {t.createdAt}</span>
        <span>קובץ דמ״ץ: {t.damatz}</span>
        {t.extras?.length > 0 && <span>קבצים נוספים: {t.extras.length}</span>}
      </div>
      {showExpiry && (
        <div className="ticket-expiry">יימחק אוטומטית בעוד {t.daysLeft ?? 30} ימים</div>
      )}
      {footer}
    </div>
  );
}

function TicketListView({ title, tickets, showUnit, showExpiry }) {
  return (
    <div>
      <div className="view-head">
        <h1>{title}</h1>
        <p>{tickets.length} דרישות</p>
      </div>
      <div className="ticket-list">
        {tickets.length === 0 && <div className="empty">אין דרישות להצגה כרגע.</div>}
        {tickets.map((t, idx) => (
          <TicketCard key={t.id} t={t} showUnit={showUnit} showExpiry={showExpiry} delay={idx * 60} />
        ))}
      </div>
    </div>
  );
}

function ApprovalQueueView({ tickets, onDecide }) {
  return (
    <div>
      <div className="view-head">
        <h1>תור אישורים — קצין אמל״ח יחידה</h1>
        <p>{tickets.length} דרישות ממתינות להחלטה</p>
      </div>
      <div className="ticket-list">
        {tickets.length === 0 && <div className="empty">אין דרישות ממתינות.</div>}
        {tickets.map((t, idx) => (
          <TicketCard
            key={t.id}
            t={t}
            showUnit
            delay={idx * 60}
            footer={
              <div className="ticket-actions">
                <button className="btn-approve" onClick={() => onDecide(t.id, "approved")}>
                  אישור
                </button>
                <button className="btn-reject" onClick={() => onDecide(t.id, "rejected")}>
                  סירוב
                </button>
              </div>
            }
          />
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Brigade dashboard                                                   */
/* ------------------------------------------------------------------ */

function BrigadeDashboard({ tickets, onPriority }) {
  const order = { red: 0, yellow: 1, green: 2, null: 3 };
  const sorted = [...tickets].sort((a, b) => (order[a.priority] ?? 3) - (order[b.priority] ?? 3));

  return (
    <div>
      <div className="view-head">
        <h1>דשבורד קצין אמל״ח — חטיבה</h1>
        <p>כלל הדרישות שאושרו ביחידות החטיבה, ממוינות לפי דחיפות</p>
      </div>

      <div className="legend">
        <span><i className="prio-dot prio-red" /> דחוף</span>
        <span><i className="prio-dot prio-yellow" /> בינוני</span>
        <span><i className="prio-dot prio-green" /> שגרתי</span>
      </div>

      <div className="dash-table">
        <div className="dash-row dash-head">
          <span>עדיפות</span>
          <span>דרישה</span>
          <span>יחידה</span>
          <span>נפתח</span>
          <span>קבע עדיפות</span>
        </div>
        {sorted.length === 0 && <div className="empty">אין דרישות מאושרות עדיין.</div>}
        {sorted.map((t) => (
          <div className="dash-row" key={t.id}>
            <span><PriorityDot p={t.priority} /></span>
            <span>
              <div className="ticket-id">{t.id}</div>
              <div className="ticket-title-sm">{t.title}</div>
            </span>
            <span className="ticket-unit-tag">
              <UnitEmblem name={t.unit} size={18} showRing={false} />
              {t.unit}
            </span>
            <span className="dim">{t.createdAt}</span>
            <span className="prio-picker">
              {["green", "yellow", "red"].map((p) => (
                <button
                  key={p}
                  className={`prio-pick prio-pick-${p}` + (t.priority === p ? " active" : "")}
                  onClick={() => onPriority(t.id, p)}
                  title={p}
                />
              ))}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* DamatzBot modal (ticket creation)                                   */
/* ------------------------------------------------------------------ */

function DamatzBotModal({ onClose, onSubmit }) {
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [unit, setUnit] = useState(UNITS[0]);
  const [damatz, setDamatz] = useState(null);
  const [extras, setExtras] = useState([]);

  const canSubmit = title.trim() && desc.trim() && damatz;

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="drawer-close" onClick={onClose}>✕</button>
        <div className="modal-head">
          <div className="modal-bot-badge">דמ״צבוט</div>
          <h2>פתיחת דרישה למסמך דמ״ץ</h2>
          <p>מלא/י את הפרטים. הבקשה תישלח לאישור קצין האמל״ח ביחידתך.</p>
        </div>

        <label className="field">
          <span>יחידה</span>
          <select value={unit} onChange={(e) => setUnit(e.target.value)}>
            {UNITS.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>כותרת הדרישה</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="לדוגמה: חוסר בסוללות שדה"
          />
        </label>

        <label className="field">
          <span>תיאור</span>
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            rows={4}
            placeholder="פרט/י את הצורך, הכמות והדחיפות"
          />
        </label>

        <label className="field">
          <span>קובץ דמ״ץ (חובה)</span>
          <input
            type="file"
            onChange={(e) => setDamatz(e.target.files?.[0]?.name ?? null)}
          />
          {damatz && <span className="file-chip">{damatz}</span>}
        </label>

        <label className="field">
          <span>קבצים נוספים (אופציונלי)</span>
          <input
            type="file"
            multiple
            onChange={(e) => setExtras(Array.from(e.target.files || []).map((f) => f.name))}
          />
          {extras.length > 0 && (
            <span className="file-chip">{extras.length} קבצים נבחרו</span>
          )}
        </label>

        <div className="modal-actions">
          <button className="btn-cancel" onClick={onClose}>ביטול</button>
          <button
            className="btn-submit"
            disabled={!canSubmit}
            onClick={() => onSubmit({ title, desc, unit, damatz, extras })}
          >
            שליחה לאישור
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* CSS — tactical / field-console identity                             */
/* ------------------------------------------------------------------ */

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;600;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');

:root{
  --bg:#12140F;
  --panel:#1A1F16;
  --panel-raised:#212819;
  --line:#3A4530;
  --text:#E9E6D8;
  --text-dim:#9BA28A;
  --amber:#C9A227;
  --green:#5C8A3A;
  --yellow:#D4A72C;
  --red:#C1432E;
}

@keyframes bgDrift{ 0%{ background-position:0 0, 0 0; } 100%{ background-position:120px 120px, -90px 60px; } }
@keyframes scanSweep{ 0%{ transform:translateX(-30%); opacity:0; } 8%{ opacity:1; } 92%{ opacity:1; } 100%{ transform:translateX(130%); opacity:0; } }
@keyframes cardIn{ from{ opacity:0; transform:translateY(10px) scale(.97); } to{ opacity:1; transform:translateY(0) scale(1); } }
@keyframes pulseGlowRed{ 0%,100%{ box-shadow:0 0 4px 0 var(--red); } 50%{ box-shadow:0 0 13px 3px var(--red); } }
@keyframes pulseGlowYellow{ 0%,100%{ box-shadow:0 0 4px 0 var(--yellow); } 50%{ box-shadow:0 0 11px 2px var(--yellow); } }
@keyframes pulseGlowGreen{ 0%,100%{ box-shadow:0 0 4px 0 var(--green); } 50%{ box-shadow:0 0 10px 2px var(--green); } }
@keyframes ledPulse{ 0%,100%{ box-shadow:0 0 4px 1px var(--amber); } 50%{ box-shadow:0 0 10px 3px var(--amber); } }
@keyframes fadeSlideUp{ from{ opacity:0; transform:translateY(14px); } to{ opacity:1; transform:translateY(0); } }
@keyframes drawerIn{ from{ opacity:0; transform:translateX(24px); } to{ opacity:1; transform:translateX(0); } }
@keyframes modalIn{ from{ opacity:0; transform:translateY(14px) scale(.97); } to{ opacity:1; transform:translateY(0) scale(1); } }
@keyframes overlayIn{ from{ opacity:0; } to{ opacity:1; } }
@keyframes shimmer{ 0%{ background-position:-200% 0; } 100%{ background-position:200% 0; } }

.app{
  position:relative;
  background:var(--bg);
  color:var(--text);
  font-family:'Inter',sans-serif;
  min-height:600px;
  border-radius:8px;
  overflow:hidden;
  border:1px solid var(--line);
  isolation:isolate;
}

.bg-fx{
  position:absolute; inset:0; z-index:0; pointer-events:none;
  background-image:
    linear-gradient(rgba(201,162,39,.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(201,162,39,.05) 1px, transparent 1px),
    radial-gradient(ellipse at 20% -10%, rgba(92,138,58,.10), transparent 55%),
    radial-gradient(ellipse at 100% 110%, rgba(201,162,39,.08), transparent 50%);
  background-size:42px 42px, 42px 42px, auto, auto;
  animation:bgDrift 26s linear infinite;
}
.classbar, .shell{ position:relative; z-index:1; }

.classbar{
  position:relative;
  background:repeating-linear-gradient(135deg,#3A3419,#3A3419 10px,#332e15 10px,#332e15 20px);
  border-bottom:1px solid var(--amber);
  color:var(--amber);
  font-family:'IBM Plex Mono',monospace;
  font-size:11px;
  letter-spacing:.04em;
  padding:6px 16px;
  display:flex;
  justify-content:space-between;
  align-items:center;
  overflow:hidden;
}
.classbar-scan{
  position:absolute; top:0; bottom:0; width:14%;
  background:linear-gradient(90deg, transparent, rgba(233,230,216,.22), transparent);
  animation:scanSweep 5.5s ease-in-out infinite;
  pointer-events:none;
}
.classbar-tag{
  border:1px solid var(--amber);
  padding:1px 8px;
  border-radius:3px;
  transition:box-shadow .25s ease;
}
.classbar-tag:hover{ box-shadow:0 0 8px rgba(201,162,39,.5); }

.shell{ display:flex; min-height:560px; }

.sidebar{
  width:230px;
  flex:none;
  background:var(--panel);
  border-left:1px solid var(--line);
  padding:18px 14px;
  display:flex;
  flex-direction:column;
  gap:22px;
}

.brand{ display:flex; align-items:center; gap:10px; }
.brand-mark{
  width:36px;height:36px;border-radius:6px;
  background:var(--panel-raised);
  border:1px solid var(--amber);
  color:var(--amber);
  display:flex;align-items:center;justify-content:center;
  font-family:'IBM Plex Mono',monospace; font-weight:600; font-size:12px;
}
.brand-title{ font-family:'Rajdhani',sans-serif; font-weight:700; font-size:17px; letter-spacing:.02em; }
.brand-sub{ font-size:11px; color:var(--text-dim); }

.role-select-label{
  font-family:'IBM Plex Mono',monospace;
  font-size:10px; letter-spacing:.08em; color:var(--text-dim);
  margin-bottom:8px; text-transform:uppercase;
}
.role-btn{
  width:100%; text-align:right; display:flex; align-items:center; gap:8px;
  background:transparent; border:1px solid transparent; color:var(--text-dim);
  font-family:'Inter',sans-serif; font-size:13px; padding:8px 10px; border-radius:5px;
  cursor:pointer; margin-bottom:4px; transition:background .18s ease, color .18s ease, transform .12s ease;
}
.role-btn:hover{ background:var(--panel-raised); color:var(--text); transform:translateX(-2px); }
.role-btn.active{ background:var(--panel-raised); border-color:var(--line); color:var(--amber); }
.role-btn-led{
  width:7px;height:7px;border-radius:50%; background:var(--line); flex:none; transition:box-shadow .2s ease, background .2s ease;
}
.role-btn.active .role-btn-led{ background:var(--amber); animation:ledPulse 1.8s ease-in-out infinite; }

.nav{ display:flex; flex-direction:column; gap:3px; border-top:1px solid var(--line); padding-top:14px; }
.nav-btn{
  text-align:right; background:transparent; border:none; color:var(--text-dim);
  font-family:'Rajdhani',sans-serif; font-weight:600; font-size:15px;
  padding:9px 10px; border-radius:5px; cursor:pointer;
  transition:color .18s ease, background .18s ease, border-color .25s ease;
  border-right:2px solid transparent;
}
.nav-btn:hover{ color:var(--text); background:rgba(255,255,255,.03); }
.nav-btn.active{ background:var(--bg); color:var(--text); border-right-color:var(--amber); }

.new-ticket-btn{
  margin-top:auto;
  position:relative; overflow:hidden;
  background:var(--amber); color:#161A10; border:none; border-radius:5px;
  font-family:'Rajdhani',sans-serif; font-weight:700; font-size:14px;
  padding:11px; cursor:pointer;
  transition:filter .18s ease, transform .12s ease, box-shadow .25s ease;
}
.new-ticket-btn:hover{ filter:brightness(1.1); box-shadow:0 0 16px rgba(201,162,39,.45); transform:translateY(-1px); }
.new-ticket-btn:active{ transform:translateY(0) scale(.98); }
.new-ticket-btn::after{
  content:""; position:absolute; inset:0;
  background:linear-gradient(100deg, transparent 30%, rgba(255,255,255,.35) 50%, transparent 70%);
  background-size:200% 100%;
  animation:shimmer 3.2s ease-in-out infinite;
}

.main{ flex:1; padding:26px 30px; overflow-y:auto; max-height:640px; animation:fadeSlideUp .3s ease; }

.view-head h1{
  font-family:'Rajdhani',sans-serif; font-size:26px; font-weight:700; margin:0 0 4px;
}
.view-head p{ color:var(--text-dim); font-size:13px; margin:0 0 20px; }

.catalog-grid{
  display:grid; grid-template-columns:repeat(auto-fill,minmax(150px,1fr)); gap:12px;
}
.prod-card{
  background:var(--panel); border:1px solid var(--line); border-radius:7px;
  padding:16px 10px; text-align:center; cursor:pointer; color:var(--text);
  display:flex; flex-direction:column; gap:6px; align-items:center;
  opacity:0; animation:cardIn .45s ease forwards;
  transition:border-color .2s ease, background .2s ease, transform .18s ease, box-shadow .25s ease;
}
.prod-card:hover{
  border-color:var(--amber); background:var(--panel-raised);
  transform:translateY(-3px); box-shadow:0 8px 20px rgba(0,0,0,.35), 0 0 14px rgba(201,162,39,.18);
}
.prod-card:active{ transform:translateY(-1px) scale(.99); }
.prod-icon-ring{
  width:46px; height:46px; border-radius:50%; display:flex; align-items:center; justify-content:center;
  background:var(--panel-raised); border:1px solid var(--line); transition:border-color .2s ease, box-shadow .2s ease;
}
.prod-card:hover .prod-icon-ring{ border-color:var(--amber); box-shadow:0 0 12px rgba(201,162,39,.35); }
.prod-icon{ font-size:22px; transition:transform .25s ease; }
.prod-card:hover .prod-icon{ transform:scale(1.12); }
.prod-name{ font-family:'Rajdhani',sans-serif; font-weight:600; font-size:14px; }
.prod-id{ font-family:'IBM Plex Mono',monospace; font-size:11px; color:var(--amber); }
.prod-qty{ font-size:11px; color:var(--text-dim); display:flex; align-items:center; gap:5px; }
.prod-qty-dot{ width:5px; height:5px; border-radius:50%; background:var(--green); box-shadow:0 0 5px var(--green); }
.unit-emblem{ display:block; flex:none; transition:transform .2s ease, filter .2s ease; }
.unit-emblem-ring:hover{ transform:scale(1.08); filter:drop-shadow(0 0 6px rgba(201,162,39,.4)); }

.overlay{
  position:absolute; inset:0; background:rgba(0,0,0,.55); backdrop-filter:blur(2px);
  display:flex; align-items:stretch; justify-content:flex-end; z-index:10;
  animation:overlayIn .2s ease;
}
.drawer{
  width:340px; background:var(--panel); border-right:1px solid var(--line);
  padding:26px 22px; position:relative; overflow-y:auto;
  box-shadow:-18px 0 40px rgba(0,0,0,.4);
  animation:drawerIn .28s cubic-bezier(.2,.8,.3,1);
}
.drawer-close{
  position:absolute; top:14px; left:14px; background:none; border:1px solid transparent;
  color:var(--text-dim); font-size:16px; cursor:pointer; border-radius:5px; padding:2px 7px;
  transition:color .18s ease, border-color .18s ease, transform .18s ease;
}
.drawer-close:hover{ color:var(--red); border-color:var(--red); transform:rotate(90deg); }
.drawer-icon{ font-size:36px; filter:drop-shadow(0 0 8px rgba(201,162,39,.35)); }
.drawer-id{ font-family:'IBM Plex Mono',monospace; color:var(--amber); font-size:12px; margin-top:8px; }
.drawer h2{ font-family:'Rajdhani',sans-serif; font-size:22px; margin:4px 0 8px; }
.drawer-tag{
  display:inline-block; font-size:11px; color:var(--text-dim);
  border:1px solid var(--line); border-radius:4px; padding:2px 8px; margin-bottom:14px;
}
.drawer-row{ display:flex; justify-content:space-between; font-size:13px; padding:8px 0; border-top:1px solid var(--line); }
.drawer-desc{ font-size:13px; color:var(--text-dim); line-height:1.6; margin-top:14px; }
.drawer-note{
  margin-top:20px; font-size:11px; color:var(--text-dim);
  border-top:1px dashed var(--line); padding-top:12px;
}

.ticket-list{ display:flex; flex-direction:column; gap:10px; }
.ticket-card{
  background:var(--panel); border:1px solid var(--line); border-radius:7px; padding:14px 16px;
  opacity:0; animation:fadeSlideUp .35s ease forwards;
  transition:border-color .2s ease, transform .18s ease, box-shadow .2s ease;
}
.ticket-card:hover{ border-color:#4b5640; transform:translateY(-1px); box-shadow:0 6px 16px rgba(0,0,0,.3); }
.ticket-top{ display:flex; justify-content:space-between; align-items:flex-start; gap:10px; }
.ticket-id{ font-family:'IBM Plex Mono',monospace; font-size:11px; color:var(--amber); }
.ticket-title{ font-family:'Rajdhani',sans-serif; font-weight:600; font-size:16px; margin-top:2px; }
.ticket-title-sm{ font-size:12px; color:var(--text-dim); }
.ticket-desc{ font-size:13px; color:var(--text-dim); margin:8px 0; line-height:1.5; }
.ticket-meta{ display:flex; flex-wrap:wrap; gap:14px; font-size:11px; color:var(--text-dim); font-family:'IBM Plex Mono',monospace; align-items:center; }
.ticket-unit-tag{ display:inline-flex; align-items:center; gap:5px; }
.ticket-expiry{ margin-top:8px; font-size:11px; color:var(--red); }
.ticket-actions{ display:flex; gap:8px; margin-top:12px; }
.btn-approve, .btn-reject, .btn-cancel, .btn-submit{
  border:none; border-radius:5px; padding:8px 16px; font-family:'Rajdhani',sans-serif;
  font-weight:700; font-size:13px; cursor:pointer;
  transition:filter .18s ease, transform .12s ease, box-shadow .2s ease;
}
.btn-approve{ background:var(--green); color:#0F150D; }
.btn-approve:hover{ filter:brightness(1.12); box-shadow:0 0 14px rgba(92,138,58,.5); transform:translateY(-1px); }
.btn-reject{ background:transparent; color:var(--red); border:1px solid var(--red); }
.btn-reject:hover{ background:rgba(193,67,46,.12); box-shadow:0 0 14px rgba(193,67,46,.35); transform:translateY(-1px); }
.btn-approve:active, .btn-reject:active{ transform:translateY(0) scale(.97); }

.status-pill{ font-size:10px; padding:3px 9px; border-radius:20px; font-family:'IBM Plex Mono',monospace; white-space:nowrap; border:1px solid transparent; }
.status-pending{ background:rgba(201,162,39,.15); color:var(--amber); border-color:rgba(201,162,39,.4); animation:pulseGlowYellow 2.2s ease-in-out infinite; }
.status-approved{ background:rgba(92,138,58,.18); color:var(--green); border-color:rgba(92,138,58,.4); }
.status-rejected{ background:rgba(193,67,46,.18); color:var(--red); border-color:rgba(193,67,46,.4); }

.empty{ color:var(--text-dim); font-size:13px; padding:30px 0; text-align:center; }

.legend{ display:flex; gap:18px; font-size:12px; color:var(--text-dim); margin-bottom:16px; }
.legend span{ display:flex; align-items:center; gap:6px; }

.dash-table{ display:flex; flex-direction:column; border:1px solid var(--line); border-radius:7px; overflow:hidden; }
.dash-row{
  display:grid; grid-template-columns:60px 1fr 110px 110px 130px;
  align-items:center; padding:11px 14px; border-bottom:1px solid var(--line); font-size:13px;
  transition:background .18s ease;
}
.dash-row:not(.dash-head):hover{ background:rgba(255,255,255,.03); }
.dash-row:last-child{ border-bottom:none; }
.dash-head{ background:var(--panel-raised); font-family:'IBM Plex Mono',monospace; font-size:10px; color:var(--text-dim); text-transform:uppercase; letter-spacing:.05em; }
.dim{ color:var(--text-dim); font-size:12px; }

.prio-dot{ width:11px; height:11px; border-radius:50%; display:inline-block; }
.prio-dot.prio-none{ width:auto;height:auto;color:var(--text-dim); font-size:12px; }
.prio-green{ background:var(--green); animation:pulseGlowGreen 2.6s ease-in-out infinite; }
.prio-yellow{ background:var(--yellow); animation:pulseGlowYellow 2.2s ease-in-out infinite; }
.prio-red{ background:var(--red); animation:pulseGlowRed 1.3s ease-in-out infinite; }

.prio-picker{ display:flex; gap:6px; }
.prio-pick{
  width:16px; height:16px; border-radius:50%; border:1px solid var(--line); cursor:pointer; opacity:.5;
  transition:opacity .18s ease, transform .15s ease, box-shadow .2s ease;
}
.prio-pick:hover{ opacity:.85; transform:scale(1.15); }
.prio-pick.active{ opacity:1; border-color:var(--text); transform:scale(1.1); }
.prio-pick-green{ background:var(--green); }
.prio-pick-yellow{ background:var(--yellow); }
.prio-pick-red{ background:var(--red); }
.prio-pick-green.active{ box-shadow:0 0 8px var(--green); }
.prio-pick-yellow.active{ box-shadow:0 0 8px var(--yellow); }
.prio-pick-red.active{ box-shadow:0 0 8px var(--red); }

.modal{
  margin:auto; width:420px; max-height:88vh; overflow-y:auto;
  background:var(--panel); border:1px solid var(--line); border-radius:9px; padding:26px;
  position:relative;
  box-shadow:0 20px 60px rgba(0,0,0,.5), 0 0 0 1px rgba(201,162,39,.08);
  animation:modalIn .28s cubic-bezier(.2,.8,.3,1);
}
.modal-head{ margin-bottom:18px; }
.modal-bot-badge{
  display:inline-block; font-family:'IBM Plex Mono',monospace; font-size:11px;
  color:#161A10; background:var(--amber); padding:2px 9px; border-radius:4px; margin-bottom:10px;
  animation:ledPulse 2s ease-in-out infinite;
}
.modal-head h2{ font-family:'Rajdhani',sans-serif; font-size:21px; margin:0 0 6px; }
.modal-head p{ font-size:12px; color:var(--text-dim); margin:0; }

.field{ display:flex; flex-direction:column; gap:6px; margin-bottom:14px; font-size:12px; color:var(--text-dim); }
.field input, .field select, .field textarea{
  background:var(--bg); border:1px solid var(--line); border-radius:5px; color:var(--text);
  padding:9px 10px; font-family:'Inter',sans-serif; font-size:13px; resize:vertical;
}
.field input, .field select, .field textarea{ transition:box-shadow .18s ease, border-color .18s ease; }
.field input:focus, .field select:focus, .field textarea:focus{ outline:none; border-color:var(--amber); box-shadow:0 0 0 3px rgba(201,162,39,.15); }
.file-chip{
  align-self:flex-start; font-size:11px; background:var(--panel-raised); border:1px solid var(--line);
  border-radius:4px; padding:3px 8px; color:var(--text); font-family:'IBM Plex Mono',monospace;
}

.modal-actions{ display:flex; justify-content:flex-end; gap:10px; margin-top:8px; }
.btn-cancel{ background:transparent; color:var(--text-dim); border:1px solid var(--line); }
.btn-cancel:hover{ color:var(--text); border-color:#4b5640; }
.btn-submit{ background:var(--amber); color:#161A10; }
.btn-submit:not(:disabled):hover{ box-shadow:0 0 16px rgba(201,162,39,.45); transform:translateY(-1px); }
.btn-submit:disabled{ opacity:.4; cursor:not-allowed; }

.toast{
  position:absolute; bottom:18px; left:50%; transform:translateX(-50%);
  background:var(--panel-raised); border:1px solid var(--amber); color:var(--amber);
  font-family:'IBM Plex Mono',monospace; font-size:12px; padding:9px 18px; border-radius:6px;
  z-index:20; box-shadow:0 0 20px rgba(201,162,39,.25), 0 8px 24px rgba(0,0,0,.4);
  animation:fadeSlideUp .3s ease;
}

@media (max-width:640px){
  .shell{ flex-direction:column; }
  .sidebar{ width:auto; flex-direction:row; flex-wrap:wrap; }
  .nav{ flex-direction:row; flex-wrap:wrap; }
  .dash-row{ grid-template-columns:40px 1fr; row-gap:6px; }
}
`;
