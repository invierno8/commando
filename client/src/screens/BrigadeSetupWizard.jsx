import React, { useEffect, useState } from "react";
import { Building2, Pencil, X } from "lucide-react";
import UnitEmblem from "../components/UnitEmblem.jsx";
import LogoUpload from "../components/LogoUpload.jsx";
import Loading from "../components/Loading.jsx";
import { STRUCTURAL_ROLES } from "../roles.js";
import { fetchBrigadeUnits, fetchBrigadeRoster, saveBrigadeSetup } from "../api-client/brigadeStore.js";
import { updateBrigade } from "../api-client/brigadesData.js";

/* ================================================================== */
/* LEGO BLOCK 1 — Access-level data model (pure data, zero logic)      */
/* כל שינוי בהרשאות = שינוי כאן בלבד. אין if/else מפוזרים בקומפוננטות.  */
/* תפקידים מבניים (STRUCTURAL_ROLES) חיים ב-roles.js — מקור אמת יחיד,   */
/* משותף גם עם מתג התפקיד ברמת האפליקציה.                              */
/* ================================================================== */

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

/* לוגו חטיבה/יחידה הוא תמיד תמונה אמיתית שהועלתה באשף ההתקנה — לא אימוג׳י   */
/* ולא סמל מתוך רשימה. כל עוד לא הועלה לוגו, זה הפולבק הנייטרלי היחיד.      */
export function BrigadeIcon({ image, size = 22 }) {
  if (image) {
    return (
      <img src={image} alt="" width={size} height={size}
        style={{ width: size, height: size, borderRadius: "30%", objectFit: "cover" }} />
    );
  }
  return <Building2 size={size} />;
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
            <span className="unit-picker-custom-icon"><Pencil size={13} /></span>
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
        <h1>הקמת החטיבה שלך בהאנגר</h1>
        <p>
          החטיבה שלך כבר רשומה במערכת — השלב הזה משלים את הפרטים ברמת החטיבה בלבד:
          תהליך קצר בן ארבעה שלבים: פרטי החטיבה, הגדרת היחידות המשתמשות במערכת,
          ומינוי קצין אמל״ח חטיבתי. בסיום ייווצר מבנה הארגון הבסיסי, ומשם קציני
          האמל״ח יוכלו להוסיף את האנשים שלהם ולהגדיר הרשאות. הקמת חטיבות חדשות
          במערכת עצמה נעשית על ידי מנהלי המערכת, לא כאן.
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
        <Field label="לוגו החטיבה" hint="תמונה אמיתית של סמל החטיבה — תוצג בכל מסכי המערכת">
          <LogoUpload
            value={s.brigade.logo}
            onChange={(logo) => set((p) => ({ ...p, brigade: { ...p.brigade, logo } }))}
            fallback={<Building2 size={22} />}
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
          units: [...p.units, { id: crypto.randomUUID(), name, logo: null, mission: "", officerName: "", officerEmail: "" }],
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
                <div className="unit-row-top">
                  <LogoUpload
                    compact
                    value={u.logo}
                    onChange={(logo) => updateUnit(u.id, { logo })}
                    fallback={<UnitEmblem name={u.name} size={24} showRing={false} />}
                  />
                  <UnitNamePicker value={u.name} onChange={(name) => updateUnit(u.id, { name })} />
                  <button className="unit-remove" onClick={() => removeUnit(u.id)} title="הסרת יחידה"><X size={15} /></button>
                </div>
                <div className="unit-row-bottom">
                  <input
                    className="unit-mission-input"
                    value={u.mission}
                    onChange={(e) => updateUnit(u.id, { mission: e.target.value })}
                    placeholder="ייעוד / משימת היחידה (אופציונלי)"
                  />
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
              </div>
            ))}
          </div>
          <p className="unit-hint">אפשר להעלות לוגו אמיתי לכל יחידה; ליחידה שעדיין ללא לוגו יוצג תג זמני אוטומטי.</p>

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
              <UnitEmblem name={u.name} size={30} image={u.logo} />
              <div>
                <div className="review-card-title">{u.name}</div>
                {u.mission && <div className="review-card-mission">{u.mission}</div>}
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

