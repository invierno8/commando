import React, { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar, Cell,
} from "recharts";
import { Boxes, ClipboardList, Activity, TrendingUp, ChevronLeft, ListTree } from "lucide-react";
import UnitEmblem from "./UnitEmblem.jsx";
import ScopePicker, { ALL_SCOPE, SCOPE_PICKER_CSS } from "./ScopePicker.jsx";
import PhotoTile from "./PhotoTile.jsx";
import ProductDossier from "./ProductDossier.jsx";
import Loading from "./Loading.jsx";
import { StatusPill } from "./opsData.jsx";
import { fetchBrigadeUnits, fetchBrigadeCatalog, fetchBrigadeTickets, fetchBrigadeDashboard } from "./brigadeStore.js";

/* ================================================================== */
/* LEGO BLOCK — design tokens shared with the rest of the system.      */
/* ================================================================== */

const TOKENS = {
  panel: "var(--panel)", line: "var(--line)", text: "var(--text)", textDim: "var(--text-dim)",
  accent: "var(--accent)", green: "var(--green)", yellow: "var(--yellow)", red: "var(--red)",
};

/* ================================================================== */
/* LEGO BLOCK — derive everything from a single scope value, on top of */
/* whatever this brigade's dashboard dataset resolved from the store.  */
/* ================================================================== */

function getScopedData(scope, units, dash) {
  const scopedUnits = scope === ALL_SCOPE ? units : [scope];
  const rows = dash.ticketsByUnit.filter((r) => scopedUnits.includes(r.unit));

  const totals = rows.reduce(
    (acc, r) => ({ approved: acc.approved + r.approved, pending: acc.pending + r.pending, rejected: acc.rejected + r.rejected }),
    { approved: 0, pending: 0, rejected: 0 }
  );

  const priorityMap = { red: TOKENS.red, yellow: TOKENS.yellow, green: TOKENS.green };
  const priorityBreakdown = scopedUnits
    .flatMap((u) => dash.priorityByUnit[u] || [])
    .reduce((acc, p) => {
      const existing = acc.find((a) => a.key === p.key);
      if (existing) existing.value += p.value;
      else acc.push({ ...p });
      return acc;
    }, [])
    .sort((a, b) => (a.key === "red" ? -1 : b.key === "red" ? 1 : a.key === "yellow" ? -1 : 1))
    .map((p) => ({ ...p, color: priorityMap[p.key] }));

  const trend = dash.trendDays.map((d, i) => {
    const opened = scopedUnits.reduce((sum, u) => sum + (dash.trendByUnit[u]?.[i] || 0), 0);
    return { d, opened, approved: Math.round(opened * 0.78), rejected: Math.round(opened * 0.12) };
  });

  const activity = scope === ALL_SCOPE ? dash.activityLog : dash.activityLog.filter((a) => a.unit === scope);
  const last7 = trend.slice(-7);
  const trendChangePct = last7.length >= 2
    ? Math.round(((last7[last7.length - 1].opened - last7[0].opened) / Math.max(1, last7[0].opened)) * 100)
    : 0;

  return {
    total: totals.approved + totals.pending + totals.rejected,
    totals, priorityBreakdown, trend, activity, trendChangePct,
  };
}

function conditionFor(qty) {
  if (qty >= 40) return { label: "תקין", tone: "green" };
  if (qty >= 10) return { label: "מוגבל", tone: "yellow" };
  return { label: "קריטי", tone: "red" };
}

function tooltipStyle() {
  return {
    contentStyle: { background: TOKENS.panel, border: `1px solid ${TOKENS.line}`, borderRadius: 8, fontFamily: "var(--font-mono)", fontSize: 12, color: TOKENS.text, boxShadow: "var(--shadow-md)" },
    labelStyle: { color: TOKENS.textDim },
    cursor: { fill: "var(--panel-raised)" },
  };
}

/* ================================================================== */
/* Root                                                                */
/* ================================================================== */

