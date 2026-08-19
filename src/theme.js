export const THEME_STORAGE_KEY = "hangar-theme";

export function readStoredTheme() {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function persistTheme(theme) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* private browsing / storage disabled — theme just won't persist */
  }
}

/* ================================================================== */
/* Global design tokens — modeled on modern defense-tech product UI    */
/* (Anduril-style C2 consoles): near-black canvas, a single confident  */
/* accent color carrying both brand and "positive/success" meaning,    */
/* solid-fill status pills instead of outlined tags, generous card     */
/* radius. Everything is a token — screens never hardcode a color.     */
/* ================================================================== */

export const THEME_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Assistant:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600&display=swap');

:root{
  --bg:#F2F4F5;
  --panel:#FFFFFF;
  --panel-raised:#EAEDEF;
  --line:#DBE0E3;
  --text:#11151A;
  --text-dim:#5B6570;
  --accent:#159865;
  --accent-ink:#FFFFFF;
  --green:#159865;
  --yellow:#B3790E;
  --red:#C23B2E;
  --dev:#B3790E;
  --shadow-sm:0 1px 2px rgba(15,18,21,.08);
  --shadow-md:0 12px 28px rgba(15,18,21,.12);
  --radius-card:12px;
  --font-sans:'Assistant','Segoe UI',sans-serif;
  --font-mono:'IBM Plex Mono',ui-monospace,monospace;
  color-scheme:light;
}

[data-theme="dark"]{
  --bg:#0B0D0F;
  --panel:#15181B;
  --panel-raised:#1D2124;
  --line:#272C30;
  --text:#EDEFF1;
  --text-dim:#8A9199;
  --accent:#3ECF8E;
  --accent-ink:#06140D;
  --green:#3ECF8E;
  --yellow:#E0A73E;
  --red:#E2574C;
  --dev:#D98B32;
  --shadow-sm:0 1px 2px rgba(0,0,0,.4);
  --shadow-md:0 16px 34px rgba(0,0,0,.55);
  color-scheme:dark;
}

*{ box-sizing:border-box; }
html, body{ margin:0; background:var(--bg); }

/* ------------------------------------------------------------------ */
/* App shell — fixed icon sidebar + slim top bar + a soft accent glow  */
/* bleeding down from the top edge, like a powered-on console.         */
/* ------------------------------------------------------------------ */

.app-shell{
  min-height:100vh;
  display:flex;
  background:var(--bg);
  color:var(--text);
  font-family:var(--font-sans);
  font-size:14px;
  position:relative;
}
.app-glow{
  position:fixed; top:0; left:0; right:0; height:280px; pointer-events:none; z-index:0;
  background:radial-gradient(60% 100% at 50% 0%, color-mix(in srgb, var(--accent) 16%, transparent), transparent 70%);
}

.app-sidebar{
  position:sticky; top:0; align-self:flex-start; height:100vh; flex:none; z-index:20;
  display:flex; flex-direction:column; align-items:center; gap:6px;
  width:68px; padding:16px 0; background:var(--panel); border-inline-end:1px solid var(--line);
  transition:width .18s ease;
}
.app-sidebar.expanded{ width:216px; align-items:stretch; padding-inline:12px; }
.sidebar-mark{
  width:38px; height:38px; border-radius:9px; background:var(--accent); color:var(--accent-ink);
  display:flex; align-items:center; justify-content:center; font-family:var(--font-mono); font-weight:700;
  font-size:12px; flex:none; margin-bottom:14px;
}
.app-sidebar.expanded .sidebar-mark{ margin-inline:auto; }
.sidebar-nav{ display:flex; flex-direction:column; gap:4px; width:100%; align-items:center; }
.app-sidebar.expanded .sidebar-nav{ align-items:stretch; }
.sidebar-btn{
  display:flex; align-items:center; gap:11px; width:44px; height:44px; justify-content:center;
  border-radius:9px; border:1px solid transparent; background:transparent; color:var(--text-dim);
  cursor:pointer; transition:background .15s ease, color .15s ease; position:relative; flex:none;
}
.app-sidebar.expanded .sidebar-btn{ width:100%; justify-content:flex-start; padding-inline:11px; }
.sidebar-btn:hover{ background:var(--panel-raised); color:var(--text); }
.sidebar-btn.active{ background:var(--accent); color:var(--accent-ink); }
.sidebar-btn-label{ display:none; font-weight:600; font-size:13.5px; white-space:nowrap; }
.app-sidebar.expanded .sidebar-btn-label{ display:inline; }
.sidebar-btn-dev-dot{
  position:absolute; top:5px; left:5px; width:7px; height:7px; border-radius:50%; background:var(--dev);
  border:1.5px solid var(--panel);
}
.sidebar-spacer{ flex:1; }
.sidebar-toggle{
  width:32px; height:32px; border-radius:8px; border:1px solid var(--line); background:var(--panel-raised);
  color:var(--text-dim); display:flex; align-items:center; justify-content:center; cursor:pointer;
  transition:color .15s ease, transform .18s ease;
}
.sidebar-toggle:hover{ color:var(--text); }
.app-sidebar.expanded .sidebar-toggle svg{ transform:rotate(180deg); }

