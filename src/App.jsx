import React, { useState } from "react";
import TacticalSystem from "./TacticalSystem.jsx";
import BrigadeSetupWizard from "./BrigadeSetupWizard.jsx";
import DevDashboard from "./DevDashboard.jsx";
import PermissionsDashboard from "./PermissionsDashboard.jsx";

export default function App() {
  const [view, setView] = useState("dashboard");

  return (
    <div dir="rtl" style={{ fontFamily: "Inter, sans-serif", minHeight: "100vh", background: "#0c0e0a" }}>
      <div
        style={{
          display: "flex",
          gap: 10,
          padding: "14px 20px",
          borderBottom: "1px solid #2a2f22",
          background: "#12140F",
          flexWrap: "wrap",
        }}
      >
        <button onClick={() => setView("dashboard")} style={btn(view === "dashboard")}>
          דשבורד פיתוח ותשתית
        </button>
        <button onClick={() => setView("permissions")} style={btn(view === "permissions")}>
          ניהול הרשאות
        </button>
        <button onClick={() => setView("wizard")} style={btn(view === "wizard")}>
          אשף התקנת חטיבה
        </button>
        <button onClick={() => setView("system")} style={btn(view === "system")}>
          קטלוג + מערכת טיקטים
        </button>
      </div>

      <div style={{ padding: 24 }}>
        {view === "dashboard" && <DevDashboard />}
        {view === "permissions" && <PermissionsDashboard />}
        {view === "wizard" && <BrigadeSetupWizard />}
        {view === "system" && <TacticalSystem />}
      </div>
    </div>
  );
}

function btn(active) {
  return {
    background: active ? "#C9A227" : "transparent",
    color: active ? "#161A10" : "#9BA28A",
    border: "1px solid #3A4530",
    borderRadius: 6,
    padding: "8px 16px",
    fontWeight: 600,
    cursor: "pointer",
  };
}
