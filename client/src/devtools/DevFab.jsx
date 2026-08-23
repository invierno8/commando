import React, { useRef } from "react";
import { ChevronLeft, Network, Users } from "lucide-react";
import { STRUCTURAL_ROLES, ROLE_LABELS, ROLE_ORDER } from "../roles.js";
import { BRIGADE_STATUS } from "../api-client/brigadesData.js";
import { useDraggableFab } from "./useDraggableFab.js";
import { useKeepInViewport } from "./useKeepInViewport.js";
import MockDataToggle from "./MockDataToggle.jsx";

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
  // detached=true (ברירת מחדל, לתאימות אם קורא אחר לא מעביר את הפרופ הזה):
  // בועה+כפתור עצמאיים לגמרי, גרירים בחופשיות (כפי שהיה תמיד). detached=false
  // (הוגדר ב-DevAuthGate.jsx): הכפתור עצמו כבר לא מוצג — הוא הוחלף בכפתור-אייקון
  // בתוך תפריט ה-toolbar של Jynx (ראו TOOLBAR_ITEM_NODES.role שם) — כאן רק
  // הפאנל (אם open) עדיין מוצג, מעוגן ל-dockPos (מיקום התפריט) במקום למיקום-
  // הגרירה העצמאי. גרירה מתוך התפריט "מנתקת" (DevAuthGate.jsx's
  // handleItemDragEnd עובר ל-detached=true); גרירת הבועה המנותקת בחזרה על גבי
  // כל אלמנט [data-jynx-dock] (התפריט הפתוח או הבועה המכווצת) קוראת ל-
  // onReattach כדי לחבר בחזרה.
  detached = true,
  dockPos,
  onReattach,
}) {
  function handleFabDragEnd(el) {
    if (!onReattach) return;
    const rect = el?.getBoundingClientRect();
    if (!rect) return;
    // elementFromPoint לבד תמיד היה מחזיר את הכפתור הנגרר עצמו (ה-wrap שלו
    // z-index:80, מעל התפריט/הבועה שמתחתיו z-index:79) — צריך את כל הערמה
    // (elementsFromPoint), לדלג על עצמו, ולבדוק את מה שמתחתיו.
    const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
    const wrap = el.closest(".dev-fab-wrap");
    const dock = document.elementsFromPoint(cx, cy).find((n) => !wrap?.contains(n) && n.closest("[data-jynx-dock]"));
    if (dock) onReattach();
  }
  const roleFab = useDraggableFab("jynx-role-fab-pos", undefined, "right", { onDragEnd: handleFabDragEnd });
  const wrapPos = detached ? roleFab.pos : (dockPos || roleFab.pos);
  function onTriggerClick() {
    if (roleFab.consumeWasDragged()) return;
    setOpen((v) => !v);
  }
  // הפאנל הזה עלול להיות הגבוה ביותר בכל ה-chrome של Jynx (רשימת חטיבות +
  // בורר-זהות מלא, בלי גבול), ותמיד נפתח כלפי מעלה מהכפתור — הכי חשוף מכולם
  // לצאת מעל ה-viewport אם הכפתור נגרר קרוב לחלק העליון של המסך. role/
  // memberIdentityMode ב-watch כי הם משנים אילו תת-מקטעים מוצגים ולכן את
  // הגובה בפועל, גם בלי לגעת בכפתור עצמו.
  const rolePanelRef = useRef(null);
  useKeepInViewport(rolePanelRef, open, 8, [role, memberIdentityMode]);
  return (
    <div
      className="dev-fab-wrap jynx-chrome jynx-ui"
      style={{ right: wrapPos.right, bottom: wrapPos.bottom }}
      tabIndex={-1}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false); }}
    >
      {open && (
        <div ref={rolePanelRef} className="dev-fab-panel dev-only">
          <span className="dev-only-tag">JYNX — Role & brigade simulator</span>
          <div className="dev-fab-mock-toggle-row">
            <MockDataToggle />
          </div>
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
                title={b.status === BRIGADE_STATUS.PENDING ? "Brigade pending setup — no data yet" : undefined}
              >
                {b.name}{b.status === BRIGADE_STATUS.PENDING ? " (pending)" : ""}
              </button>
            ))}
          </div>
          {role === STRUCTURAL_ROLES.MEMBER && (
            <div className="env-strip-member-block">
              <span className="env-strip-persona">
                Signed in as: {persona.rank} {persona.name} · {persona.unit}
              </span>
              <div className="pill-tabs member-identity-tabs">
                <button type="button" className={"pill-tab" + (memberIdentityMode === "random" ? " active" : "")} onClick={() => becomeRandomMember()}>Regular member</button>
                <button type="button" className={"pill-tab" + (memberIdentityMode === "lead" ? " active" : "")} onClick={() => setMemberIdentityMode("lead")}>Team lead</button>
                <button type="button" className={"pill-tab" + (memberIdentityMode === "teamMember" ? " active" : "")} onClick={() => setMemberIdentityMode("teamMember")}>Team member</button>
              </div>
              {memberIdentityMode === "random" && brigadeUnits.length > 1 && (
                <label className="env-strip-identity officer-unit-pick">
                  <span>Unit for regular member</span>
                  <select value={persona.unit} onChange={(e) => becomeRandomMember(e.target.value)}>
                    {brigadeUnits.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </label>
              )}
              {memberIdentityMode === "lead" && (
                devTeams.length === 0 ? (
                  <span className="env-strip-hint">No teams yet in this brigade — create one via Permissions → Org tree.</span>
                ) : (
                  <label className="env-strip-identity officer-unit-pick">
                    <span>Pick a team to impersonate as its lead</span>
                    <select value={ledTeam?.id || ""} onChange={(e) => { const t = devTeams.find((tt) => tt.id === e.target.value); if (t) becomeTeamLead(t); }}>
                      <option value="">Select a team...</option>
                      {devTeams.map((t) => <option key={t.id} value={t.id}>{t.name} — {t.unit}</option>)}
                    </select>
                  </label>
                )
              )}
              {memberIdentityMode === "teamMember" && (
                teamMemberOptions.length === 0 ? (
                  <span className="env-strip-hint">No sub-team members yet in this brigade.</span>
                ) : (
                  <label className="env-strip-identity officer-unit-pick">
                    <span>Pick a team member to impersonate</span>
                    <select value={userId} onChange={(e) => { const entry = teamMemberOptions.find((o) => o.identifier === e.target.value); if (entry) becomeTeamMember(entry); }}>
                      <option value="">Select a team member...</option>
                      {teamMemberOptions.map((o, i) => <option key={o.identifier + i} value={o.identifier}>{o.identifier} — {o.teamName}/{o.subteamName} ({o.unit})</option>)}
                    </select>
                  </label>
                )
              )}
            </div>
          )}
          {role === STRUCTURAL_ROLES.UNIT_OFFICER && brigadeUnits.length > 1 && (
            <label className="env-strip-identity officer-unit-pick">
              <span>Unit — which unit this equipment officer belongs to (simulated unit members get a random unit, so this doesn't always sync automatically)</span>
              <select value={officerUnit || brigadeUnits[0]} onChange={(e) => setOfficerUnit(e.target.value)}>
                {brigadeUnits.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </label>
          )}
          <label className="env-strip-identity">
            <span>
              {role === STRUCTURAL_ROLES.MEMBER
                ? "Real personal number (optional) — overrides the random persona, to test recognition as team lead or block"
                : "User ID — your personal dashboard layout follows you across devices"}
            </span>
            <input
              value={userId}
              onChange={(e) => setUserId(e.target.value.replace(/\D/g, ""))}
              placeholder="e.g. 7134209"
              inputMode="numeric"
            />
          </label>
          {isTeamLead && (
            <span className="env-strip-persona"><Network size={12} style={{ verticalAlign: "-2px" }} /> Identified as team lead: {ledTeam.name}</span>
          )}
        </div>
      )}
      {detached && (
        <button type="button" ref={roleFab.sizeRef} className="dev-fab" onClick={onTriggerClick} {...roleFab.dragHandlers} title="Role & brigade picker — drag onto the Jynx menu/bubble to dock it back in">
          <Users size={14} />
          <ChevronLeft size={14} className={"dev-fab-arrow" + (open ? " open" : "")} />
        </button>
      )}
    </div>
  );
}
