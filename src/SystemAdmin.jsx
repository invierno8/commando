import React, { useState } from "react";
import { X, Plus, Check, Trash2 } from "lucide-react";
import { BRIGADE_ICONS, BrigadeIcon } from "./BrigadeSetupWizard.jsx";
import { RANK_OPTIONS } from "./PermissionsDashboard.jsx";
import { BRIGADE_STATUS, BRIGADE_STATUS_LABELS, seedSystemAdmins } from "./brigadesData.js";

/* ================================================================== */
/* LEGO BLOCK — SystemAdmin: the one screen above brigade level.        */
/* HANGAR is built כלל-זרועי — to serve every brigade, not just this    */
/* one — so this is where a system admin provisions new brigades,       */
/* retires old ones, and manages who else holds system-admin rights.    */
/* Visible only to STRUCTURAL_ROLES.SYSTEM_ADMIN (gated in App.jsx).    */
/* ================================================================== */

function IconPicker({ value, onChange }) {
  return (
    <div className="sa-icon-picker">
      {Object.keys(BRIGADE_ICONS).map((key) => (
        <button
          key={key}
          type="button"
          className={"sa-icon-opt" + (value === key ? " active" : "")}
          onClick={() => onChange(key)}
        >
          <BrigadeIcon iconKey={key} size={16} />
        </button>
      ))}
    </div>
  );
}

function AddBrigadeForm({ onAdd }) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("shield");
  const [rank, setRank] = useState(RANK_OPTIONS[0]);
  const [contactName, setContactName] = useState("");
  const [personalNumber, setPersonalNumber] = useState("");

  const canAdd = name.trim() && contactName.trim() && personalNumber.trim();

  function submit() {
    onAdd({
      id: crypto.randomUUID(), name, icon, mission: "",
      status: BRIGADE_STATUS.PENDING, units: 0, members: 0,
      contactRank: rank, contactName, contactPersonalNumber: personalNumber,
      createdAt: new Date().toLocaleDateString("he-IL"),
    });
    setName(""); setContactName(""); setPersonalNumber(""); setIcon("shield"); setRank(RANK_OPTIONS[0]);
  }

  return (
    <div className="add-form">
      <label className="add-form-field">
        <span>שם החטיבה</span>
        <input placeholder="לדוגמה: חטיבת גבעתי" value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="add-form-field">
        <span>סמל</span>
        <IconPicker value={icon} onChange={setIcon} />
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

function BrigadeRow({ b, onUpdate, onActivate, onRemove }) {
  return (
    <div className="brigade-row">
      <div className="brigade-row-icon"><BrigadeIcon iconKey={b.icon} size={20} /></div>
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
      <button className="person-remove" onClick={() => onRemove(b.id)} title="הסרת חטיבה מהמערכת"><Trash2 size={14} /></button>
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
                <BrigadeIcon iconKey={b.icon} size={20} />
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
/* Root                                                                */
/* ================================================================== */

export default function SystemAdmin({ brigades, setBrigades }) {
  const [admins, setAdmins] = useState(seedSystemAdmins);
  const [tab, setTab] = useState("brigades");

  function updateBrigade(id, patch) {
    setBrigades((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }
  function activateBrigade(id) {
    updateBrigade(id, { status: BRIGADE_STATUS.ACTIVE });
  }
  function removeBrigade(id) {
    setBrigades((prev) => prev.filter((b) => b.id !== id));
  }
  function addBrigade(b) {
    setBrigades((prev) => [...prev, b]);
  }
  function addAdmin(a) {
    setAdmins((prev) => [...prev, a]);
  }
  function removeAdmin(id) {
    setAdmins((prev) => prev.filter((a) => a.id !== id));
  }

  return (
    <div dir="rtl" className="sysadmin-view">
      <style>{CSS}</style>

      <p className="view-sub">
        ניהול כלל-זרועי — האנגר משרת יותר מחטיבה אחת. כאן ניתן להקים חטיבות חדשות, לעקוב אחר סטטוס ההקמה שלהן,
        ולנהל מי מחזיק בהרשאת מנהל מערכת.
      </p>

      <div className="pill-tabs" style={{ marginBottom: 20 }}>
        <button className={"pill-tab" + (tab === "brigades" ? " active" : "")} onClick={() => setTab("brigades")}>חטיבות במערכת</button>
        <button className={"pill-tab" + (tab === "tree" ? " active" : "")} onClick={() => setTab("tree")}>עץ ארגוני</button>
        <button className={"pill-tab" + (tab === "admins" ? " active" : "")} onClick={() => setTab("admins")}>מנהלי מערכת</button>
      </div>

      {tab === "brigades" && (
        <div className="panel-card sa-section">
          <div className="section-title">חטיבות רשומות ({brigades.length})</div>
          <div className="brigade-list">
            {brigades.map((b) => (
              <BrigadeRow key={b.id} b={b} onUpdate={updateBrigade} onActivate={activateBrigade} onRemove={removeBrigade} />
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
          <div className="brigade-list">
            {admins.length === 0 && <div className="empty">אין עדיין מנהלי מערכת נוספים.</div>}
            {admins.map((a) => (
              <div className="person-row" key={a.id}>
                <div className="person-info">
                  <div className="person-name"><span className="person-rank">{a.rank}</span> {a.name}</div>
                  <div className="person-meta"><span>מ.א. {a.personalNumber}</span>{a.email && <span>{a.email}</span>}</div>
                </div>
                <button className="person-remove" onClick={() => removeAdmin(a.id)} title="הסרה"><X size={14} /></button>
              </div>
            ))}
          </div>
          <div className="section-title">הוספת מנהל מערכת</div>
          <AddAdminForm onAdd={addAdmin} />
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

.sa-icon-picker{ display:flex; flex-wrap:wrap; gap:6px; max-width:220px; }
.sa-icon-opt{
  width:30px; height:30px; border-radius:7px; background:var(--bg); border:1px solid var(--line);
  color:var(--text-dim); display:flex; align-items:center; justify-content:center; cursor:pointer;
  transition:border-color .15s ease, color .15s ease;
}
.sa-icon-opt.active{ border-color:var(--accent); color:var(--accent); background:var(--panel-raised); }

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

@media (max-width:760px){
  .brigade-row{ flex-direction:column; align-items:stretch; }
  .brigade-row-contact{ margin-inline-start:0; text-align:right; }
}
`;
