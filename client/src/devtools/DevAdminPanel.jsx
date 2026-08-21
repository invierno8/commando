import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, ShieldCheck } from "lucide-react";
import { adminVerify, fetchAdminMe } from "./devApi.js";
import DevAdminUsersScreen from "./DevAdminUsersScreen.jsx";
import DevAnnotationsScreen from "./DevAnnotationsScreen.jsx";
import JynxFeedbackScreen from "./JynxFeedbackScreen.jsx";

/* ================================================================== */
/* גישה למנהל בלבד (את/ה, לא משתמשי-פיתוח רגילים) — סוד יחיד (ADMIN_    */
/* SECRET), לא חשבון-פר-אדם, בכוונה (ראו plan doc). מציג שתי לשוניות:    */
/* ניהול משתמשי הפיתוח, וסקירת הערות ה-QA שנאספו מה-overlay.             */
/* ================================================================== */
export default function DevAdminPanel({ onClose, onVerified }) {
  const [checking, setChecking] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [secret, setSecret] = useState("");
  const [error, setError] = useState("");
  const [tab, setTab] = useState("users");

  useEffect(() => {
    let cancelled = false;
    fetchAdminMe().then((d) => {
      if (cancelled) return;
      setAuthenticated(!!d.authenticated);
      setChecking(false);
      if (d.authenticated) onVerified?.();
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function verify() {
    setError("");
    try {
      await adminVerify(secret);
      setAuthenticated(true);
      onVerified?.();
    } catch (e) {
      setError(e.message);
    }
  }

  return createPortal(
    <div className="overlay jynx-chrome" onClick={onClose}>
      <style>{CSS}</style>
      <div className="dev-admin-modal dev-only" onClick={(e) => e.stopPropagation()}>
        <button className="drawer-close" onClick={onClose}><X size={16} /></button>
        {checking ? (
          <div className="dev-admin-empty">בודק הרשאה...</div>
        ) : !authenticated ? (
          <div className="dev-admin-gate">
            <ShieldCheck size={24} />
            <h3>גישת מנהל</h3>
            <p>נדרש הסוד (ADMIN_SECRET) כדי לנהל משתמשי פיתוח ולסקור הערות QA.</p>
            <input
              type="password" autoFocus value={secret} placeholder="סוד מנהל"
              onChange={(e) => setSecret(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && verify()}
            />
            {error && <div className="dev-admin-error">{error}</div>}
            <button type="button" className="dev-admin-verify-btn" onClick={verify} disabled={!secret.trim()}>כניסה</button>
          </div>
        ) : (
          <>
            <div className="pill-tabs" style={{ marginBottom: 14 }}>
              <button type="button" className={"pill-tab" + (tab === "users" ? " active" : "")} onClick={() => setTab("users")}>משתמשי פיתוח</button>
              <button type="button" className={"pill-tab" + (tab === "annotations" ? " active" : "")} onClick={() => setTab("annotations")}>הערות QA</button>
              <button type="button" className={"pill-tab" + (tab === "jynx" ? " active jynx-tab-active" : "")} onClick={() => setTab("jynx")}>🔮 Jynx</button>
            </div>
            {tab === "users" && <DevAdminUsersScreen />}
            {tab === "annotations" && <DevAnnotationsScreen />}
            {tab === "jynx" && <JynxFeedbackScreen />}
          </>
        )}
      </div>
    </div>,
    document.body
  );
}

const CSS = `
@keyframes fadeSlideUp{ from{ opacity:0; transform:translateY(8px); } to{ opacity:1; transform:translateY(0); } }
.overlay{ position:fixed; inset:0; background:rgba(6,8,10,.6); backdrop-filter:blur(2px); display:flex; align-items:center; justify-content:center; z-index:250; padding:24px; }
.dev-admin-modal{
  position:relative; width:min(560px, 92vw); max-height:82vh; overflow-y:auto;
  background:var(--panel); border-radius:14px; padding:22px; animation:fadeSlideUp .16s ease;
}
.drawer-close{
  position:absolute; top:14px; left:14px; background:var(--panel-raised); border:1px solid var(--line);
  color:var(--text-dim); border-radius:8px; padding:6px; cursor:pointer; display:flex;
}
.drawer-close:hover{ color:var(--red); border-color:var(--red); }
.dev-admin-empty{ color:var(--text-dim); font-size:13px; text-align:center; padding:24px 0; }
.dev-admin-gate{ display:flex; flex-direction:column; align-items:center; gap:8px; text-align:center; padding:12px 0; color:var(--dev); }
.dev-admin-gate h3{ margin:0; color:var(--text); font-family:var(--font-sans); font-size:16px; }
.dev-admin-gate p{ color:var(--text-dim); font-size:12.5px; margin:0 0 6px; max-width:340px; }
.dev-admin-gate input{
  width:220px; background:var(--bg); border:1px solid var(--dev); border-radius:8px; padding:8px 10px;
  color:var(--text); font-family:var(--font-mono); font-size:13px; text-align:center;
}
.dev-admin-gate input:focus{ outline:none; box-shadow:0 0 0 2px color-mix(in srgb, var(--dev) 25%, transparent); }
.dev-admin-verify-btn{
  background:var(--dev); color:#fff; border:none; border-radius:8px; padding:8px 18px; font-weight:700;
  font-size:13px; cursor:pointer; font-family:var(--font-sans);
}
.dev-admin-verify-btn:disabled{ opacity:.5; cursor:not-allowed; }
.dev-admin-error{ color:var(--red); font-size:12px; }

.dev-admin-tab{ display:flex; flex-direction:column; gap:12px; }
.dev-admin-hint{ color:var(--text-dim); font-size:12px; line-height:1.6; margin:0; }

.dev-admin-user-list, .dev-admin-annotation-list{ display:flex; flex-direction:column; gap:8px; }
.dev-admin-user-row{
  display:flex; align-items:center; justify-content:space-between; gap:10px;
  background:var(--panel-raised); border:1px solid var(--line); border-radius:9px; padding:9px 12px;
}
.dev-admin-user-info{ display:flex; align-items:center; gap:8px; font-size:13px; }
.dev-admin-user-role{ color:var(--text-dim); font-size:11.5px; }
.dev-admin-user-inactive{ color:var(--red); font-size:11px; border:1px solid var(--red); border-radius:4px; padding:1px 6px; }
.dev-admin-user-actions{ display:flex; gap:6px; }
.dev-admin-user-actions button{
  background:none; border:1px solid var(--line); border-radius:7px; padding:5px; color:var(--text-dim); cursor:pointer;
}
.dev-admin-user-actions button:hover{ color:var(--text); border-color:var(--text-dim); }

.dev-admin-add-form{ display:flex; gap:8px; flex-wrap:wrap; }
.dev-admin-add-form input{
  flex:1; min-width:110px; background:var(--bg); border:1px solid var(--line); border-radius:8px;
  padding:7px 10px; font-size:12.5px; color:var(--text); font-family:var(--font-sans);
}
.dev-admin-add-form button{
  display:inline-flex; align-items:center; gap:5px; background:var(--accent); color:var(--accent-ink);
  border:none; border-radius:8px; padding:7px 14px; font-weight:700; font-size:12.5px; cursor:pointer;
}
.dev-admin-add-form button:disabled{ opacity:.4; cursor:not-allowed; }

.dev-admin-annotations-head{ display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap; }
.dev-admin-export-btn{
  display:inline-flex; align-items:center; gap:6px; background:var(--panel-raised); border:1px solid var(--line);
  border-radius:8px; padding:7px 12px; font-size:12px; font-weight:700; color:var(--text); cursor:pointer;
}
.dev-admin-annotation-row{
  display:flex; align-items:flex-start; justify-content:space-between; gap:10px;
  background:var(--panel-raised); border:1px solid var(--line); border-radius:9px; padding:10px 12px;
}
.dev-admin-annotation-row.resolved{ opacity:.55; }
.dev-admin-annotation-main{ display:flex; flex-direction:column; gap:3px; min-width:0; }
.dev-admin-annotation-route{ font-family:var(--font-mono); font-size:10.5px; color:var(--dev); text-transform:uppercase; }
.dev-admin-annotation-target{ font-size:11.5px; color:var(--text-dim); }
.dev-admin-annotation-comment{ margin:2px 0; font-size:13px; color:var(--text); }
.dev-admin-annotation-meta{ font-size:11px; color:var(--text-dim); }
.dev-admin-annotation-actions{ display:flex; flex-direction:column; gap:6px; align-items:center; flex:none; }
.dev-admin-resolve-btn{
  flex:none; width:28px; height:28px; border-radius:50%; border:1px solid var(--line); background:var(--panel);
  color:var(--text-dim); cursor:pointer; display:flex; align-items:center; justify-content:center;
}
.dev-admin-resolve-btn.active{ background:var(--green); border-color:var(--green); color:#fff; }
.dev-admin-action-btn{
  display:inline-flex; align-items:center; gap:4px; background:#2F8FCE; color:#fff; border:none;
  border-radius:14px; padding:5px 10px; font-size:11px; font-weight:700; cursor:pointer; white-space:nowrap;
}
.dev-admin-action-btn:hover{ filter:brightness(1.08); }
.dev-admin-action-pill{ align-self:flex-start; margin-top:2px; }
.dev-admin-action-pill a{ color:inherit; text-decoration:underline; margin-inline-start:4px; }
.dev-admin-spin{ animation:devAdminSpin 1s linear infinite; }
@keyframes devAdminSpin{ to{ transform:rotate(360deg); } }
.dev-admin-action-log{ font-size:11px; color:var(--red); }
.dev-admin-export-box{ display:flex; flex-direction:column; gap:8px; }
.dev-admin-export-box textarea{
  width:100%; background:var(--bg); border:1px solid var(--line); border-radius:8px; padding:10px;
  font-family:var(--font-mono); font-size:11.5px; color:var(--text); direction:ltr; text-align:left;
}
.jynx-tab-active{ background:var(--jynx) !important; border-color:var(--jynx) !important; color:#fff !important; }
.jynx-feedback-row{ border-inline-start:2px solid var(--jynx); }
.dev-admin-export-box button{
  align-self:flex-end; background:var(--panel-raised); border:1px solid var(--line); border-radius:8px;
  padding:6px 14px; font-size:12px; color:var(--text); cursor:pointer;
}
`;
