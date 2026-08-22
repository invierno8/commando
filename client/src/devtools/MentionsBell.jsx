import React, { useEffect, useRef, useState } from "react";
import { Bell, X } from "lucide-react";
import { fetchMentions, markMentionRead } from "./devApi.js";
import { useKeepInViewport } from "./useKeepInViewport.js";

/* ================================================================== */
/* LEGO BLOCK — "you were @mentioned" bell, lives in the Jynx toolbar     */
/* next to the other icon buttons (see DevAuthGate.jsx). Polls           */
/* GET /dev/mentions (see data/routes/mentions.js) every 10s — same       */
/* cadence as DevAdminUsersScreen.jsx's "who's online" poll, since this   */
/* is a similarly low-urgency background refresh, not the 5s live-comment */
/* cadence CommentsPanel.jsx uses. Deliberately does NOT auto-navigate    */
/* to the mentioning comment on click (that would need cross-screen       */
/* routing this component doesn't have access to) — clicking a row just   */
/* marks it read and shows enough context (route/author/snippet) to find  */
/* it manually. A real "jump to it" can be added later if this turns out  */
/* to not be enough.                                                      */
/* ================================================================== */
export default function MentionsBell() {
  const [mentions, setMentions] = useState([]);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const dropdownRef = useRef(null);
  useKeepInViewport(dropdownRef, open, 8, [mentions.length]);

  function reload() {
    fetchMentions().then(setMentions).catch(() => {});
  }
  useEffect(() => {
    reload();
    const t = setInterval(reload, 10000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e) {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    }
    window.addEventListener("click", onDocClick, true);
    return () => window.removeEventListener("click", onDocClick, true);
  }, [open]);

  async function dismiss(id) {
    setMentions((prev) => prev.filter((m) => m.id !== id));
    await markMentionRead(id);
  }

  const unread = mentions.filter((m) => !m.read);

  return (
    <div ref={wrapRef} className="mentions-bell-wrap">
      <style>{CSS}</style>
      <button
        type="button" className={"dev-toolbar-icon-btn" + (unread.length > 0 ? " active" : "")}
        onClick={() => setOpen((v) => !v)} title="Mentions"
      >
        <Bell size={13} />
        {unread.length > 0 && <span className="mentions-bell-badge">{unread.length > 9 ? "9+" : unread.length}</span>}
      </button>
      {open && (
        <div ref={dropdownRef} className="mentions-bell-dropdown jynx-ui">
          {unread.length === 0 ? (
            <div className="mentions-bell-empty">No new mentions.</div>
          ) : (
            unread.map((m) => (
              <div key={m.id} className="mentions-bell-item">
                <div className="mentions-bell-item-head">
                  <span className="mentions-bell-item-from">{m.mentionedBy}</span>
                  <span className="mentions-bell-item-route">{m.route}</span>
                  <button type="button" className="mentions-bell-dismiss" onClick={() => dismiss(m.id)} title="Mark as read">
                    <X size={11} />
                  </button>
                </div>
                <p className="mentions-bell-item-snippet">{m.snippet}</p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

const CSS = `
.mentions-bell-wrap{ position:relative; }
.mentions-bell-badge{
  position:absolute; top:-4px; right:-4px; background:var(--red); color:#fff; border-radius:8px;
  font-size:9px; font-weight:700; line-height:1; padding:2px 4px; min-width:14px; text-align:center;
  font-family:var(--font-mono);
}
.mentions-bell-dropdown{
  position:absolute; top:36px; right:0; width:260px; max-height:320px; overflow-y:auto;
  background:var(--panel); border:1px solid var(--jynx); border-radius:10px; padding:6px;
  display:flex; flex-direction:column; gap:6px; box-shadow:var(--shadow-md); animation:devAnnotateIn .12s ease;
}
.mentions-bell-empty{ padding:12px; font-size:12px; color:var(--text-dim); text-align:center; }
.mentions-bell-item{ border-bottom:1px solid var(--line); padding:6px 6px 8px; }
.mentions-bell-item:last-child{ border-bottom:none; padding-bottom:6px; }
.mentions-bell-item-head{ display:flex; align-items:center; gap:6px; }
.mentions-bell-item-from{ font-weight:700; font-size:11.5px; color:var(--jynx); }
.mentions-bell-item-route{ font-family:var(--font-mono); font-size:9.5px; color:var(--text-dim); text-transform:uppercase; flex:1; }
.mentions-bell-dismiss{ background:none; border:none; color:var(--text-dim); cursor:pointer; display:flex; flex:none; }
.mentions-bell-dismiss:hover{ color:var(--jynx); }
.mentions-bell-item-snippet{ margin:3px 0 0; font-size:11.5px; color:var(--text); }
`;