export default function DevDashboard({ brigadeId }) {
  const [scope, setScope] = useState(ALL_SCOPE);
  const [openItem, setOpenItem] = useState(null);
  const [loaded, setLoaded] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoaded(null);
    setScope(ALL_SCOPE);
    Promise.all([
      fetchBrigadeUnits(brigadeId),
      fetchBrigadeCatalog(brigadeId),
      fetchBrigadeTickets(brigadeId),
      fetchBrigadeDashboard(brigadeId),
    ]).then(([units, catalog, tickets, dash]) => {
      if (!cancelled) setLoaded({ units, catalog, tickets, dash });
    });
    return () => { cancelled = true; };
  }, [brigadeId]);

  const data = useMemo(
    () => (loaded ? getScopedData(scope, loaded.units, loaded.dash) : null),
    [scope, loaded]
  );

  if (!loaded) {
    return (
      <div dir="rtl" className="dash">
        <style>{CSS}</style>
        <Loading />
      </div>
    );
  }

  const { units, catalog, tickets, dash } = loaded;

  if (units.length === 0) {
    return (
      <div dir="rtl" className="dash">
        <style>{CSS}</style>
        <div className="empty-state">
          לחטיבה זו עדיין אין נתונים — היא ממתינה שקצין אמל״ח החטיבה ישלים את אשף ההתקנה.
        </div>
      </div>
    );
  }

  const openRequests = [...tickets].sort((a, b) => (a.status === "pending" ? -1 : 1)).slice(0, 5);

  return (
    <div dir="rtl" className="dash">
      <style>{CSS}</style>

      <div className="dash-toprow">
        <div className="dash-kpis">
          <MiniKpi label="סה״כ דרישות" value={data.total} />
          <MiniKpi label="ממתינות" value={data.totals.pending} tone="yellow" />
          <MiniKpi label="אושרו" value={data.totals.approved} tone="green" />
          <MiniKpi label="סורבו" value={data.totals.rejected} tone="red" />
        </div>
        <ScopePicker scope={scope} setScope={setScope} units={units} />
      </div>

      <section className="panel-card dash-section">
        <div className="panel-card-head">
          <div className="panel-card-title"><Boxes size={16} /> מצב ציוד</div>
          <span className="panel-card-hint">גלילה אופקית לצפייה בכל הפריטים</span>
        </div>
        <div className="equip-scroll">
          {catalog.map((it) => {
            const cond = conditionFor(it.qty);
            return (
              <button className="equip-card" key={it.id} onClick={() => setOpenItem(it)}>
                <div className="equip-card-info">
                  <div className="equip-card-name">{it.name}</div>
                  <div className="equip-card-id">{it.id}</div>
                  <div className="equip-card-row"><span>כמות</span><b>{it.qty}</b></div>
                  <div className="equip-card-row"><span>קטגוריה</span><b>{it.category}</b></div>
                  <div className="equip-card-row"><span>אחראי</span><b>{it.responsibleRank} {it.responsibleName}</b></div>
                  <span className={`pill pill-${cond.tone} equip-card-pill`}>{cond.label}</span>
                </div>
                <PhotoTile iconKey={it.icon} size={78} iconSize={30} ribbon={false} />
                <span className="equip-card-more">לתעודת זהות <ChevronLeft size={13} /></span>
              </button>
            );
          })}
        </div>
      </section>

      <div className="dash-grid-2">
        <section className="panel-card dash-section">
          <div className="panel-card-head">
            <div className="panel-card-title"><ClipboardList size={16} /> בקשות פתוחות</div>
          </div>
          <div className="req-table">
            <div className="req-row req-head">
              <span>מזהה</span><span>סוג הדרישה</span><span>יחידה</span><span>סטטוס</span>
            </div>
            {openRequests.map((r) => (
              <div className="req-row" key={r.id}>
                <span className="req-id">{r.id}</span>
                <span className="req-title">{r.title}</span>
                <span className="req-unit"><UnitEmblem name={r.unit} size={16} showRing={false} />{r.unit}</span>
                <span><StatusPill status={r.status} /></span>
              </div>
            ))}
          </div>
        </section>

        <section className="panel-card dash-section readiness-card">
          <div className="panel-card-head">
            <div className="panel-card-title"><Activity size={16} /> מוכנות מערכת</div>
          </div>
          <div className="readiness-main">
            <div className="readiness-big">99.8%</div>
            <div className="readiness-big-label">זמינות מערכת (30 יום)</div>
          </div>
          <div className="readiness-grid">
            <div className="readiness-stat"><span>משתמשים פעילים</span><b>37</b></div>
            <div className="readiness-stat"><span>פריטים בקטלוג</span><b>{catalog.length}</b></div>
            <div className="readiness-stat"><span>זמן אישור ממוצע</span><b>6.4h</b></div>
            <div className="readiness-stat"><span>גרסת מערכת</span><b>0.1.0</b></div>
          </div>
          <div className="readiness-strip">
            {data.trend.slice(-7).map((t) => (
              <div className="readiness-strip-day" key={t.d}>
                <span className="readiness-strip-val">{t.opened}</span>
                <span className="readiness-strip-day-label">{t.d}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="dash-grid-2">
        <section className="panel-card dash-section">
          <div className="panel-card-head">
            <div className="panel-card-title"><TrendingUp size={16} /> דרישות שנפתחו — 14 יום אחרונים</div>
            <span className={"trend-badge" + (data.trendChangePct < 0 ? " trend-down" : "")}>
              {data.trendChangePct >= 0 ? "+" : ""}{data.trendChangePct}%
            </span>
          </div>
          <div className="dot-legend-row">
            <span className="dot-legend"><i className="dot-legend-dot" style={{ background: "var(--accent)" }} />נפתחו</span>
            <span className="dot-legend"><i className="dot-legend-dot" style={{ background: "var(--green)" }} />אושרו</span>
          </div>
          <ResponsiveContainer width="100%" height={210}>
            <AreaChart data={data.trend} margin={{ top: 6, right: 10, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id="trendFillOpened" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={TOKENS.accent} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={TOKENS.accent} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="trendFillApproved" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={TOKENS.green} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={TOKENS.green} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={TOKENS.line} strokeDasharray="3 4" vertical={false} />
              <XAxis dataKey="d" stroke={TOKENS.textDim} fontSize={11} tickLine={false} />
              <YAxis stroke={TOKENS.textDim} fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip {...tooltipStyle()} />
              <Area type="monotone" dataKey="opened" stroke={TOKENS.accent} strokeWidth={2} fill="url(#trendFillOpened)" />
              <Area type="monotone" dataKey="approved" stroke={TOKENS.green} strokeWidth={2} fill="url(#trendFillApproved)" />
            </AreaChart>
          </ResponsiveContainer>
        </section>

        <section className="panel-card dash-section">
          <div className="panel-card-head">
            <div className="panel-card-title"><ListTree size={16} /> תיעדוף דרישות מאושרות</div>
          </div>
          <div className="dot-legend-row">
            <span className="dot-legend"><i className="dot-legend-dot" style={{ background: "var(--red)" }} />דחוף</span>
            <span className="dot-legend"><i className="dot-legend-dot" style={{ background: "var(--yellow)" }} />בינוני</span>
            <span className="dot-legend"><i className="dot-legend-dot" style={{ background: "var(--green)" }} />שגרתי</span>
          </div>
          <div dir="ltr">
            <ResponsiveContainer width="100%" height={190}>
              <BarChart data={data.priorityBreakdown} layout="vertical" margin={{ top: 6, right: 20, left: 10, bottom: 0 }}>
                <CartesianGrid stroke={TOKENS.line} strokeDasharray="3 4" horizontal={false} />
                <XAxis type="number" stroke={TOKENS.textDim} fontSize={11} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="label" stroke={TOKENS.textDim} fontSize={12} tickLine={false} axisLine={false} width={72} />
                <Tooltip {...tooltipStyle()} />
                <Bar dataKey="value" radius={[0, 8, 8, 0]} maxBarSize={30}>
                  {data.priorityBreakdown.map((p) => <Cell key={p.key} fill={p.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <section className="panel-card dash-section">
        <div className="panel-card-head">
          <div className="panel-card-title">יומן פעילות אחרון</div>
        </div>
        <div className="log-list">
          {data.activity.length === 0 && <div className="empty">אין פעילות רשומה עבור יחידה זו.</div>}
          {data.activity.map((a, idx) => (
            <div className="log-row" key={idx} style={{ animationDelay: `${idx * 60}ms` }}>
              <span className={`log-dot log-${a.tone}`} />
              <span className="log-time">{a.date} · {a.time}</span>
              <span className="log-actor">{a.actor}</span>
              <span className="log-unit-tag"><UnitEmblem name={a.unit} size={14} showRing={false} />{a.unit}</span>
              <span className="log-title">{a.title}</span>
              <span className="log-text">{a.action}</span>
            </div>
          ))}
        </div>
      </section>

      {openItem && <ProductDossier item={openItem} onClose={() => setOpenItem(null)} />}
    </div>
  );
}

function MiniKpi({ label, value, tone }) {
  return (
    <div className={"mini-kpi" + (tone ? ` mini-kpi-${tone}` : "")}>
      <div className="mini-kpi-value"><span className="count-up">{value}</span></div>
      <div className="mini-kpi-label">{label}</div>
    </div>
  );
}

/* ================================================================== */
/* CSS                                                                 */
/* ================================================================== */

const CSS = `
@keyframes fadeSlideUp{ from{ opacity:0; transform:translateY(8px); } to{ opacity:1; transform:translateY(0); } }

.dash{ display:flex; flex-direction:column; gap:16px; }
.dash-section{ padding:16px 18px 18px; }
.panel-card-hint{ font-size:11.5px; color:var(--text-dim); }

.dash-toprow{ display:flex; align-items:center; justify-content:space-between; gap:16px; flex-wrap:wrap; }
.dash-kpis{ display:flex; gap:10px; flex-wrap:wrap; }
.mini-kpi{
  background:var(--panel); border:1px solid var(--line); border-radius:var(--radius-card); padding:12px 18px;
  min-width:110px; opacity:0; animation:fadeSlideUp .3s ease forwards;
}
.mini-kpi-value{ font-weight:800; font-size:22px; }
.mini-kpi-label{ font-size:11.5px; color:var(--text-dim); margin-top:2px; }
.mini-kpi-yellow .mini-kpi-value{ color:var(--yellow); }
.mini-kpi-green .mini-kpi-value{ color:var(--green); }
.mini-kpi-red .mini-kpi-value{ color:var(--red); }

${SCOPE_PICKER_CSS}

.equip-scroll{ display:flex; gap:14px; overflow-x:auto; padding:16px 2px 4px; scroll-snap-type:x proximity; }
.equip-card{
  scroll-snap-align:start; flex:none; width:260px; display:flex; align-items:flex-start; gap:12px;
  background:var(--panel-raised); border:1px solid var(--line); border-radius:var(--radius-card);
  padding:16px; text-align:right; cursor:pointer; color:var(--text); position:relative;
  transition:border-color .15s ease, box-shadow .15s ease;
}
.equip-card:hover{ border-color:var(--accent); box-shadow:var(--shadow-sm); }
.equip-card-info{ flex:1; display:flex; flex-direction:column; gap:5px; }
.equip-card-name{ font-weight:700; font-size:14.5px; }
.equip-card-id{ font-family:var(--font-mono); font-size:11px; color:var(--accent); margin-bottom:4px; }
.equip-card-row{ display:flex; justify-content:space-between; gap:8px; font-size:11.5px; color:var(--text-dim); }
.equip-card-row b{ color:var(--text); font-weight:600; }
.equip-card-pill{ margin-top:6px; align-self:flex-start; }
.equip-card-more{
  position:absolute; bottom:10px; left:16px; display:flex; align-items:center; gap:3px;
  font-size:10.5px; color:var(--text-dim);
}

.dash-grid-2{ display:grid; grid-template-columns:1.5fr 1fr; gap:16px; }

.req-table{ display:flex; flex-direction:column; margin-top:10px; }
.req-row{ display:grid; grid-template-columns:90px 1fr 110px 130px; align-items:center; gap:10px; padding:11px 4px; border-bottom:1px solid var(--line); font-size:13px; }
.req-row:last-child{ border-bottom:none; }
.req-head{ font-family:var(--font-mono); font-size:10.5px; color:var(--text-dim); text-transform:uppercase; letter-spacing:.05em; }
.req-id{ font-family:var(--font-mono); font-size:12px; color:var(--accent); }
.req-title{ font-weight:600; }
.req-unit{ display:inline-flex; align-items:center; gap:6px; font-size:12.5px; color:var(--text-dim); }

.readiness-card{ display:flex; flex-direction:column; }
.readiness-main{ text-align:center; padding:10px 0 14px; border-bottom:1px solid var(--line); margin-bottom:14px; }
.readiness-big{ font-size:34px; font-weight:800; color:var(--accent); }
.readiness-big-label{ font-size:12px; color:var(--text-dim); margin-top:2px; }
.readiness-grid{ display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:14px; }
.readiness-stat{ background:var(--panel-raised); border:1px solid var(--line); border-radius:9px; padding:9px 11px; font-size:11px; color:var(--text-dim); display:flex; flex-direction:column; gap:4px; }
.readiness-stat b{ font-size:15px; color:var(--text); font-family:var(--font-mono); font-weight:600; }
.readiness-strip{ display:flex; justify-content:space-between; gap:4px; margin-top:auto; padding-top:10px; border-top:1px solid var(--line); }
.readiness-strip-day{ display:flex; flex-direction:column; align-items:center; gap:3px; font-size:10px; color:var(--text-dim); }
.readiness-strip-val{ font-family:var(--font-mono); font-weight:700; color:var(--text); font-size:12px; }

.dot-legend-row{ display:flex; gap:16px; margin:10px 2px 0; }

.trend-badge{ background:var(--panel-raised); border:1px solid var(--line); border-radius:20px; padding:3px 10px; }
.trend-badge.trend-down{ color:var(--red); }

.log-list{ display:flex; flex-direction:column; gap:10px; margin-top:10px; }
.log-row{
  display:flex; align-items:center; flex-wrap:wrap; gap:8px 10px; font-size:13px;
  opacity:0; animation:fadeSlideUp .25s ease forwards;
  border-bottom:1px solid var(--line); padding-bottom:9px;
}
.log-row:last-child{ border-bottom:none; padding-bottom:0; }
.log-dot{ width:6px; height:6px; border-radius:50%; flex:none; }
.log-green{ background:var(--green); } .log-yellow{ background:var(--yellow); } .log-red{ background:var(--red); }
.log-time{ font-family:var(--font-mono); color:var(--text-dim); flex:none; }
.log-actor{ font-weight:600; color:var(--text); }
.log-title{ font-weight:600; color:var(--accent); }
.log-unit-tag{ display:inline-flex; align-items:center; gap:4px; font-size:11px; color:var(--accent); background:var(--panel-raised); border:1px solid var(--line); border-radius:20px; padding:2px 9px; }
.log-text{ color:var(--text-dim); flex:1 1 100%; }
.empty{ color:var(--text-dim); font-size:13px; }

@media (max-width:900px){
  .dash-grid-2{ grid-template-columns:1fr; }
}
`;
