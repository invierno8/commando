import React, { useEffect, useRef, useState } from "react";
import { Lock, Settings2, Eye, EyeOff } from "lucide-react";
import { devLogin, devLogout, fetchDevMe, fetchAdminMe } from "./devApi.js";
import DevFab from "./DevFab.jsx";
import MockDataToggle from "./MockDataToggle.jsx";
import DevAdminPanel from "./DevAdminPanel.jsx";
import DevOverlay from "./overlay/DevOverlay.jsx";

const FAB_POS_KEY = "jynx-fab-pos";
const DEFAULT_POS = { right: 20, bottom: 20 };

function readStoredPos() {
  try {
    const raw = JSON.parse(localStorage.getItem(FAB_POS_KEY));
    if (raw && typeof raw.right === "number" && typeof raw.bottom === "number") return raw;
  } catch { /* ignore */ }
  return DEFAULT_POS;
}

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
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [adminOpen, setAdminOpen] = useState(false);
  const [overlayOn, setOverlayOn] = useState(true);
  // ידוע מראש (בלי לפתוח את פאנל הניהול) כדי ש-DevOverlay יוכל לסמן
  // אוטומטית "פעולה" על הערות שהמנהל עצמו כותב, ולהציג סימוני מנהל קבועים
  // על המסך — גם מיד אחרי רענון דף, כל עוד עוגיית המנהל עדיין תקפה.
  const [isAdmin, setIsAdmin] = useState(false);
  // כפתור ה-JYNX הראשי (המצב הנעול) גרירי — כדי שלא יסתיר בטעות תוכן קבוע
  // במסך כלשהו. המיקום נשמר יחסית ל-right/bottom (לא top/left) כדי שיתאים
  // גם ל-RTL, ונשמר ב-localStorage כך שנשאר איפה שהושאר בין רענוני דף.
  const [fabPos, setFabPos] = useState(readStoredPos);
  const dragRef = useRef({ dragging: false, moved: false, startX: 0, startY: 0, startPos: DEFAULT_POS });

  function onFabPointerDown(e) {
    dragRef.current = { dragging: true, moved: false, startX: e.clientX, startY: e.clientY, startPos: fabPos };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }
  function onFabPointerMove(e) {
    const d = dragRef.current;
    if (!d.dragging) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) d.moved = true;
    if (!d.moved) return;
    const next = {
      right: Math.max(4, d.startPos.right - dx),
      bottom: Math.max(4, d.startPos.bottom - dy),
    };
    setFabPos(next);
  }
  function onFabPointerUp() {
    const d = dragRef.current;
    if (!d.dragging) return;
    d.dragging = false;
    if (d.moved) {
      try { localStorage.setItem(FAB_POS_KEY, JSON.stringify(fabPos)); } catch { /* ignore */ }
    }
  }
  // גרירה אמיתית לא אמורה גם לפתוח/לסגור את פאנל ההתחברות — רק קליק "נקי".
  function onFabClick() {
    if (dragRef.current.moved) { dragRef.current.moved = false; return; }
    setLoginOpen((v) => !v);
  }

  useEffect(() => {
    let cancelled = false;
    fetchDevMe().then((d) => { if (!cancelled) { setDevName(d?.name || null); setChecking(false); } });
    fetchAdminMe().then((d) => { if (!cancelled) setIsAdmin(!!d?.authenticated); });
    return () => { cancelled = true; };
  }, []);

  async function login() {
    setError("");
    try {
      const res = await devLogin(password);
      setDevName(res.name);
      if (res.isAdmin) setIsAdmin(true);
      setLoginOpen(false);
      setPassword("");
    } catch (e) {
      setError(e.message);
    }
  }
  async function logout() {
    await devLogout();
    setDevName(null);
    setIsAdmin(false);
  }

  if (checking) return null;

  if (!devName) {
    return (
      <div
        className="dev-fab-wrap jynx-chrome"
        style={{ right: fabPos.right, bottom: fabPos.bottom }}
        tabIndex={-1}
        onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setLoginOpen(false); }}
      >
        <style>{CSS}</style>
        {loginOpen && (
          <div className="dev-fab-panel dev-only dev-login-panel">
            <span className="dev-only-tag">JYNX — כניסה למצב פיתוח</span>
            <label className="env-strip-identity">
              <span>סיסמה</span>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && login()} autoFocus />
            </label>
            {error && <div className="dev-login-error">{error}</div>}
            <button type="button" className="dev-login-submit" onClick={login} disabled={!password.trim()}>
              כניסה
            </button>
          </div>
        )}
        <button
          type="button"
          className="dev-fab dev-fab-locked"
          onClick={onFabClick}
          onPointerDown={onFabPointerDown}
          onPointerMove={onFabPointerMove}
          onPointerUp={onFabPointerUp}
          title="כניסה למצב פיתוח — ניתן לגרור"
        >
          <Lock size={13} />
          <span className="jynx-logo">JYNX</span>
        </button>
      </div>
    );
  }

  return (
    <>
      <style>{CSS}</style>
      <DevOverlay active={overlayOn} route={route} isAdmin={isAdmin} />
      <div className="dev-fab-toolbar jynx-chrome">
        <MockDataToggle />
        <button type="button" className="dev-toolbar-icon-btn" onClick={() => setOverlayOn((v) => !v)} title={overlayOn ? "כיבוי תצפית Dev" : "הפעלת תצפית Dev"}>
          {overlayOn ? <Eye size={13} /> : <EyeOff size={13} />}
        </button>
        <button type="button" className="dev-toolbar-icon-btn" onClick={() => setAdminOpen(true)} title="ניהול (מנהל בלבד)">
          <Settings2 size={13} />
        </button>
        <button type="button" className="dev-toolbar-devname" onClick={logout} title="לחיצה להתנתקות">
          שלום, {devName}
        </button>
      </div>
      <DevFab {...devFabProps} />
      {adminOpen && <DevAdminPanel onClose={() => setAdminOpen(false)} onVerified={() => setIsAdmin(true)} />}
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
