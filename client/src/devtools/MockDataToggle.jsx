import React, { useEffect, useState } from "react";
import { Database, HardDrive } from "lucide-react";
import { fetchDataMode, setDataMode } from "./devApi.js";

/* מתג mock/live — דגל גלובלי אחד בצד השרת (לא פר-session, ראו התוכנית).   */
/* מרענן טוען את המצב הנוכחי; מעבר עצמו עושה reload מלא, כדי שכל מסך      */
/* ייגזר מחדש מהמקור הנכון בלי לנסות לסנכרן state מקומי ישן.               */
export default function MockDataToggle() {
  const [mode, setMode] = useState(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetchDataMode().then((d) => { if (!cancelled) setMode(d.mode); });
    return () => { cancelled = true; };
  }, []);

  // jynx-mt8i1fowscur: "demo data turn off never works". toggle() used to
  // await setDataMode() with no try/catch at all — any failure just threw
  // silently (no reload, no error), so the button looked completely dead.
  // The most likely real-world cause: Render's free-tier backend sleeps
  // after inactivity and can take 30-50s to wake on the first request (the
  // exact same root cause already diagnosed and retried for in this file's
  // fetchDevMe() call, see DevAuthGate.jsx's comment above that retry loop)
  // — a click that lands during that wake-up window used to fail outright.
  // One short retry covers that transient case; any other failure now shows
  // an inline message instead of nothing happening.
  async function toggle() {
    if (pending) return;
    const next = mode === "mock" ? "live" : "mock";
    setPending(true);
    setError(null);
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        await setDataMode(next);
        window.location.reload();
        return;
      } catch (err) {
        if (attempt === 1) {
          setPending(false);
          setError(err.message || "המעבר נכשל");
          return;
        }
        await new Promise((r) => setTimeout(r, 2500));
      }
    }
  }

  if (!mode) return null;

  return (
    <div className="mock-toggle-wrap">
      <button
        type="button"
        className={"mock-toggle" + (mode === "mock" ? " mock-toggle-mock" : " mock-toggle-live")}
        onClick={toggle}
        disabled={pending}
        title={mode === "mock" ? "Showing demo data — click to switch to the real/live system" : "Real/live system (starts empty, keeps whatever's been created since) — click to switch to demo data"}
      >
        {mode === "mock" ? <Database size={13} /> : <HardDrive size={13} />}
        {pending ? "..." : (mode === "mock" ? "Demo data" : "Live data")}
      </button>
      {error && (
        <span className="mock-toggle-error" title={error}>
          ⚠ {error}
        </span>
      )}
    </div>
  );
}
