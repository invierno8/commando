import React, { useEffect, useState } from "react";
import ProductDossier from "./ProductDossier.jsx";
import PhotoTile from "./PhotoTile.jsx";
import Loading from "./Loading.jsx";
import { fetchBrigadeCatalog } from "./brigadeStore.js";

export default function Catalog({ brigadeId }) {
  const [item, setItem] = useState(null);
  const [catalog, setCatalog] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setCatalog(null);
    fetchBrigadeCatalog(brigadeId).then((data) => { if (!cancelled) setCatalog(data); });
    return () => { cancelled = true; };
  }, [brigadeId]);

  return (
    <div dir="rtl" className="catalog-view">
      <style>{CSS}</style>

      <p className="view-sub">מלאי ציוד זמין ליחידה. לחיצה על פריט פותחת תעודת זהות מלאה.</p>

      {catalog === null ? (
        <Loading />
      ) : catalog.length === 0 ? (
        <div className="empty-state">אין עדיין פריטים בקטלוג של חטיבה זו — היא ממתינה להשלמת ההקמה.</div>
      ) : (
      <div className="catalog-grid">
        {catalog.map((it, idx) => (
          <button
            className="prod-card"
            key={it.id}
            style={{ animationDelay: `${idx * 40}ms` }}
            onClick={() => setItem(it)}
          >
            <PhotoTile iconKey={it.icon} size={72} iconSize={28} />
            <div className="prod-name">{it.name}</div>
            <div className="prod-id">{it.id}</div>
            <div className="prod-qty">
              <span className="prod-qty-dot" />
              במלאי: {it.qty}
            </div>
          </button>
        ))}
      </div>
      )}

      {item && <ProductDossier item={item} onClose={() => setItem(null)} />}
    </div>
  );
}

const CSS = `
@keyframes cardIn{ from{ opacity:0; transform:translateY(6px); } to{ opacity:1; transform:translateY(0); } }

.view-sub{ color:var(--text-dim); font-size:14px; margin:0 0 20px; }

.catalog-grid{ display:grid; grid-template-columns:repeat(auto-fill,minmax(190px,1fr)); gap:16px; }
.prod-card{
  background:var(--panel); border:1px solid var(--line); border-radius:var(--radius-card);
  padding:22px 14px; text-align:center; cursor:pointer; color:var(--text);
  display:flex; flex-direction:column; gap:10px; align-items:center;
  opacity:0; animation:cardIn .3s ease forwards;
  transition:border-color .15s ease, box-shadow .15s ease, transform .15s ease;
}
.prod-card:hover{ border-color:var(--accent); box-shadow:var(--shadow-sm); transform:translateY(-2px); }
.prod-card:hover .photo-tile{ border-color:var(--accent); }
.prod-name{ font-family:var(--font-sans); font-weight:600; font-size:15.5px; }
.prod-id{ font-family:var(--font-mono); font-size:12px; color:var(--accent); }
.prod-qty{ font-size:12.5px; color:var(--text-dim); display:flex; align-items:center; gap:5px; }
.prod-qty-dot{ width:5px; height:5px; border-radius:50%; background:var(--green); }

@media (max-width:640px){
  .catalog-grid{ grid-template-columns:repeat(auto-fill,minmax(130px,1fr)); }
}
`;