.app-main-col{ flex:1; min-width:0; display:flex; flex-direction:column; position:relative; z-index:1; }

.app-topbar{
  display:flex; align-items:center; justify-content:space-between; gap:16px;
  padding:14px 26px; position:sticky; top:0; z-index:15;
  background:color-mix(in srgb, var(--bg) 88%, transparent); backdrop-filter:blur(10px);
  border-bottom:1px solid var(--line);
}
.app-topbar-title{ display:flex; align-items:center; gap:12px; }
.app-topbar-title h1{ font-size:19px; font-weight:700; margin:0; }
.app-topbar-crumb{ font-size:12px; color:var(--text-dim); font-family:var(--font-mono); }

.app-topbar-right{ display:flex; align-items:center; gap:14px; }
.icon-btn{
  width:36px; height:36px; border-radius:9px; border:1px solid var(--line); background:var(--panel);
  color:var(--text-dim); display:flex; align-items:center; justify-content:center; cursor:pointer;
  transition:color .15s ease, border-color .15s ease; position:relative; flex:none;
}
.icon-btn:hover{ color:var(--text); border-color:var(--text-dim); }
.icon-btn-dot{
  position:absolute; top:-2px; left:-2px; min-width:16px; height:16px; padding:0 3px; border-radius:8px;
  background:var(--red); color:#fff; font-size:9.5px; font-weight:700; display:flex; align-items:center; justify-content:center;
  font-family:var(--font-mono); border:2px solid var(--bg);
}

.theme-toggle{ display:flex; align-items:center; gap:2px; background:var(--panel-raised); border:1px solid var(--line); border-radius:9px; padding:3px; }
.theme-toggle-opt{
  display:flex; align-items:center; justify-content:center; width:30px; height:30px; border:none; background:transparent;
  color:var(--text-dim); border-radius:7px; cursor:pointer; transition:background .15s ease, color .15s ease;
}
.theme-toggle-opt.active{ background:var(--panel); color:var(--accent); box-shadow:var(--shadow-sm); }
.theme-toggle-opt svg{ width:15px; height:15px; }

.user-chip{ display:flex; align-items:center; gap:10px; }
.user-avatar{
  width:36px; height:36px; border-radius:50%; background:var(--panel-raised); border:1px solid var(--line);
  display:flex; align-items:center; justify-content:center; color:var(--text-dim); flex:none;
}
.user-chip-text{ text-align:right; line-height:1.25; }
.user-chip-name{ font-size:13px; font-weight:700; }
.user-chip-role{ font-size:11px; color:var(--text-dim); }

.app-body{ padding:24px 26px 40px; position:relative; z-index:1; flex:1; }

/* ------------------------------------------------------------------ */
/* Environment strip — dev/demo indicator + role simulator, now a      */
/* compact bar under the top bar instead of a loud banner.             */
/* ------------------------------------------------------------------ */

.env-strip{
  display:flex; align-items:center; justify-content:space-between; gap:16px;
  padding:8px 26px; background:color-mix(in srgb, var(--dev) 8%, var(--bg));
  border-bottom:1px solid var(--line);
  color:var(--text-dim); font-family:var(--font-mono); font-size:11.5px; letter-spacing:.03em;
  flex-wrap:wrap; position:relative; z-index:10;
}
.env-strip-tag{
  border:1px solid var(--dev); color:var(--dev); padding:1px 9px; border-radius:3px; font-weight:600;
}
.env-strip-clock{ font-variant-numeric:tabular-nums; }
.env-strip-persona{ font-size:11px; color:var(--dev); margin-inline-start:8px; padding-inline-start:8px; border-inline-start:1px solid var(--dev); }

.dev-only{
  border:1px dashed var(--dev); border-radius:9px; padding:8px 10px; position:relative;
  background:color-mix(in srgb, var(--dev) 6%, transparent);
}
.dev-only-tag{
  position:absolute; top:-9px; right:10px; background:var(--bg); color:var(--dev);
  font-family:var(--font-mono); font-size:9.5px; font-weight:700; letter-spacing:.06em;
  padding:0 6px; text-transform:uppercase;
}
.dev-badge{
  display:inline-flex; align-items:center; gap:4px; font-family:var(--font-mono); font-size:9.5px;
  font-weight:700; letter-spacing:.05em; color:var(--dev); border:1px solid var(--dev);
  border-radius:3px; padding:1px 6px; text-transform:uppercase; margin-inline-start:6px; vertical-align:middle;
}

