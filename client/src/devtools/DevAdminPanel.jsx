import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, ShieldCheck, LogIn } from "lucide-react";
import { adminVerify, fetchAdminMe, fetchAnnotationSettings, setAutoResolveOnPrOpened } from "./devApi.js";
import { setAuthErrorListener } from "../api-client/http.js";
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
  // הסשן (X-Admin-Session) יכול לפוג באמצע שימוש בפאנל — למשל תוך כדי כתיבת
  // תגובה בלשונית Jynx/Comments. במקום להחזיר את authenticated ל-false (מה
  // שהיה מסיר לגמרי את הלשונית הפעילה ומאבד כל state מקומי שם — טיוטת-
  // תגובה פתוחה, תיבת-עריכה וכו', בדיוק מה שהמשתמש התלונן עליו), מציגים
  // באנר קטן מעל תוכן הלשונית והלשונית עצמה נשארת mounted לגמרי. ראו
  // setAuthErrorListener ב-http.js — מאזין 401 יחיד ברמת המודול, לא Context.
  const [reAuthNeeded, setReAuthNeeded] = useState(false);
  const [reAuthSecret, setReAuthSecret] = useState("");
  const [reAuthError, setReAuthError] = useState("");
  const [reAuthing, setReAuthing] = useState(false);
  // "לסמן כטופל אוטומטית כשנפתח PR" — הגדרה משותפת לשתי הלשוניות (Comments/
  // Jynx), ולכן מוצגת כאן מעל ה-tabs, לא בתוך אחת מהן. ראו
  // data/lib/annotationSettings.js להסבר המלא למה זו לא באמת "אוטומטי
  // כשה-PR נמזג" אלא "אוטומטי כשה-PR נפתח" — האפליקציה הזו לא יודעת מתי PR
  // ממוזג, רק מתי הרוטינה סימנה pr_opened.
  const [autoResolve, setAutoResolveState] = useState(false);
  const [autoResolveSaving, setAutoResolveSaving] = useState(false);

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

  useEffect(() => {
    if (!authenticated) return;
    setAuthErrorListener((message) => {
      if (message && message.startsWith("נדרש אימות מנהל")) setReAuthNeeded(true);
    });
    return () => setAuthErrorListener(null);
  }, [authenticated]);

  useEffect(() => {
    if (!authenticated) return;
    fetchAnnotationSettings().then((s) => setAutoResolveState(!!s.autoResolveOnPrOpened)).catch(() => {});
  }, [authenticated]);

  async function toggleAutoResolve() {
    const next = !autoResolve;
    setAutoResolveState(next); // אופטימי — הטוגל עצמו מהיר, אין צורך לחכות
    setAutoResolveSaving(true);
    try {
      await setAutoResolveOnPrOpened(next);
    } catch {
      setAutoResolveState(!next); // נכשל — חוזרים למצב הקודם
    } finally {
      setAutoResolveSaving(false);
    }
  }

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

  async function reLogin() {
    setReAuthError("");
    setReAuthing(true);
    try {
      await adminVerify(reAuthSecret);
      setReAuthNeeded(false);
      setReAuthSecret("");
    } catch (e) {
      setReAuthError(e.message);
    } finally {
      setReAuthing(false);
    }
  }

  return createPortal(
    <div className="overlay jynx-chrome" onClick={onClose}>
      <style>{CSS}</style>
      <div className="dev-admin-modal dev-only jynx-ui" onClick={(e) => e.stopPropagation()}>
        <button className="drawer-close" onClick={onClose}><X size={16} /></button>
        {checking ? (
          <div className="dev-admin-empty">Checking permission...</div>
        ) : !authenticated ? (
          <div className="dev-admin-gate">
            <ShieldCheck size={24} />
            <h3>Admin access</h3>
            <p>The ADMIN_SECRET is required to manage dev users and review QA comments.</p>
            <input
              type="password" autoFocus value={secret} placeholder="Admin secret"
              onChange={(e) => setSecret(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && verify()}
            />
            {error && <div className="dev-admin-error">{error}</div>}
            <button type="button" className="dev-admin-verify-btn" onClick={verify} disabled={!secret.trim()}>Sign in</button>
          </div>
        ) : (
          <>
            {reAuthNeeded && (
              <div className="dev-admin-reauth-banner">
                <ShieldCheck size={14} />
                <span>Admin session expired — sign in again to keep working (nothing here is lost).</span>
                <input
                  type="password" autoFocus value={reAuthSecret} placeholder="Admin secret"
                  onChange={(e) => setReAuthSecret(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && reLogin()}
                  disabled={reAuthing}
                />
                <button type="button" onClick={reLogin} disabled={!reAuthSecret.trim() || reAuthing}>
                  <LogIn size={12} /> {reAuthing ? "Signing in..." : "Sign in"}
                </button>
                {reAuthError && <span className="dev-admin-reauth-error">{reAuthError}</span>}
              </div>
            )}
            {(tab === "annotations" || tab === "jynx") && (
              <div className="dev-admin-autoresolve-row">
                <span>
                  <b>{autoResolve ? "Auto" : "Manual"}</b> mark as Done — {autoResolve
                    ? "a comment resolves itself the moment a PR is opened for it"
                    : "you click ✓ yourself once a PR is merged (see the hint on pr_opened rows)"}
                </span>
                <button
                  type="button"
                  className={"dev-admin-autoresolve-toggle" + (autoResolve ? " on" : "")}
                  onClick={toggleAutoResolve}
                  disabled={autoResolveSaving}
                  title={autoResolve ? "Switch to manual" : "Switch to automatic"}
                >
                  <span className="dev-admin-autoresolve-knob" />
                </button>
              </div>
            )}
            <div className="pill-tabs" style={{ marginBottom: 14 }}>
              <button type="button" className={"pill-tab" + (tab === "users" ? " active" : "")} onClick={() => setTab("users")}>Dev Users</button>
              <button type="button" className={"pill-tab" + (tab === "annotations" ? " active" : "")} onClick={() => setTab("annotations")}>Comments</button>
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
.dev-admin-gate{ display:flex; flex-direction:column; align-items:center; gap:8px; text-align:center; padding:12px 0; color:var(--jynx); }
.dev-admin-gate h3{ margin:0; color:var(--text); font-family:var(--font-jynx); font-size:16px; }
.dev-admin-gate p{ color:var(--text-dim); font-size:12.5px; margin:0 0 6px; max-width:340px; }
.dev-admin-gate input{
  width:220px; background:var(--bg); border:1px solid var(--jynx); border-radius:8px; padding:8px 10px;
  color:var(--text); font-family:var(--font-mono); font-size:13px; text-align:center;
}
.dev-admin-gate input:focus{ outline:none; box-shadow:0 0 0 2px color-mix(in srgb, var(--jynx) 25%, transparent); }
.dev-admin-verify-btn{
  background:var(--jynx); color:#fff; border:none; border-radius:8px; padding:8px 18px; font-weight:700;
  font-size:13px; cursor:pointer; font-family:var(--font-jynx);
}
.dev-admin-verify-btn:disabled{ opacity:.5; cursor:not-allowed; }
.dev-admin-error{ color:var(--red); font-size:12px; }

.dev-admin-reauth-banner{
  display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:12px;
  background:color-mix(in srgb, var(--yellow) 12%, transparent); border:1px solid var(--yellow);
  border-radius:9px; padding:8px 10px; color:var(--yellow); font-size:12px;
}
.dev-admin-reauth-banner span{ flex:1 1 200px; min-width:0; }
.dev-admin-reauth-banner input{
  width:140px; background:var(--bg); border:1px solid var(--yellow); border-radius:7px; padding:6px 9px;
  font-family:var(--font-mono); font-size:12px; color:var(--text);
}
.dev-admin-reauth-banner button{
  display:inline-flex; align-items:center; gap:4px; background:var(--yellow); color:#000; border:none;
  border-radius:7px; padding:6px 12px; font-size:12px; font-weight:700; cursor:pointer; white-space:nowrap;
}
.dev-admin-reauth-banner button:disabled{ opacity:.5; cursor:not-allowed; }
.dev-admin-reauth-error{ color:var(--red); font-size:11.5px; flex-basis:100%; }

.dev-admin-autoresolve-row{
  display:flex; align-items:center; gap:10px; margin-top:28px; margin-bottom:12px; padding:8px 10px;
  background:var(--panel-raised); border:1px solid var(--line); border-radius:9px;
}
/* כשבאנר ה-reauth כבר מוצג מעל השורה הזאת, היא כבר לא הדבר הראשון ממש מתחת
   ל-.drawer-close הצף (position:absolute, top/left:14px) — אז אין צורך
   ברווח הנוסף שמונע ממנו לכסות את תחילת ה-"Manual"/"Auto" המודגש. */
.dev-admin-reauth-banner + .dev-admin-autoresolve-row{ margin-top:12px; }
.dev-admin-autoresolve-row span{ flex:1; font-size:11.5px; color:var(--text-dim); line-height:1.5; }
.dev-admin-autoresolve-row span b{ color:var(--text); }
.dev-admin-autoresolve-toggle{
  flex:none; width:36px; height:20px; border-radius:12px; border:1px solid var(--line); background:var(--bg);
  cursor:pointer; position:relative; padding:0; transition:background .15s ease, border-color .15s ease;
}
.dev-admin-autoresolve-toggle.on{ background:var(--jynx); border-color:var(--jynx); }
.dev-admin-autoresolve-toggle:disabled{ opacity:.6; cursor:not-allowed; }
.dev-admin-autoresolve-knob{
  position:absolute; top:1px; left:1px; width:16px; height:16px; border-radius:50%; background:#fff;
  box-shadow:var(--shadow-sm); transition:transform .15s ease;
}
.dev-admin-autoresolve-toggle.on .dev-admin-autoresolve-knob{ transform:translateX(16px); }

.dev-admin-tab{ display:flex; flex-direction:column; gap:12px; }
.dev-admin-hint{ color:var(--text-dim); font-size:12px; line-height:1.6; margin:0; }

.dev-admin-user-list, .dev-admin-annotation-list{ display:flex; flex-direction:column; gap:8px; }
.dev-admin-user-row{
  display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap;
  background:var(--panel-raised); border:1px solid var(--line); border-radius:9px; padding:9px 12px;
}
.dev-admin-user-info{ display:flex; align-items:center; gap:8px; font-size:13px; }
.dev-admin-user-role{ color:var(--text-dim); font-size:11.5px; }
.dev-admin-user-inactive{ color:var(--red); font-size:11px; border:1px solid var(--red); border-radius:4px; padding:1px 6px; }
.dev-admin-user-created{ color:var(--text-dim); font-size:10.5px; }
.dev-admin-online-dot{ width:8px; height:8px; border-radius:50%; background:var(--line); flex:none; }
.dev-admin-online-dot.online{ background:var(--green); box-shadow:0 0 0 2px color-mix(in srgb, var(--green) 25%, transparent); }
.dev-admin-password-reset{ display:flex; gap:6px; margin-top:6px; width:100%; }
.dev-admin-password-reset input{
  flex:1; background:var(--bg); border:1px solid var(--line); border-radius:7px; padding:6px 9px;
  font-size:12px; font-family:var(--font-mono); color:var(--text);
}
.dev-admin-password-reset button{
  background:var(--jynx); color:#fff; border:none; border-radius:7px; padding:6px 14px; font-size:12px; font-weight:700; cursor:pointer;
}
.dev-admin-password-reset button:disabled{ opacity:.5; cursor:not-allowed; }
.dev-admin-user-actions{ display:flex; gap:6px; }
.dev-admin-user-actions button{
  background:none; border:1px solid var(--line); border-radius:7px; padding:5px; color:var(--text-dim); cursor:pointer;
}
.dev-admin-user-actions button:hover{ color:var(--text); border-color:var(--text-dim); }
.dev-admin-user-actions button.jynx-perm-active{ color:var(--jynx); border-color:var(--jynx); }
.dev-admin-user-jynx-badge{
  color:var(--jynx); font-size:11px; border:1px solid var(--jynx); border-radius:4px; padding:1px 6px;
}

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
.dev-admin-annotation-route{ font-family:var(--font-mono); font-size:10.5px; color:var(--jynx); text-transform:uppercase; }
.dev-admin-annotation-target{ font-size:11.5px; color:var(--text-dim); }
.dev-admin-annotation-comment{ margin:2px 0; font-size:13px; color:var(--text); }
.dev-admin-comment-row{ display:flex; align-items:flex-start; gap:6px; }
.dev-admin-comment-row .dev-admin-annotation-comment{ flex:1; }
.dev-admin-edit-btn{
  flex:none; margin-top:4px; background:none; border:none; color:var(--text-dim); cursor:pointer;
  padding:2px; display:inline-flex; opacity:.55;
}
.dev-admin-edit-btn:hover{ color:var(--jynx); opacity:1; }
.dev-admin-attachment-link{ display:inline-flex; align-self:flex-start; margin:2px 0; }
.dev-admin-attachment-thumb{
  width:56px; height:56px; object-fit:cover; border-radius:7px; border:1px solid var(--line);
}
.dev-admin-attachment-file{
  align-items:center; gap:5px; background:var(--panel); border:1px solid var(--line);
  border-radius:14px; padding:4px 10px; font-size:11px; color:var(--text-dim); text-decoration:none;
}
.dev-admin-attachment-file:hover{ color:var(--jynx); border-color:var(--jynx); }
.dev-admin-annotation-meta{ font-size:11px; color:var(--text-dim); }
.dev-admin-annotation-actions{ display:flex; flex-direction:column; gap:6px; align-items:center; flex:none; }
.dev-admin-resolve-btn{
  flex:none; width:28px; height:28px; border-radius:50%; border:1px solid var(--line); background:var(--panel);
  color:var(--text-dim); cursor:pointer; display:flex; align-items:center; justify-content:center;
}
.dev-admin-resolve-btn.active{ background:var(--green); border-color:var(--green); color:#fff; }
.dev-admin-archive-btn{
  flex:none; width:28px; height:28px; border-radius:50%; border:1px solid var(--line); background:var(--panel);
  color:var(--text-dim); cursor:pointer; display:flex; align-items:center; justify-content:center;
}
.dev-admin-archive-btn:hover{ color:var(--text); border-color:var(--text-dim); }
.dev-admin-edit-btn, .dev-admin-delete-btn{
  flex:none; width:28px; height:28px; border-radius:50%; border:1px solid var(--line); background:var(--panel);
  color:var(--text-dim); cursor:pointer; display:flex; align-items:center; justify-content:center;
}
.dev-admin-edit-btn:hover{ color:var(--jynx); border-color:var(--jynx); }
.dev-admin-delete-btn:hover{ background:var(--red); border-color:var(--red); color:#fff; }
.dev-admin-edit-box{ display:flex; flex-direction:column; gap:6px; margin:2px 0; }
.dev-admin-edit-box textarea{
  width:100%; background:var(--bg); border:1px solid var(--jynx); border-radius:7px; padding:7px 9px;
  font-size:13px; font-family:var(--font-sans); color:var(--text); resize:vertical;
}
.dev-admin-edit-box-actions{ display:flex; justify-content:flex-end; gap:6px; }
.dev-admin-edit-box-actions button{
  display:inline-flex; align-items:center; gap:4px; border:none; border-radius:7px; padding:5px 11px;
  font-size:11.5px; font-weight:700; cursor:pointer; background:var(--panel-raised); color:var(--text-dim);
}
.dev-admin-edit-box-actions button.primary{ background:var(--jynx); color:#fff; }
.dev-admin-edit-box-actions button:disabled{ opacity:.5; cursor:not-allowed; }
.dev-admin-delete-confirm{
  display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-top:4px; font-size:11.5px; color:var(--red);
  background:color-mix(in srgb, var(--red) 10%, transparent); border:1px solid var(--red); border-radius:7px; padding:6px 9px;
}
.dev-admin-delete-confirm-actions{ display:flex; gap:6px; margin-inline-start:auto; }
.dev-admin-delete-confirm-actions button{
  border:none; border-radius:7px; padding:4px 10px; font-size:11.5px; font-weight:700; cursor:pointer;
  background:var(--panel-raised); color:var(--text-dim);
}
.dev-admin-delete-confirm-actions button.danger{ background:var(--red); color:#fff; }
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
.dev-admin-pr-hint{ font-size:11px; color:var(--text-dim); }
.dev-admin-resolution-note{
  display:flex; align-items:flex-start; gap:5px; font-size:11.5px; color:var(--green);
  background:color-mix(in srgb, var(--green) 10%, transparent); border-radius:6px; padding:5px 8px; margin-top:2px;
}
.dev-admin-resolution-note.reopened{
  color:var(--yellow); background:color-mix(in srgb, var(--yellow) 10%, transparent);
}
.dev-admin-resolve-note-box{ display:flex; flex-direction:column; gap:6px; margin-top:4px; }
.dev-admin-resolve-note-box textarea{
  width:100%; background:var(--bg); border:1px solid var(--line); border-radius:7px; padding:7px 9px;
  font-size:12px; font-family:var(--font-sans); color:var(--text); resize:vertical;
}
.dev-admin-resolve-note-actions{ display:flex; justify-content:flex-end; gap:6px; }
.dev-admin-resolve-note-actions button{
  border:none; border-radius:7px; padding:5px 11px; font-size:11.5px; font-weight:700; cursor:pointer;
  background:var(--panel-raised); color:var(--text-dim);
}
.dev-admin-resolve-note-actions button.primary{ background:var(--green); color:#fff; }
.dev-admin-thread-toggle{
  align-self:flex-start; display:inline-flex; align-items:center; gap:4px; background:none; border:none;
  color:var(--text-dim); font-size:11px; cursor:pointer; padding:2px 0; margin-top:2px;
}
.dev-admin-thread-toggle:hover{ color:var(--jynx); }
.dev-admin-thread{
  display:flex; flex-direction:column; gap:6px; background:var(--bg); border:1px solid var(--line);
  border-radius:8px; padding:8px; margin-top:2px;
}
.dev-admin-thread-item{ font-size:11.5px; color:var(--text); display:flex; flex-wrap:wrap; gap:6px; align-items:baseline; }
.dev-admin-thread-item b{ color:var(--jynx); }
.dev-admin-thread-time{ font-size:10px; color:var(--text-dim); margin-inline-start:auto; }
/* אזכור @שם/@jynx בתגובה — כחול (לא הסגול-מותג של Jynx) כדי שיובחן ויזואלית,
   ראו mentionUtils.jsx (משותף עם CommentsPanel.jsx). */
.dev-admin-mention{ color:#2F8FCE; font-weight:700; }
.dev-admin-mention-jynx{ color:var(--dev); }
.dev-admin-thread-input-wrap{ position:relative; }
.dev-admin-mention-dropdown{
  position:absolute; bottom:100%; left:0; right:0; margin-bottom:4px; background:var(--panel);
  border:1px solid var(--jynx); border-radius:8px; padding:4px; display:flex; flex-direction:column; gap:2px;
  box-shadow:var(--shadow-md); z-index:1; max-height:140px; overflow-y:auto;
}
.dev-admin-mention-dropdown button{
  background:none; border:none; text-align:left; padding:5px 7px; border-radius:5px; font-size:11.5px;
  color:var(--text); cursor:pointer;
}
.dev-admin-mention-dropdown button:hover{ background:color-mix(in srgb, var(--jynx) 12%, transparent); color:var(--jynx); }
.dev-admin-thread-input{ display:flex; gap:6px; }
.dev-admin-thread-input input{
  flex:1; background:var(--panel); border:1px solid var(--line); border-radius:7px; padding:6px 9px;
  font-size:12px; color:var(--text); font-family:var(--font-sans);
}
.dev-admin-thread-input button{
  background:var(--jynx); color:#fff; border:none; border-radius:7px; padding:6px 12px; font-size:11.5px; font-weight:700; cursor:pointer;
}
.dev-admin-thread-input button:disabled{ opacity:.5; cursor:not-allowed; }
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
