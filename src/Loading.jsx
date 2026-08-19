import React from "react";

export default function Loading({ label = "טוען נתוני חטיבה..." }) {
  return (
    <div className="loading-state">
      <span className="loading-spinner" aria-hidden="true" />
      {label}
    </div>
  );
}
