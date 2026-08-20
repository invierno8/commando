import React, { useRef } from "react";
import { Upload } from "lucide-react";

/* ================================================================== */
/* LEGO BLOCK — LogoUpload: reads a chosen image file as a data URL     */
/* (no backend yet, so this is what "storage" means for now) and hands  */
/* it back via onChange. Used for both the brigade logo and each unit's */
/* logo in BrigadeSetupWizard — real uploaded artwork instead of a      */
/* picked icon or emoji.                                                */
/* ================================================================== */

export default function LogoUpload({ label, value, onChange, fallback, compact }) {
  const inputRef = useRef(null);

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onChange(reader.result);
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  return (
    <div className={"logo-upload" + (compact ? " logo-upload-compact" : "")}>
      <div className="logo-upload-preview">
        {value ? <img src={value} alt="" /> : fallback}
      </div>
      <div className="logo-upload-body">
        {label && <span className="logo-upload-label">{label}</span>}
        <div className="logo-upload-actions">
          <button type="button" className="logo-upload-btn" onClick={() => inputRef.current?.click()}>
            <Upload size={13} /> {value ? "החלפת תמונה" : "העלאת לוגו"}
          </button>
          {value && (
            <button type="button" className="logo-upload-remove" onClick={() => onChange(null)}>הסרה</button>
          )}
        </div>
      </div>
      <input ref={inputRef} type="file" accept="image/*" onChange={handleFile} />
    </div>
  );
}
