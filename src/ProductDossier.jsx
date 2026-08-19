import React from "react";
import { X, Camera } from "lucide-react";
import PhotoTile from "./PhotoTile.jsx";

/* ================================================================== */
/* LEGO BLOCK — ProductDossier: a presentation-ready equipment record, */
/* meant to be legible when projected in a review/approval forum — not */
/* a quick-glance side panel. Self-contained (own styles) so any screen*/
/* can open it without depending on another component's CSS.           */
/* ================================================================== */

export default function ProductDossier({ item, onClose }) {
  return (
    <div className="overlay" onClick={onClose}>
      <style>{CSS}</style>
      <div className="dossier" onClick={(e) => e.stopPropagation()}>
        <button className="drawer-close" onClick={onClose}><X size={16} /></button>

        <div className="dossier-eyebrow">תעודת זהות ציוד — להצגה בפורום דיון</div>

        <div className="dossier-head">
          <PhotoTile iconKey={item.icon} size={92} iconSize={38} />
          <div className="dossier-head-text">
            <div className="dossier-id">{item.id}</div>
            <h2>{item.name}</h2>
            <div className="dossier-tags">
              <span className="drawer-tag">{item.category}</span>
              <span className="drawer-tag dossier-qty-tag">במלאי: {item.qty}</span>
              {item.photoUploaded && (
                <span className="drawer-tag dossier-photo-tag">
                  <Camera size={12} /> תמונה בתיק
                </span>
              )}
            </div>
          </div>
        </div>

        <p className="dossier-desc">{item.desc}</p>

        <div className="dossier-section-title">קצין אמל״ח אחראי</div>
        <div className="dossier-officer">
          <div className="dossier-officer-row">
            <span className="officer-rank">{item.responsibleRank}</span>
            <span className="officer-name">{item.responsibleName}</span>
          </div>
          <div className="dossier-officer-meta">
            <span>מ.א. {item.responsiblePersonalNumber}</span>
            <a className="drawer-phone" href={`tel:${item.responsiblePhone}`}>{item.responsiblePhone}</a>
          </div>
        </div>

        <div className="dossier-section-title">תהליך ותיעוד</div>
        <div className="dossier-timeline">
          <div className="dossier-timeline-row">
            <span className="dossier-timeline-dot" />
            <div>
              <div className="dossier-timeline-label">נוסף לקטלוג</div>
              <div className="dossier-timeline-meta">{item.addedAt} · {item.addedBy}</div>
            </div>
          </div>
          <div className="dossier-timeline-row">
            <span className="dossier-timeline-dot" />
            <div>
              <div className="dossier-timeline-label">עדכון אחרון</div>
              <div className="dossier-timeline-meta">{item.updatedAt} · {item.updatedBy}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const CSS = `
@keyframes overlayIn{ from{ opacity:0; } to{ opacity:1; } }
@keyframes dossierIn{ from{ opacity:0; transform:translateY(10px) scale(.98); } to{ opacity:1; transform:translateY(0) scale(1); } }

.overlay{
  position:fixed; inset:0; background:rgba(6,8,10,.6); backdrop-filter:blur(2px);
  display:flex; align-items:center; justify-content:center; z-index:300; padding:24px;
  animation:overlayIn .15s ease;
}
.dossier{
  width:640px; max-width:100%; max-height:88vh; overflow-y:auto;
  background:var(--panel); border:1px solid var(--line); border-radius:var(--radius-card); padding:30px 32px;
  position:relative; box-shadow:var(--shadow-md); animation:dossierIn .2s ease;
}
.drawer-close{
  position:absolute; top:16px; left:16px; background:none; border:1px solid transparent;
  color:var(--text-dim); cursor:pointer; border-radius:8px; padding:6px;
  display:flex; transition:color .15s ease, border-color .15s ease;
}
.drawer-close:hover{ color:var(--red); border-color:var(--red); }

.dossier-eyebrow{
  font-family:var(--font-mono); font-size:11px; color:var(--text-dim); text-transform:uppercase;
  letter-spacing:.06em; border-bottom:1px solid var(--line); padding-bottom:12px; margin-bottom:18px;
}
.dossier-head{ display:flex; align-items:flex-start; gap:18px; margin-bottom:16px; }
.dossier-head-text{ flex:1; }
.dossier-id{ font-family:var(--font-mono); color:var(--accent); font-size:13px; }
.dossier-head h2{ font-family:var(--font-sans); font-weight:700; font-size:23px; margin:4px 0 10px; }
.dossier-tags{ display:flex; gap:8px; flex-wrap:wrap; align-items:center; }
.drawer-tag{
  display:inline-flex; align-items:center; gap:5px; font-size:12px; color:var(--text-dim);
  border:1px solid var(--line); border-radius:20px; padding:3px 11px;
}
.drawer-tag svg{ width:12px; height:12px; }
.dossier-qty-tag{ color:var(--green); border-color:var(--green); }
.dossier-photo-tag{ color:var(--accent); border-color:var(--accent); }

.dossier-desc{ font-size:14.5px; color:var(--text); line-height:1.7; margin:0 0 22px; }

.dossier-section-title{
  font-family:var(--font-mono); font-size:11.5px; color:var(--accent); text-transform:uppercase;
  letter-spacing:.06em; margin:0 0 10px;
}
.dossier-officer{
  background:var(--panel-raised); border:1px solid var(--line); border-radius:10px; padding:14px 16px; margin-bottom:22px;
}
.dossier-officer-row{ display:flex; align-items:baseline; gap:8px; }
.officer-rank{ font-family:var(--font-mono); font-size:12.5px; color:var(--text-dim); }
.officer-name{ font-family:var(--font-sans); font-weight:700; font-size:16px; }
.dossier-officer-meta{ display:flex; justify-content:space-between; align-items:center; margin-top:8px; font-size:13px; color:var(--text-dim); font-family:var(--font-mono); }
.drawer-phone{ color:var(--accent); font-family:var(--font-mono); font-size:13px; text-decoration:none; }
.drawer-phone:hover{ text-decoration:underline; }

.dossier-timeline{ display:flex; flex-direction:column; gap:14px; }
.dossier-timeline-row{ display:flex; align-items:flex-start; gap:10px; }
.dossier-timeline-dot{ width:8px; height:8px; border-radius:50%; background:var(--accent); margin-top:5px; flex:none; }
.dossier-timeline-label{ font-family:var(--font-sans); font-weight:600; font-size:13.5px; }
.dossier-timeline-meta{ font-size:12.5px; color:var(--text-dim); font-family:var(--font-mono); margin-top:2px; }
`;
