import React, { useEffect, useMemo, useState } from "react";
import { X, Camera, FileText, Paperclip, Image as ImageIcon } from "lucide-react";
import UnitEmblem from "./UnitEmblem.jsx";
import CountUp from "./CountUp.jsx";
import Loading from "./Loading.jsx";
import { StatusPill, PriorityDot } from "./opsData.jsx";
import { fetchBrigadeTickets, fetchBrigadeUnits } from "./brigadeStore.js";
import { STRUCTURAL_ROLES } from "./roles.js";

const ROLE_TABS = {
  [STRUCTURAL_ROLES.MEMBER]: [["myTickets", "הדרישות שלי"]],
  [STRUCTURAL_ROLES.UNIT_OFFICER]: [
    ["queue", "תור אישורים"],
    ["approvedFolder", "תיקיית אושרו"],
    ["rejectedFolder", "תיקיית סורבו"],
  ],
  [STRUCTURAL_ROLES.BRIGADE_OFFICER]: [
    ["dashboard", "דשבורד חטיבתי"],
    ["approvedFolder", "תיקיית אושרו"],
    ["rejectedFolder", "תיקיית סורבו"],
  ],
  [STRUCTURAL_ROLES.SYSTEM_ADMIN]: [
    ["dashboard", "דשבורד חטיבתי"],
    ["queue", "תור אישורים"],
    ["approvedFolder", "תיקיית אושרו"],
    ["rejectedFolder", "תיקיית סורבו"],
  ],
};

const ROLE_HEAD = {
  [STRUCTURAL_ROLES.MEMBER]: { title: "דרישות וטיקטים", sub: "מעקב אחר הדרישות שפתחת מול הקטלוג" },
  [STRUCTURAL_ROLES.UNIT_OFFICER]: { title: "דרישות וטיקטים — קצין אמל״ח יחידה", sub: "אישור דרישות שנפתחו ביחידה ומעקב אחר החלטות" },
  [STRUCTURAL_ROLES.BRIGADE_OFFICER]: { title: "דרישות וטיקטים — קצין אמל״ח חטיבה", sub: "תיעדוף דרישות שאושרו ביחידות החטיבה" },
  [STRUCTURAL_ROLES.SYSTEM_ADMIN]: { title: "דרישות וטיקטים — תצוגת מנהל מערכת", sub: "תצוגה מלאה על כלל הדרישות במערכת" },
};

