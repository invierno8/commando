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
      title={mode === "mock" ? "מציג נתוני הדגמה — לחיצה למעבר למערכת ריקה/אמיתית" : "מערכת ריקה/אמיתית — לחיצה למעבר לנתוני הדגמה"}
    >
      {mode === "mock" ? <Database size={13} /> : <HardDrive size={13} />}
      {mode === "mock" ? "נתוני הדגמה" : "מערכת ריקה"}
    </button>
  );
}
