import React, { useMemo, useState } from "react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from "recharts";
import UnitEmblem from "./UnitEmblem.jsx";
import ScopePicker, { ALL_SCOPE, SCOPE_PICKER_CSS } from "./ScopePicker.jsx";

/* ================================================================== */
/* LEGO BLOCK — design tokens shared with the rest of the system.      */
/* ================================================================== */

const TOKENS = {
  bg: "#12140F", panel: "#1A1F16", panelRaised: "#212819", line: "#3A4530",
  text: "#E9E6D8", textDim: "#9BA28A", amber: "#C9A227", green: "#5C8A3A",
  yellow: "#D4A72C", red: "#C1432E",
};

const UNITS = ["מגלן", "דובדבן", "אגוז", "יחידת מטה"];

/* ================================================================== */
/* LEGO BLOCK — mock data, per unit. בפרודקשן כל זה מוחלף בקריאת API   */
/* לפי scope; שאר הקומפוננטה לא צריכה להשתנות.                        */
/* ================================================================== */

const TICKETS_BY_UNIT = [
  { unit: "מגלן", approved: 22, pending: 4, rejected: 3 },
  { unit: "דובדבן", approved: 19, pending: 5, rejected: 2 },
  { unit: "אגוז", approved: 15, pending: 3, rejected: 3 },
  { unit: "יחידת מטה", approved: 5, pending: 2, rejected: 1 },
];

const PRIORITY_BY_UNIT = {
  "מגלן": [{ key: "red", label: "דחוף", value: 4 }, { key: "yellow", label: "בינוני", value: 8 }, { key: "green", label: "שגרתי", value: 10 }],
  "דובדבן": [{ key: "red", label: "דחוף", value: 3 }, { key: "yellow", label: "בינוני", value: 7 }, { key: "green", label: "שגרתי", value: 9 }],
  "אגוז": [{ key: "red", label: "דחוף", value: 3 }, { key: "yellow", label: "בינוני", value: 6 }, { key: "green", label: "שגרתי", value: 6 }],
  "יחידת מטה": [{ key: "red", label: "דחוף", value: 1 }, { key: "yellow", label: "בינוני", value: 3 }, { key: "green", label: "שגרתי", value: 1 }],
};

const TREND_BY_UNIT = {
  "מגלן": [4, 6, 3, 8, 5, 9, 6, 10, 5, 7, 11, 6, 9, 12],
  "דובדבן": [3, 5, 2, 6, 4, 7, 5, 8, 4, 6, 9, 5, 7, 10],
  "אגוז": [2, 3, 2, 4, 3, 5, 3, 5, 3, 4, 6, 4, 5, 6],
  "יחידת מטה": [1, 1, 1, 2, 1, 2, 1, 2, 1, 1, 3, 1, 2, 3],
};
const TREND_DAYS = ["1/8","2/8","3/8","4/8","5/8","6/8","7/8","8/8","9/8","10/8","11/8","12/8","13/8","14/8"];

const ACTIVITY_LOG = [
  { date: "17/8", time: "20:41", actor: "עידן לוי", unit: "דובדבן", title: "תקלה בגנרטור שדה", action: "אישר את REQ-1042", tone: "green" },
  { date: "17/8", time: "20:22", actor: "דניאל אור", unit: "מגלן", title: "חוסר במשקפות ראיית לילה", action: "פתח דרישה חדשה REQ-1058", tone: "amber" },
  { date: "17/8", time: "19:58", actor: "מאיה ברק", unit: "אגוז", title: "סוללות שדה — מלאי נמוך", action: "דחתה את REQ-1037 — נכנסה לתיקיית סורבו (30 יום)", tone: "red" },
  { date: "17/8", time: "19:40", actor: "נועה שגיא", unit: "יחידת מטה", title: "אלונקת חילוץ פגומה", action: "עדכנה תיעדוף ל-REQ-1041", tone: "amber" },
  { date: "16/8", time: "18:15", actor: "רוני כהן", unit: "מגלן", title: "משקפת ראיית לילה — NVG-04", action: "הוסיף פריט חדש לקטלוג", tone: "green" },
  { date: "16/8", time: "17:52", actor: "עידן לוי", unit: "דובדבן", title: "בקשה לאוהלי שטח נוספים", action: "פתח דרישה חדשה REQ-1055", tone: "amber" },
];

/* ================================================================== */
/* LEGO BLOCK — derive everything from a single scope value.           */
/* scope = "__all__" | שם יחידה. שאר הקומפוננטה קוראת רק מכאן.          */
/* ================================================================== */

