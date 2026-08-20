import React, { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import UnitEmblem from "./UnitEmblem.jsx";
import ScopePicker, { ALL_SCOPE, SCOPE_PICKER_CSS } from "./ScopePicker.jsx";
import Loading from "./Loading.jsx";
import SearchBar from "./SearchBar.jsx";
import FilterSelect from "./FilterSelect.jsx";
import Pagination from "./Pagination.jsx";
import { matchesSearch } from "./search.js";
import { STRUCTURAL_ROLES } from "./roles.js";
import { fetchBrigadeUnits, fetchBrigadeRoster } from "./brigadeStore.js";

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

function PersonRow({ person, onChange, onRemove, showUnit, unitLogos, delay = 0 }) {
  return (
    <div className={"perm-row" + (showUnit ? "" : " no-unit")} style={{ animationDelay: `${delay}ms` }}>
      <span className="perm-person-name">
        <span className="person-rank">{person.rank}</span> {person.name}
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
      <AccessSelect
        value={person.catalogAccess}
        onChange={(v) => onChange({ ...person, catalogAccess: v })}
        options={CATALOG_ACCESS}
        labels={ACCESS_LABELS.catalog}
      />
      <AccessSelect
        value={person.ticketAccess}
        onChange={(v) => onChange({ ...person, ticketAccess: v })}
        options={TICKET_ACCESS}
        labels={ACCESS_LABELS.ticket}
      />
      <button className="person-remove" onClick={() => onRemove(person.id)} title="הסרה"><X size={14} /></button>
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
/* Unit officer dashboard — reduced scope: only their own unit          */
/* ================================================================== */

function UnitRoster({ unit, unitPeople, setUnitPeople, unitLogos }) {
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
              <PersonRow key={p.id} person={p} onChange={updatePerson} onRemove={removePerson} unitLogos={unitLogos} delay={idx * 30} />
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

function UnitPermissionsView({ unit, unitPeople, setUnitPeople, unitLogos }) {
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

      <UnitRoster unit={unit} unitPeople={unitPeople} setUnitPeople={setUnitPeople} unitLogos={unitLogos} />
    </div>
  );
}

/* ================================================================== */
/* Brigade officer dashboard — full scope                              */
/* ================================================================== */

function BrigadePermissionsView({
  units, unitOfficers, setUnitOfficers, brigadeStaff, setBrigadeStaff,
  unitPeople, setUnitPeople, unitLogos,
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
                  <div className="officer-row" key={o.id} style={{ animationDelay: `${idx * 40}ms` }}>
                    <div className="officer-unit">
                      <UnitEmblem name={o.unit} size={26} image={unitLogos?.[o.unit]} />
                      {o.unit}
                    </div>
                    <select className="officer-input officer-rank-input" value={o.rank} onChange={(e) => updateOfficer(o.id, { rank: e.target.value })}>
                      {RANK_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <input className="officer-input" value={o.name} onChange={(e) => updateOfficer(o.id, { name: e.target.value })} placeholder="שם קצין אמל״ח" />
                    <input className="officer-input" value={o.personalNumber} inputMode="numeric"
                      onChange={(e) => updateOfficer(o.id, { personalNumber: e.target.value.replace(/\D/g, "") })} placeholder="מספר אישי" />
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
                  <PersonRow key={p.id} person={p} onChange={updateStaff} onRemove={removeStaff} unitLogos={unitLogos} delay={idx * 30} />
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
          <UnitRoster unit={drill} unitPeople={unitPeople} setUnitPeople={setUnitPeople} unitLogos={unitLogos} />
        </>
      )}
    </div>
  );
}

/* ================================================================== */
/* Org tree — LEGO BLOCK. שכבה אחת מעל ומתחת למי שצופה, או התרשים המלא. */
/* ================================================================== */

function OrgNode({ title, sub, emblem, emblemImage, highlight, children }) {
  return (
    <div className={"org-node" + (highlight ? " org-node-you" : "")}>
      <div className="org-node-card">
        {emblem && <UnitEmblem name={emblem} size={24} showRing={false} image={emblemImage} />}
        <div>
          <div className="org-node-title">{title}</div>
          {sub && <div className="org-node-sub">{sub}</div>}
        </div>
        {highlight && <span className="org-node-you-tag">אתה כאן</span>}
      </div>
      {children && children.length > 0 && (
        <div className="org-node-children">
          {children.map((c, i) => <React.Fragment key={i}>{c}</React.Fragment>)}
        </div>
      )}
    </div>
  );
}

function OrgTree({ role, brigadeName, myUnit, units, unitOfficers, brigadeStaff, unitPeople, unitLogos }) {
  const personLeaf = (p) => (
    <OrgNode key={p.id} title={`${p.rank} ${p.name}`} sub={`מ.א. ${p.personalNumber}`} />
  );

  if (role === STRUCTURAL_ROLES.UNIT_OFFICER) {
    const officer = unitOfficers.find((o) => o.unit === myUnit);
    const people = unitPeople[myUnit] || [];
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
            >
              {people.map(personLeaf)}
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
            const people = unitPeople[u] || [];
            return (
              <OrgNode
                key={u}
                title={u}
                emblem={u}
                emblemImage={unitLogos?.[u]}
                sub={officer ? `${officer.rank} ${officer.name}` : "טרם מונה קצין"}
              >
                {people.map(personLeaf)}
              </OrgNode>
            );
          }),
          brigadeStaff.length > 0 && (
            <OrgNode key="staff" title="צוות חטיבתי" sub="ישירות תחת מפקדת החטיבה">
              {brigadeStaff.map(personLeaf)}
            </OrgNode>
          ),
        ].filter(Boolean)}
      </OrgNode>
    </div>
  );
}

