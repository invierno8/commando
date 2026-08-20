import React from "react";
import { ChevronLeft, Network } from "lucide-react";
import { STRUCTURAL_ROLES, ROLE_LABELS, ROLE_ORDER } from "../roles.js";
import { BRIGADE_STATUS } from "../api-client/brigadesData.js";

/* ================================================================== */
/* בורר תפקיד/חטיבה/זהות של סביבת הפיתוח — הועבר החוצה מ-App.jsx כמעט     */
/* ללא שינוי (ראו FORCLAUDE.md/plan). מוצג רק כשמשתמש-פיתוח מאומת —       */
/* DevAuthGate.jsx הוא מי שמחליט מתי לרנדר את הרכיב הזה בכלל.             */
/* ================================================================== */
export default function DevFab({
  open, setOpen,
  role, chooseRole,
  brigades, brigadeId, chooseBrigade,
  persona, memberIdentityMode, setMemberIdentityMode, becomeRandomMember,
  brigadeUnits, devTeams, ledTeam, becomeTeamLead,
  teamMemberOptions, userId, setUserId, becomeTeamMember,
  officerUnit, setOfficerUnit,
  isTeamLead,
}) {
  return (
    <div className="dev-fab-wrap" tabIndex={-1} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false); }}>
      {open && (
        <div className="dev-fab-panel dev-only">
          <span className="dev-only-tag">DEV — סימולציית תפקיד וחטיבה</span>
          <div className="pill-tabs">
            {ROLE_ORDER.map((r) => (
              <button
                key={r}
                className={"pill-tab" + (role === r ? " active" : "")}
                style={{ padding: "5px 11px", fontSize: 12 }}
                onClick={() => chooseRole(r)}
              >
                {ROLE_LABELS[r]}
              </button>
            ))}
          </div>
          <div className="pill-tabs" style={{ marginTop: 6 }}>
            {(brigades || []).map((b) => (
              <button
                key={b.id}
                className={"pill-tab" + (brigadeId === b.id ? " active" : "")}
                style={{ padding: "5px 11px", fontSize: 12 }}
                onClick={() => chooseBrigade(b.id)}
                title={b.status === BRIGADE_STATUS.PENDING ? "חטיבה ממתינה להקמה — ללא נתונים עדיין" : undefined}
              >
                {b.name}{b.status === BRIGADE_STATUS.PENDING ? " (ממתינה)" : ""}
              </button>
            ))}
          </div>
          {role === STRUCTURAL_ROLES.MEMBER && (
            <div className="env-strip-member-block">
              <span className="env-strip-persona">
                מחובר כ: {persona.rank} {persona.name} · {persona.unit}
              </span>
              <div className="pill-tabs member-identity-tabs">
                <button type="button" className={"pill-tab" + (memberIdentityMode === "random" ? " active" : "")} onClick={() => becomeRandomMember()}>חייל רגיל</button>
                <button type="button" className={"pill-tab" + (memberIdentityMode === "lead" ? " active" : "")} onClick={() => setMemberIdentityMode("lead")}>ראש צוות</button>
                <button type="button" className={"pill-tab" + (memberIdentityMode === "teamMember" ? " active" : "")} onClick={() => setMemberIdentityMode("teamMember")}>חבר צוות</button>
              </div>
              {memberIdentityMode === "random" && brigadeUnits.length > 1 && (
                <label className="env-strip-identity officer-unit-pick">
                  <span>יחידה לחייל רגיל</span>
                  <select value={persona.unit} onChange={(e) => becomeRandomMember(e.target.value)}>
                    {brigadeUnits.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </label>
              )}
              {memberIdentityMode === "lead" && (
                devTeams.length === 0 ? (
                  <span className="env-strip-hint">אין עדיין צוותים בחטיבה זו — ניתן ליצור דרך ניהול הרשאות ← עץ ארגוני.</span>
                ) : (
                  <label className="env-strip-identity officer-unit-pick">
                    <span>בחירת צוות להתחזות כראש שלו</span>
                    <select value={ledTeam?.id || ""} onChange={(e) => { const t = devTeams.find((tt) => tt.id === e.target.value); if (t) becomeTeamLead(t); }}>
                      <option value="">בחר/י צוות...</option>
                      {devTeams.map((t) => <option key={t.id} value={t.id}>{t.name} — {t.unit}</option>)}
                    </select>
                  </label>
                )
              )}
              {memberIdentityMode === "teamMember" && (
                teamMemberOptions.length === 0 ? (
                  <span className="env-strip-hint">אין עדיין חברי תת-צוות בחטיבה זו.</span>
                ) : (
                  <label className="env-strip-identity officer-unit-pick">
                    <span>בחירת חבר צוות להתחזות אליו</span>
                    <select value={userId} onChange={(e) => { const entry = teamMemberOptions.find((o) => o.identifier === e.target.value); if (entry) becomeTeamMember(entry); }}>
                      <option value="">בחר/י חבר צוות...</option>
                      {teamMemberOptions.map((o, i) => <option key={o.identifier + i} value={o.identifier}>{o.identifier} — {o.teamName}/{o.subteamName} ({o.unit})</option>)}
                    </select>
                  </label>
                )
              )}
            </div>
          )}
          {role === STRUCTURAL_ROLES.UNIT_OFFICER && brigadeUnits.length > 1 && (
            <label className="env-strip-identity officer-unit-pick">
              <span>יחידה — לאיזו יחידה קצין האמל״ח שייך (חברי יחידה מדומים מקבלים יחידה אקראית, לכן זה לא תמיד מסתנכרן לבד)</span>
              <select value={officerUnit || brigadeUnits[0]} onChange={(e) => setOfficerUnit(e.target.value)}>
                {brigadeUnits.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </label>
          )}
          <label className="env-strip-identity">
            <span>
              {role === STRUCTURAL_ROLES.MEMBER
                ? "מספר אישי אמיתי (אופציונלי) — דורס את הפרסונה האקראית, כדי לבדוק זיהוי כראש צוות או חסימה"
                : "זיהוי משתמש (מ.א.) — פריסת הדשבורד האישית שלך עוברת איתך בין מכשירים"}
            </span>
            <input
              value={userId}
              onChange={(e) => setUserId(e.target.value.replace(/\D/g, ""))}
              placeholder="לדוגמה: 7134209"
              inputMode="numeric"
            />
          </label>
          {isTeamLead && (
            <span className="env-strip-persona"><Network size={12} style={{ verticalAlign: "-2px" }} /> מזוהה כראש צוות: {ledTeam.name}</span>
          )}
        </div>
      )}
      <button type="button" className="dev-fab" onClick={() => setOpen((v) => !v)} title="בורר תפקיד/חטיבה (DEV)">
        <span className="dev-fab-tag">DEV</span>
        <ChevronLeft size={14} className={"dev-fab-arrow" + (open ? " open" : "")} />
      </button>
    </div>
  );
}
