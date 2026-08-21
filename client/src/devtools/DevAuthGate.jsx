import React, { useEffect, useState } from "react";
import { Lock, Settings2, Eye, EyeOff, LogOut, MessageSquare, GripVertical, X, Loader2 } from "lucide-react";
import { devLogin, devLogout, fetchDevMe, fetchAdminMe } from "./devApi.js";
import DevFab from "./DevFab.jsx";
import DevAdminPanel from "./DevAdminPanel.jsx";
import DevOverlay from "./overlay/DevOverlay.jsx";
import CommentsPanel from "./overlay/CommentsPanel.jsx";
import { useDraggableFab } from "./useDraggableFab.js";

/* ================================================================== */
/* השער היחיד לכל מצב הפיתוח — לא מחליף את .dev-fab הקיים, רק שומר       */
/* עליו נעול עד שמשתמש-פיתוח מזוהה מתחבר עם שם+סיסמה (ראו plan doc:      */
/* "gated, not replaced"). מבקר ללא התחברות רואה בדיוק את מה שהוא רואה    */
/* היום — MEMBER אקראי, בלי שום כפתור dev גלוי מעבר לנעילה עצמה.          */
/* ================================================================== */
export default function DevAuthGate({ route, devFabProps }) {
  const [checking, setChecking] = useState(true);
  const [devName, setDevName] = useState(null); // null = לא מחובר
  const [devUserId, setDevUserId] = useState(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [overlayOn, setOverlayOn] = useState(true);
  const [commentsOn, setCommentsOn] = useState(false);
  const [toolbarOpen, setToolbarOpen] = useState(true);
  // ידוע מראש (בלי לפתוח את פאנל הניהול) כדי ש-DevOverlay יוכל לסמן
  // אוטומטית "פעולה" על הערות שהמנהל עצמו כותב, ולהציג סימוני מנהל קבועים
  // על המסך — גם מיד אחרי רענון דף, כל עוד עוגיית המנהל עדיין תקפה.
  const [isAdmin, setIsAdmin] = useState(false);
  // "Jynx commenter" (2026-08-21) — הרשאה נפרדת ופחות-חמורה מ-isAdmin, ראו
  // data/config/dev-users.json / DevAdminUsersScreen.jsx. נטען מ-/dev/me
  // (טרי מהמרשם בכל בקשה, לא מהטוקן) כדי שביטול/הענקה על ידי מנהל ייכנס
  // לתוקף בלי דרישה להתחבר מחדש.
  const [canJynxComment, setCanJynxComment] = useState(false);
  // כל חלק בכרום של Jynx גרירי בנפרד (מיקום/localStorage משלו) — כך שלא
  // יסתיר בטעות תוכן קבוע במסך כלשהו, גם אחרי שמתחברים ומופיע גם הסרגל.
  const lockedFab = useDraggableFab("jynx-fab-pos");
  const toolbarFab = useDraggableFab("jynx-toolbar-pos", { right: 20, bottom: 76 });

  // גרירה אמיתית לא אמורה גם לפתוח/לסגור את פאנל ההתחברות — רק קליק "נקי".
  function onFabClick() {
    if (lockedFab.consumeWasDragged()) return;
    setLoginOpen((v) => !v);
  }
  // גרירה אמיתית של הסרגל לא אמורה גם לקפל/לפתוח אותו — רק קליק "נקי" על
  // כפתור הקיפול או על הבועה המכווצת.
  function toggleToolbarOpen() {
    if (toolbarFab.consumeWasDragged()) return;
    setToolbarOpen((v) => !v);
  }

  useEffect(() => {
    let cancelled = false;
    fetchDevMe().then((d) => { if (!cancelled) { setDevName(d?.name || null); setDevUserId(d?.id || null); setCanJynxComment(!!d?.canJynxComment); setChecking(false); } });
    fetchAdminMe().then((d) => { if (!cancelled) setIsAdmin(!!d?.authenticated); });
    return () => { cancelled = true; };
  }, []);

  async function login() {
    setError("");
    setLoggingIn(true);
    try {
      const res = await devLogin(password);
      setDevName(res.name);
      if (res.isAdmin) setIsAdmin(true);
      setLoginOpen(false);
      setPassword("");
      const me = await fetchDevMe();
      setDevUserId(me?.id || null);
      setCanJynxComment(!!me?.canJynxComment);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoggingIn(false);
    }
  }
  async function logout() {
    await devLogout();
    setDevName(null);
    setDevUserId(null);
    setIsAdmin(false);
    setCanJynxComment(false);
  }

  if (checking) return null;

  if (!devName) {
    return (
      <div
        className="dev-fab-wrap jynx-chrome jynx-ui"
        style={{ right: lockedFab.pos.right, bottom: lockedFab.pos.bottom }}
        tabIndex={-1}
        onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setLoginOpen(false); }}
      >
        <style>{CSS}</style>
        {loginOpen && (
          <div className="dev-fab-panel dev-only dev-login-panel">
            <span className="dev-only-tag">JYNX — Sign in to dev mode</span>
            <label className="env-strip-identity">
              <span>Password</span>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && login()} disabled={loggingIn} autoFocus />
            </label>
            {error && <div className="dev-login-error">{error}</div>}
            <button type="button" className="dev-login-submit" onClick={login} disabled={!password.trim() || loggingIn}>
              {loggingIn ? <Loader2 size={13} className="dev-login-spinner" /> : "Sign in"}
            </button>
          </div>
        )}
        <button
          type="button"
          className="dev-fab dev-fab-locked"
          onClick={onFabClick}
          {...lockedFab.dragHandlers}
          title="Sign in to dev mode — draggable"
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
      <DevOverlay active={overlayOn} route={route} isAdmin={isAdmin} canJynxChrome={isAdmin || canJynxComment} />
      <CommentsPanel active={commentsOn} route={route} currentDevUserId={devUserId} isAdmin={isAdmin} canJynxComment={canJynxComment} />
      {toolbarOpen ? (
        <div
          className="dev-fab-toolbar jynx-chrome jynx-ui"
          style={{ right: toolbarFab.pos.right, bottom: toolbarFab.pos.bottom }}
          {...toolbarFab.dragHandlers}
        >
          <span className="dev-toolbar-grip" title="Drag anywhere on the toolbar to move it"><GripVertical size={13} /></span>
          <button type="button" className="dev-toolbar-icon-btn" data-devblock="dev-toolbar-overlay-toggle" onClick={() => setOverlayOn((v) => !v)} title={overlayOn ? "Turn off hover overlay" : "Turn on hover overlay"}>
            {overlayOn ? <Eye size={13} /> : <EyeOff size={13} />}
          </button>
          <button type="button" className={"dev-toolbar-icon-btn" + (commentsOn ? " active" : "")} data-devblock="dev-toolbar-comments-toggle" onClick={() => setCommentsOn((v) => !v)} title={commentsOn ? "Hide screen comments" : "Show all comments on this screen"}>
            <MessageSquare size={13} />
          </button>
          <button type="button" className="dev-toolbar-icon-btn" data-devblock="dev-toolbar-admin-btn" onClick={() => setAdminOpen(true)} title="Admin (admin only)">
            <Settings2 size={13} />
          </button>
          <span className="dev-toolbar-devname">Hi, {devName}</span>
          <button type="button" className="dev-toolbar-icon-btn" data-devblock="dev-toolbar-logout-btn" onClick={logout} title="Log out of Jynx">
            <LogOut size={13} />
          </button>
          <button type="button" className="dev-toolbar-icon-btn" data-devblock="dev-toolbar-collapse-btn" onClick={toggleToolbarOpen} title="Collapse to the Jynx bubble">
            <X size={13} />
          </button>
        </div>
      ) : (
        <div className="dev-fab-wrap jynx-chrome jynx-ui" style={{ right: toolbarFab.pos.right, bottom: toolbarFab.pos.bottom }}>
          <button type="button" className="dev-fab" onClick={toggleToolbarOpen} {...toolbarFab.dragHandlers} title="Expand the Jynx toolbar — draggable">
            <span className="jynx-logo">JYNX</span>
          </button>
        </div>
      )}
      <DevFab {...devFabProps} />
      {adminOpen && <DevAdminPanel onClose={() => setAdminOpen(false)} onVerified={() => setIsAdmin(true)} />}
    </>
  );
}

