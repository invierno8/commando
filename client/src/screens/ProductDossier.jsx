import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  X, Camera, Images, ZoomIn, Pencil, Trash2, Check, Ban, Wrench, PackagePlus, AlertTriangle,
  Building2, UserRound, FolderOpen, ArrowUpRight, Link2, Sparkles, Heart, Save,
} from "lucide-react";
import PhotoTile from "../components/PhotoTile.jsx";
import MediaGallery from "../components/MediaGallery.jsx";
import MediaEditor from "../components/MediaEditor.jsx";
import { StatusPill, TICKET_TYPE_LABELS, CATALOG_ORIGINS, CATALOG_ORIGIN_LABELS } from "../opsData.jsx";
import { fetchDraft, saveDraft, clearDraft } from "../api-client/draftStore.js";

/* ================================================================== */
/* LEGO BLOCK — ProductDossier: a presentation-ready equipment record, */
/* meant to be legible when projected in a review/approval forum — not */
/* a quick-glance side panel. Self-contained (own styles) so any screen*/
/* can open it without depending on another component's CSS.           */
/*                                                                      */
/* Editing is opt-in via `canEdit`/`onSave`/`onDelete` — the caller     */
/* (Catalog.jsx) decides who gets those based on role + unit ownership; */
/* this component itself has no permission logic, only presentation.   */
/* `availableUnits`, when given, lets an editor reassign the item's     */
/* owning unit (brigade officers only — unit officers never get this    */
/* prop, so the unit renders as a fixed tag for them, per Catalog.jsx). */
/* `canEditOrigin` is a SEPARATE, narrower right than `canEdit`: only    */
/* system admins may set the מקור/אחריות tag (מחט״ל/תעשייה/ייצור פנים),  */
/* so the two flags can differ — a unit/brigade officer can have         */
/* `canEdit` without `canEditOrigin` (sees the origin tag read-only even */
/* while editing everything else), and a system admin reaching a item    */
/* via DevDashboard's equipment carousel can have `canEditOrigin`        */
/* without `canEdit` (only the origin section unlocks). The edit-mode    */
/* toggle itself shows whenever either flag is true.                    */
/* ================================================================== */

function nowStamp() {
  const d = new Date();
  return d.toLocaleDateString("he-IL") + " " + d.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
}

// מחיקת פריט קטלוג — אישור דו-שלבי, לא לחיצה בודדת (window.confirm), כמו כל
// פעולה הרסנית אחרת במערכת (ראו TeamDeleteConfirmModal ב-PermissionsDashboard.jsx) —
// משוכפל כאן במקום ייבוא, כי כל קובץ מסך כאן עצמאי (ראו התיעוד בראש הקובץ).
function DeleteItemControl({ itemName, onConfirm }) {
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return (
      <button type="button" className="dossier-btn dossier-btn-danger" onClick={() => setConfirming(true)}>
        <Trash2 size={13} /> מחיקה
      </button>
    );
  }
  return (
    <div className="dossier-delete-confirm" onClick={(e) => e.stopPropagation()}>
      <span><AlertTriangle size={13} /> למחוק את "{itemName}" מהקטלוג? הפעולה אינה הפיכה.</span>
      <div className="dossier-delete-confirm-actions">
        <button type="button" className="dossier-btn dossier-btn-ghost" onClick={() => setConfirming(false)}>ביטול</button>
        <button type="button" className="dossier-btn dossier-btn-danger" onClick={onConfirm}><Trash2 size={13} /> אישור מחיקה</button>
      </div>
    </div>
  );
}

