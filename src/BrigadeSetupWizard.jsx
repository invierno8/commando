import React, { useState } from "react";
import UnitEmblem from "./UnitEmblem.jsx";

/* ================================================================== */
/* LEGO BLOCK 1 — Access-level data model (pure data, zero logic)      */
/* כל שינוי בהרשאות = שינוי כאן בלבד. אין if/else מפוזרים בקומפוננטות.  */
/* ================================================================== */

export const STRUCTURAL_ROLES = {
  SYSTEM_ADMIN: "system_admin",           // מטמיע המערכת — לא שייך לחטיבה ספציפית
  BRIGADE_OFFICER: "brigade_officer",     // קצין אמל״ח חטיבה
  UNIT_OFFICER: "unit_officer",           // קצין אמל״ח יחידה
  MEMBER: "member",                       // חייל/משתמש קצה
};

export const CATALOG_ACCESS = {
  READ: "read",       // רואה קטלוג בלבד
  EDITOR: "editor",    // מוסיף מוצרים, עורך רק מה שהוסיף
  MANAGER: "manager",  // עורך את כל הקטלוג
};

export const TICKET_ACCESS = {
  NONE: "none",         // אין פריט תפריט, אין גישה לדרישות
  REQUESTER: "requester",// פותח/עורך/רואה רק דרישות שלו
  MANAGER: "manager",    // רואה/עורך/מארכב דרישות של כולם
};

// תוויות תצוגה — לגו-בלוק נפרד כדי שלא יתערבב עם לוגיקה
export const ACCESS_LABELS = {
  catalog: {
    [CATALOG_ACCESS.READ]: "קריאה בלבד",
    [CATALOG_ACCESS.EDITOR]: "עריכה — פריטים שהוספתי",
    [CATALOG_ACCESS.MANAGER]: "ניהול קטלוג מלא",
  },
  ticket: {
    [TICKET_ACCESS.NONE]: "ללא גישה",
    [TICKET_ACCESS.REQUESTER]: "דורש — דרישות אישיות",
    [TICKET_ACCESS.MANAGER]: "מנהל דרישות — גישה מלאה",
  },
};

/* ================================================================== */
/* LEGO BLOCK 2 — Wizard engine (גנרי, לא יודע כלום על חטיבות)         */
/* הוספת שלב חדש = אובייקט חדש במערך STEPS. המנוע לא משתנה.            */
/* ================================================================== */

function Wizard({ steps, state, setState, onFinish }) {
  const [i, setI] = useState(0);
  const step = steps[i];
  const isLast = i === steps.length - 1;
  const canProceed = step.canProceed ? step.canProceed(state) : true;

  return (
    <div className="wizard">
      <div className="wizard-progress">
        {steps.map((s, idx) => (
          <div key={s.key} className={"wizard-dot" + (idx <= i ? " done" : "")}>
            <span className="wizard-dot-mark" />
            <span className="wizard-dot-label">{s.short}</span>
          </div>
        ))}
      </div>

      <div className="wizard-body">{step.render(state, setState)}</div>

      <div className="wizard-actions">
        <button className="btn-ghost" disabled={i === 0} onClick={() => setI((n) => n - 1)}>
          חזרה
        </button>
        {!isLast ? (
          <button className="btn-primary" disabled={!canProceed} onClick={() => setI((n) => n + 1)}>
            המשך
          </button>
        ) : (
          <button className="btn-primary" disabled={!canProceed} onClick={onFinish}>
            סיום התקנה
          </button>
        )}
      </div>
    </div>
  );
}

/* ================================================================== */
/* LEGO BLOCK 3 — Small reusable field components                      */
/* ================================================================== */

