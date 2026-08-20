import React, { useEffect, useState } from "react";
import { Lock, Settings2, Eye, EyeOff } from "lucide-react";
import { devLogin, devLogout, fetchDevMe } from "./devApi.js";
import DevFab from "./DevFab.jsx";
import MockDataToggle from "./MockDataToggle.jsx";
import DevAdminPanel from "./DevAdminPanel.jsx";
import DevOverlay from "./overlay/DevOverlay.jsx";

/* ================================================================== */
/* השער היחיד לכל מצב הפיתוח — לא מחליף את .dev-fab הקיים, רק שומר       */
/* עליו נעול עד שמשתמש-פיתוח מזוהה מתחבר עם שם+סיסמה (ראו plan doc:      */
/* "gated, not replaced"). מבקר ללא התחברות רואה בדיוק את מה שהוא רואה    */
/* היום — MEMBER אקראי, בלי שום כפתור dev גלוי מעבר לנעילה עצמה.          */
/* ================================================================== */
export default function DevAuthGate({ route, devFabProps }) {
  const [checking, setChecking] = useState(true);
  const [devName, setDevName] = useState(null); // null = לא מחובר
  const [loginOpen, setLoginOpen] = useState(false);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [adminOpen, setAdminOpen] = useState(false);
  const [overlayOn, setOverlayOn] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchDevMe().then((d) => { if (!cancelled) { setDevName(d?.name || null); setChecking(false); } });
    return () => { cancelled = true; };
  }, []);

  async function login() {
    setError("");
    try {
      const res = await devLogin(name.trim(), password);
      setDevName(res.name);
      setLoginOpen(false);
      setName(""); setPassword("");
    } catch (e) {
      setError(e.message);
    }
  }
  async function logout() {
    await devLogout();
    setDevName(null);
  }

  if (checking) return null;

  if (!devName) {
    return (
      <div className="dev-fab-wrap" tabIndex={-1} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setLoginOpen(false); }}>
        <style>{CSS}</style>
        {loginOpen && (
          <div className="dev-fab-panel dev-only dev-login-panel">
            <span className="dev-only-tag">DEV — כניסה למצב פיתוח</span>
            <label className="env-strip-identity">
              <span>שם</span>
              <input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            </label>
            <label className="env-strip-identity">
              <span>סיסמה</span>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && login()} />
            </label>
            {error && <div className="dev-login-error">{error}</div>}
            <button type="button" className="dev-login-submit" onClick={login} disabled={!name.trim() || !password.trim()}>
              כניסה
            </button>
          </div>
        )}
        <button type="button" className="dev-fab dev-fab-locked" onClick={() => setLoginOpen((v) => !v)} title="כניסה למצב פיתוח">
          <Lock size={13} />
          <span className="dev-fab-tag">DEV</span>
        </button>
      </div>
    );
  }

  return (
    <>
      <style>{CSS}</style>
      <DevOverlay active={overlayOn} route={route} />
      <div className="dev-fab-toolbar">
        <MockDataToggle />
        <button type="button" className="dev-toolbar-icon-btn" onClick={() => setOverlayOn((v) => !v)} title={overlayOn ? "כיבוי תצפית Dev" : "הפעלת תצפית Dev"}>
          {overlayOn ? <Eye size={13} /> : <EyeOff size={13} />}
        </button>
        <button type="button" className="dev-toolbar-icon-btn" onClick={() => setAdminOpen(true)} title="ניהול (מנהל בלבד)">
          <Settings2 size={13} />
        </button>
        <button type="button" className="dev-toolbar-devname" onClick={logout} title="לחיצה להתנתקות">
          {devName}
        </button>
      </div>
      <DevFab {...devFabProps} />
      {adminOpen && <DevAdminPanel onClose={() => setAdminOpen(false)} />}
    </>
  );
}

const CSS = `
.dev-login-panel{ display:flex; flex-direction:column; gap:8px; }
.dev-login-error{ color:var(--red); font-size:11.5px; }
.dev-login-submit{
  background:var(--dev); color:#fff; border:none; border-radius:8px; padding:7px 0; font-weight:700;
  font-size:12.5px; cursor:pointer; font-family:var(--font-sans);
}
.dev-login-submit:disabled{ opacity:.5; cursor:not-allowed; }
.dev-fab-locked{ opacity:.75; }
.dev-fab-locked:hover{ opacity:1; }

.dev-fab-toolbar{
  position:fixed; bottom:76px; right:20px; z-index:79; display:flex; align-items:center; gap:6px;
}
.dev-toolbar-icon-btn{
  width:30px; height:30px; border-radius:8px; border:1px solid var(--dev); background:var(--panel);
  color:var(--dev); display:flex; align-items:center; justify-content:center; cursor:pointer;
}
.dev-toolbar-icon-btn:hover{ background:color-mix(in srgb, var(--dev) 10%, var(--panel)); }
.dev-toolbar-devname{
  background:var(--panel); border:1px solid var(--dev); color:var(--dev); border-radius:20px;
  padding:6px 12px; font-family:var(--font-mono); font-size:11px; font-weight:700; cursor:pointer;
}

.mock-toggle{
  display:inline-flex; align-items:center; gap:6px; border-radius:20px; padding:6px 12px; border:1px solid var(--dev);
  background:var(--panel); font-family:var(--font-mono); font-size:11px; font-weight:700; cursor:pointer;
}
.mock-toggle-mock{ color:var(--dev); }
.mock-toggle-live{ color:var(--green); border-color:var(--green); }
`;
