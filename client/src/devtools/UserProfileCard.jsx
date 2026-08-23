import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, MessageSquare, MessageCircle, Smile, GitPullRequest, CheckCircle2, Loader2, Calendar, ExternalLink, Sparkles } from "lucide-react";
import { fetchUserProfile } from "./devApi.js";

/* ================================================================== */
/* LEGO BLOCK — the "user system" (2026-08-23): a click-through profile  */
/* card for any dev user, opened from an @mention or an author name      */
/* anywhere in the dev-tool chrome (see openUserProfile.js for how the   */
/* click gets here — this component mounts once, at the top, in          */
/* DevAuthGate.jsx, listening for that event).                           */
/*                                                                      */
/* "Activity" is a single unified feed built server-side (see             */
/* data/lib/userActivity.js) from BOTH note queues — regular QA           */
/* annotations about the underlying app, and Jynx-meta feedback about     */
/* the dev tool itself (tagged with a small 🔮 badge per item so the       */
/* two don't get confused) — comments this person wrote, replies they     */
/* added to ANY thread (not just their own), and reactions. The filter    */
/* row is exactly "all their activity, or only the comments they left"    */
/* per the original ask, plus replies/reactions as free extra filters     */
/* since the data was already there.                                     */
/* ================================================================== */

const TYPE_ICON = { comment: MessageSquare, reply: MessageCircle, reaction: Smile };
const TYPE_LABEL = { comment: "Comment", reply: "Reply", reaction: "Reaction" };
const FILTERS = [
  { key: "all", label: "All" },
  { key: "comment", label: "Comments" },
  { key: "reply", label: "Replies" },
  { key: "reaction", label: "Reactions" },
];

