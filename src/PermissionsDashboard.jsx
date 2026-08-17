import React, { useState } from "react";
import UnitEmblem from "./UnitEmblem.jsx";
import ScopePicker, { ALL_SCOPE, SCOPE_PICKER_CSS } from "./ScopePicker.jsx";

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

const UNITS = ["מגלן", "דובדבן", "אגוז", "יחידת מטה"];

/* ================================================================== */
/* LEGO BLOCK — mock data                                              */
/* ================================================================== */

const seedUnitOfficers = [
  { id: "uo-1", unit: "מגלן", name: "רוני כהן", email: "roni.cohen@example.mil" },
  { id: "uo-2", unit: "דובדבן", name: "עידן לוי", email: "idan.levi@example.mil" },
  { id: "uo-3", unit: "אגוז", name: "מאיה ברק", email: "maya.barak@example.mil" },
  { id: "uo-4", unit: "יחידת מטה", name: "טל אשכנזי", email: "tal.ash@example.mil" },
];

const seedBrigadeStaff = [
  { id: "bs-1", name: "נועה שגיא", email: "noa.sagi@example.mil",
    catalogAccess: CATALOG_ACCESS.MANAGER, ticketAccess: TICKET_ACCESS.MANAGER },
];

const seedUnitPeople = {
  "מגלן": [
    { id: "p-1", name: "דניאל אור", email: "daniel.or@example.mil",
      catalogAccess: CATALOG_ACCESS.EDITOR, ticketAccess: TICKET_ACCESS.REQUESTER },
    { id: "p-2", name: "אביב שמש", email: "aviv.shemesh@example.mil",
      catalogAccess: CATALOG_ACCESS.READ, ticketAccess: TICKET_ACCESS.NONE },
  ],
  "דובדבן": [
    { id: "p-3", name: "יובל נחמן", email: "yuval.nachman@example.mil",
      catalogAccess: CATALOG_ACCESS.READ, ticketAccess: TICKET_ACCESS.REQUESTER },
  ],
  "אגוז": [],
  "יחידת מטה": [],
};

/* ================================================================== */
/* LEGO BLOCK — reusable pieces                                        */
/* ================================================================== */

function AccessSelect({ label, value, onChange, options, labels }) {
  return (
    <label className="access-field">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {Object.values(options).map((v) => (
          <option key={v} value={v}>{labels[v]}</option>
        ))}
      </select>
    </label>
  );
}

function PersonRow({ person, onChange, onRemove, showUnit }) {
  return (
    <div className="person-row">
      <div className="person-info">
        <div className="person-name">{person.name}</div>
        <div className="person-email">{person.email}</div>
        {showUnit && (
          <div className="person-unit">
            <UnitEmblem name={person.unit} size={16} showRing={false} />
            {person.unit}
          </div>
        )}
      </div>
      <AccessSelect
        label="קטלוג"
        value={person.catalogAccess}
        onChange={(v) => onChange({ ...person, catalogAccess: v })}
        options={CATALOG_ACCESS}
        labels={ACCESS_LABELS.catalog}
      />
      <AccessSelect
        label="דרישות"
        value={person.ticketAccess}
        onChange={(v) => onChange({ ...person, ticketAccess: v })}
        options={TICKET_ACCESS}
        labels={ACCESS_LABELS.ticket}
      />
      <button className="person-remove" onClick={() => onRemove(person.id)} title="הסרה">✕</button>
    </div>
  );
}

function AddPersonForm({ onAdd, extraField }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [catalogAccess, setCatalogAccess] = useState(CATALOG_ACCESS.READ);
  const [ticketAccess, setTicketAccess] = useState(TICKET_ACCESS.NONE);

  const canAdd = name.trim() && email.trim();

  function submit() {
    onAdd({ id: crypto.randomUUID(), name, email, catalogAccess, ticketAccess });
    setName(""); setEmail("");
    setCatalogAccess(CATALOG_ACCESS.READ); setTicketAccess(TICKET_ACCESS.NONE);
  }

  return (
    <div className="add-form">
      <input placeholder="שם מלא" value={name} onChange={(e) => setName(e.target.value)} />
      <input placeholder="אימייל (לחיבור עתידי למשתמש)" value={email} onChange={(e) => setEmail(e.target.value)} />
      <AccessSelect label="קטלוג" value={catalogAccess} onChange={setCatalogAccess} options={CATALOG_ACCESS} labels={ACCESS_LABELS.catalog} />
      <AccessSelect label="דרישות" value={ticketAccess} onChange={setTicketAccess} options={TICKET_ACCESS} labels={ACCESS_LABELS.ticket} />
      <button className="add-btn" disabled={!canAdd} onClick={submit}>+ הוספה</button>
    </div>
  );
}

