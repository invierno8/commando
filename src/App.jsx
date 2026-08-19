import React, { useEffect, useMemo, useState } from "react";
import { Home, Package, ClipboardList, Users, Settings, Bell, ChevronLeft, User, Building2 } from "lucide-react";
import Catalog from "./Catalog.jsx";
import Tickets from "./Tickets.jsx";
import PermissionsDashboard from "./PermissionsDashboard.jsx";
import BrigadeSetupWizard from "./BrigadeSetupWizard.jsx";
import DevDashboard from "./DevDashboard.jsx";
import SystemAdmin from "./SystemAdmin.jsx";
import ThemeToggle from "./ThemeToggle.jsx";
import { THEME_CSS, readStoredTheme, persistTheme } from "./theme.js";
import { STRUCTURAL_ROLES, ROLE_LABELS, ROLE_ORDER } from "./roles.js";
import { randomMemberPersona } from "./opsData.jsx";
import { seedBrigades, BRIGADE_STATUS } from "./brigadesData.js";
import { fetchBrigadeUnits, fetchBrigadeTickets } from "./brigadeStore.js";

const OFFICER_ROLES = [STRUCTURAL_ROLES.UNIT_OFFICER, STRUCTURAL_ROLES.BRIGADE_OFFICER, STRUCTURAL_ROLES.SYSTEM_ADMIN];

const NAV = [
  { key: "dashboard", label: "דשבורד", icon: Home, dev: true, visibleFor: OFFICER_ROLES, render: (role, persona, brigadeId) => <DevDashboard brigadeId={brigadeId} /> },
  { key: "catalog", label: "קטלוג אמל״ח", icon: Package, visibleFor: [STRUCTURAL_ROLES.MEMBER], render: (role, persona, brigadeId) => <Catalog brigadeId={brigadeId} /> },
  { key: "tickets", label: "דרישות וטיקטים", icon: ClipboardList, render: (role, persona, brigadeId) => <Tickets role={role} persona={persona} brigadeId={brigadeId} /> },
  { key: "permissions", label: "ניהול הרשאות", icon: Users, visibleFor: OFFICER_ROLES, render: (role, persona, brigadeId, brigades) => <PermissionsDashboard role={role} brigadeId={brigadeId} brigadeName={brigades.find((b) => b.id === brigadeId)?.name} /> },
  { key: "wizard", label: "אשף התקנה", icon: Settings, visibleFor: OFFICER_ROLES, render: (role, persona, brigadeId) => <BrigadeSetupWizard brigadeId={brigadeId} /> },
  { key: "sysadmin", label: "ניהול מערכת", icon: Building2, visibleFor: [STRUCTURAL_ROLES.SYSTEM_ADMIN], render: (role, persona, brigadeId, brigades, setBrigades) => <SystemAdmin brigades={brigades} setBrigades={setBrigades} /> },
];

export default function App() {
  const [role, setRole] = useState(STRUCTURAL_ROLES.MEMBER);
  const [brigades, setBrigades] = useState(seedBrigades);
  const [brigadeId, setBrigadeId] = useState(seedBrigades[0].id);
  const [persona, setPersona] = useState(randomMemberPersona);
  const [view, setView] = useState("catalog");
  const [theme, setTheme] = useState(readStoredTheme);
  const [now, setNow] = useState(new Date());
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  const currentBrigade = brigades.find((b) => b.id === brigadeId) || brigades[0];

  async function rerollPersona(forBrigadeId) {
    const units = await fetchBrigadeUnits(forBrigadeId);
    setPersona(randomMemberPersona(units));
  }

  function chooseRole(r) {
    setRole(r);
    if (r === STRUCTURAL_ROLES.MEMBER) rerollPersona(brigadeId);
  }

  function chooseBrigade(id) {
    setBrigadeId(id);
    if (role === STRUCTURAL_ROLES.MEMBER) rerollPersona(id);
  }

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    persistTheme(theme);
  }, [theme]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchBrigadeTickets(brigadeId).then((tickets) => {
      if (!cancelled) setPendingCount(tickets.filter((t) => t.status === "pending").length);
    });
    return () => { cancelled = true; };
  }, [brigadeId]);

  const visibleNav = useMemo(() => NAV.filter((n) => !n.visibleFor || n.visibleFor.includes(role)), [role]);

  useEffect(() => {
    if (!visibleNav.some((n) => n.key === view)) setView("tickets");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  const active = visibleNav.find((n) => n.key === view) || visibleNav[0];
  const currentUserName = role === STRUCTURAL_ROLES.MEMBER ? `${persona.rank} ${persona.name}` : "משתמש הדגמה";

  return (
    <div dir="rtl" className="app-shell">
      <style>{THEME_CSS}</style>
      <div className="app-glow" aria-hidden="true" />

      <aside className={"app-sidebar" + (sidebarOpen ? " expanded" : "")}>
        <div className="sidebar-mark">HGR</div>
        <nav className="sidebar-nav">
          {visibleNav.map((n) => {
            const Icon = n.icon;
            return (
              <button
                key={n.key}
                className={"sidebar-btn" + (view === n.key ? " active" : "")}
                title={n.label}
                onClick={() => setView(n.key)}
              >
                <Icon size={19} />
                <span className="sidebar-btn-label">{n.label}</span>
                {n.dev && <span className="sidebar-btn-dev-dot" title="DEV בלבד" />}
              </button>
            );
          })}
        </nav>
        <div className="sidebar-spacer" />
        <button className="sidebar-toggle" onClick={() => setSidebarOpen((o) => !o)} title="הרחבת תפריט">
          <ChevronLeft size={16} />
        </button>
      </aside>

      <div className="app-main-col">
        <div className="app-topbar">
          <div className="app-topbar-title">
            <div>
              <h1>{active?.label}</h1>
              <div className="app-topbar-crumb">HANGAR · {currentBrigade?.name}</div>
            </div>
          </div>

          <div className="app-topbar-right">
            <button className="icon-btn" title="התראות">
              <Bell size={16} />
              {pendingCount > 0 && <span className="icon-btn-dot">{pendingCount}</span>}
            </button>
            <ThemeToggle theme={theme} setTheme={setTheme} />
            <div className="user-chip">
              <div className="user-chip-text">
                <div className="user-chip-name">{currentUserName}</div>
                <div className="user-chip-role">{ROLE_LABELS[role]}</div>
              </div>
              <div className="user-avatar"><User size={17} /></div>
            </div>
          </div>
        </div>

        <div className="env-strip">
          <span>
            <span className="env-strip-tag">DEV</span>{" "}
            סביבת פיתוח / דמו — נתונים מדומים, אינם מחוברים למקור אמת מבצעי
          </span>
          <span className="env-strip-clock">
            עדכון אחרון: {now.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </span>
          <div className="dev-only" style={{ padding: "5px 10px" }}>
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
              {brigades.map((b) => (
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
              <span className="env-strip-persona">
                מחובר כ: {persona.rank} {persona.name} · {persona.unit}
              </span>
            )}
          </div>
        </div>

        <div className="app-body">{active && active.render(role, persona, brigadeId, brigades, setBrigades)}</div>
      </div>
    </div>
  );
}
