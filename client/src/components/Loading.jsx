import React from "react";

export default function Loading({ label = "טוען נתוני חטיבה..." }) {
  return (
    <div className="hg-loading">
      <div className="hg-loading-head">
        <span className="hg-loading-spinner" aria-hidden="true" />
        <span>{label}</span>
      </div>
      <div className="hg-loading-skeleton" aria-hidden="true">
        <span className="hg-loading-scanline" />
        <i style={{ width: "72%" }} />
        <i style={{ width: "54%" }} />
        <i style={{ width: "38%" }} />
      </div>
    </div>
  );
}