export function MissionBar({ brigade }) {
  return (
    <div className="mission-bar">
      <div className="mission-icon"><BrigadeIcon image={brigade.logo} size={24} /></div>
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
              <UnitEmblem name={u.name} size={30} image={u.logo} />
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

export default function BrigadeSetupWizard({ brigadeId, brigades, setBrigades }) {
  const [state, setState] = useState(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setDone(false);
    setState(null);
    const registryBrigade = brigades?.find((b) => b.id === brigadeId);

    Promise.all([fetchBrigadeUnits(brigadeId), fetchBrigadeRoster(brigadeId)]).then(([units, roster]) => {
      if (cancelled) return;
      setState({
        brigade: {
          name: registryBrigade?.name || "",
          logo: registryBrigade?.logo || null,
          mission: registryBrigade?.mission || "",
        },
        // חטיבה שכבר השלימה הקמה מגיעה לכאן עם היחידות והקצינים האמיתיים שלה
        // מהדאטהסט התפעולי — עריכה, לא יצירה מחדש. חטיבה חדשה/ממתינה, שעדיין
        // אין לה יחידות אמיתיות, מקבלת רשימה ריקה — בדיוק כמו קודם.
        units: units.map((name) => {
          const officer = roster.unitOfficers.find((o) => o.unit === name);
          return {
            id: crypto.randomUUID(),
            name,
            // originalName נשמר קבוע גם אם name נערך באשף (שינוי שם יחידה) —
            // saveBrigadeSetup ב-brigadeStore.js משתמש בו כדי להעביר את המרשם/
            // הקצין הקיימים של היחידה יחד עם השם החדש, במקום לאבד אותם.
            originalName: name,
            logo: registryBrigade?.unitLogos?.[name] || null,
            mission: registryBrigade?.unitMissions?.[name] || "",
            officerName: officer?.name || "",
            officerEmail: officer?.personalNumber || "",
          };
        }),
        brigadeOfficerName: registryBrigade?.contactName || "",
        brigadeOfficerEmail: registryBrigade?.contactPersonalNumber || "",
      });
    });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brigadeId]);

  async function finish() {
    if (setBrigades && brigadeId) {
      const unitLogos = {};
      const unitMissions = {};
      state.units.forEach((u) => {
        if (u.logo) unitLogos[u.name] = u.logo;
        if (u.mission) unitMissions[u.name] = u.mission;
      });
      const registryBrigade = brigades?.find((b) => b.id === brigadeId);
      const patch = {
        name: state.brigade.name || registryBrigade?.name,
        logo: state.brigade.logo || registryBrigade?.logo,
        mission: state.brigade.mission || registryBrigade?.mission,
        unitLogos: { ...(registryBrigade?.unitLogos || {}), ...unitLogos },
        unitMissions: { ...(registryBrigade?.unitMissions || {}), ...unitMissions },
        contactName: state.brigadeOfficerName || registryBrigade?.contactName,
        contactPersonalNumber: state.brigadeOfficerEmail || registryBrigade?.contactPersonalNumber,
        units: state.units.length,
      };
      const updated = await updateBrigade(brigadeId, patch);
      setBrigades((prev) => prev.map((b) => (b.id === brigadeId ? updated : b)));
    }
    if (brigadeId) await saveBrigadeSetup(brigadeId, { units: state.units });
    setDone(true);
  }

  if (!state) {
    return (
      <div dir="rtl" className="wizard-view panel-card">
        <style>{CSS}</style>
        <Loading />
      </div>
    );
  }

  return (
    <div dir="rtl" className="wizard-view panel-card">
      <style>{CSS}</style>
      {!done ? (
        <Wizard steps={steps} state={state} setState={setState} onFinish={finish} />
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
@keyframes fadeSlideUp{ from{ opacity:0; transform:translateY(10px); } to{ opacity:1; transform:translateY(0); } }

.wizard-view{
  max-width:760px; margin:0 auto;
  color:var(--text); font-family:var(--font-sans);
  padding:32px 36px;
}
.wizard, .completed{ animation:fadeSlideUp .3s ease; }

.wizard-progress{ display:flex; gap:6px; margin-bottom:30px; }
.wizard-dot{ flex:1; display:flex; flex-direction:column; align-items:center; gap:6px; }
.wizard-dot-mark{ width:100%; height:3px; background:var(--line); border-radius:2px; transition:background .25s ease; }
.wizard-dot.done .wizard-dot-mark{ background:var(--accent); }
.wizard-dot-label{ font-family:var(--font-mono); font-size:11px; color:var(--text-dim); }
.wizard-dot.done .wizard-dot-label{ color:var(--accent); }

.setup-mark{ font-family:var(--font-mono); font-size:12px; color:var(--accent);
  border:1px solid var(--accent); display:inline-block; padding:2px 9px; border-radius:3px; margin-bottom:14px; letter-spacing:.04em; }
.step-welcome h1{ font-family:var(--font-sans); font-weight:700; font-size:26px; margin:0 0 12px; }
.step-welcome p{ color:var(--text-dim); font-size:14px; line-height:1.7; max-width:560px; }

.step h2{ font-family:var(--font-sans); font-weight:700; font-size:20px; margin:0 0 6px; }
.step-sub{ color:var(--text-dim); font-size:14px; margin:0 0 18px; }

.field{ display:flex; flex-direction:column; gap:6px; font-size:13px; color:var(--text-dim); margin-bottom:16px; }
.field input, .field textarea{ background:var(--panel); border:1px solid var(--line); border-radius:5px;
  color:var(--text); padding:10px 12px; font-family:var(--font-sans); font-size:14px; }
.field input:focus, .field textarea:focus{ outline:none; border-color:var(--accent); box-shadow:0 0 0 3px color-mix(in srgb, var(--accent) 18%, transparent); }
.field input:disabled{ opacity:.6; }
.field-hint{ font-size:12px; color:var(--text-dim); opacity:.8; }

.icon-picker{ display:flex; flex-wrap:wrap; gap:6px; }
.icon-opt{ width:34px; height:34px; border-radius:5px; background:var(--panel); border:1px solid var(--line);
  color:var(--text-dim); display:flex; align-items:center; justify-content:center; cursor:pointer; transition:border-color .15s ease, color .15s ease; }
.icon-opt.active{ border-color:var(--accent); background:var(--panel-raised); color:var(--accent); }

.suggest-row{ display:flex; align-items:center; gap:8px; font-size:13px; color:var(--text-dim);
  margin-bottom:16px; flex-wrap:wrap; }
.chip{ background:var(--panel); border:1px solid var(--line); color:var(--accent); border-radius:4px;
  padding:5px 12px; font-size:13px; cursor:pointer; font-family:var(--font-mono);
  transition:border-color .15s ease; }
.chip:hover{ border-color:var(--accent); }

.unit-list{ display:flex; flex-direction:column; gap:10px; margin-bottom:14px; }
.unit-row{ display:flex; flex-direction:column; gap:9px; background:var(--panel); border:1px solid var(--line);
  border-radius:6px; padding:10px 12px; }
.unit-row-top{ display:flex; align-items:center; gap:12px; }
.unit-row-bottom{ display:flex; gap:10px; padding-inline-start:44px; }
.unit-mission-input{ flex:1.3; }
.unit-row-icon{ position:relative; }
.unit-hint{ font-size:12px; color:var(--text-dim); margin:-4px 0 14px; }
.unit-emblem{ display:block; }

.unit-picker{ position:relative; flex:1; min-width:150px; }
.unit-picker-trigger{
  width:100%; display:flex; align-items:center; gap:8px; background:var(--bg);
  border:1px solid var(--line); border-radius:4px; padding:6px 10px; cursor:pointer; color:var(--text);
  font-family:var(--font-sans); font-size:13px; transition:border-color .15s ease;
}
.unit-picker-trigger:hover{ border-color:var(--text-dim); }
.unit-picker-placeholder{ color:var(--text-dim); }
.unit-picker-arrow{ margin-right:auto; color:var(--text-dim); font-size:12px; transition:transform .18s ease; }
.unit-picker-arrow.open{ transform:rotate(180deg); color:var(--accent); }
.unit-picker-menu{
  position:absolute; top:calc(100% + 6px); right:0; left:0; z-index:30;
  background:var(--panel); border:1px solid var(--line); border-radius:6px;
  box-shadow:var(--shadow-md); padding:6px; max-height:260px; overflow-y:auto;
  animation:fadeSlideUp .14s ease;
}
.unit-picker-item{
  width:100%; display:flex; align-items:center; gap:9px; background:transparent; border:none;
  color:var(--text); padding:7px 8px; border-radius:4px; cursor:pointer; font-size:13px; text-align:right;
  font-family:var(--font-sans);
}
.unit-picker-item:hover{ background:var(--panel-raised); }
.unit-picker-item-custom{ border-top:1px solid var(--line); margin-top:4px; padding-top:9px; color:var(--text-dim); }
.unit-picker-custom-icon{ width:22px; text-align:center; }
.unit-row-bottom input{ flex:1; background:var(--bg); border:1px solid var(--line); border-radius:4px;
  color:var(--text); padding:8px 10px; font-size:13px; }
.unit-remove{ background:none; border:1px solid transparent; color:var(--text-dim); cursor:pointer; border-radius:6px; padding:6px; display:flex; transition:color .15s ease, border-color .15s ease; }
.unit-remove:hover{ color:var(--red); border-color:var(--red); }
.btn-add-unit{ background:transparent; border:1px dashed var(--line); color:var(--text-dim); border-radius:5px;
  padding:9px; width:100%; cursor:pointer; font-family:var(--font-sans); font-weight:600; }
.btn-add-unit:hover{ border-color:var(--accent); color:var(--accent); }

.wizard-actions{ display:flex; justify-content:space-between; margin-top:26px; border-top:1px solid var(--line); padding-top:18px; }
.btn-ghost, .btn-primary{ border-radius:5px; padding:10px 22px; font-family:var(--font-sans);
  font-weight:700; font-size:14px; cursor:pointer; transition:filter .15s ease, box-shadow .15s ease; }
.btn-ghost{ background:transparent; border:1px solid var(--line); color:var(--text-dim); }
.btn-ghost:not(:disabled):hover{ color:var(--text); border-color:var(--text-dim); }
.btn-ghost:disabled{ opacity:.3; cursor:not-allowed; }
.btn-primary{ background:var(--accent); border:none; color:var(--accent-ink); }
.btn-primary:not(:disabled):hover{ filter:brightness(1.08); box-shadow:var(--shadow-sm); }
.btn-primary:disabled{ opacity:.35; cursor:not-allowed; }

.review-grid{ display:grid; grid-template-columns:repeat(auto-fill,minmax(180px,1fr)); gap:10px; margin-top:14px; }
.review-card{ background:var(--panel); border:1px solid var(--line); border-radius:6px; padding:12px 14px;
  opacity:0; animation:fadeSlideUp .3s ease forwards; transition:border-color .15s ease; }
.review-card:hover{ border-color:var(--text-dim); }
.review-card-unit{ display:flex; align-items:flex-start; gap:10px; }
.review-card-title{ font-family:var(--font-sans); font-weight:600; font-size:14px; }
.review-card-value{ font-size:13px; color:var(--text-dim); margin-top:4px; }
.review-card-mission{ font-size:12px; color:var(--accent); margin-top:3px; line-height:1.5; }
.review-card-email{ font-size:12px; color:var(--accent); margin-top:2px; font-family:var(--font-mono); }

.completed-badge{ display:inline-block; font-family:var(--font-mono); font-size:12px;
  color:#FFFFFF; background:var(--green); padding:3px 10px; border-radius:3px; margin-bottom:10px; letter-spacing:.04em; }
.completed-body h2{ font-family:var(--font-sans); font-weight:700; font-size:20px; margin:0 0 4px; }

.next-steps{ margin-top:28px; border-top:1px dashed var(--line); padding-top:18px; }
.next-steps-title{ font-family:var(--font-mono); font-size:12px; color:var(--text-dim);
  text-transform:uppercase; letter-spacing:.06em; margin-bottom:10px; }
.next-card{ background:var(--panel); border:1px solid var(--line); border-radius:6px; padding:12px 14px;
  font-size:13px; color:var(--text-dim); line-height:1.7; margin-bottom:8px; }
.next-card b{ color:var(--text); }
`;
