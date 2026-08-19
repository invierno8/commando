import React from "react";
import {
  Radio, Binoculars, Shirt, BatteryFull, Cross, Zap, Tent, Compass, Flashlight, Package,
} from "lucide-react";

/* ================================================================== */
/* LEGO BLOCK — category → line icon lookup. Single source of truth so */
/* Catalog.jsx and ProductDossier.jsx never diverge on how an item's   */
/* category renders. "Package" is the fallback for any future category */
/* that hasn't been mapped yet.                                        */
/* ================================================================== */

export const CATEGORY_ICONS = {
  radio: Radio,
  nvg: Binoculars,
  vest: Shirt,
  battery: BatteryFull,
  medical: Cross,
  generator: Zap,
  tent: Tent,
  nav: Compass,
  light: Flashlight,
};

/* Classification-marking ribbon text — real IDF-style shorthand for    */
/* "unclassified", used here purely for prototype flavor.               */
const RIBBON_LABEL = "בלת״ם";

export default function PhotoTile({ iconKey, size = 56, iconSize = 26, ribbon = true, style }) {
  const Icon = CATEGORY_ICONS[iconKey] || Package;
  return (
    <div className="photo-tile" style={{ width: size, height: size, ...style }}>
      {ribbon && <div className="photo-tile-ribbon">{RIBBON_LABEL}</div>}
      <Icon size={iconSize} />
    </div>
  );
}