function Field({ label, hint, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

const ICON_OPTIONS = ["🛡️", "⚔️", "🦅", "🐆", "🐺", "🏔️", "⭐", "🔱", "🎯", "🧭"];

function IconPicker({ value, onChange }) {
  return (
    <div className="icon-picker">
      {ICON_OPTIONS.map((ic) => (
        <button
          key={ic}
          type="button"
          className={"icon-opt" + (value === ic ? " active" : "")}
          onClick={() => onChange(ic)}
        >
          {ic}
        </button>
      ))}
    </div>
  );
}

/* ================================================================== */
/* Step content — כל שלב הוא בלוק עצמאי, ניתן להזזה/הסרה/הוספה          */
/* ================================================================== */

const PILOT_SUGGESTIONS = ["מגלן", "דובדבן", "אגוז"];
const UNIT_PRESETS = ["מגלן", "דובדבן", "אגוז", "יחידת מטה", "סיירת גולני", "סיירת גבעתי", "שייטת 13"];

function UnitNamePicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [customMode, setCustomMode] = useState(value && !UNIT_PRESETS.includes(value));

  function selectPreset(name) {
    onChange(name);
    setCustomMode(false);
    setOpen(false);
  }

  return (
    <div
      className="unit-picker"
      tabIndex={-1}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
      }}
    >
      {customMode ? (
        <input
          autoFocus
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="שם היחידה"
        />
      ) : (
        <button type="button" className="unit-picker-trigger" onClick={() => setOpen((o) => !o)}>
          <UnitEmblem name={value || "?"} size={24} showRing={false} />
          <span className={value ? "" : "unit-picker-placeholder"}>{value || "בחר יחידה"}</span>
          <span className={"unit-picker-arrow" + (open ? " open" : "")}>▾</span>
        </button>
      )}

      {open && (
        <div className="unit-picker-menu">
          {UNIT_PRESETS.map((n) => (
            <button type="button" key={n} className="unit-picker-item" onClick={() => selectPreset(n)}>
              <UnitEmblem name={n} size={22} showRing={false} />
              <span>{n}</span>
            </button>
          ))}
          <button
            type="button"
            className="unit-picker-item unit-picker-item-custom"
            onClick={() => { setCustomMode(true); setOpen(false); }}
          >
            <span className="unit-picker-custom-icon">✎</span>
            <span>הזנה ידנית — שם אחר</span>
          </button>
        </div>
      )}
    </div>
  );
}

