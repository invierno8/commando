import React, { useEffect, useRef, useState } from "react";

/* Animates a numeric value counting up on mount/change — used for KPI
   tiles so the dashboard reads as live rather than static. Non-numeric
   values (e.g. "6.4h") pass through unchanged. */
export default function CountUp({ value, duration = 600 }) {
  const numeric = typeof value === "number" ? value : parseFloat(value);
  const isPlainNumber = typeof value === "number";
  const [display, setDisplay] = useState(isPlainNumber ? 0 : value);
  const fromRef = useRef(0);

  useEffect(() => {
    if (!isPlainNumber || Number.isNaN(numeric)) {
      setDisplay(value);
      return;
    }
    const from = fromRef.current;
    const start = performance.now();
    let raf;
    function tick(now) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (numeric - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = numeric;
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numeric, isPlainNumber]);

  return <span className="count-up">{display}</span>;
}