/* ================================================================== */
/* Unit officer dashboard — reduced scope: only their own unit          */
/* ================================================================== */

function UnitRoster({ unit, unitPeople, setUnitPeople }) {
  const people = unitPeople[unit] || [];

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
      <div className="person-list">
        {people.length === 0 && <div className="empty">עדיין לא נוספו אנשים ליחידה זו.</div>}
        {people.map((p, idx) => (
          <div key={p.id} style={{ animationDelay: `${idx * 50}ms` }} className="person-row-wrap">
            <PersonRow person={p} onChange={updatePerson} onRemove={removePerson} />
          </div>
        ))}
      </div>

      <div className="section-title">הוספת איש צוות</div>
      <AddPersonForm onAdd={addPerson} />
    </>
  );
}

function UnitPermissionsView({ unit, setUnit, unitPeople, setUnitPeople }) {
  return (
    <div>
      <div className="view-head">
        <h1>ניהול הרשאות — יחידה</h1>
        <p>תצוגה מצומצמת: כל קצין אמל״ח יחידה מנהל רק את אנשי היחידה שלו.</p>
      </div>

      <label className="unit-select">
        <span>יחידה (הדגמה — בפועל נקבע לפי המשתמש המחובר)</span>
        <div className="unit-select-row">
          <UnitEmblem name={unit} size={30} />
          <select value={unit} onChange={(e) => setUnit(e.target.value)}>
            {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
      </label>

      <UnitRoster unit={unit} unitPeople={unitPeople} setUnitPeople={setUnitPeople} />
    </div>
  );
}

/* ================================================================== */
/* Brigade officer dashboard — full scope                              */
/* ================================================================== */

function BrigadePermissionsView({
  unitOfficers, setUnitOfficers, brigadeStaff, setBrigadeStaff,
  unitPeople, setUnitPeople,
}) {
  const [drill, setDrill] = useState(ALL_SCOPE);

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
        <ScopePicker scope={drill} setScope={setDrill} units={UNITS} allLabel="89 — כלל החטיבה" allEmblemName="89" />
      </div>

      {drill === ALL_SCOPE ? (
        <>
          <div className="section-title">קציני אמל״ח ביחידות</div>
          <div className="officer-list">
            {unitOfficers.map((o, idx) => (
              <div className="officer-row" key={o.id} style={{ animationDelay: `${idx * 50}ms` }}>
                <div className="officer-unit">
                  <UnitEmblem name={o.unit} size={26} />
                  {o.unit}
                </div>
                <input
                  className="officer-input"
                  value={o.name}
                  onChange={(e) => updateOfficer(o.id, { name: e.target.value })}
                  placeholder="שם קצין אמל״ח"
                />
                <input
                  className="officer-input"
                  value={o.email}
                  onChange={(e) => updateOfficer(o.id, { email: e.target.value })}
                  placeholder="אימייל"
                />
              </div>
            ))}
          </div>

          <div className="section-title">צוות חטיבתי נוסף</div>
          <div className="person-list">
            {brigadeStaff.length === 0 && <div className="empty">אין עדיין אנשי צוות חטיבתיים נוספים.</div>}
            {brigadeStaff.map((p, idx) => (
              <div key={p.id} style={{ animationDelay: `${idx * 50}ms` }} className="person-row-wrap">
                <PersonRow person={p} onChange={updateStaff} onRemove={removeStaff} />
              </div>
            ))}
          </div>

          <div className="section-title">הוספת איש צוות חטיבתי</div>
          <AddPersonForm onAdd={addStaff} />
        </>
      ) : (
        <>
          {drillOfficer && (
            <div className="drill-officer-tag">
              <UnitEmblem name={drill} size={22} showRing={false} />
              קצין אמל״ח היחידה: <b>{drillOfficer.name}</b>
              <span className="drill-officer-email">{drillOfficer.email}</span>
            </div>
          )}
          <UnitRoster unit={drill} unitPeople={unitPeople} setUnitPeople={setUnitPeople} />
        </>
      )}
    </div>
  );
}