export default function Tickets({ role, persona, brigadeId }) {
  const tabs = ROLE_TABS[role] || ROLE_TABS[STRUCTURAL_ROLES.MEMBER];
  const [tab, setTab] = useState(tabs[0][0]);
  const [tickets, setTickets] = useState(null);
  const [units, setUnits] = useState([]);
  const [detailTicket, setDetailTicket] = useState(null);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [toast, setToast] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  useEffect(() => {
    setTab(tabs[0][0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  useEffect(() => {
    let cancelled = false;
    setTickets(null);
    Promise.all([fetchBrigadeTickets(brigadeId), fetchBrigadeUnits(brigadeId)]).then(([t, u]) => {
      if (cancelled) return;
      setTickets(t);
      setUnits(u);
      setLastUpdated(new Date());
    });
    return () => { cancelled = true; };
  }, [brigadeId]);

  function nowStamp() {
    const d = new Date();
    return d.toLocaleDateString("he-IL") + " " + d.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
  }

  function flash(msg) {
    setToast(msg);
    window.clearTimeout(flash._t);
    flash._t = window.setTimeout(() => setToast(null), 2600);
  }

  function submitTicket(data) {
    const id = "REQ-" + Math.floor(1050 + Math.random() * 900);
    const stamp = nowStamp();
    const t = {
      id, title: data.title, desc: data.desc, unit: persona?.unit || data.unit || units[0] || "",
      damatz: data.damatz, extras: data.extras, status: "pending", priority: null,
      requestedBy: persona ? `${persona.rank} ${persona.name}` : "משתמש נוכחי (הדגמה)",
      createdAt: "עכשיו", submittedAt: stamp, decidedAt: null, decidedBy: null,
      dueDate: "", photoUploaded: (data.extras || []).some((f) => /\.(jpg|jpeg|png)$/i.test(f)),
    };
    setTickets((prev) => [t, ...prev]);
    setShowTicketModal(false);
    setLastUpdated(new Date());
    flash(`הדרישה ${id} נפתחה ונשלחה לקצין האמל״ח ביחידה`);
  }

  function decide(id, decision) {
    const stamp = nowStamp();
    setTickets((prev) =>
      prev.map((t) =>
        t.id === id
          ? { ...t, status: decision, decidedAt: stamp, decidedBy: "משתמש נוכחי (הדגמה)", daysLeft: decision === "rejected" ? 30 : undefined }
          : t
      )
    );
    setLastUpdated(new Date());
    flash(decision === "approved" ? `${id} אושר והועבר לחטיבה` : `${id} סורב — יימחק בעוד 30 ימים`);
  }

  function setPriority(id, priority) {
    setTickets((prev) => prev.map((t) => (t.id === id ? { ...t, priority } : t)));
    setLastUpdated(new Date());
  }

  function setDueDate(id, dueDate) {
    setTickets((prev) => prev.map((t) => (t.id === id ? { ...t, dueDate } : t)));
    setLastUpdated(new Date());
  }

  const pendingForUnit = useMemo(() => (tickets || []).filter((t) => t.status === "pending"), [tickets]);
  const approvedFolder = useMemo(() => (tickets || []).filter((t) => t.status === "approved"), [tickets]);
  const rejectedFolder = useMemo(() => (tickets || []).filter((t) => t.status === "rejected"), [tickets]);
  const myUnitTickets = useMemo(
    () => (persona ? (tickets || []).filter((t) => t.unit === persona.unit) : (tickets || [])),
    [tickets, persona]
  );
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
    <div dir="rtl" className="tickets-view">
      <style>{CSS}</style>

      <div className="view-head-row">
        <p className="view-sub">
          {role === STRUCTURAL_ROLES.MEMBER && persona
            ? `מציג רק את דרישות ${persona.unit} — היחידה שלך`
            : head.sub}
          {" · "}עדכון אחרון: {lastUpdated.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </p>
        {role === STRUCTURAL_ROLES.MEMBER && (
          <button className="new-ticket-btn" onClick={() => setShowTicketModal(true)}>
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

      {tab === "myTickets" && (
        <TicketListView
          title={persona ? `דרישות ${persona.unit}` : "הדרישות שנפתחו על ידך"}
          tickets={myUnitTickets}
          showUnit={false}
          onOpen={setDetailTicket}
        />
      )}
      {tab === "queue" && (
        <ApprovalQueueView tickets={pendingForUnit} onDecide={decide} onOpen={setDetailTicket} />
      )}
      {tab === "approvedFolder" && (
        <TicketListView title="תיקיית אושרו" tickets={approvedFolder} showUnit onOpen={setDetailTicket} />
      )}
      {tab === "rejectedFolder" && (
        <TicketListView title="תיקיית סורבו" tickets={rejectedFolder} showUnit showExpiry onOpen={setDetailTicket} />
      )}
      {tab === "dashboard" && (
        <BrigadeDashboard tickets={approvedFolder} onPriority={setPriority} onOpen={setDetailTicket} />
      )}

      {detailTicket && (
        <TicketDetailModal
          ticket={tickets.find((t) => t.id === detailTicket.id) || detailTicket}
          onClose={() => setDetailTicket(null)}
          onSetDueDate={setDueDate}
        />
      )}
      {showTicketModal && (
        <DamatzBotModal defaultUnit={persona?.unit} onClose={() => setShowTicketModal(false)} onSubmit={submitTicket} />
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Ticket list / cards                                                 */
/* ------------------------------------------------------------------ */

function TicketCard({ t, showUnit, showExpiry, footer, delay = 0, onOpen }) {
  return (
    <div
      className="ticket-card ticket-card-clickable"
      style={{ animationDelay: `${delay}ms` }}
      onClick={() => onOpen && onOpen(t)}
    >
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
        {t.dueDate && <span className="ticket-due">תג״ב: {t.dueDate}</span>}
        {t.photoUploaded && <span className="meta-icon-item"><Camera size={13} /> תמונה מצורפת</span>}
        <span>קובץ דמ״ץ: {t.damatz}</span>
        {t.extras?.length > 0 && <span>קבצים נוספים: {t.extras.length}</span>}
      </div>
      {showExpiry && (
        <div className="ticket-expiry">יימחק אוטומטית בעוד {t.daysLeft ?? 30} ימים</div>
      )}
      {footer && <div onClick={(e) => e.stopPropagation()}>{footer}</div>}
    </div>
  );
}

function TicketListView({ title, tickets, showUnit, showExpiry, onOpen }) {
  return (
    <div className="panel-card list-card">
      <div className="list-head">
        <h2>{title}</h2>
        <p><CountUp value={tickets.length} /> דרישות — לחיצה על דרישה פותחת פרטים מלאים</p>
      </div>
      <div className="ticket-list">
        {tickets.length === 0 && <div className="empty">אין דרישות להצגה כרגע.</div>}
        {tickets.map((t, idx) => (
          <TicketCard key={t.id} t={t} showUnit={showUnit} showExpiry={showExpiry} delay={idx * 50} onOpen={onOpen} />
        ))}
      </div>
    </div>
  );
}

function ApprovalQueueView({ tickets, onDecide, onOpen }) {
  return (
    <div className="panel-card list-card">
      <div className="list-head">
        <h2>תור אישורים</h2>
        <p><CountUp value={tickets.length} /> דרישות ממתינות להחלטה</p>
      </div>
      <div className="ticket-list">
        {tickets.length === 0 && <div className="empty">אין דרישות ממתינות.</div>}
        {tickets.map((t, idx) => (
          <TicketCard
            key={t.id}
            t={t}
            showUnit
            delay={idx * 50}
            onOpen={onOpen}
            footer={
              <div className="ticket-actions">
                <button className="btn-approve" onClick={() => onDecide(t.id, "approved")}>אישור</button>
                <button className="btn-reject" onClick={() => onDecide(t.id, "rejected")}>סירוב</button>
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

function BrigadeDashboard({ tickets, onPriority, onOpen }) {
  const order = { red: 0, yellow: 1, green: 2, null: 3 };
  const sorted = [...tickets].sort((a, b) => (order[a.priority] ?? 3) - (order[b.priority] ?? 3));

  return (
    <div className="panel-card list-card">
      <div className="list-head">
        <h2>דשבורד קצין אמל״ח — חטיבה</h2>
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
          <div className="dash-row dash-row-clickable" key={t.id} onClick={() => onOpen && onOpen(t)}>
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
            <span className="prio-picker" onClick={(e) => e.stopPropagation()}>
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
/* Ticket detail modal                                                 */
/* ------------------------------------------------------------------ */

function TicketDetailModal({ ticket, onClose, onSetDueDate }) {
  const t = ticket;
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal detail-modal" onClick={(e) => e.stopPropagation()}>
        <button className="drawer-close" onClick={onClose}><X size={16} /></button>

        <div className="modal-head">
          <div className="detail-id-row">
            <span className="ticket-id">{t.id}</span>
            <StatusPill status={t.status} />
          </div>
          <h2>{t.title}</h2>
          <div className="ticket-unit-tag">
            <UnitEmblem name={t.unit} size={18} showRing={false} />
            {t.unit}
          </div>
        </div>

        <p className="detail-desc">{t.desc}</p>

        <div className="detail-grid">
          <div className="detail-field">
            <span>נפתח על ידי</span>
            <b>{t.requestedBy || "לא ידוע"}</b>
          </div>
          <div className="detail-field">
            <span>תאריך ושעת פתיחה</span>
            <b>{t.submittedAt || t.createdAt}</b>
          </div>
          <div className="detail-field">
            <span>הוחלט על ידי</span>
            <b>{t.decidedBy || "טרם התקבלה החלטה"}</b>
          </div>
          <div className="detail-field">
            <span>תאריך ושעת החלטה</span>
            <b>{t.decidedAt || "טרם התקבלה החלטה"}</b>
          </div>
          <div className="detail-field">
            <span>עדיפות</span>
            <b><PriorityDot p={t.priority} /></b>
          </div>
        </div>

        <label className="due-date-field">
          <span>תג״ב — תאריך גמר ביצוע</span>
          <input
            type="text"
            value={t.dueDate || ""}
            placeholder="לדוגמה: 30/08/2026"
            onChange={(e) => onSetDueDate(t.id, e.target.value)}
          />
        </label>

        <div className="detail-files">
          <div className="detail-files-title">קבצים מצורפים</div>
          <div className="detail-file-row">
            <span className="file-chip"><FileText size={12} /> {t.damatz}</span>
          </div>
          {t.extras?.length > 0 && (
            <div className="detail-file-row">
              {t.extras.map((f) => (
                <span className="file-chip" key={f}><Paperclip size={12} /> {f}</span>
              ))}
            </div>
          )}
        </div>

        {t.photoUploaded ? (
          <div className="photo-placeholder">
            <ImageIcon size={20} className="photo-icon" />
            <span>תמונה מצורפת לדרישה (הדגמה — תצוגה מקדימה תתווסף בשלב הבא)</span>
          </div>
        ) : (
          <div className="photo-placeholder photo-placeholder-empty">לא הועלתה תמונה לדרישה זו</div>
        )}

        {t.status === "rejected" && (
          <div className="ticket-expiry">יימחק אוטומטית בעוד {t.daysLeft ?? 30} ימים</div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* DamatzBot modal (ticket creation)                                   */
/* ------------------------------------------------------------------ */

function DamatzBotModal({ onClose, onSubmit, defaultUnit }) {
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [unit] = useState(defaultUnit || "");
  const [damatz, setDamatz] = useState(null);
  const [extras, setExtras] = useState([]);

  const canSubmit = title.trim() && desc.trim() && damatz;

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="drawer-close" onClick={onClose}><X size={16} /></button>
        <div className="modal-head">
          <div className="modal-bot-badge">דמ״צבוט</div>
          <h2>פתיחת דרישה למסמך דמ״ץ</h2>
          <p>מלא/י את הפרטים. הבקשה תישלח לאישור קצין האמל״ח ביחידתך.</p>
        </div>

        <label className="field">
          <span>יחידה — נקבעת אוטומטית לפי המשתמש המחובר</span>
          <input value={unit} disabled />
        </label>

        <label className="field">
          <span>כותרת הדרישה</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="לדוגמה: חוסר בסוללות שדה" />
        </label>

        <label className="field">
          <span>תיאור</span>
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={4} placeholder="פרט/י את הצורך, הכמות והדחיפות" />
        </label>

        <label className="field">
          <span>קובץ דמ״ץ (חובה)</span>
          <input type="file" onChange={(e) => setDamatz(e.target.files?.[0]?.name ?? null)} />
          {damatz && <span className="file-chip">{damatz}</span>}
        </label>

        <label className="field">
          <span>קבצים נוספים (אופציונלי)</span>
          <input type="file" multiple onChange={(e) => setExtras(Array.from(e.target.files || []).map((f) => f.name))} />
          {extras.length > 0 && <span className="file-chip">{extras.length} קבצים נבחרו</span>}
        </label>

        <div className="modal-actions">
          <button className="btn-cancel" onClick={onClose}>ביטול</button>
          <button className="btn-submit" disabled={!canSubmit} onClick={() => onSubmit({ title, desc, unit, damatz, extras })}>
            שליחה לאישור
          </button>
        </div>
      </div>
    </div>
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
  background:var(--accent); color:var(--accent-ink); border:none; border-radius:9px;
  font-family:var(--font-sans); font-weight:700; font-size:14px; padding:11px 18px; cursor:pointer;
  transition:filter .15s ease, box-shadow .15s ease;
}
.new-ticket-btn:hover{ filter:brightness(1.08); box-shadow:var(--shadow-sm); }

.ticket-list{ display:flex; flex-direction:column; gap:10px; }
.ticket-card{
  background:var(--panel-raised); border:1px solid var(--line); border-radius:12px; padding:16px 18px;
  opacity:0; animation:fadeSlideUp .25s ease forwards;
  transition:border-color .15s ease, box-shadow .15s ease;
}
.ticket-card:hover{ border-color:var(--accent); box-shadow:var(--shadow-sm); }
.ticket-top{ display:flex; justify-content:space-between; align-items:flex-start; gap:10px; }
.ticket-id{ font-family:var(--font-mono); font-size:12px; color:var(--accent); }
.ticket-title{ font-family:var(--font-sans); font-weight:600; font-size:16px; margin-top:3px; }
.ticket-title-sm{ font-size:12.5px; color:var(--text-dim); }
.ticket-desc{ font-size:14px; color:var(--text-dim); margin:9px 0; line-height:1.55; }
.ticket-meta{ display:flex; flex-wrap:wrap; gap:14px; font-size:12px; color:var(--text-dim); font-family:var(--font-mono); align-items:center; }
.ticket-unit-tag, .meta-icon-item{ display:inline-flex; align-items:center; gap:5px; }
.ticket-expiry{ margin-top:8px; font-size:12px; color:var(--red); }
.ticket-actions{ display:flex; gap:8px; margin-top:12px; }
.btn-approve, .btn-reject, .btn-cancel, .btn-submit{
  border:none; border-radius:9px; padding:9px 17px; font-family:var(--font-sans);
  font-weight:700; font-size:13.5px; cursor:pointer;
  transition:filter .15s ease, box-shadow .15s ease;
}
.btn-approve{ background:var(--green); color:#FFFFFF; }
.btn-approve:hover{ filter:brightness(1.08); }
.btn-reject{ background:transparent; color:var(--red); border:1px solid var(--red); }
.btn-reject:hover{ background:var(--panel-raised); }

.empty{ color:var(--text-dim); font-size:14px; padding:30px 0; text-align:center; }

.legend{ display:flex; gap:18px; font-size:13px; color:var(--text-dim); margin-bottom:16px; }
.legend span{ display:flex; align-items:center; gap:6px; }

.dash-table{ display:flex; flex-direction:column; border:1px solid var(--line); border-radius:10px; overflow:hidden; }
.dash-row{
  display:grid; grid-template-columns:60px 1fr 120px 120px 130px;
  align-items:center; padding:12px 16px; border-bottom:1px solid var(--line); font-size:14px;
  transition:background .15s ease;
}
.dash-row:not(.dash-head):hover{ background:var(--panel-raised); }
.dash-row:last-child{ border-bottom:none; }
.dash-head{ background:var(--panel-raised); font-family:var(--font-mono); font-size:11px; color:var(--text-dim); text-transform:uppercase; letter-spacing:.05em; }
.dim{ color:var(--text-dim); font-size:13px; }

.prio-dot{ width:10px; height:10px; border-radius:50%; display:inline-block; }
.prio-dot.prio-none{ width:auto;height:auto;color:var(--text-dim); font-size:13px; }
.prio-green{ background:var(--green); }
.prio-yellow{ background:var(--yellow); }
.prio-red{ background:var(--red); animation:urgentPulse 1.8s ease-in-out infinite; }

.prio-picker{ display:flex; gap:6px; }
.prio-pick{ width:16px; height:16px; border-radius:50%; border:1px solid var(--line); cursor:pointer; opacity:.5; transition:opacity .15s ease; }
.prio-pick:hover{ opacity:.85; }
.prio-pick.active{ opacity:1; border-color:var(--text); }
.prio-pick-green{ background:var(--green); }
.prio-pick-yellow{ background:var(--yellow); }
.prio-pick-red{ background:var(--red); }

.overlay{ position:fixed; inset:0; background:rgba(6,8,10,.6); backdrop-filter:blur(2px); display:flex; align-items:center; justify-content:center; z-index:200; padding:24px; animation:overlayIn .15s ease; }
.modal{
  width:440px; max-width:100%; max-height:88vh; overflow-y:auto;
  background:var(--panel); border:1px solid var(--line); border-radius:var(--radius-card); padding:28px;
  position:relative; box-shadow:var(--shadow-md); animation:modalIn .2s ease;
}
.drawer-close{ position:absolute; top:16px; left:16px; background:none; border:1px solid transparent; color:var(--text-dim); cursor:pointer; border-radius:8px; padding:6px; display:flex; transition:color .15s ease, border-color .15s ease; }
.drawer-close:hover{ color:var(--red); border-color:var(--red); }
.modal-head{ margin-bottom:18px; }
.modal-bot-badge{ display:inline-block; font-family:var(--font-mono); font-size:11px; color:var(--accent-ink); background:var(--accent); padding:2px 10px; border-radius:20px; margin-bottom:10px; letter-spacing:.03em; }
.modal-head h2{ font-family:var(--font-sans); font-weight:700; font-size:20px; margin:0 0 6px; }
.modal-head p{ font-size:13px; color:var(--text-dim); margin:0; }

.field{ display:flex; flex-direction:column; gap:6px; margin-bottom:15px; font-size:13px; color:var(--text-dim); }
.field input, .field select, .field textarea{ background:var(--bg); border:1px solid var(--line); border-radius:8px; color:var(--text); padding:10px 11px; font-family:var(--font-sans); font-size:14px; resize:vertical; transition:border-color .15s ease, box-shadow .15s ease; }
.field input:focus, .field select:focus, .field textarea:focus{ outline:none; border-color:var(--accent); box-shadow:0 0 0 3px color-mix(in srgb, var(--accent) 18%, transparent); }
.file-chip{ display:inline-flex; align-items:center; gap:5px; align-self:flex-start; font-size:12px; background:var(--panel-raised); border:1px solid var(--line); border-radius:20px; padding:3px 10px; color:var(--text); font-family:var(--font-mono); }

.modal-actions{ display:flex; justify-content:flex-end; gap:10px; margin-top:8px; }
.btn-cancel{ background:transparent; color:var(--text-dim); border:1px solid var(--line); }
.btn-cancel:hover{ color:var(--text); border-color:var(--text-dim); }
.btn-submit{ background:var(--accent); color:var(--accent-ink); }
.btn-submit:not(:disabled):hover{ filter:brightness(1.08); }
.btn-submit:disabled{ opacity:.4; cursor:not-allowed; }

.toast{
  position:fixed; bottom:24px; left:50%; transform:translateX(-50%);
  background:var(--panel); border:1px solid var(--accent); color:var(--text);
  font-family:var(--font-mono); font-size:13px; padding:10px 20px; border-radius:12px;
  z-index:250; box-shadow:var(--shadow-md); animation:fadeSlideUp .2s ease;
}

.ticket-card-clickable{ cursor:pointer; }
.ticket-due{ color:var(--accent); }
.dash-row-clickable{ cursor:pointer; }

.detail-modal{ width:500px; }
.detail-id-row{ display:flex; align-items:center; gap:10px; margin-bottom:6px; }
.detail-modal h2{ font-family:var(--font-sans); font-weight:700; font-size:20px; margin:2px 0 8px; }
.detail-desc{ font-size:14px; color:var(--text-dim); line-height:1.6; margin:14px 0; }
.detail-grid{ display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:16px; }
.detail-field{ background:var(--bg); border:1px solid var(--line); border-radius:9px; padding:10px 12px; display:flex; flex-direction:column; gap:4px; font-size:12px; color:var(--text-dim); }
.detail-field b{ font-size:14px; color:var(--text); font-family:var(--font-mono); font-weight:500; }
.due-date-field{ display:flex; flex-direction:column; gap:6px; font-size:13px; color:var(--text-dim); margin-bottom:16px; }
.due-date-field input{ background:var(--bg); border:1px solid var(--accent); border-radius:8px; color:var(--accent); padding:10px 11px; font-family:var(--font-mono); font-size:14px; }
.due-date-field input:focus{ outline:none; box-shadow:0 0 0 3px color-mix(in srgb, var(--accent) 18%, transparent); }
.detail-files{ margin-bottom:14px; }
.detail-files-title{ font-family:var(--font-mono); font-size:11px; color:var(--text-dim); text-transform:uppercase; letter-spacing:.05em; margin-bottom:8px; }
.detail-file-row{ display:flex; flex-wrap:wrap; gap:6px; margin-bottom:6px; }
.photo-placeholder{ display:flex; align-items:center; gap:10px; background:var(--bg); border:1px dashed var(--line); border-radius:10px; padding:14px; font-size:13px; color:var(--text-dim); margin-bottom:6px; }
.photo-icon{ width:22px; height:22px; flex:none; color:var(--text-dim); }
.photo-placeholder-empty{ justify-content:center; opacity:.7; }

@media (max-width:640px){
  .dash-row{ grid-template-columns:40px 1fr; row-gap:6px; }
}
`;