/* ------------------------------------------------------------------ */
/* Shared card / pill / table primitives — the "lego bricks" every     */
/* screen composes from, so a new dashboard widget always matches.     */
/* ------------------------------------------------------------------ */

.panel-card{
  background:var(--panel); border:1px solid var(--line); border-radius:var(--radius-card);
  box-shadow:var(--shadow-sm);
}
.panel-card-head{ display:flex; align-items:center; justify-content:space-between; gap:10px; padding:16px 18px 0; }
.panel-card-title{ font-size:14.5px; font-weight:700; display:flex; align-items:center; gap:8px; }
.panel-card-link{ display:flex; align-items:center; gap:4px; font-size:12px; color:var(--text-dim); text-decoration:none; cursor:pointer; background:none; border:none; font-family:var(--font-sans); }
.panel-card-link:hover{ color:var(--accent); }

.pill{
  display:inline-flex; align-items:center; gap:5px; font-size:11px; font-weight:700; letter-spacing:.02em;
  padding:4px 11px; border-radius:20px; white-space:nowrap; font-family:var(--font-sans);
}
.pill-green{ background:var(--green); color:#fff; }
.pill-yellow{ background:var(--yellow); color:#fff; }
.pill-red{ background:var(--red); color:#fff; }
.pill-neutral{ background:var(--panel-raised); color:var(--text-dim); border:1px solid var(--line); }
.pill-outline-accent{ border:1px solid var(--accent); color:var(--accent); background:transparent; }

.dot-legend{ display:flex; align-items:center; gap:6px; font-size:12px; color:var(--text-dim); }
.dot-legend-dot{ width:8px; height:8px; border-radius:50%; flex:none; }

.trend-badge{
  display:inline-flex; align-items:center; gap:3px; font-family:var(--font-mono); font-size:12px; font-weight:700;
  color:var(--green);
}

.pill-tabs{ display:flex; gap:8px; flex-wrap:wrap; }
.pill-tab{
  background:transparent; border:1px solid var(--line); color:var(--text-dim); border-radius:9px;
  padding:9px 18px; font-family:var(--font-sans); font-weight:700; font-size:13.5px; cursor:pointer;
  transition:border-color .15s ease, color .15s ease, background .15s ease;
}
.pill-tab:hover{ color:var(--text); }
.pill-tab.active{ background:var(--accent); color:var(--accent-ink); border-color:var(--accent); }

.count-up{ font-variant-numeric:tabular-nums; }

/* ------------------------------------------------------------------ */
/* Loading state — every screen's data now comes through an async      */
/* per-brigade fetch (brigadeStore.js), so every screen needs one of    */
/* these while that promise resolves.                                  */
/* ------------------------------------------------------------------ */

@keyframes spin{ to{ transform:rotate(360deg); } }
.loading-state{
  display:flex; align-items:center; gap:10px; color:var(--text-dim); font-size:13.5px;
  padding:40px 0; justify-content:center;
}
.loading-spinner{
  width:16px; height:16px; border-radius:50%; flex:none;
  border:2px solid var(--line); border-top-color:var(--accent);
  animation:spin .7s linear infinite;
}
.empty-state{
  color:var(--text-dim); font-size:13.5px; text-align:center; padding:40px 20px;
  background:var(--panel-raised); border:1px dashed var(--line); border-radius:var(--radius-card);
}

/* Classification-marking photo tile — see PhotoTile.jsx */
.photo-tile{
  position:relative; overflow:hidden; border-radius:10px; border:1px solid var(--line);
  background:linear-gradient(135deg, var(--panel-raised) 0%, var(--panel) 65%);
  display:flex; align-items:center; justify-content:center; flex:none;
}
.photo-tile::after{
  content:""; position:absolute; inset:0; pointer-events:none;
  background-image:repeating-linear-gradient(135deg, transparent 0 9px, rgba(0,0,0,.035) 9px 10px);
}
.photo-tile svg{ position:relative; z-index:1; color:var(--text-dim); stroke-width:1.4; }
.photo-tile-ribbon{
  position:absolute; top:11px; left:-30px; width:120px; z-index:2;
  background:linear-gradient(90deg, var(--accent) 45%, transparent);
  color:var(--accent-ink); font-family:var(--font-mono); font-size:8.5px; font-weight:700; letter-spacing:.05em;
  text-align:center; padding:2.5px 0; transform:rotate(-45deg); transform-origin:center;
}

@media (max-width:860px){
  .app-sidebar{ display:none; }
  .app-body{ padding:18px; }
}
`;
