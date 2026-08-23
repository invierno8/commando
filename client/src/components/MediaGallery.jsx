import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, ChevronRight, ChevronLeft, Play } from "lucide-react";

/* ================================================================== */
/* LEGO BLOCK — MediaGallery: a lightbox for a catalog item's attached  */
/* media. One image → a plain enlarged view, no gallery chrome. Two+    */
/* items (images and/or videos mixed) → full gallery mode: arrows,      */
/* thumbnail strip, counter, keyboard navigation. Self-contained (own   */
/* <style>) so any screen can open it without depending on another      */
/* component's CSS, same pattern as ProductDossier.jsx.                 */
/* ================================================================== */

export default function MediaGallery({ media, startIndex = 0, onClose }) {
  const [index, setIndex] = useState(startIndex);
  const isGallery = media.length > 1;
  const current = media[index];

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose();
      else if (isGallery && e.key === "ArrowRight") setIndex((i) => (i + 1) % media.length);
      else if (isGallery && e.key === "ArrowLeft") setIndex((i) => (i - 1 + media.length) % media.length);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isGallery, media.length, onClose]);

  function next(e) {
    e.stopPropagation();
    setIndex((i) => (i + 1) % media.length);
  }
  function prev(e) {
    e.stopPropagation();
    setIndex((i) => (i - 1 + media.length) % media.length);
  }

  return createPortal(
    <div className="media-gallery-overlay" onClick={(e) => { e.stopPropagation(); onClose(); }}>
      <style>{CSS}</style>
      <button className="media-gallery-close" onClick={onClose} title="סגירה (Esc)"><X size={18} /></button>

      {isGallery && (
        <span className="media-gallery-counter" dir="ltr">{index + 1} / {media.length}</span>
      )}

      <div className="media-gallery-stage" onClick={(e) => e.stopPropagation()}>
        {isGallery && (
          <button className="media-gallery-nav media-gallery-nav-prev" onClick={prev} title="הקודם">
            <ChevronRight size={22} />
          </button>
        )}

        <div className="media-gallery-frame">
          {current.type === "video" ? (
            <video key={current.url} src={current.url} poster={current.poster} controls autoPlay className="media-gallery-media" />
          ) : (
            <img key={current.url} src={current.url} alt={current.caption || ""} className="media-gallery-media" />
          )}
        </div>

        {isGallery && (
          <button className="media-gallery-nav media-gallery-nav-next" onClick={next} title="הבא">
            <ChevronLeft size={22} />
          </button>
        )}
      </div>

      {current.caption && <div className="media-gallery-caption">{current.caption}</div>}

      {isGallery && (
        <div className="media-gallery-thumbs" onClick={(e) => e.stopPropagation()}>
          {media.map((m, i) => (
            <button
              key={m.url}
              className={"media-gallery-thumb" + (i === index ? " active" : "")}
              onClick={() => setIndex(i)}
            >
              <img src={m.poster || (m.type === "video" ? undefined : m.url)} alt="" />
              {m.type === "video" && <span className="media-gallery-thumb-play"><Play size={11} /></span>}
            </button>
          ))}
        </div>
      )}
    </div>,
    document.body
  );
}

const CSS = `
@keyframes mediaGalleryIn{ from{ opacity:0; } to{ opacity:1; } }
@keyframes mediaFrameIn{ from{ opacity:0; transform:scale(.97); } to{ opacity:1; transform:scale(1); } }

.media-gallery-overlay{
  position:fixed; inset:0; background:rgba(4,5,6,.88); backdrop-filter:blur(3px);
  display:flex; flex-direction:column; align-items:center; justify-content:center;
  z-index:400; padding:28px; animation:mediaGalleryIn var(--t-fast) ease;
}
.media-gallery-close{
  position:absolute; top:18px; left:18px; background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.14);
  color:#fff; cursor:pointer; border-radius:var(--radius-md); padding:8px; display:flex; transition:background var(--t-fast) ease, border-color var(--t-fast) ease;
}
.media-gallery-close:hover{ background:rgba(255,255,255,.14); border-color:var(--red); color:var(--red); }
.media-gallery-counter{
  position:absolute; top:22px; right:24px; font-family:var(--font-mono); font-size:12.5px; color:rgba(255,255,255,.75);
  letter-spacing:.04em;
}

.media-gallery-stage{ display:flex; align-items:center; gap:14px; max-width:min(1000px, 88vw); width:100%; justify-content:center; }
.media-gallery-nav{
  flex:none; background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.14); color:#fff;
  border-radius:50%; width:42px; height:42px; display:flex; align-items:center; justify-content:center;
  cursor:pointer; transition:background var(--t-fast) ease, border-color var(--t-fast) ease;
}
.media-gallery-nav:hover{ background:rgba(255,255,255,.16); border-color:var(--accent); color:var(--accent); }

.media-gallery-frame{
  flex:1; min-width:0; max-height:74vh; display:flex; align-items:center; justify-content:center;
  animation:mediaFrameIn .18s ease;
}
.media-gallery-media{
  max-width:100%; max-height:74vh; border-radius:var(--radius-lg); box-shadow:0 20px 60px rgba(0,0,0,.5);
  border:1px solid rgba(255,255,255,.1); background:#000; object-fit:contain;
}

.media-gallery-caption{
  margin-top:14px; color:rgba(255,255,255,.72); font-size:13px; font-family:var(--font-sans); text-align:center; max-width:640px;
}

.media-gallery-thumbs{
  display:flex; gap:9px; margin-top:18px; max-width:min(1000px, 88vw); overflow-x:auto; padding:2px;
}
.media-gallery-thumb{
  flex:none; width:64px; height:48px; border-radius:var(--radius-md); overflow:hidden; border:2px solid transparent;
  background:#000; cursor:pointer; padding:0; position:relative; opacity:.6; transition:opacity var(--t-fast) ease, border-color var(--t-fast) ease;
}
.media-gallery-thumb:hover{ opacity:.9; }
.media-gallery-thumb.active{ opacity:1; border-color:var(--accent); }
.media-gallery-thumb img{ width:100%; height:100%; object-fit:cover; display:block; }
.media-gallery-thumb-play{
  position:absolute; inset:0; display:flex; align-items:center; justify-content:center;
  background:rgba(0,0,0,.35); color:#fff;
}

@media (max-width:640px){
  .media-gallery-nav{ width:34px; height:34px; }
  .media-gallery-thumb{ width:50px; height:38px; }
}
`;