const steps = [
  {
    key: "welcome",
    short: "פתיחה",
    render: () => (
      <div className="step-welcome">
        <div className="setup-mark">SETUP</div>
        <h1>הטמעת מערכת אמל״ח־נט בחטיבה</h1>
        <p>
          תהליך קצר בן ארבעה שלבים: פרטי החטיבה, הגדרת היחידות המשתמשות במערכת,
          ומינוי קצין אמל״ח חטיבתי. בסיום ייווצר מבנה הארגון הבסיסי, ומשם קציני
          האמל״ח יוכלו להוסיף את האנשים שלהם ולהגדיר הרשאות.
        </p>
      </div>
    ),
  },

  {
    key: "brigade",
    short: "חטיבה",
    canProceed: (s) => s.brigade.name.trim().length > 0,
    render: (s, set) => (
      <div className="step">
        <h2>פרטי החטיבה</h2>
        <Field label="שם החטיבה">
          <input
            value={s.brigade.name}
            onChange={(e) => set((p) => ({ ...p, brigade: { ...p.brigade, name: e.target.value } }))}
            placeholder="לדוגמה: חטיבת הקומנדו"
          />
        </Field>
        <Field label="לוגו / סמל" hint="בחירה זמנית מתוך סמלייה — בפרודקשן: העלאת קובץ לוגו">
          <IconPicker
            value={s.brigade.icon}
            onChange={(icon) => set((p) => ({ ...p, brigade: { ...p.brigade, icon } }))}
          />
        </Field>
        <Field label="ייעוד / משימת החטיבה" hint="יופיע קבוע בראש המערכת עבור כלל המשתמשים">
          <textarea
            rows={3}
            value={s.brigade.mission}
            onChange={(e) => set((p) => ({ ...p, brigade: { ...p.brigade, mission: e.target.value } }))}
            placeholder="נוסח קצר של ייעוד החטיבה"
          />
        </Field>
      </div>
    ),
  },

  {
    key: "units",
    short: "יחידות",
    canProceed: (s) => s.units.length > 0 && s.units.every((u) => u.name.trim()),
    render: (s, set) => {
      const addUnit = (name = "") =>
        set((p) => ({
          ...p,
          units: [...p.units, { id: crypto.randomUUID(), name, icon: "🛡️", officerName: "", officerEmail: "" }],
        }));
      const updateUnit = (id, patch) =>
        set((p) => ({ ...p, units: p.units.map((u) => (u.id === id ? { ...u, ...patch } : u)) }));
      const removeUnit = (id) =>
        set((p) => ({ ...p, units: p.units.filter((u) => u.id !== id) }));

      return (
        <div className="step">
          <h2>יחידות המשתמשות במערכת</h2>
          <p className="step-sub">כל יחידה תקבל אמל״חיה עצמאית וקצין אמל״ח משלה.</p>

          {s.units.length === 0 && (
            <div className="suggest-row">
              <span>הצעה מהירה לפיילוט:</span>
              {PILOT_SUGGESTIONS.map((n) => (
                <button key={n} className="chip" onClick={() => addUnit(n)}>
                  + {n}
                </button>
              ))}
            </div>
          )}

          <div className="unit-list">
            {s.units.map((u) => (
              <div className="unit-row" key={u.id}>
                <div className="unit-row-fields">
                  <UnitNamePicker value={u.name} onChange={(name) => updateUnit(u.id, { name })} />
                  <input
                    value={u.officerName}
                    onChange={(e) => updateUnit(u.id, { officerName: e.target.value })}
                    placeholder="שם קצין אמל״ח היחידה"
                  />
                  <input
                    value={u.officerEmail}
                    onChange={(e) => updateUnit(u.id, { officerEmail: e.target.value.replace(/\D/g, "") })}
                    placeholder="מספר אישי — יזוהה מול OpenID בכניסה הראשונה"
                    inputMode="numeric"
                  />
                </div>
                <button className="unit-remove" onClick={() => removeUnit(u.id)}>✕</button>
              </div>
            ))}
          </div>
          <p className="unit-hint">התג לצד שם היחידה נוצר אוטומטית מהשם — אין צורך להעלות לוגו.</p>

          <button className="btn-add-unit" onClick={() => addUnit("")}>+ הוספת יחידה</button>
        </div>
      );
    },
  },

  {
    key: "brigadeOfficer",
    short: "קצין חטיבה",
    canProceed: (s) => s.brigadeOfficerName.trim().length > 0 && s.brigadeOfficerEmail.trim().length > 0,
    render: (s, set) => (
      <div className="step">
        <h2>קצין אמל״ח חטיבתי</h2>
        <p className="step-sub">
          המשתמש הזה יקבל דשבורד ניהול חטיבתי: תיעדוף וסטטוס לדרישות שאושרו
          ביחידות, וניהול הרשאות לקציני היחידות.
        </p>
        <Field label="שם קצין אמל״ח החטיבה">
          <input
            value={s.brigadeOfficerName}
            onChange={(e) => set((p) => ({ ...p, brigadeOfficerName: e.target.value }))}
            placeholder="שם מלא"
          />
        </Field>
        <Field label="מספר אישי" hint="בכניסה הראשונה למערכת, ה-OpenID יזוהה מול המספר האישי הזה וישויך אוטומטית לתפקיד">
          <input
            value={s.brigadeOfficerEmail}
            onChange={(e) => set((p) => ({ ...p, brigadeOfficerEmail: e.target.value.replace(/\D/g, "") }))}
            placeholder="1234567"
            inputMode="numeric"
          />
        </Field>
        <Field label="הרשאה מבנית" hint="נקבעת אוטומטית בהתאם לתפקיד">
          <input disabled value={ACCESS_LABELS_ROLE(STRUCTURAL_ROLES.BRIGADE_OFFICER)} />
        </Field>
      </div>
    ),
  },

  {
    key: "review",
    short: "סיכום",
    render: (s) => (
      <div className="step">
        <h2>סיכום ואישור</h2>
        <p className="step-sub">כך ייראה סרגל החטיבה הקבוע לאחר ההתקנה:</p>
        <MissionBar brigade={s.brigade} />

        <div className="review-grid">
          <div className="review-card">
            <div className="review-card-title">קצין אמל״ח חטיבה</div>
            <div className="review-card-value">{s.brigadeOfficerName || "—"}</div>
            <div className="review-card-email">{s.brigadeOfficerEmail || ""}</div>
          </div>
          {s.units.map((u) => (
            <div className="review-card review-card-unit" key={u.id}>
              <UnitEmblem name={u.name} size={30} />
              <div>
                <div className="review-card-title">{u.name}</div>
                <div className="review-card-value">
                  קצין אמל״ח: {u.officerName || "טרם הוגדר"}
                </div>
                {u.officerEmail && <div className="review-card-email">{u.officerEmail}</div>}
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
];

function ACCESS_LABELS_ROLE(role) {
  return {
    [STRUCTURAL_ROLES.SYSTEM_ADMIN]: "מנהל מערכת",
    [STRUCTURAL_ROLES.BRIGADE_OFFICER]: "קצין אמל״ח חטיבה",
    [STRUCTURAL_ROLES.UNIT_OFFICER]: "קצין אמל״ח יחידה",
    [STRUCTURAL_ROLES.MEMBER]: "משתמש",
  }[role];
}

/* ================================================================== */
/* Persistent mission bar — לגו-בלוק בפני עצמו, ישמש בכל מסכי המערכת   */
/* ================================================================== */

function MissionBar({ brigade }) {
  return (
    <div className="mission-bar">
      <div className="mission-icon">{brigade.icon}</div>
      <div className="mission-text">
        <div className="mission-name">{brigade.name || "שם החטיבה"}</div>
        <div className="mission-quote">{brigade.mission || "ייעוד החטיבה יופיע כאן"}</div>
      </div>
    </div>
  );
}

/* ================================================================== */
/* Post-setup placeholder shell — מראה לאן זה הולך בהמשך                */
/* ================================================================== */

function CompletedShell({ state }) {
  return (
    <div className="completed">
      <MissionBar brigade={state.brigade} />
      <div className="completed-body">
        <div className="completed-badge">ההתקנה הושלמה</div>
        <h2>מבנה הארגון נוצר</h2>
        <div className="review-grid">
          <div className="review-card">
            <div className="review-card-title">קצין אמל״ח חטיבה</div>
            <div className="review-card-value">{state.brigadeOfficerName}</div>
            <div className="review-card-email">{state.brigadeOfficerEmail}</div>
          </div>
          {state.units.map((u) => (
            <div className="review-card review-card-unit" key={u.id}>
              <UnitEmblem name={u.name} size={30} />
              <div>
                <div className="review-card-title">{u.name}</div>
                <div className="review-card-value">קצין אמל״ח: {u.officerName}</div>
                {u.officerEmail && <div className="review-card-email">{u.officerEmail}</div>}
              </div>
            </div>
          ))}
        </div>

        <div className="next-steps">
          <div className="next-steps-title">בשלבים הבאים ייבנו:</div>
          <div className="next-card">
            <b>ניהול הרשאות</b> — קציני האמל״ח יוסיפו את אנשי היחידה שלהם ויקבעו רמת
            גישה לקטלוג ({ACCESS_LABELS.catalog.read} / {ACCESS_LABELS.catalog.editor} / {ACCESS_LABELS.catalog.manager})
            ולדרישות ({ACCESS_LABELS.ticket.none} / {ACCESS_LABELS.ticket.requester} / {ACCESS_LABELS.ticket.manager}).
          </div>
          <div className="next-card">
            <b>דשבורד פיתוח / תשתית</b> — מנהל המערכת והמפתחים יראו שימוש, כמות
            דרישות לפי סטטוס (פתוחות / אושרו / סורבו), ומדדי בריאות מערכת.
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================================================================== */
/* Root                                                                */
/* ================================================================== */

export default function BrigadeSetupWizard() {
  const [state, setState] = useState({
    brigade: { name: "", icon: "🛡️", mission: "" },
    units: [],
    brigadeOfficerName: "",
    brigadeOfficerEmail: "",
  });
  const [done, setDone] = useState(false);

  return (
    <div dir="rtl" className="app">
      <style>{CSS}</style>
      {!done ? (
        <Wizard steps={steps} state={state} setState={setState} onFinish={() => setDone(true)} />
      ) : (
        <CompletedShell state={state} />
      )}
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
  --text:#E9E6D8; --text-dim:#9BA28A; --amber:#C9A227; --green:#5C8A3A;
}
@keyframes fadeSlideUp{ from{ opacity:0; transform:translateY(14px); } to{ opacity:1; transform:translateY(0); } }
@keyframes ledPulse{ 0%,100%{ box-shadow:0 0 4px 1px var(--amber); } 50%{ box-shadow:0 0 10px 3px var(--amber); } }
@keyframes bgDrift{ 0%{ background-position:0 0, 0 0; } 100%{ background-position:120px 120px, -90px 60px; } }

.app{
  position:relative; overflow:hidden;
  background:var(--bg); color:var(--text); font-family:'Inter',sans-serif;
  border-radius:8px; border:1px solid var(--line); padding:34px; min-height:560px;
}
.app::before{
  content:""; position:absolute; inset:0; z-index:0; pointer-events:none;
  background-image:
    linear-gradient(rgba(201,162,39,.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(201,162,39,.05) 1px, transparent 1px);
  background-size:42px 42px, 42px 42px;
  animation:bgDrift 26s linear infinite;
}
.wizard, .completed{ position:relative; z-index:1; animation:fadeSlideUp .35s ease; }

.wizard-progress{ display:flex; gap:6px; margin-bottom:30px; }
.wizard-dot{ flex:1; display:flex; flex-direction:column; align-items:center; gap:6px; }
.wizard-dot-mark{ width:100%; height:3px; background:var(--line); border-radius:2px; transition:background .3s ease, box-shadow .3s ease; }
.wizard-dot.done .wizard-dot-mark{ background:var(--amber); box-shadow:0 0 6px rgba(201,162,39,.5); }
.wizard-dot-label{ font-family:'IBM Plex Mono',monospace; font-size:10px; color:var(--text-dim); }
.wizard-dot.done .wizard-dot-label{ color:var(--amber); }

.setup-mark{ font-family:'IBM Plex Mono',monospace; font-size:11px; color:var(--amber);
  border:1px solid var(--amber); display:inline-block; padding:2px 9px; border-radius:4px; margin-bottom:14px; }
.step-welcome h1{ font-family:'Rajdhani',sans-serif; font-size:28px; margin:0 0 12px; }
.step-welcome p{ color:var(--text-dim); font-size:14px; line-height:1.7; max-width:560px; }

.step h2{ font-family:'Rajdhani',sans-serif; font-size:22px; margin:0 0 6px; }
.step-sub{ color:var(--text-dim); font-size:13px; margin:0 0 18px; }

.field{ display:flex; flex-direction:column; gap:6px; font-size:12px; color:var(--text-dim); margin-bottom:16px; }
.field input, .field textarea{ background:var(--panel); border:1px solid var(--line); border-radius:6px;
  color:var(--text); padding:10px 12px; font-family:'Inter',sans-serif; font-size:13px; }
.field input:focus, .field textarea:focus{ outline:1px solid var(--amber); }
.field input:disabled{ opacity:.6; }
.field-hint{ font-size:11px; color:var(--text-dim); opacity:.8; }

.icon-picker{ display:flex; flex-wrap:wrap; gap:6px; }
.icon-opt{ width:34px; height:34px; border-radius:6px; background:var(--panel); border:1px solid var(--line);
  font-size:16px; cursor:pointer; transition:border-color .18s ease, transform .15s ease, box-shadow .2s ease; }
.icon-opt:hover{ transform:translateY(-2px); }
.icon-opt.active{ border-color:var(--amber); background:var(--panel-raised); box-shadow:0 0 10px rgba(201,162,39,.35); }

.suggest-row{ display:flex; align-items:center; gap:8px; font-size:12px; color:var(--text-dim);
  margin-bottom:16px; flex-wrap:wrap; }
.chip{ background:var(--panel); border:1px solid var(--line); color:var(--amber); border-radius:20px;
  padding:5px 12px; font-size:12px; cursor:pointer; font-family:'IBM Plex Mono',monospace;
  transition:border-color .18s ease, box-shadow .2s ease, transform .15s ease; }
.chip:hover{ border-color:var(--amber); box-shadow:0 0 10px rgba(201,162,39,.3); transform:translateY(-1px); }

.unit-list{ display:flex; flex-direction:column; gap:10px; margin-bottom:14px; }
.unit-row{ display:flex; align-items:center; gap:12px; background:var(--panel); border:1px solid var(--line);
  border-radius:7px; padding:10px 12px; }
.unit-row-icon{ position:relative; }
.unit-hint{ font-size:11px; color:var(--text-dim); margin:-4px 0 14px; }
.unit-emblem{ display:block; transition:transform .2s ease, filter .2s ease; }
.unit-emblem-ring:hover{ transform:scale(1.08); filter:drop-shadow(0 0 6px rgba(201,162,39,.4)); }

.unit-picker{ position:relative; flex:1; min-width:150px; }
.unit-picker-trigger{
  width:100%; display:flex; align-items:center; gap:8px; background:var(--bg);
  border:1px solid var(--line); border-radius:5px; padding:6px 10px; cursor:pointer; color:var(--text);
  font-family:'Inter',sans-serif; font-size:12px; transition:border-color .18s ease;
}
.unit-picker-trigger:hover{ border-color:#4b5640; }
.unit-picker-placeholder{ color:var(--text-dim); }
.unit-picker-arrow{ margin-right:auto; color:var(--text-dim); font-size:11px; transition:transform .18s ease; }
.unit-picker-arrow.open{ transform:rotate(180deg); color:var(--amber); }
.unit-picker-menu{
  position:absolute; top:calc(100% + 6px); right:0; left:0; z-index:30;
  background:var(--panel-raised); border:1px solid var(--line); border-radius:7px;
  box-shadow:0 12px 28px rgba(0,0,0,.45); padding:6px; max-height:260px; overflow-y:auto;
  animation:fadeSlideUp .16s ease;
}
.unit-picker-item{
  width:100%; display:flex; align-items:center; gap:9px; background:transparent; border:none;
  color:var(--text); padding:7px 8px; border-radius:5px; cursor:pointer; font-size:12px; text-align:right;
}
.unit-picker-item:hover{ background:rgba(255,255,255,.05); }
.unit-picker-item-custom{ border-top:1px solid var(--line); margin-top:4px; padding-top:9px; color:var(--text-dim); }
.unit-picker-custom-icon{ width:22px; text-align:center; }
.unit-row-fields{ flex:1; display:flex; gap:10px; }
.unit-row-fields input{ flex:1; background:var(--bg); border:1px solid var(--line); border-radius:5px;
  color:var(--text); padding:8px 10px; font-size:12px; }
.unit-remove{ background:none; border:none; color:var(--text-dim); cursor:pointer; font-size:14px; }
.btn-add-unit{ background:transparent; border:1px dashed var(--line); color:var(--text-dim); border-radius:6px;
  padding:9px; width:100%; cursor:pointer; font-family:'Rajdhani',sans-serif; font-weight:600; }
.btn-add-unit:hover{ border-color:var(--amber); color:var(--amber); }

.wizard-actions{ display:flex; justify-content:space-between; margin-top:26px; border-top:1px solid var(--line); padding-top:18px; }
.btn-ghost, .btn-primary{ border-radius:6px; padding:10px 22px; font-family:'Rajdhani',sans-serif;
  font-weight:700; font-size:14px; cursor:pointer; transition:filter .18s ease, transform .12s ease, box-shadow .2s ease; }
.btn-ghost{ background:transparent; border:1px solid var(--line); color:var(--text-dim); }
.btn-ghost:not(:disabled):hover{ color:var(--text); border-color:#4b5640; }
.btn-ghost:disabled{ opacity:.3; cursor:not-allowed; }
.btn-primary{ background:var(--amber); border:none; color:#161A10; }
.btn-primary:not(:disabled):hover{ filter:brightness(1.1); box-shadow:0 0 16px rgba(201,162,39,.45); transform:translateY(-1px); }
.btn-primary:not(:disabled):active{ transform:translateY(0) scale(.98); }
.btn-primary:disabled{ opacity:.35; cursor:not-allowed; }

.mission-bar{ display:flex; align-items:center; gap:14px; background:var(--panel); border:1px solid var(--amber);
  border-radius:8px; padding:14px 18px; margin-bottom:22px; animation:fadeSlideUp .35s ease; box-shadow:0 0 18px rgba(201,162,39,.12); }
.mission-icon{ font-size:26px; }
.mission-name{ font-family:'Rajdhani',sans-serif; font-weight:700; font-size:17px; }
.mission-quote{ font-size:12px; color:var(--text-dim); margin-top:2px; }

.review-grid{ display:grid; grid-template-columns:repeat(auto-fill,minmax(180px,1fr)); gap:10px; margin-top:14px; }
.review-card{ background:var(--panel); border:1px solid var(--line); border-radius:7px; padding:12px 14px;
  opacity:0; animation:fadeSlideUp .35s ease forwards; transition:border-color .18s ease, transform .18s ease; }
.review-card:hover{ border-color:#4b5640; transform:translateY(-2px); }
.review-card-unit{ display:flex; align-items:flex-start; gap:10px; }
.review-card-title{ font-family:'Rajdhani',sans-serif; font-weight:600; font-size:14px; }
.review-card-value{ font-size:12px; color:var(--text-dim); margin-top:4px; }
.review-card-email{ font-size:11px; color:var(--amber); margin-top:2px; font-family:'IBM Plex Mono',monospace; }

.completed-badge{ display:inline-block; font-family:'IBM Plex Mono',monospace; font-size:11px;
  color:#0F150D; background:var(--green); padding:3px 10px; border-radius:4px; margin-bottom:10px;
  animation:ledPulse 2s ease-in-out infinite; }
.completed-body h2{ font-family:'Rajdhani',sans-serif; font-size:22px; margin:0 0 4px; }

.next-steps{ margin-top:28px; border-top:1px dashed var(--line); padding-top:18px; }
.next-steps-title{ font-family:'IBM Plex Mono',monospace; font-size:11px; color:var(--text-dim);
  text-transform:uppercase; letter-spacing:.05em; margin-bottom:10px; }
.next-card{ background:var(--panel); border:1px solid var(--line); border-radius:7px; padding:12px 14px;
  font-size:12px; color:var(--text-dim); line-height:1.7; margin-bottom:8px; }
.next-card b{ color:var(--text); }
`;