/* ================================================================== */
/* Root                                                                */
/* ================================================================== */

export default function PermissionsDashboard() {
  const [scope, setScope] = useState("unit"); // unit | brigade
  const [unit, setUnit] = useState(UNITS[0]);
  const [unitPeople, setUnitPeople] = useState(seedUnitPeople);
  const [unitOfficers, setUnitOfficers] = useState(seedUnitOfficers);
  const [brigadeStaff, setBrigadeStaff] = useState(seedBrigadeStaff);

  return (
    <div dir="rtl" className="app">
      <style>{CSS}</style>
      <div className="bg-fx" aria-hidden="true" />

      <div className="scope-switch">
        <button className={"scope-btn" + (scope === "unit" ? " active" : "")} onClick={() => setScope("unit")}>
          קצין אמל״ח יחידה
        </button>
        <button className={"scope-btn" + (scope === "brigade" ? " active" : "")} onClick={() => setScope("brigade")}>
          קצין אמל״ח חטיבה
        </button>
      </div>

      <div key={scope} className="scope-body">
        {scope === "unit" ? (
          <UnitPermissionsView unit={unit} setUnit={setUnit} unitPeople={unitPeople} setUnitPeople={setUnitPeople} />
        ) : (
          <BrigadePermissionsView
            unitOfficers={unitOfficers} setUnitOfficers={setUnitOfficers}
            brigadeStaff={brigadeStaff} setBrigadeStaff={setBrigadeStaff}
            unitPeople={unitPeople} setUnitPeople={setUnitPeople}
          />
        )}
      </div>
    </div>
  );
}

/* ================================================================== */
/* CSS                                                                 */
/* ================================================================== */

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;600;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');

:root{
  --bg:#12140F; --panel:#1A1F16; --panel-raised:#212819; --line:#3A4530;
  --text:#E9E6D8; --text-dim:#9BA28A; --amber:#C9A227; --green:#5C8A3A; --red:#C1432E;
}
@keyframes bgDrift{ 0%{ background-position:0 0, 0 0; } 100%{ background-position:120px 120px, -90px 60px; } }
@keyframes fadeSlideUp{ from{ opacity:0; transform:translateY(10px); } to{ opacity:1; transform:translateY(0); } }

.app{ position:relative; overflow:hidden; background:var(--bg); color:var(--text);
  font-family:'Inter',sans-serif; border-radius:8px; border:1px solid var(--line); padding:28px 30px; min-height:560px; }
