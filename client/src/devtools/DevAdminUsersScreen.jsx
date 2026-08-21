import React, { useEffect, useState } from "react";
import { Plus, Trash2, ShieldOff, ShieldCheck, KeyRound } from "lucide-react";
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

  if (!users) return <div className="dev-admin-empty">טוען...</div>;

  return (
    <div className="dev-admin-tab">
      <p className="dev-admin-hint">
        משתמשי פיתוח (product managers / מפקדים / מהנדסים) שיכולים להפעיל מצב פיתוח בקישור הציבורי ולהשאיר הערות QA.
        הקובץ עצמו (data/config/dev-users.json) הוא מקור האמת בגרסת ה-Git; המסך הזה עורך אותו ישירות על השרת.
        הסיסמאות מוצפנות (bcrypt) — אין דרך להציג סיסמה קיימת, רק לאפס לסיסמה חדשה.
      </p>
      {users.length === 0 && <div className="dev-admin-empty">אין עדיין משתמשי פיתוח.</div>}
      {users.length > 0 && (
        <div className="dev-admin-user-list">
          {users.map((u) => (
            <div className="dev-admin-user-row" key={u.id}>
              <div className="dev-admin-user-info">
                <span className={"dev-admin-online-dot" + (u.online ? " online" : "")} title={u.online ? "מחובר/ת כרגע" : "לא מחובר/ת כרגע"} />
                <b>{u.name}</b>
                {u.role && <span className="dev-admin-user-role">{u.role}</span>}
                {!u.active && <span className="dev-admin-user-inactive">מושבת</span>}
                {u.createdAt && <span className="dev-admin-user-created">נוצר/ה {new Date(u.createdAt).toLocaleDateString("he-IL")}</span>}
              </div>
              <div className="dev-admin-user-actions">
                <button type="button" onClick={() => { setChangingId(changingId === u.id ? null : u.id); setNewPassword(""); }} title="איפוס סיסמה">
                  <KeyRound size={14} />
                </button>
                <button type="button" onClick={() => toggleActive(u)} title={u.active ? "השבתה" : "הפעלה"}>
                  {u.active ? <ShieldOff size={14} /> : <ShieldCheck size={14} />}
                </button>
                <button type="button" onClick={() => removeUser(u.id)} title="מחיקה"><Trash2 size={14} /></button>
              </div>
              {changingId === u.id && (
                <div className="dev-admin-password-reset">
                  <input
                    type="text" placeholder="סיסמה חדשה" value={newPassword} autoFocus
                    onChange={(e) => setNewPassword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && savePassword(u.id)}
                  />
                  <button type="button" onClick={() => savePassword(u.id)} disabled={!newPassword.trim()}>שמירה</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <div className="dev-admin-add-form">
        <input placeholder="שם" value={name} onChange={(e) => setName(e.target.value)} />
        <input placeholder="תפקיד (לדוגמה: מפקד גדוד)" value={role} onChange={(e) => setRole(e.target.value)} />
        <input placeholder="סיסמה" type="text" value={password} onChange={(e) => setPassword(e.target.value)} />
        <button type="button" onClick={addUser} disabled={!name.trim() || !password.trim()}><Plus size={13} /> הוספה</button>
      </div>
      {error && <div className="dev-admin-error">{error}</div>}
    </div>
  );
}
