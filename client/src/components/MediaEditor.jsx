import React, { useRef } from "react";
import { X, ImagePlus, Video, Play } from "lucide-react";

/* ================================================================== */
/* LEGO BLOCK — MediaEditor: add/remove/caption the photos and videos   */
/* attached to a catalog item. Same upload mechanism as LogoUpload.jsx  */
/* (FileReader → data URL, no backend yet). Styled by the consuming     */
/* screen (ProductDossier.jsx) rather than carrying its own <style>,    */
/* since it only ever renders inside that component's edit mode.        */
/* ================================================================== */

export default function MediaEditor({ media, onChange }) {
  const imgInputRef = useRef(null);
  const vidInputRef = useRef(null);

  function addFile(file, type) {
    const reader = new FileReader();
    reader.onload = () => onChange([...media, { type, url: reader.result, caption: "" }]);
    reader.readAsDataURL(file);
  }
  function handleImgFile(e) {
    const file = e.target.files?.[0];
    if (file) addFile(file, "image");
    e.target.value = "";
  }
  function handleVidFile(e) {
    const file = e.target.files?.[0];
    if (file) addFile(file, "video");
    e.target.value = "";
  }
  function updateCaption(idx, caption) {
    onChange(media.map((m, i) => (i === idx ? { ...m, caption } : m)));
  }
  function removeAt(idx) {
    onChange(media.filter((_, i) => i !== idx));
  }

  return (
    <div className="media-editor">
      {media.length > 0 && (
        <div className="media-editor-list">
          {media.map((m, idx) => (
            <div className="media-editor-item" key={idx}>
              <div className="media-editor-thumb">
                {m.type === "video" ? (
                  m.poster ? <img src={m.poster} alt="" /> : <Video size={16} />
                ) : (
                  <img src={m.url} alt="" />
                )}
                {m.type === "video" && <span className="media-editor-thumb-play"><Play size={9} /></span>}
              </div>
              <input
                className="media-editor-caption"
                value={m.caption || ""}
                onChange={(e) => updateCaption(idx, e.target.value)}
                placeholder="כיתוב (אופציונלי)"
              />
              <button type="button" className="media-editor-remove" onClick={() => removeAt(idx)} title="הסרה">
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="media-editor-actions">
        <button type="button" className="media-editor-add" onClick={() => imgInputRef.current?.click()}>
          <ImagePlus size={13} /> הוספת תמונה
        </button>
        <button type="button" className="media-editor-add" onClick={() => vidInputRef.current?.click()}>
          <Video size={13} /> הוספת סרטון
        </button>
      </div>
      <input ref={imgInputRef} type="file" accept="image/*" onChange={handleImgFile} style={{ display: "none" }} />
      <input ref={vidInputRef} type="file" accept="video/*" onChange={handleVidFile} style={{ display: "none" }} />
    </div>
  );
}
