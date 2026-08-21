import React, { useEffect, useState } from "react";
import { Plus, Trash2, ShieldOff, ShieldCheck, KeyRound, Sparkles } from "lucide-react";
import { fetchDevUsers, createDevUser, updateDevUser, deleteDevUser } from "./devApi.js";

/* לא נושא <style> משלו — תמיד ממוסגר בתוך DevAdminPanel.jsx, שכבר מזריק     */
/* <style> יחיד לכל הלשוניות (בדיוק כמו תת-רכיבי מודל בתוך מסך אחר בקוד הזה).*/
export default function DevAdminUsersScreen() {
  const [users, setUsers] = useState(null);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [changingId, setChangingId] = useState(null); // מי מציג כרגע שדה "סיסמה חדשה"
  const [newPassword, setNewPassword] = useState("");

  function reload() {
    fetchDevUsers().then(setUsers);
  }
  useEffect(() => {
    reload();
    const t = setInterval(reload, 10000); // "מחובר/ת כרגע" מתעדכן בזמן אמת
    return () => clearInterval(t);
  }, []);

  async function addUser() {
    if (!name.trim() || !password.trim()) return;
    setError("");
    try {
      await createDevUser({ name: name.trim(), role: role.trim(), password: password.trim() });
      setName(""); setRole(""); setPassword("");
      reload();
    } catch (e) {
      setError(e.message);
    }
  }
  async function toggleActive(u) {
    await updateDevUser(u.id, { active: !u.active });
    reload();
  }
  // "Jynx commenter" — הרשאה נפרדת לגמרי מ-active/admin: מאפשרת למשתמש-
  // פיתוח רגיל להשאיר משוב על Jynx עצמו (Ctrl/Cmd+קליק על ה-FAB/הסרגל) ולראות
  // את מה שהוא כתב בסיידבר שלו (ראו DevOverlay.jsx / useHoverTarget.js /
  // CommentsPanel.jsx / data/routes/jynx-feedback.js).
  async function toggleJynxCommenter(u) {
    await updateDevUser(u.id, { canJynxComment: !u.canJynxComment });
    reload();
  }
  async function removeUser(id) {
    await deleteDevUser(id);
    reload();
  }
  async function savePassword(id) {
    if (!newPassword.trim()) return;
    await updateDevUser(id, { password: newPassword.trim() });
    setChangingId(null);
    setNewPassword("");
    reload();
  }

  if (!users) return <div className="dev-admin-empty">Loading...</div>;

  return (
    <div className="dev-admin-tab">
      <p className="dev-admin-hint">
        Dev users (product managers / commanders / engineers) who can activate dev mode on the public link and leave QA comments.
        The file itself (data/config/dev-users.json) is the source of truth in Git; this screen edits it directly on the server.
        Passwords are encrypted (bcrypt) — there's no way to show an existing password, only reset to a new one.
        The sparkle button grants/revokes "Jynx commenter" — lets that dev user leave feedback about Jynx itself
        (the FAB/toolbar/admin panel), separate from and in addition to their regular QA-comment access.
      </p>
      {users.length === 0 && <div className="dev-admin-empty">No dev users yet.</div>}
      {users.length > 0 && (
        <div className="dev-admin-user-list">
          {users.map((u) => (
            <div className="dev-admin-user-row" key={u.id}>
              <div className="dev-admin-user-info">
                <span className={"dev-admin-online-dot" + (u.online ? " online" : "")} title={u.online ? "Online now" : "Offline"} />
                <b>{u.name}</b>
                {u.role && <span className="dev-admin-user-role">{u.role}</span>}
                {u.canJynxComment && <span className="dev-admin-user-jynx-tag" title="Can leave feedback about Jynx itself"><Sparkles size={10} /> Jynx commenter</span>}
                {!u.active && <span className="dev-admin-user-inactive">Disabled</span>}
                {u.createdAt && <span className="dev-admin-user-created">Created {new Date(u.createdAt).toLocaleDateString("en-US")}</span>}
              </div>
              <div className="dev-admin-user-actions">
                <button
                  type="button"
                  className={u.canJynxComment ? "dev-admin-jynx-toggle-active" : ""}
                  onClick={() => toggleJynxCommenter(u)}
                  title={u.canJynxComment ? "Revoke Jynx commenter permission" : "Grant Jynx commenter permission (feedback about Jynx itself)"}
                >
                  <Sparkles size={14} />
                </button>
                <button type="button" onClick={() => { setChangingId(changingId === u.id ? null : u.id); setNewPassword(""); }} title="Reset password">
                  <KeyRound size={14} />
                </button>
                <button type="button" onClick={() => toggleActive(u)} title={u.active ? "Disable" : "Enable"}>
                  {u.active ? <ShieldOff size={14} /> : <ShieldCheck size={14} />}
                </button>
                <button type="button" onClick={() => removeUser(u.id)} title="Delete"><Trash2 size={14} /></button>
              </div>
              {changingId === u.id && (
                <div className="dev-admin-password-reset">
                  <input
                    type="text" placeholder="New password" value={newPassword} autoFocus
                    onChange={(e) => setNewPassword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && savePassword(u.id)}
                  />
                  <button type="button" onClick={() => savePassword(u.id)} disabled={!newPassword.trim()}>Save</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <div className="dev-admin-add-form">
        <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <input placeholder="Role (e.g. Battalion Commander)" value={role} onChange={(e) => setRole(e.target.value)} />
        <input placeholder="Password" type="text" value={password} onChange={(e) => setPassword(e.target.value)} />
        <button type="button" onClick={addUser} disabled={!name.trim() || !password.trim()}><Plus size={13} /> Add</button>
      </div>
      {error && <div className="dev-admin-error">{error}</div>}
    </div>
  );
}