export default function ProductDossier({
  item, onClose, canEdit, canEditOrigin, onSave, onDelete, availableUnits, isNew, onReopen,
  categories, linkedTickets, relatedItems, onRequestTicket, onSelectRelated, onViewTicket,
  onToggleInterest, currentActor, draftUserId,
}) {
  const [galleryIndex, setGalleryIndex] = useState(null);
  const [editing, setEditing] = useState(!!isNew);
  const [draft, setDraft] = useState(isNew ? { ...item, media: item.media || [] } : null);
  const [reopening, setReopening] = useState(false);
  const [reopenName, setReopenName] = useState(item.name);
  const [reopenDesc, setReopenDesc] = useState(item.desc);
  const [attempted, setAttempted] = useState(false);

  // טיוטת "פריט חדש" — רק שדות טקסט/מטא-דאטה נשמרים (לא media: תמונות
  // מקודדות ל-base64 עלולות לחרוג ממכסת localStorage בקלות, ואת המדיה
  // ממילא סביר להעלות מחדש כשחוזרים לטיוטה). אותו רעיון בדיוק כמו טיוטת
  // דרישה ב-Tickets.jsx — DamatzBotModal — משוכפל כי כל מסך כאן עצמאי.
  const [savedDraft, setSavedDraft] = useState(undefined);
  const [draftResolved, setDraftResolved] = useState(!isNew || !draftUserId);
  useEffect(() => {
    if (!isNew || !draftUserId) return;
    let cancelled = false;
    fetchDraft(draftUserId, "catalogItem").then((d) => { if (!cancelled) setSavedDraft(d); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  function resumeDraft() {
    const d = savedDraft.data;
    setDraft((p) => ({ ...p, ...d }));
    setDraftResolved(true);
  }
  function discardDraft() {
    clearDraft(draftUserId, "catalogItem");
    setDraftResolved(true);
  }
  useEffect(() => {
    if (!isNew || !draftUserId || !draft) return;
    if (!draftResolved && savedDraft !== null) return;
    const t = setTimeout(() => {
      saveDraft(draftUserId, "catalogItem", {
        name: draft.name, category: draft.category, qty: draft.qty, desc: draft.desc,
        notes: draft.notes, equipInstructions: draft.equipInstructions,
      });
    }, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew, draftUserId, draftResolved, savedDraft, draft?.name, draft?.category, draft?.qty, draft?.desc, draft?.notes, draft?.equipInstructions]);

  const view = editing && draft ? draft : item;
  const media = view.media || [];
  const hasMedia = media.length > 0;
  const missing = editing && draft ? { name: !draft.name.trim(), desc: !draft.desc.trim(), category: !draft.category.trim() } : {};
  const canSave = editing && !missing.name && !missing.desc && !missing.category;
  function errClass(key) { return attempted && missing[key] ? " field-error" : ""; }
  const categoryOptions = categories?.includes(view.category) || !view.category ? categories : [...(categories || []), view.category];
  const repairCount = (linkedTickets || []).filter((t) => t.type === "repair").length;
  const interestedList = view.interested || [];
  const interestedCount = interestedList.length;
  const isInterested = !!currentActor && interestedList.some((p) => p.name === currentActor);
  const interestedNames = interestedList.map((p) => p.name).join(", ");

  function startEdit() {
    setDraft({ ...item, media: item.media || [] });
    setEditing(true);
  }
  function cancelEdit() {
    if (isNew) { onClose(); return; }
    setEditing(false);
    setDraft(null);
  }
  function save() {
    if (!canSave) { setAttempted(true); return; }
    if (isNew && draftUserId) clearDraft(draftUserId, "catalogItem");
    onSave({ ...draft, qty: Math.max(0, Number(draft.qty) || 0), updatedAt: nowStamp(), updatedBy: currentActor || "משתמש (הדגמה)" });
    setEditing(false);
    setDraft(null);
    setAttempted(false);
  }
  function patch(field, value) {
    setDraft((p) => ({ ...p, [field]: value }));
  }
  function patchNested(field, subfield, value) {
    setDraft((p) => ({ ...p, [field]: { ...(p[field] || {}), [subfield]: value } }));
  }
  function setOrigin(origin) {
    setDraft((p) => ({ ...p, origin }));
  }
  function addProductFile(e) {
    const files = Array.from(e.target.files || []).map((f) => f.name);
    if (files.length === 0) return;
    setDraft((p) => ({ ...p, productFiles: [...(p.productFiles || []), ...files] }));
  }
  function removeProductFile(idx) {
    setDraft((p) => ({ ...p, productFiles: p.productFiles.filter((_, i) => i !== idx) }));
  }

  return createPortal(
    <div className="overlay" onClick={onClose}>
      <style>{CSS}</style>
      <div className={"dossier" + (!draftResolved && savedDraft ? " dossier-draft-pending" : "")} onClick={(e) => e.stopPropagation()}>
        <button className="drawer-close" onClick={onClose}><X size={16} /></button>

        {!draftResolved && savedDraft && (
          <div className="draft-resume-banner">
            <Save size={16} />
            <div className="draft-resume-text">
              <b>נמצאה טיוטה שמורה</b>
              <span>מ-{new Date(savedDraft.savedAt).toLocaleString("he-IL")} — להמשיך למלא אותה?</span>
            </div>
            <div className="draft-resume-actions">
              <button type="button" className="dossier-btn dossier-btn-ghost" onClick={discardDraft}>התחלה חדשה</button>
              <button type="button" className="dossier-btn dossier-btn-primary" onClick={resumeDraft}>המשך טיוטה</button>
            </div>
          </div>
        )}

        <div className="dossier-toprow">
          <div className="dossier-eyebrow">{isNew ? "פריט חדש בקטלוג — מילוי פרטים" : "תעודת זהות ציוד — להצגה בפורום דיון"}</div>
          <div className="dossier-toprow-right">
            {view.origin && (
              <span className={"origin-tag-wrap" + (view.origin === CATALOG_ORIGINS.IN_HOUSE ? " origin-glow" : "")}>
                <span className={"origin-tag-shape origin-" + view.origin}>
                  {view.origin === CATALOG_ORIGINS.IN_HOUSE && <Sparkles size={12} />}
                  {CATALOG_ORIGIN_LABELS[view.origin]}
                </span>
              </span>
            )}
            {(canEdit || canEditOrigin) && (
              <div className="dossier-edit-actions">
                {editing ? (
                  <>
                    {onDelete && (
                      <DeleteItemControl itemName={item.name} onConfirm={() => { onDelete(item.id); onClose(); }} />
                    )}
                    <button type="button" className="dossier-btn dossier-btn-ghost" onClick={cancelEdit}>
                      <Ban size={13} /> ביטול
                    </button>
                    <button type="button" className={"dossier-btn dossier-btn-primary" + (!canSave ? " dossier-btn-pending" : "")} onClick={save}>
                      <Check size={13} /> שמירה
                    </button>
                  </>
                ) : (
                  <button type="button" className="dossier-btn dossier-btn-primary" onClick={startEdit}>
                    <Pencil size={13} /> עריכת פריט
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="dossier-head">
          <button
            type="button"
            className={"dossier-photo-btn" + (hasMedia ? "" : " no-media")}
            onClick={hasMedia ? () => setGalleryIndex(0) : undefined}
            title={hasMedia ? (media.length > 1 ? "צפייה בגלריית התמונות" : "הגדלת התמונה") : undefined}
          >
            {hasMedia && media[0].type === "image" ? (
              <img src={media[0].url} alt="" className="dossier-photo-thumb" />
            ) : hasMedia ? (
              <img src={media[0].poster} alt="" className="dossier-photo-thumb" />
            ) : (
              <PhotoTile iconKey={item.icon} size={120} iconSize={46} />
            )}
            {hasMedia && (
              <span className="dossier-photo-overlay">
                {media.length > 1 ? <Images size={18} /> : <ZoomIn size={18} />}
              </span>
            )}
          </button>
          <div className="dossier-head-text">
            <div className="dossier-id">{item.id}</div>
            {editing && canEdit ? (
              <>
                <input className={"dossier-name-input" + errClass("name")} value={draft.name} onChange={(e) => patch("name", e.target.value)} placeholder="שם הפריט" />
                {attempted && missing.name && <span className="field-error-msg">שדה חובה</span>}
              </>
            ) : (
              <h2>{view.name}</h2>
            )}
            <div className="dossier-tags">
              {editing && canEdit ? (
                <>
                  <select className={"dossier-tag-select" + errClass("category")} value={draft.category} onChange={(e) => patch("category", e.target.value)}>
                    <option value="" disabled>בחר/י קטגוריה</option>
                    {(categoryOptions || []).map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  {attempted && missing.category && <span className="field-error-msg">יש לבחור קטגוריה</span>}
                  <label className="dossier-qty-edit">
                    <span>במלאי</span>
                    <input type="number" min="0" value={draft.qty} onChange={(e) => patch("qty", e.target.value)} />
                  </label>
                  {availableUnits?.length > 0 ? (
                    <select className="dossier-unit-select" value={draft.unit} onChange={(e) => patch("unit", e.target.value)}>
                      {availableUnits.map((u) => <option key={u} value={u}>{u}</option>)}
                    </select>
                  ) : (
                    <span className="drawer-tag dossier-unit-tag">{item.unit}</span>
                  )}
                </>
              ) : (
                <>
                  <span className="drawer-tag">{view.category}</span>
                  <span className="drawer-tag dossier-unit-tag">{view.unit}</span>
                  <span className="drawer-tag dossier-qty-tag">במלאי: {view.qty}</span>
                  {hasMedia && (
                    <button type="button" className="drawer-tag dossier-photo-tag" onClick={() => setGalleryIndex(0)}>
                      <Camera size={12} />
                      {media.length > 1 ? `${media.length} קבצי מדיה בתיק` : "תמונה בתיק"}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {editing && canEdit ? (
          <>
            <textarea className={"dossier-desc-input" + errClass("desc")} value={draft.desc} onChange={(e) => patch("desc", e.target.value)} rows={3} placeholder="תיאור הפריט" />
            {attempted && missing.desc && <span className="field-error-msg">שדה חובה</span>}
          </>
        ) : (
          <p className="dossier-desc">{view.desc}</p>
        )}

        {editing && canEdit && (
          <>
            <div className="dossier-section-title">תמונות וסרטונים</div>
            <MediaEditor media={draft.media} onChange={(m) => patch("media", m)} />
          </>
        )}

        <div className="dossier-grid">
          <div>
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
          </div>

          <div>
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

        <div className="dossier-section-title">פרטי מקור ואחריות</div>
        {editing && canEditOrigin ? (
          <div className="dossier-origin-edit">
            <div className="origin-pick-row">
              {Object.values(CATALOG_ORIGINS).map((o) => (
                <button
                  type="button"
                  key={o}
                  className={"origin-pick" + (draft.origin === o ? " active" : "")}
                  onClick={() => setOrigin(draft.origin === o ? null : o)}
                >
                  {CATALOG_ORIGIN_LABELS[o]}
                </button>
              ))}
            </div>
            {draft.origin === CATALOG_ORIGINS.MATAL && (
              <div className="origin-fields">
                <input placeholder="דרגה" value={draft.originContact?.rank || ""} onChange={(e) => patchNested("originContact", "rank", e.target.value)} className="origin-field-sm" />
                <input placeholder="שם איש קשר במחט״ל" value={draft.originContact?.name || ""} onChange={(e) => patchNested("originContact", "name", e.target.value)} />
                <input placeholder="טלפון" value={draft.originContact?.phone || ""} onChange={(e) => patchNested("originContact", "phone", e.target.value)} className="origin-field-sm" />
              </div>
            )}
            {draft.origin === CATALOG_ORIGINS.INDUSTRY && (
              <div className="origin-fields">
                <input placeholder="שם החברה היצרנית" value={draft.originCompany || ""} onChange={(e) => patch("originCompany", e.target.value)} />
              </div>
            )}
            {draft.origin === CATALOG_ORIGINS.IN_HOUSE && (
              <div className="origin-fields origin-fields-column">
                <div className="origin-fields">
                  <input placeholder="דרגה" value={draft.developmentLead?.rank || ""} onChange={(e) => patchNested("developmentLead", "rank", e.target.value)} className="origin-field-sm" />
                  <input placeholder="אחראי פיתוח ביחידה" value={draft.developmentLead?.name || ""} onChange={(e) => patchNested("developmentLead", "name", e.target.value)} />
                </div>
                <div className="dossier-file-list">
                  {(draft.productFiles || []).map((f, idx) => (
                    <span className="dossier-file-chip" key={idx}>
                      <FolderOpen size={12} /> {f}
                      <button type="button" onClick={() => removeProductFile(idx)}><X size={11} /></button>
                    </span>
                  ))}
                </div>
                <label className="media-editor-add">
                  <FolderOpen size={13} /> הוספת תיק/קבצי מוצר
                  <input type="file" multiple style={{ display: "none" }} onChange={addProductFile} />
                </label>
              </div>
            )}
          </div>
        ) : !view.origin ? (
          <div className="dossier-origin-empty">
            מקור הפריט לא הוגדר עדיין{canEditOrigin ? "" : " — ניתן לעדכון על ידי מנהל מערכת בלבד"}.
          </div>
        ) : (
          <div className="dossier-origin-view">
            {view.origin === CATALOG_ORIGINS.MATAL && view.originContact && (
              <span className="dossier-origin-detail">
                <UserRound size={13} />
                {view.originContact.rank} {view.originContact.name}
                {view.originContact.phone && <a className="drawer-phone" href={`tel:${view.originContact.phone}`}>{view.originContact.phone}</a>}
              </span>
            )}
            {view.origin === CATALOG_ORIGINS.INDUSTRY && view.originCompany && (
              <span className="dossier-origin-detail"><Building2 size={13} /> {view.originCompany}</span>
            )}
            {view.origin === CATALOG_ORIGINS.IN_HOUSE && (
              <span className="dossier-origin-detail">
                {view.developmentLead && <><UserRound size={13} /> אחראי פיתוח: {view.developmentLead.rank} {view.developmentLead.name}</>}
                {view.productFiles?.length > 0 && (
                  <span className="dossier-file-list dossier-file-list-inline">
                    {view.productFiles.map((f) => (
                      <span className="dossier-file-chip" key={f}><FolderOpen size={12} /> {f}</span>
                    ))}
                  </span>
                )}
              </span>
            )}
          </div>
        )}

        <div className="dossier-section-title equip-path-title"><PackagePlus size={14} /> מסלול הצטיידות</div>
        {editing && canEdit ? (
          <textarea
            className="dossier-notes-input"
            value={draft.equipInstructions || ""}
            onChange={(e) => patch("equipInstructions", e.target.value)}
            rows={2}
            placeholder="איך מצטיידים בפריט הזה בפועל? (נכתב על ידי הקצין שמאשר את הפריט)"
          />
        ) : view.equipInstructions ? (
          <p className="equip-path-text">{view.equipInstructions}</p>
        ) : (
          <div className="dossier-origin-empty">מסלול ההצטיידות טרם תועד לפריט זה.</div>
        )}

        <div className="dossier-section-title">הערות</div>
        {editing && canEdit ? (
          <textarea
            className="dossier-notes-input"
            value={draft.notes || ""}
            onChange={(e) => patch("notes", e.target.value)}
            rows={2}
            placeholder="הערות חופשיות על הפריט — גלויות לכל מי שצופה בתעודת הזהות"
          />
        ) : view.notes ? (
          <p className="dossier-notes">{view.notes}</p>
        ) : (
          <div className="dossier-origin-empty">אין עדיין הערות לפריט זה.</div>
        )}

        {item.status === "rejected" && (
          <div className="rejected-panel">
            <div className="dossier-section-title">סיבת הסירוב</div>
            <p className="rejected-reason">{item.rejectionReason || "לא צויין נימוק."}</p>
            {canEdit && onReopen && (
              reopening ? (
                <div className="reopen-form">
                  <input className="reopen-title-input" value={reopenName} onChange={(e) => setReopenName(e.target.value)} placeholder="שם הפריט" />
                  <textarea rows={3} value={reopenDesc} onChange={(e) => setReopenDesc(e.target.value)} placeholder="תיאור" />
                  <div className="reopen-form-actions">
                    <button type="button" className="dossier-btn dossier-btn-ghost" onClick={() => setReopening(false)}>ביטול</button>
                    <button
                      type="button"
                      className="dossier-btn dossier-btn-primary"
                      disabled={!reopenName.trim() || !reopenDesc.trim()}
                      onClick={() => { onReopen(item.id, { name: reopenName.trim(), desc: reopenDesc.trim() }); setReopening(false); }}
                    >
                      שליחה מחדש
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" className="reopen-btn" onClick={() => setReopening(true)}>
                  <Pencil size={13} /> עריכה ופתיחה מחדש
                </button>
              )
            )}
          </div>
        )}

        {!editing && (onRequestTicket || onToggleInterest) && (
          <div className="dossier-quick-actions">
            {onRequestTicket && (
              <>
                <button type="button" className="dossier-quick-btn" onClick={() => onRequestTicket("repair")}>
                  <Wrench size={14} /> דיווח תקלה
                </button>
                <button type="button" className="dossier-quick-btn" onClick={() => onRequestTicket("equip")}>
                  <PackagePlus size={14} /> בקשת הצטיידות נוספת
                </button>
              </>
            )}
            {onToggleInterest && (
              <button
                type="button"
                className={"dossier-quick-btn dossier-interest-btn" + (isInterested ? " active" : "")}
                onClick={onToggleInterest}
                title={interestedNames || undefined}
              >
                <Heart size={14} />
                {isInterested ? "מעוניין/ת" : "גם אני מעוניין/ת"}
                {interestedCount > 0 && <span className="dossier-interest-count">{interestedCount}</span>}
              </button>
            )}
          </div>
        )}

        {!editing && repairCount >= 2 && (
          <div className="dossier-insight">
            <AlertTriangle size={15} />
            פריט זה דווח כתקול {repairCount} פעמים — ייתכן ששווה לשקול בדיקה יסודית או החלפה.
          </div>
        )}

        {!editing && linkedTickets?.length > 0 && (
          <>
            <div className="dossier-section-title">דרישות הקשורות למוצר זה</div>
            <div className="dossier-linked-tickets">
              {linkedTickets.map((t) => (
                <button type="button" className="dossier-linked-ticket" key={t.id} onClick={() => onViewTicket && onViewTicket(t.id)}>
                  <span className="linked-ticket-main">
                    <span className="ticket-id">{t.id}</span>
                    <span className="linked-ticket-title">{t.title}</span>
                  </span>
                  <span className="linked-ticket-meta">
                    {t.type && <span className="pill pill-neutral">{TICKET_TYPE_LABELS[t.type]}</span>}
                    <StatusPill status={t.status} />
                  </span>
                </button>
              ))}
            </div>
          </>
        )}

        {!editing && relatedItems?.length > 0 && (
          <>
            <div className="dossier-section-title">פריטים דומים באותה קטגוריה</div>
            <div className="dossier-related">
              {relatedItems.map((r) => (
                <button type="button" className="dossier-related-chip" key={r.id} onClick={() => onSelectRelated && onSelectRelated(r)}>
                  <Link2 size={12} /> {r.name}
                  <ArrowUpRight size={11} />
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {galleryIndex !== null && hasMedia && (
        <MediaGallery media={media} startIndex={galleryIndex} onClose={() => setGalleryIndex(null)} />
      )}
    </div>,
    document.body
  );
}

const CSS = `
@keyframes overlayIn{ from{ opacity:0; } to{ opacity:1; } }
@keyframes dossierIn{ from{ opacity:0; transform:translateY(10px) scale(.98); } to{ opacity:1; transform:translateY(0) scale(1); } }

.overlay{
  position:fixed; inset:0; background:rgba(6,8,10,.6); backdrop-filter:blur(2px);
  display:flex; align-items:center; justify-content:center; z-index:300; padding:24px;
  animation:overlayIn var(--t-fast) ease;
}
.dossier{
  width:900px; max-width:100%; max-height:90vh; overflow-y:auto;
  background:var(--brk),var(--panel); border:1px solid var(--line); border-radius:var(--radius-card); padding:32px 36px 36px;
  position:relative; box-shadow:var(--shadow-md); animation:dossierIn var(--t-base) ease;
}
.drawer-close{
  position:absolute; top:16px; left:16px; background:none; border:1px solid transparent;
  color:var(--text-dim); cursor:pointer; border-radius:var(--radius-md); padding:6px;
  display:flex; transition:color var(--t-fast) ease, border-color var(--t-fast) ease; z-index:1;
}
.drawer-close:hover{ color:var(--red); border-color:var(--red); }

.dossier-toprow{ display:flex; align-items:center; justify-content:space-between; gap:14px; border-bottom:1px solid var(--line); padding-bottom:12px; margin-bottom:20px; padding-inline-end:36px; }
.dossier-toprow-right{ display:flex; align-items:center; gap:12px; flex-wrap:wrap; }
.dossier-eyebrow{
  font-family:var(--font-mono); font-size:11px; color:var(--text-dim); text-transform:uppercase;
  letter-spacing:.06em;
}
.dossier-edit-actions{ display:flex; gap:8px; flex-wrap:wrap; }
.dossier-btn{
  display:inline-flex; align-items:center; gap:6px; border-radius:var(--radius-md); padding:7px 13px; font-size:12.5px;
  font-weight:700; font-family:var(--font-sans); cursor:pointer; border:1px solid var(--line); background:var(--panel-raised);
  color:var(--text); transition:filter var(--t-fast) ease, border-color var(--t-fast) ease, background var(--t-fast) ease;
}
.dossier-btn-primary{ background:var(--accent); color:var(--accent-ink); border-color:var(--accent); }
.dossier-btn-primary:not(:disabled):hover{ filter:brightness(1.08); }
.dossier-btn-primary:disabled{ opacity:.4; cursor:not-allowed; }
.dossier-btn-ghost:hover{ border-color:var(--text-dim); }
.dossier-btn-danger{ background:none; border-color:var(--red); color:var(--red); }
.dossier-btn-danger:hover{ background:color-mix(in srgb, var(--red) 12%, transparent); }
.dossier-delete-confirm{
  display:flex; flex-direction:column; gap:8px; background:var(--bg); border:1px solid var(--red);
  border-radius:var(--radius-md); padding:9px 11px; animation:dossierIn var(--t-fast) ease; max-width:280px;
}
.dossier-delete-confirm span{ display:flex; align-items:flex-start; gap:6px; font-size:12px; color:var(--text); line-height:1.4; }
.dossier-delete-confirm-actions{ display:flex; justify-content:flex-end; gap:8px; }

.dossier-head{ display:flex; align-items:flex-start; gap:22px; margin-bottom:18px; }
.dossier-head-text{ flex:1; min-width:0; }
.dossier-id{ font-family:var(--font-mono); color:var(--accent); font-size:13px; }
.dossier-head h2{ font-family:var(--font-sans); font-weight:700; font-size:25px; margin:4px 0 12px; }
.dossier-name-input{
  display:block; width:100%; font-family:var(--font-sans); font-weight:700; font-size:22px; margin:5px 0 12px;
  background:var(--bg); border:1px solid var(--accent); border-radius:var(--radius-md); padding:7px 10px; color:var(--text);
}
.dossier-tags{ display:flex; gap:8px; flex-wrap:wrap; align-items:center; }
.drawer-tag{
  display:inline-flex; align-items:center; gap:5px; font-size:12px; color:var(--text-dim);
  border:1px solid var(--line); border-radius:var(--radius-lg); padding:3px 11px; font-family:var(--font-sans);
  background:none; cursor:default;
}
.drawer-tag svg{ width:12px; height:12px; }
.dossier-unit-tag{ color:var(--text); border-color:var(--line); background:var(--panel-raised); font-weight:600; }
.dossier-qty-tag{ color:var(--green); border-color:var(--green); }
.dossier-photo-tag{ color:var(--accent); border-color:var(--accent); cursor:pointer; transition:background var(--t-fast) ease; }
.dossier-photo-tag:hover{ background:color-mix(in srgb, var(--accent) 12%, transparent); }
.dossier-tag-input, .dossier-tag-select{
  background:var(--bg); border:1px solid var(--line); border-radius:var(--radius-lg); padding:5px 13px; font-size:12.5px;
  color:var(--text); font-family:var(--font-sans); width:130px;
}
.dossier-tag-select{ cursor:pointer; }
.dossier-qty-edit{ display:flex; align-items:center; gap:6px; font-size:12px; color:var(--text-dim); }
.dossier-qty-edit input{
  width:64px; background:var(--bg); border:1px solid var(--line); border-radius:var(--radius-lg); padding:5px 11px;
  color:var(--text); font-family:var(--font-mono); font-size:12.5px;
}
.dossier-unit-select{
  background:var(--bg); border:1px solid var(--line); border-radius:var(--radius-lg); padding:5px 13px; font-size:12.5px;
  color:var(--text); font-family:var(--font-sans); cursor:pointer;
}

.dossier-photo-btn{
  position:relative; flex:none; width:120px; height:120px; border-radius:var(--radius-card); overflow:hidden;
  border:1px solid var(--line); padding:0; background:none; cursor:pointer;
  transition:border-color var(--t-fast) ease, box-shadow var(--t-fast) ease;
}
.dossier-photo-btn:not(.no-media):hover{ border-color:var(--accent); box-shadow:var(--shadow-sm); }
.dossier-photo-btn.no-media{ cursor:default; }
.dossier-photo-thumb{ width:100%; height:100%; object-fit:cover; display:block; }
.dossier-photo-overlay{
  position:absolute; inset:0; display:flex; align-items:center; justify-content:center;
  background:rgba(6,8,10,0); color:#fff; opacity:0; transition:opacity var(--t-fast) ease, background var(--t-fast) ease;
}
.dossier-photo-btn:hover .dossier-photo-overlay{ opacity:1; background:rgba(6,8,10,.42); }

.dossier-desc{ font-size:14.5px; color:var(--text); line-height:1.7; margin:0 0 24px; }
.dossier-desc-input{
  width:100%; font-size:14px; color:var(--text); line-height:1.6; margin:0 0 24px; font-family:var(--font-sans);
  background:var(--bg); border:1px solid var(--line); border-radius:var(--radius-lg); padding:11px 13px; resize:vertical;
}
.dossier-desc-input:focus, .dossier-name-input:focus, .dossier-tag-input:focus, .dossier-qty-edit input:focus{
  outline:none; border-color:var(--accent); box-shadow:0 0 0 3px color-mix(in srgb, var(--accent) 16%, transparent);
}

/* מסומן אדום רק אחרי ניסיון שמירה כושל — לא בטופס נקי. הכפתור עצמו תמיד    */
/* לחיץ (לא disabled) כדי שהלחיצה תוכל לחשוף מה חסר במקום פשוט לא לקרות.   */
.field-error{ border-color:var(--red) !important; box-shadow:0 0 0 2px color-mix(in srgb, var(--red) 14%, transparent) !important; }
.field-error-msg{ display:block; font-size:11.5px; color:var(--red); font-weight:600; margin-top:4px; }
.dossier-btn-pending{ opacity:.55; }

.draft-resume-banner{
  display:flex; align-items:center; gap:12px; background:color-mix(in srgb, var(--accent) 8%, transparent);
  border:1px solid var(--accent); border-radius:var(--radius-lg); padding:12px 14px; margin-bottom:18px;
}
.draft-resume-banner svg{ color:var(--accent); flex:none; }
.draft-resume-text{ display:flex; flex-direction:column; gap:2px; flex:1; font-size:12.5px; color:var(--text); }
.draft-resume-text b{ font-size:13.5px; }
.draft-resume-text span{ color:var(--text-dim); font-size:11.5px; }
.draft-resume-actions{ display:flex; gap:8px; flex:none; }
.dossier-draft-pending > *:not(.draft-resume-banner):not(.drawer-close){ opacity:.35; pointer-events:none; filter:blur(1px); }

.equip-path-title{ display:flex; align-items:center; gap:7px; }
.equip-path-title svg{ color:var(--accent); }
.equip-path-text{
  font-size:13.5px; color:var(--text); line-height:1.6; margin:0 0 22px; background:var(--bg);
  border-inline-start:3px solid var(--accent); border-radius:var(--radius-md); padding:10px 13px;
}
.dossier-notes{ font-size:13.5px; color:var(--text-dim); line-height:1.6; margin:0 0 22px; font-style:italic; }
.dossier-notes-input{
  width:100%; font-size:13.5px; color:var(--text); line-height:1.6; margin:0 0 22px; font-family:var(--font-sans);
  background:var(--bg); border:1px solid var(--line); border-radius:var(--radius-lg); padding:10px 12px; resize:vertical;
}
.dossier-notes-input:focus{ outline:none; border-color:var(--accent); box-shadow:0 0 0 3px color-mix(in srgb, var(--accent) 16%, transparent); }

.rejected-panel{ margin-bottom:22px; padding:14px; border:1px dashed var(--red); border-radius:var(--radius-lg); background:color-mix(in srgb, var(--red) 4%, transparent); }
.rejected-panel .dossier-section-title{ margin-top:0; }
.rejected-reason{ font-size:13px; color:var(--text); line-height:1.6; margin:0 0 10px; }
.reopen-btn{
  display:inline-flex; align-items:center; gap:6px; background:none; border:1px solid var(--accent); color:var(--accent);
  border-radius:var(--radius-md); padding:7px 13px; font-size:12.5px; font-weight:700; cursor:pointer; font-family:var(--font-sans);
  transition:background var(--t-fast) ease;
}
.reopen-btn:hover{ background:color-mix(in srgb, var(--accent) 10%, transparent); }
.reopen-form{ display:flex; flex-direction:column; gap:8px; }
.reopen-title-input, .reopen-form textarea{
  width:100%; background:var(--panel); border:1px solid var(--line); border-radius:var(--radius-md); padding:8px 10px;
  font-size:13px; color:var(--text); font-family:var(--font-sans);
}
.reopen-title-input:focus, .reopen-form textarea:focus{ outline:none; border-color:var(--accent); }
.reopen-form-actions{ display:flex; justify-content:flex-end; gap:8px; }

.dossier-section-title{
  font-family:var(--font-mono); font-size:11.5px; color:var(--accent); text-transform:uppercase;
  letter-spacing:.06em; margin:0 0 10px;
}

.media-editor{ margin-bottom:24px; }
.media-editor-list{ display:flex; flex-direction:column; gap:8px; margin-bottom:10px; }
.media-editor-item{
  display:flex; align-items:center; gap:10px; background:var(--panel-raised); border:1px solid var(--line);
  border-radius:var(--radius-md); padding:7px 9px;
}
.media-editor-thumb{
  position:relative; width:44px; height:34px; border-radius:var(--radius-md); overflow:hidden; flex:none; background:var(--bg);
  border:1px solid var(--line); display:flex; align-items:center; justify-content:center; color:var(--text-dim);
}
.media-editor-thumb img{ width:100%; height:100%; object-fit:cover; }
.media-editor-thumb-play{
  position:absolute; inset:0; display:flex; align-items:center; justify-content:center;
  background:rgba(0,0,0,.3); color:#fff;
}
.media-editor-caption{
  flex:1; min-width:0; background:var(--bg); border:1px solid var(--line); border-radius:var(--radius-md); padding:7px 10px;
  font-size:12.5px; color:var(--text); font-family:var(--font-sans);
}
.media-editor-caption:focus{ outline:none; border-color:var(--accent); }
.media-editor-remove{
  flex:none; background:none; border:1px solid transparent; color:var(--text-dim); border-radius:var(--radius-md); padding:6px;
  cursor:pointer; display:flex; transition:color var(--t-fast) ease, border-color var(--t-fast) ease;
}
.media-editor-remove:hover{ color:var(--red); border-color:var(--red); }
.media-editor-main-btn{
  flex:none; background:none; border:1px solid transparent; color:var(--text-dim); border-radius:var(--radius-md); padding:6px;
  cursor:pointer; display:flex; transition:color var(--t-fast) ease, border-color var(--t-fast) ease;
}
.media-editor-main-btn:hover:not(:disabled){ color:var(--yellow); border-color:var(--yellow); }
.media-editor-main-btn.active{ color:var(--yellow); cursor:default; }
.media-editor-main-btn.active svg{ fill:var(--yellow); }
.media-editor-main-btn:disabled{ cursor:default; }
.media-editor-actions{ display:flex; gap:8px; }
.media-editor-add{
  display:inline-flex; align-items:center; gap:6px; background:var(--panel-raised); border:1px dashed var(--line);
  border-radius:var(--radius-md); padding:8px 13px; font-size:12.5px; font-weight:600; color:var(--text-dim); cursor:pointer;
  font-family:var(--font-sans); transition:border-color var(--t-fast) ease, color var(--t-fast) ease;
}
.media-editor-add:hover{ border-color:var(--accent); color:var(--accent); }

.dossier-grid{ display:grid; grid-template-columns:1fr 1fr; gap:22px; }
.dossier-officer{
  background:var(--panel-raised); border:1px solid var(--line); border-radius:var(--radius-lg); padding:14px 16px; height:100%;
  box-sizing:border-box;
}
.dossier-officer-row{ display:flex; align-items:baseline; gap:8px; }
.officer-rank{ font-family:var(--font-mono); font-size:12.5px; color:var(--text-dim); }
.officer-name{ font-family:var(--font-sans); font-weight:700; font-size:16px; }
.dossier-officer-meta{ display:flex; justify-content:space-between; align-items:center; margin-top:8px; font-size:13px; color:var(--text-dim); font-family:var(--font-mono); }
.drawer-phone{ color:var(--accent); font-family:var(--font-mono); font-size:13px; text-decoration:none; }
.drawer-phone:hover{ text-decoration:underline; }

.dossier-timeline{
  display:flex; flex-direction:column; gap:14px; background:var(--panel-raised); border:1px solid var(--line);
  border-radius:var(--radius-lg); padding:14px 16px; height:100%; box-sizing:border-box; justify-content:center;
}
.dossier-timeline-row{ display:flex; align-items:flex-start; gap:10px; }
.dossier-timeline-dot{ width:8px; height:8px; border-radius:50%; background:var(--accent); margin-top:5px; flex:none; }
.dossier-timeline-label{ font-family:var(--font-sans); font-weight:600; font-size:13.5px; }
.dossier-timeline-meta{ font-size:12.5px; color:var(--text-dim); font-family:var(--font-mono); margin-top:2px; }

.dossier-origin-empty{ color:var(--text-dim); font-size:13px; margin-bottom:22px; }
.dossier-origin-view{ display:flex; align-items:center; gap:14px; flex-wrap:wrap; margin-bottom:22px; }
.dossier-origin-detail{
  display:inline-flex; align-items:center; gap:7px; font-size:13px; color:var(--text); flex-wrap:wrap;
}

/* טאג המקור/אחריות בשורה העליונה — צורת תגית אמיתית (מצולע עם חוד וחור   */
/* תלייה), לא כפתור/פילס מלבני, לפי בקשה מפורשת. origin-tag-wrap הוא       */
/* מעטפת לא-חתוכה שנושאת את הזוהר הפועם (כי clip-path על האלמנט הפנימי     */
/* היה חותך את ה-box-shadow יחד עם שאר הצורה); origin-tag-shape הוא         */
/* המצולע עצמו — מילוי צבע מלא (כמו pill הרגילים באפליקציה) ולא מתאר,      */
/* עם pseudo-element שמדמה חור תלייה בצבע רקע הכרטיס. גדול מספיק לטקסט כי   */
/* זו הגרסה שמופיעה רק כשתעודת הזהות המורחבת פתוחה (לא בכרטיס הסגור).      */
@keyframes originGlow{
  0%,100%{ box-shadow:0 0 0 0 rgba(224,138,52,.5); }
  50%{ box-shadow:0 0 7px 2px rgba(224,138,52,.5); }
}
.origin-tag-wrap{ display:inline-flex; border-radius:var(--radius-md); }
.origin-tag-wrap.origin-glow{ animation:originGlow 2.4s ease-in-out infinite; }
.origin-tag-shape{
  position:relative; display:inline-flex; align-items:center; gap:6px;
  padding:7px 16px 7px 20px; font-size:12.5px; font-weight:700; font-family:var(--font-sans); color:#fff;
  clip-path:polygon(24% 0%, 100% 0%, 100% 100%, 24% 100%, 0% 50%);
}
.origin-tag-shape::before{
  content:""; position:absolute; left:9px; top:50%; transform:translateY(-50%);
  width:4px; height:4px; border-radius:50%; background:var(--panel);
}
.origin-tag-shape.origin-matal{ background:var(--green); }
.origin-tag-shape.origin-industry{ background:#2F8FCE; }
.origin-tag-shape.origin-in_house{ background:#E08A34; }
.dossier-origin-detail svg{ color:var(--text-dim); flex:none; }

.dossier-origin-edit{ margin-bottom:22px; }
.origin-pick-row{ display:flex; gap:8px; flex-wrap:wrap; margin-bottom:12px; }
.origin-pick{
  background:var(--panel-raised); border:1px solid var(--line); border-radius:var(--radius-lg); padding:7px 15px;
  font-size:12.5px; font-weight:600; color:var(--text-dim); cursor:pointer; font-family:var(--font-sans);
  transition:border-color var(--t-fast) ease, color var(--t-fast) ease, background var(--t-fast) ease;
}
.origin-pick:hover{ border-color:var(--accent); color:var(--accent); }
.origin-pick.active{ background:var(--accent); color:var(--accent-ink); border-color:var(--accent); }
.origin-fields{ display:flex; gap:8px; flex-wrap:wrap; }
.origin-fields-column{ flex-direction:column; align-items:flex-start; }
.origin-fields input{
  flex:1; min-width:140px; background:var(--bg); border:1px solid var(--line); border-radius:var(--radius-md);
  padding:9px 11px; font-size:13px; color:var(--text); font-family:var(--font-sans);
}
.origin-field-sm{ flex:0 0 90px !important; min-width:0 !important; }
.origin-fields input:focus{ outline:none; border-color:var(--accent); box-shadow:0 0 0 3px color-mix(in srgb, var(--accent) 16%, transparent); }

.dossier-file-list{ display:flex; flex-wrap:wrap; gap:7px; }
.dossier-file-list-inline{ margin-inline-start:6px; }
.dossier-file-chip{
  display:inline-flex; align-items:center; gap:6px; font-size:12px; color:var(--text-dim);
  background:var(--panel-raised); border:1px solid var(--line); border-radius:var(--radius-lg); padding:4px 10px;
  font-family:var(--font-mono);
}
.dossier-file-chip button{
  background:none; border:none; color:var(--text-dim); cursor:pointer; display:flex; padding:0;
  transition:color var(--t-fast) ease;
}
.dossier-file-chip button:hover{ color:var(--red); }

.dossier-quick-actions{ display:flex; gap:10px; flex-wrap:wrap; margin-bottom:22px; }
.dossier-quick-btn{
  display:inline-flex; align-items:center; gap:7px; background:var(--panel-raised); border:1px solid var(--line);
  border-radius:var(--radius-md); padding:9px 15px; font-size:13px; font-weight:600; color:var(--text); cursor:pointer;
  font-family:var(--font-sans); transition:border-color var(--t-fast) ease, color var(--t-fast) ease, background var(--t-fast) ease;
}
.dossier-quick-btn:hover{ border-color:var(--accent); color:var(--accent); background:color-mix(in srgb, var(--accent) 8%, transparent); }

/* הבעת עניין — לא הרשאה ולא זרימת אישור, רק אינדיקציה קהילתית קלה של מי    */
/* עוד עשוי לרצות את הפריט, כדי שהמערכת תרגיש כמו עבודה משותפת ולא רק      */
/* אינטראקציה אישית מול קטלוג. הצבע הופך לוורוד-אדום עדין כשפעיל בלבד.     */
.dossier-interest-btn.active{ border-color:#E0577A; color:#E0577A; background:color-mix(in srgb, #E0577A 10%, transparent); }
.dossier-interest-btn.active svg{ fill:#E0577A; }
.dossier-interest-count{
  display:inline-flex; align-items:center; justify-content:center; min-width:18px; height:18px; padding:0 5px;
  border-radius:var(--radius-md); background:var(--panel); border:1px solid currentColor; font-size:11px; font-weight:700;
  font-family:var(--font-mono);
}

.dossier-insight{
  display:flex; align-items:center; gap:10px; background:color-mix(in srgb, var(--yellow) 12%, transparent);
  border:1px solid var(--yellow); border-radius:var(--radius-lg); padding:12px 15px; font-size:13px; color:var(--text);
  margin-bottom:22px; line-height:1.5;
}
.dossier-insight svg{ color:var(--yellow); flex:none; }

.dossier-linked-tickets{ display:flex; flex-direction:column; gap:8px; margin-bottom:22px; }
.dossier-linked-ticket{
  display:flex; align-items:center; justify-content:space-between; gap:10px; background:var(--panel-raised);
  border:1px solid var(--line); border-radius:var(--radius-md); padding:10px 13px; cursor:pointer; text-align:right;
  font-family:var(--font-sans); transition:border-color var(--t-fast) ease;
}
.dossier-linked-ticket:hover{ border-color:var(--accent); }
.linked-ticket-main{ display:flex; align-items:center; gap:10px; min-width:0; }
.linked-ticket-title{ font-size:13px; color:var(--text); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.linked-ticket-meta{ display:flex; align-items:center; gap:8px; flex:none; }

.dossier-related{ display:flex; gap:8px; flex-wrap:wrap; margin-bottom:6px; }
.dossier-related-chip{
  display:inline-flex; align-items:center; gap:6px; background:none; border:1px solid var(--line);
  border-radius:var(--radius-lg); padding:6px 13px; font-size:12.5px; color:var(--text-dim); cursor:pointer;
  font-family:var(--font-sans); transition:border-color var(--t-fast) ease, color var(--t-fast) ease;
}
.dossier-related-chip:hover{ border-color:var(--accent); color:var(--accent); }
.dossier-related-chip svg:first-child{ color:var(--accent); }

@media (max-width:720px){
  .dossier{ padding:24px 20px 28px; }
  .dossier-grid{ grid-template-columns:1fr; }
  .dossier-head{ flex-direction:column; }
  .dossier-toprow{ flex-direction:column; align-items:flex-start; gap:10px; padding-inline-end:0; }
}
`;
