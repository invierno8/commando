import React, { useEffect, useState } from "react";
import { Database, HardDrive } from "lucide-react";
import { fetchDataMode, setDataMode } from "./devApi.js";

/* מתג mock/live — דגל גלובלי אחד בצד השרת (לא פר-session, ראו התוכנית).   */
/* מרענן טוען את המצב הנוכחי; מעבר עצמו עושה reload מלא, כדי שכל מסך      */
/* ייגזר מחדש מהמקור הנכון בלי לנסות לסנכרן state מקומי ישן.               */
export default function MockDataToggle() {
  const [mode, setMode] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetchDataMode().then((d) => { if (!cancelled) setMode(d.mode); });
    return () => { cancelled = true; };
  }, []);

  async function toggle() {
    const next = mode === "mock" ? "live" : "mock";
    await setDataMode(next);
    window.location.reload();
  }

  if (!mode) return null;

  return (
    <button
      type="button"
      className={"mock-toggle" + (mode === "mock" ? " mock-toggle-mock" : " mock-toggle-live")}
      onClick={toggle}
      title={mode === "mock" ? "Showing demo data — click to switch to the real/live system" : "Real/live system (starts empty, keeps whatever's been created since) — click to switch to demo data"}
    >
      {mode === "mock" ? <Database size={13} /> : <HardDrive size={13} />}
      {mode === "mock" ? "Demo data" : "Live data"}
    </button>
  );
}