export default function UserProfileCard({ userId, onClose }) {
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    let cancelled = false;
    setProfile(null);
    setError(null);
    setFilter("all");
    fetchUserProfile(userId)
      .then((d) => { if (!cancelled) setProfile(d); })
      .catch((e) => { if (!cancelled) setError(e.message || "Couldn't load this profile."); });
    return () => { cancelled = true; };
  }, [userId]);

  const shown = profile ? profile.activity.filter((a) => filter === "all" || a.type === filter) : [];

  return createPortal(
    <div className="jynx-profile-overlay" onClick={onClose}>
      <style>{CSS}</style>
      <div className="jynx-profile-panel jynx-ui" onClick={(e) => e.stopPropagation()}>
        <div className="jynx-profile-head">
          <span>👤 {profile ? profile.name : "Profile"}</span>
          <button type="button" className="jynx-profile-close" onClick={onClose} title="Close"><X size={14} /></button>
        </div>

        {error && <div className="jynx-profile-error">{error}</div>}
        {!profile && !error && (
          <div className="jynx-profile-loading"><Loader2 size={16} className="jynx-profile-spin" /> Loading…</div>
        )}

        {profile && (
          <>
            <div className="jynx-profile-meta">
              <span
                className={"jynx-profile-online-dot" + (profile.online ? " online" : "")}
                title={profile.online ? "Online now" : "Offline"}
              />
              {profile.role && <span className="jynx-profile-role">{profile.role}</span>}
              {profile.canJynxComment && (
                <span className="jynx-profile-jynx-badge"><Sparkles size={10} /> Jynx commenter</span>
              )}
              {!profile.active && <span className="jynx-profile-inactive">Disabled</span>}
              {profile.createdAt && (
                <span className="jynx-profile-joined">
                  <Calendar size={11} /> Joined {new Date(profile.createdAt).toLocaleDateString("en-US")}
                </span>
              )}
            </div>

            <div className="jynx-profile-stats">
              <div className="jynx-profile-stat"><b>{profile.stats.comment}</b><span>Comments</span></div>
              <div className="jynx-profile-stat"><b>{profile.stats.reply}</b><span>Replies</span></div>
              <div className="jynx-profile-stat"><b>{profile.stats.reaction}</b><span>Reactions</span></div>
            </div>

            <div className="pill-tabs jynx-profile-filters">
              {FILTERS.map((f) => (
                <button
                  key={f.key} type="button"
                  className={"pill-tab" + (filter === f.key ? " active" : "")}
                  onClick={() => setFilter(f.key)}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="jynx-profile-activity-list">
              {shown.length === 0 && (
                <div className="jynx-profile-empty">No {filter === "all" ? "activity" : filter + "s"} yet.</div>
              )}
              {shown.map((a, i) => {
                const Icon = TYPE_ICON[a.type] || MessageSquare;
                return (
                  <div key={i} className="jynx-profile-activity-item">
                    <div className="jynx-profile-activity-head">
                      <Icon size={12} />
                      <span className="jynx-profile-activity-type">
                        {TYPE_LABEL[a.type] || a.type}{a.emoji ? ` ${a.emoji}` : ""}
                      </span>
                      {a.kind === "jynx" && <span className="jynx-profile-jynx-tag">🔮 Jynx</span>}
                      <span className="jynx-profile-activity-route">
                        {a.route}{a.targetLabel ? ` · ${a.targetLabel}` : ""}
                      </span>
                      <span className="jynx-profile-activity-date">{new Date(a.createdAt).toLocaleString("en-US")}</span>
                    </div>
                    <p className="jynx-profile-activity-text">{a.text}</p>
                    {a.type === "comment" && (
                      <div className="jynx-profile-activity-status">
                        {a.resolved ? (
                          <span className="jynx-profile-status-done"><CheckCircle2 size={11} /> Done</span>
                        ) : (
                          <span className="jynx-profile-status-open">Open</span>
                        )}
                        {a.actionPrUrl && (
                          <a href={a.actionPrUrl} target="_blank" rel="noreferrer" className="jynx-profile-pr-link">
                            <GitPullRequest size={10} /> PR <ExternalLink size={9} />
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}

const CSS = `
.jynx-profile-overlay{
  position:fixed; inset:0; background:rgba(6,8,10,.55); backdrop-filter:blur(1px); z-index:100020;
  display:flex; align-items:center; justify-content:center; padding:20px;
}
.jynx-profile-panel{
  width:min(440px, 94vw); max-height:min(600px, 88vh); background:var(--panel); border:1px solid var(--jynx);
  border-radius:14px; padding:16px; display:flex; flex-direction:column; gap:12px; box-shadow:var(--shadow-md);
  animation:jynxProfileIn .16s ease;
}
@keyframes jynxProfileIn{ from{ opacity:0; transform:scale(.96); } to{ opacity:1; transform:scale(1); } }
.jynx-profile-head{ display:flex; align-items:center; justify-content:space-between; font-weight:700; color:var(--jynx); font-size:14px; flex:none; }
.jynx-profile-close{ background:none; border:none; color:var(--text-dim); cursor:pointer; display:flex; }
.jynx-profile-close:hover{ color:var(--red); }
.jynx-profile-loading{ display:flex; align-items:center; gap:8px; color:var(--text-dim); font-size:12.5px; padding:24px 0; justify-content:center; }
.jynx-profile-spin{ animation:jynxProfileSpin .8s linear infinite; }
@keyframes jynxProfileSpin{ to{ transform:rotate(360deg); } }
.jynx-profile-error{ color:var(--red); font-size:12.5px; }
.jynx-profile-meta{ display:flex; flex-wrap:wrap; align-items:center; gap:8px; font-size:11.5px; color:var(--text-dim); flex:none; }
.jynx-profile-online-dot{ width:8px; height:8px; border-radius:50%; background:var(--text-dim); flex:none; }
.jynx-profile-online-dot.online{ background:var(--green); box-shadow:0 0 0 3px color-mix(in srgb, var(--green) 25%, transparent); }
.jynx-profile-role{ font-weight:600; color:var(--text); }
.jynx-profile-jynx-badge{
  display:inline-flex; align-items:center; gap:3px; background:var(--jynx); color:#fff; border-radius:10px;
  padding:2px 7px; font-size:10px; font-weight:700;
}
.jynx-profile-inactive{ color:var(--red); font-weight:700; }
.jynx-profile-joined{ display:inline-flex; align-items:center; gap:3px; margin-inline-start:auto; }
.jynx-profile-stats{ display:flex; gap:8px; flex:none; }
.jynx-profile-stat{
  flex:1; display:flex; flex-direction:column; align-items:center; background:var(--panel-raised);
  border:1px solid var(--line); border-radius:10px; padding:8px 0;
}
.jynx-profile-stat b{ font-size:16px; color:var(--jynx); }
.jynx-profile-stat span{ font-size:10px; color:var(--text-dim); text-transform:uppercase; letter-spacing:.03em; }
.jynx-profile-filters{ flex:none; }
.jynx-profile-filters .pill-tab{ padding:6px 12px; font-size:12px; }
.jynx-profile-activity-list{ display:flex; flex-direction:column; gap:8px; overflow-y:auto; min-height:0; }
.jynx-profile-empty{ text-align:center; color:var(--text-dim); font-size:12.5px; padding:20px 0; }
.jynx-profile-activity-item{
  background:var(--panel-raised); border:1px solid var(--line); border-radius:10px; padding:9px 11px;
}
.jynx-profile-activity-head{ display:flex; align-items:center; gap:6px; color:var(--text-dim); flex-wrap:wrap; }
.jynx-profile-activity-type{ font-weight:700; color:var(--jynx); font-size:11px; }
.jynx-profile-jynx-tag{ font-size:9.5px; background:color-mix(in srgb, var(--jynx) 16%, transparent); color:var(--jynx); border-radius:6px; padding:1px 5px; }
.jynx-profile-activity-route{ font-family:var(--font-mono); font-size:10px; text-transform:uppercase; }
.jynx-profile-activity-date{ font-size:10px; margin-inline-start:auto; white-space:nowrap; }
.jynx-profile-activity-text{ margin:6px 0 0; font-size:12.5px; color:var(--text); line-height:1.4; }
.jynx-profile-activity-status{ display:flex; align-items:center; gap:8px; margin-top:6px; font-size:10.5px; }
.jynx-profile-status-done{ display:inline-flex; align-items:center; gap:3px; color:var(--green); font-weight:700; }
.jynx-profile-status-open{ color:var(--text-dim); font-weight:700; }
.jynx-profile-pr-link{ display:inline-flex; align-items:center; gap:3px; color:var(--jynx); text-decoration:none; font-weight:700; }
.jynx-profile-pr-link:hover{ text-decoration:underline; }
`;