.bg-fx{ position:absolute; inset:0; z-index:0; pointer-events:none;
  background-image:linear-gradient(rgba(201,162,39,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(201,162,39,.05) 1px, transparent 1px);
  background-size:42px 42px, 42px 42px; animation:bgDrift 26s linear infinite; }
.app > *:not(.bg-fx){ position:relative; z-index:1; }

.scope-switch{ display:flex; gap:8px; margin-bottom:24px; border-bottom:1px solid var(--line); padding-bottom:16px; }
.scope-btn{ background:transparent; border:1px solid var(--line); color:var(--text-dim); border-radius:6px;
  padding:9px 18px; font-family:'Rajdhani',sans-serif; font-weight:700; font-size:14px; cursor:pointer;
  transition:border-color .2s ease, color .2s ease, background .2s ease; }
.scope-btn:hover{ color:var(--text); }
.scope-btn.active{ background:var(--amber); color:#161A10; border-color:var(--amber); }

.scope-body{ animation:fadeSlideUp .3s ease; }
.view-head h1{ font-family:'Rajdhani',sans-serif; font-size:24px; margin:0 0 4px; }
.view-head p{ color:var(--text-dim); font-size:13px; margin:0 0 20px; }
.view-head-row{ display:flex; justify-content:space-between; align-items:flex-start; gap:16px; flex-wrap:wrap; position:relative; z-index:10; }
.view-head-row .view-head, .view-head-row > div{ margin:0; }

${SCOPE_PICKER_CSS}

.drill-officer-tag{
  display:flex; align-items:center; gap:8px; background:var(--panel); border:1px solid var(--line);
  border-radius:7px; padding:9px 14px; font-size:12px; color:var(--text-dim); margin-bottom:18px;
}
.drill-officer-tag b{ color:var(--text); }
.drill-officer-email{ font-family:'IBM Plex Mono',monospace; color:var(--amber); margin-right:auto; }

.section-title{ font-family:'IBM Plex Mono',monospace; font-size:11px; color:var(--amber);
  text-transform:uppercase; letter-spacing:.05em; margin:22px 0 10px; }

.unit-select{ display:flex; flex-direction:column; gap:6px; font-size:12px; color:var(--text-dim); max-width:280px; margin-bottom:8px; }
.unit-select select{ background:var(--panel); border:1px solid var(--line); border-radius:6px; color:var(--text); padding:9px 10px; font-size:13px; }

.person-list{ display:flex; flex-direction:column; gap:8px; }
.person-row-wrap{ opacity:0; animation:fadeSlideUp .3s ease forwards; }
.person-row{
  display:flex; align-items:center; gap:14px; background:var(--panel); border:1px solid var(--line);
  border-radius:7px; padding:10px 14px; transition:border-color .18s ease;
}
.person-row:hover{ border-color:#4b5640; }
.person-info{ flex:1; min-width:120px; }
.person-name{ font-family:'Rajdhani',sans-serif; font-weight:600; font-size:14px; }
.person-email{ font-size:11px; color:var(--text-dim); font-family:'IBM Plex Mono',monospace; }
.person-unit{ font-size:10px; color:var(--amber); margin-top:2px; display:flex; align-items:center; gap:5px; }
.unit-select-row{ display:flex; align-items:center; gap:10px; }
.unit-emblem{ display:block; transition:transform .2s ease, filter .2s ease; }
.unit-emblem-ring:hover{ transform:scale(1.08); filter:drop-shadow(0 0 6px rgba(201,162,39,.4)); }


.access-field{ display:flex; flex-direction:column; gap:3px; font-size:10px; color:var(--text-dim); }
.access-field select{ background:var(--bg); border:1px solid var(--line); border-radius:5px; color:var(--text);
  padding:6px 8px; font-size:11px; min-width:150px; }

.person-remove{ background:none; border:1px solid transparent; color:var(--text-dim); border-radius:5px;
  padding:4px 8px; cursor:pointer; transition:color .18s ease, border-color .18s ease; }
.person-remove:hover{ color:var(--red); border-color:var(--red); }

.add-form{ display:flex; flex-wrap:wrap; gap:10px; align-items:flex-end; background:var(--panel);
  border:1px dashed var(--line); border-radius:7px; padding:14px; }
.add-form input{ background:var(--bg); border:1px solid var(--line); border-radius:5px; color:var(--text);
  padding:8px 10px; font-size:12px; flex:1; min-width:140px; }
.add-btn{ background:var(--amber); color:#161A10; border:none; border-radius:5px; padding:9px 16px;
  font-family:'Rajdhani',sans-serif; font-weight:700; font-size:13px; cursor:pointer; transition:filter .18s ease, box-shadow .2s ease; }
.add-btn:not(:disabled):hover{ filter:brightness(1.1); box-shadow:0 0 14px rgba(201,162,39,.4); }
.add-btn:disabled{ opacity:.4; cursor:not-allowed; }

.officer-list{ display:flex; flex-direction:column; gap:8px; }
.officer-row{
  display:grid; grid-template-columns:110px 1fr 1fr; gap:10px; align-items:center;
  background:var(--panel); border:1px solid var(--line); border-radius:7px; padding:10px 14px;
  opacity:0; animation:fadeSlideUp .3s ease forwards;
}
.officer-unit{ font-family:'Rajdhani',sans-serif; font-weight:600; color:var(--amber); font-size:13px; display:flex; align-items:center; gap:8px; }
.officer-input{ background:var(--bg); border:1px solid var(--line); border-radius:5px; color:var(--text);
  padding:7px 9px; font-size:12px; }

.empty{ color:var(--text-dim); font-size:13px; padding:16px 0; }

@media (max-width:700px){
  .person-row{ flex-wrap:wrap; }
  .officer-row{ grid-template-columns:1fr; }
}
`;