function getScopedData(scope) {
  const units = scope === ALL_SCOPE ? UNITS : [scope];
  const rows = TICKETS_BY_UNIT.filter((r) => units.includes(r.unit));

  const totals = rows.reduce(
    (acc, r) => ({
      approved: acc.approved + r.approved,
      pending: acc.pending + r.pending,
      rejected: acc.rejected + r.rejected,
    }),
    { approved: 0, pending: 0, rejected: 0 }
  );

  const statusBreakdown = [
    { key: "pending", label: "ממתינות", value: totals.pending, color: TOKENS.amber },
    { key: "approved", label: "אושרו", value: totals.approved, color: TOKENS.green },
    { key: "rejected", label: "סורבו", value: totals.rejected, color: TOKENS.red },
  ];

  const priorityMap = { red: TOKENS.red, yellow: TOKENS.yellow, green: TOKENS.green };
  const priorityBreakdown = units
    .flatMap((u) => PRIORITY_BY_UNIT[u] || [])
    .reduce((acc, p) => {
      const existing = acc.find((a) => a.key === p.key);
      if (existing) existing.value += p.value;
      else acc.push({ ...p });
      return acc;
    }, [])
    .sort((a, b) => (a.key === "red" ? -1 : b.key === "red" ? 1 : a.key === "yellow" ? -1 : 1))
    .map((p) => ({ ...p, color: priorityMap[p.key] }));

  const trend = TREND_DAYS.map((d, i) => ({
    d,
    opened: units.reduce((sum, u) => sum + (TREND_BY_UNIT[u]?.[i] || 0), 0),
  }));

  const activity = scope === ALL_SCOPE
    ? ACTIVITY_LOG
    : ACTIVITY_LOG.filter((a) => a.unit === scope);

  return {
    total: totals.approved + totals.pending + totals.rejected,
    totals, statusBreakdown, priorityBreakdown, trend, activity,
    unitRows: rows,
  };
}

/* ================================================================== */
/* LEGO BLOCK — generic pieces                                         */
/* ================================================================== */

