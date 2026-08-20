import React from "react";
import { Search, X } from "lucide-react";

/* ================================================================== */
/* LEGO BLOCK — SearchBar. A free-text input + an optional row of      */
/* filter controls (FilterSelect / pill-tabs) passed in as children,   */
/* so every screen wires its own filters without duplicating the row   */
/* layout. Pairs with matchesSearch() in search.js.                    */
/* ================================================================== */

export default function SearchBar({ value, onChange, placeholder = "חיפוש...", children }) {
  return (
    <div className="search-filter-row">
      <div className="search-bar">
        <Search size={15} className="search-bar-icon" />
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
        {value && (
          <button type="button" className="search-bar-clear" onClick={() => onChange("")} title="ניקוי חיפוש">
            <X size={13} />
          </button>
        )}
      </div>
      {children && <div className="search-bar-filters">{children}</div>}
    </div>
  );
}