const CSS = `
.dev-login-panel{ display:flex; flex-direction:column; gap:8px; }
.dev-login-error{ color:var(--red); font-size:11.5px; }
.dev-login-submit{
  background:var(--jynx); color:#fff; border:none; border-radius:8px; padding:7px 0; font-weight:700;
  font-size:12.5px; cursor:pointer; font-family:var(--font-sans);
}
.dev-login-submit:disabled{ opacity:.5; cursor:not-allowed; }
.dev-login-spinner{ display:block; margin:0 auto; animation:devLoginSpin .7s linear infinite; }
@keyframes devLoginSpin{ to{ transform:rotate(360deg); } }

.dev-fab-toolbar{
  position:fixed; z-index:79; display:flex; align-items:center; gap:6px;
  cursor:grab; touch-action:none;
}
.dev-fab-toolbar:active{ cursor:grabbing; }
.dev-toolbar-grip{
  display:flex; align-items:center; justify-content:center; width:16px; height:30px; color:var(--text-dim);
  flex:none;
}
.dev-toolbar-icon-btn{
  width:30px; height:30px; border-radius:8px; border:1px solid var(--jynx); background:var(--panel);
  color:var(--jynx); display:flex; align-items:center; justify-content:center; cursor:pointer;
}
.dev-toolbar-icon-btn:hover{ background:color-mix(in srgb, var(--jynx) 10%, var(--panel)); }
.dev-toolbar-icon-btn.active{ background:var(--jynx); color:#fff; }
.dev-toolbar-devname{
  background:var(--panel); border:1px solid var(--jynx); color:var(--jynx); border-radius:20px;
  padding:6px 12px; font-family:var(--font-mono); font-size:11px; font-weight:700; white-space:nowrap;
}

.dev-fab-mock-toggle-row{ display:flex; margin-bottom:6px; }
.mock-toggle{
  display:inline-flex; align-items:center; gap:6px; border-radius:20px; padding:6px 12px; border:1px solid var(--jynx);
  background:var(--panel); font-family:var(--font-mono); font-size:11px; font-weight:700; cursor:pointer;
}
.mock-toggle-mock{ color:var(--jynx); }
.mock-toggle-live{ color:var(--green); border-color:var(--green); }
`;