function KpiCard({ label, value, tone, sub }) {
  return (
    <div className={"kpi-card" + (tone ? ` kpi-${tone}` : "")}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}

function ChartPanel({ title, sub, children }) {
  return (
    <div className="chart-panel">
      <div className="chart-panel-head">
        <div className="chart-title">{title}</div>
        {sub && <div className="chart-sub">{sub}</div>}
      </div>
      <div className="chart-body">{children}</div>
    </div>
  );
}

function tooltipStyle() {
  return {
    contentStyle: { background: TOKENS.panelRaised, border: `1px solid ${TOKENS.line}`, borderRadius: 6, fontFamily: "IBM Plex Mono, monospace", fontSize: 12, color: TOKENS.text },
    labelStyle: { color: TOKENS.textDim },
    cursor: { fill: "rgba(255,255,255,.04)" },
  };
}

const SYSTEM_HEALTH = [
  { label: "משתמשים פעילים היום", value: "37" },
  { label: "פריטים בקטלוג", value: "9" },
  { label: "זמן אישור ממוצע", value: "6.4 שעות" },
  { label: "זמינות מערכת (30 יום)", value: "99.8%" },
];

/* ================================================================== */
/* Root                                                                */
/* ================================================================== */

export default function DevDashboard() {
  const [scope, setScope] = useState(ALL_SCOPE);
  const data = useMemo(() => getScopedData(scope), [scope]);

  return (
    <div dir="rtl" className="app">
      <style>{CSS}</style>
      <div className="bg-fx" aria-hidden="true" />

      <div className="dash-header">
        <div>
          <div className="dash-eyebrow">
            דשבורד פיתוח ותשתית — {scope === ALL_SCOPE ? "חטיבתי" : "יחידתי"}
          </div>
          <h1>{scope === ALL_SCOPE ? "בקרת מערכת אמל״ח־נט" : `בקרת יחידה — ${scope}`}</h1>
        </div>
        <div className="dash-header-right">
          <ScopePicker scope={scope} setScope={setScope} units={UNITS} />
          <div className="dash-header-tag">נתוני דמו — לא מחובר ל-API</div>
        </div>
      </div>

      <div className="kpi-row">
        <KpiCard label="סה״כ דרישות" value={data.total} />
        <KpiCard label="ממתינות לאישור" value={data.totals.pending} tone="amber" />
        <KpiCard label="אושרו" value={data.totals.approved} tone="green" />
        <KpiCard label="סורבו" value={data.totals.rejected} tone="red" />
        <KpiCard label="זמן אישור ממוצע" value="6.4h" />
      </div>

      <div className="chart-grid">
        <ChartPanel title="דרישות שנפתחו — 14 יום אחרונים" sub="מגמת שימוש יומית">
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={data.trend} margin={{ top: 6, right: 10, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={TOKENS.amber} stopOpacity={0.45} />
                  <stop offset="100%" stopColor={TOKENS.amber} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={TOKENS.line} strokeDasharray="3 4" vertical={false} />
              <XAxis dataKey="d" stroke={TOKENS.textDim} fontSize={11} tickLine={false} />
              <YAxis stroke={TOKENS.textDim} fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip {...tooltipStyle()} />
              <Area type="monotone" dataKey="opened" stroke={TOKENS.amber} strokeWidth={2} fill="url(#trendFill)" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title="פילוח סטטוס דרישות" sub={`מתוך ${data.total} דרישות בסה״כ`}>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={data.statusBreakdown} dataKey="value" nameKey="label" innerRadius={55} outerRadius={82} paddingAngle={3}>
                {data.statusBreakdown.map((s) => (
                  <Cell key={s.key} fill={s.color} stroke={TOKENS.panel} strokeWidth={2} />
                ))}
              </Pie>
              <Legend verticalAlign="bottom" height={28} formatter={(v) => <span style={{ color: TOKENS.textDim, fontSize: 12 }}>{v}</span>} />
              <Tooltip {...tooltipStyle()} />
            </PieChart>
          </ResponsiveContainer>
        </ChartPanel>

        {scope === ALL_SCOPE && (
          <ChartPanel title="דרישות לפי יחידה" sub="אושרו / ממתינות / סורבו">
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={TICKETS_BY_UNIT} margin={{ top: 6, right: 10, left: -18, bottom: 0 }}>
                <CartesianGrid stroke={TOKENS.line} strokeDasharray="3 4" vertical={false} />
                <XAxis dataKey="unit" stroke={TOKENS.textDim} fontSize={11} tickLine={false} />
                <YAxis stroke={TOKENS.textDim} fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip {...tooltipStyle()} />
                <Legend formatter={(v) => <span style={{ color: TOKENS.textDim, fontSize: 12 }}>{v}</span>} />
                <Bar dataKey="approved" name="אושרו" stackId="a" fill={TOKENS.green} radius={[3, 3, 0, 0]} />
                <Bar dataKey="pending" name="ממתינות" stackId="a" fill={TOKENS.amber} />
                <Bar dataKey="rejected" name="סורבו" stackId="a" fill={TOKENS.red} radius={[0, 0, 3, 3]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartPanel>
        )}

        <ChartPanel title="תיעדוף דרישות מאושרות" sub="דחוף / בינוני / שגרתי">
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={data.priorityBreakdown} layout="vertical" margin={{ top: 6, right: 20, left: 10, bottom: 0 }}>
              <CartesianGrid stroke={TOKENS.line} strokeDasharray="3 4" horizontal={false} />
              <XAxis type="number" stroke={TOKENS.textDim} fontSize={11} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="label" stroke={TOKENS.textDim} fontSize={12} tickLine={false} axisLine={false} width={60} />
              <Tooltip {...tooltipStyle()} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {data.priorityBreakdown.map((p) => (
                  <Cell key={p.key} fill={p.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>
      </div>

      <div className="bottom-grid">
        <div className="health-panel">
          <div className="chart-title">בריאות מערכת</div>
          <div className="health-list">
            {SYSTEM_HEALTH.map((h) => (
              <div className="health-row" key={h.label}>
                <span className="health-led" />
                <span className="health-label">{h.label}</span>
                <span className="health-value">{h.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="log-panel">
          <div className="chart-title">יומן פעילות אחרון</div>
          <div className="log-list">
            {data.activity.length === 0 && <div className="empty">אין פעילות רשומה עבור יחידה זו.</div>}
            {data.activity.map((a, idx) => (
              <div className="log-row" key={idx} style={{ animationDelay: `${idx * 60}ms` }}>
                <span className={`log-dot log-${a.tone}`} />
                <span className="log-time">{a.date} · {a.time}</span>
                <span className="log-actor">{a.actor}</span>
                <span className="log-unit-tag">
                  <UnitEmblem name={a.unit} size={14} showRing={false} />
                  {a.unit}
                </span>
                <span className="log-title">{a.title}</span>
                <span className="log-text">{a.action}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================================================================== */
/* CSS                                                                 */
/* ================================================================== */

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;600;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');

:root{
  --bg:#12140F; --panel:#1A1F16; --panel-raised:#212819; --line:#3A4530;
  --text:#E9E6D8; --text-dim:#9BA28A; --amber:#C9A227; --green:#5C8A3A; --yellow:#D4A72C; --red:#C1432E;
}

@keyframes bgDrift{ 0%{ background-position:0 0, 0 0; } 100%{ background-position:120px 120px, -90px 60px; } }
@keyframes fadeSlideUp{ from{ opacity:0; transform:translateY(10px); } to{ opacity:1; transform:translateY(0); } }
@keyframes ledPulse{ 0%,100%{ box-shadow:0 0 4px 1px var(--green); } 50%{ box-shadow:0 0 9px 2px var(--green); } }

.app{
  position:relative; overflow:hidden;
  background:var(--bg); color:var(--text); font-family:'Inter',sans-serif;
  border-radius:8px; border:1px solid var(--line); padding:28px 30px;
}
.bg-fx{
  position:absolute; inset:0; z-index:0; pointer-events:none;
  background-image:
    linear-gradient(rgba(201,162,39,.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(201,162,39,.05) 1px, transparent 1px);
  background-size:42px 42px, 42px 42px;
  animation:bgDrift 26s linear infinite;
}
.app > *:not(.bg-fx){ position:relative; z-index:1; }

.app > .dash-header{ display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:22px; gap:16px; flex-wrap:wrap; position:relative; z-index:20; }
.dash-eyebrow{ font-family:'IBM Plex Mono',monospace; font-size:11px; color:var(--amber); letter-spacing:.05em; margin-bottom:4px; }
.dash-header h1{ font-family:'Rajdhani',sans-serif; font-size:26px; margin:0; }
.dash-header-right{ display:flex; flex-direction:column; align-items:flex-end; gap:8px; }
.dash-header-tag{ font-family:'IBM Plex Mono',monospace; font-size:11px; color:var(--text-dim); border:1px solid var(--line); border-radius:4px; padding:4px 10px; }

${SCOPE_PICKER_CSS}

.kpi-row{ display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:10px; margin-bottom:22px; }
.kpi-card{
  background:var(--panel); border:1px solid var(--line); border-radius:8px; padding:14px 16px;
  opacity:0; animation:fadeSlideUp .35s ease forwards; transition:border-color .2s ease, transform .18s ease;
}
.kpi-card:hover{ border-color:#4b5640; transform:translateY(-2px); }
.kpi-label{ font-size:11px; color:var(--text-dim); margin-bottom:6px; }
.kpi-value{ font-family:'Rajdhani',sans-serif; font-weight:700; font-size:26px; }
.kpi-sub{ font-size:10px; color:var(--text-dim); margin-top:2px; }
.kpi-amber .kpi-value{ color:var(--amber); }
.kpi-green .kpi-value{ color:var(--green); }
.kpi-red .kpi-value{ color:var(--red); }

.chart-grid{ display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-bottom:14px; }
.chart-panel{ background:var(--panel); border:1px solid var(--line); border-radius:8px; padding:16px 18px; }
.chart-panel-head{ margin-bottom:6px; }
.chart-title{ font-family:'Rajdhani',sans-serif; font-weight:600; font-size:15px; }
.chart-sub{ font-size:11px; color:var(--text-dim); margin-top:2px; }

.bottom-grid{ display:grid; grid-template-columns:1fr 1.6fr; gap:14px; }
.health-panel, .log-panel{ background:var(--panel); border:1px solid var(--line); border-radius:8px; padding:16px 18px; }
.health-list{ margin-top:12px; display:flex; flex-direction:column; gap:12px; }
.health-row{ display:flex; align-items:center; gap:10px; font-size:12px; }
.health-led{ width:7px; height:7px; border-radius:50%; background:var(--green); animation:ledPulse 2s ease-in-out infinite; }
.health-label{ color:var(--text-dim); flex:1; }
.health-value{ font-family:'IBM Plex Mono',monospace; color:var(--text); }

.log-list{ margin-top:12px; display:flex; flex-direction:column; gap:10px; }
.log-row{
  display:flex; align-items:center; flex-wrap:wrap; gap:8px 10px; font-size:12px;
  opacity:0; animation:fadeSlideUp .3s ease forwards;
  border-bottom:1px solid var(--line); padding-bottom:9px;
}
.log-row:last-child{ border-bottom:none; padding-bottom:0; }
.log-dot{ width:6px; height:6px; border-radius:50%; flex:none; }
.log-green{ background:var(--green); } .log-amber{ background:var(--amber); } .log-red{ background:var(--red); }
.log-time{ font-family:'IBM Plex Mono',monospace; color:var(--text-dim); flex:none; }
.log-actor{ font-family:'Rajdhani',sans-serif; font-weight:600; color:var(--text); }
.log-title{ font-family:'Rajdhani',sans-serif; font-weight:600; color:var(--amber); }
.log-unit-tag{
  display:inline-flex; align-items:center; gap:4px; font-size:10px; color:var(--amber);
  background:var(--panel-raised); border:1px solid var(--line); border-radius:20px; padding:2px 8px;
}
.log-text{ color:var(--text-dim); flex:1 1 100%; }
.empty{ color:var(--text-dim); font-size:12px; }

@media (max-width:900px){
  .chart-grid{ grid-template-columns:1fr; }
  .bottom-grid{ grid-template-columns:1fr; }
}
`;