/* ================================================================== */
/* Root                                                                */
/* ================================================================== */

export default function PermissionsDashboard({ role, brigadeId, brigadeName, unitLogos }) {
  const [units, setUnits] = useState(null);
  const [unitPeople, setUnitPeople] = useState({});
  const [unitOfficers, setUnitOfficers] = useState([]);
  const [brigadeStaff, setBrigadeStaff] = useState([]);
  const [view, setView] = useState("list");

  useEffect(() => {
    let cancelled = false;
    setUnits(null);
    Promise.all([fetchBrigadeUnits(brigadeId), fetchBrigadeRoster(brigadeId)]).then(([u, roster]) => {
      if (cancelled) return;
      setUnits(u);
      setUnitOfficers(roster.unitOfficers);
      setBrigadeStaff(roster.brigadeStaff);
      setUnitPeople(roster.unitPeople);
    });
    return () => { cancelled = true; };
  }, [brigadeId]);

  const isBrigadeScope = role === STRUCTURAL_ROLES.BRIGADE_OFFICER || role === STRUCTURAL_ROLES.SYSTEM_ADMIN;
  const myUnit = units?.[0];

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
      </div>

      <div key={view} className="scope-body">
        {view === "tree" ? (
          <>
            <div className="view-head">
              <h1>מבנה ארגוני</h1>
              <p>
                {isBrigadeScope
                  ? "תרשים החטיבה המלא — כלל היחידות ואנשי הצוות."
                  : "התצוגה שלך: שכבה אחת מעליך (החטיבה) ומה שתחתיך (אנשי היחידה)."}
              </p>
            </div>
            <OrgTree
              role={role} brigadeName={brigadeName} myUnit={myUnit} units={units}
              unitOfficers={unitOfficers} brigadeStaff={brigadeStaff} unitPeople={unitPeople} unitLogos={unitLogos}
            />
          </>
        ) : isBrigadeScope ? (
          <BrigadePermissionsView
            units={units}
            unitOfficers={unitOfficers} setUnitOfficers={setUnitOfficers}
            brigadeStaff={brigadeStaff} setBrigadeStaff={setBrigadeStaff}
            unitPeople={unitPeople} setUnitPeople={setUnitPeople} unitLogos={unitLogos}
          />
        ) : (
          <UnitPermissionsView unit={myUnit} unitPeople={unitPeople} setUnitPeople={setUnitPeople} unitLogos={unitLogos} />
        )}
      </div>
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
  display:grid; grid-template-columns:110px 100px 1fr 1fr; gap:10px; align-items:center;
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
.org-tree{ overflow-x:auto; padding-bottom:8px; }
.org-node{ display:inline-flex; flex-direction:column; align-items:center; }
.org-node-card{
  position:relative; display:flex; align-items:center; gap:10px; background:var(--panel); border:1px solid var(--line);
  border-radius:6px; padding:10px 16px; white-space:nowrap; box-shadow:var(--shadow-sm); z-index:1;
}
.org-node-you .org-node-card{ border-color:var(--accent); background:var(--panel-raised); }
.org-node-title{ font-family:var(--font-sans); font-weight:700; font-size:14px; }
.org-node-sub{ font-size:11.5px; color:var(--text-dim); margin-top:1px; }
.org-node-you-tag{ font-family:var(--font-mono); font-size:9.5px; color:var(--accent); border:1px solid var(--accent);
  border-radius:3px; padding:1px 6px; margin-right:4px; text-transform:uppercase; }
.org-node-children{
  display:flex; gap:16px; margin-top:-1px; padding:20px 20px 16px; flex-wrap:wrap; justify-content:center;
  background:var(--panel-raised); border:1px solid var(--line); border-top:none;
  border-radius:0 0 8px 8px;
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
