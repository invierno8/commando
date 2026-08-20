import React from "react";

/* ================================================================== */
/* LEGO BLOCK — FilterSelect. A labeled dropdown filter meant to sit    */
/* inside <SearchBar>'s filter row. `options` is [{ value, label }],   */
/* "all" is always injected as the reset option.                       */
/* ================================================================== */

export default function FilterSelect({ value, onChange, options, allLabel = "הכל", ariaLabel }) {
  return (
    <select className="filter-select" value={value} onChange={(e) => onChange(e.target.value)} aria-label={ariaLabel}>
      <option value="all">{allLabel}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}
