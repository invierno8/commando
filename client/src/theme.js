export const THEME_STORAGE_KEY = "hangar-theme";

export function readStoredTheme() {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
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
/* Global design tokens — HANGAR Design System v1.0 (2026-08-23). Dark   */
/* near-black canvas by default, a single mint accent carrying brand+    */
/* success meaning, near-square geometry (2-4px radius, no pill shapes   */
/* except status dots), corner-bracket accents (--brk/--brk-hot) instead */
/* of full borders for focus/selection, IBM Plex Sans Hebrew + IBM Plex  */
/* Mono for everything. Everything is a token — screens never hardcode   */
/* a color, radius, or timing value.                                     */
/*                                                                        */
/* --red/--green/--yellow are kept as aliases onto --danger/--accent/     */
/* --warn so existing screen code (written against the previous token    */
/* set) keeps resolving correctly without a mechanical rename pass —     */
/* new/updated screens should reach for the semantic names directly.     */
/*                                                                        */
/* Jynx (the dev/QA overlay, client/src/devtools/) is a separate tool     */
/* riding on top of this app and keeps its OWN pre-existing palette —     */
/* see the .jynx-chrome/.jynx-ui pin block below, which re-fixes every    */
/* token Jynx depends on to its previous value in both theme states, so   */
/* this redesign has zero visual effect on it.                            */
/* ================================================================== */

export const THEME_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Assistant:wght@400;500;600;700;800&family=IBM+Plex+Sans+Hebrew:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&family=Space+Grotesk:wght@600;700&display=swap');

:root, [data-theme="dark"]{
  --bg:#0A0B0C; --bg-sunk:#060708; --panel:#101215; --panel-raised:#17191D; --panel-hi:#1E2126;
  --line:#23262B; --line-strong:#33383E;
  --edge:rgba(233,236,239,.55); --edge-hot:rgba(233,236,239,.95); --grid:rgba(255,255,255,.016);
  --text:#E9ECEF; --text-dim:#868E97; --text-mute:#767E86;
  --accent:#35E08F; --accent-ink:#04150C; --accent-soft:rgba(53,224,143,.12);
  --warn:#E6A93C; --warn-soft:rgba(230,169,60,.14);
  --danger:#E85A4D; --danger-soft:rgba(232,90,77,.14);
  --info:#4A9EDA; --info-soft:rgba(74,158,218,.14); --violet:#9B82FF;
  --jynx:#9B82FF; --dev:var(--warn);
  --red:var(--danger); --green:var(--accent); --yellow:var(--warn);
  --shadow-sm:0 4px 12px rgba(0,0,0,.35); --shadow-md:0 16px 34px rgba(0,0,0,.55); --shadow-2:0 14px 34px rgba(0,0,0,.6);
  --radius-sm:2px; --radius-md:3px; --radius-lg:4px; --radius-card:var(--radius-lg);
  --s1:4px; --s2:8px; --s3:12px; --s4:16px; --s6:24px; --s8:40px;
  --t-instant:90ms; --t-fast:140ms; --t-base:200ms; --t-slow:300ms; --t-enter:420ms;
  --ease:cubic-bezier(.2,.8,.25,1); --ease-snap:cubic-bezier(.16,1,.3,1); --ease-io:cubic-bezier(.6,0,.3,1);
  --brk:
    linear-gradient(var(--edge),var(--edge)) 0 0/14px 1.5px no-repeat,
    linear-gradient(var(--edge),var(--edge)) 0 0/1.5px 14px no-repeat,
    linear-gradient(var(--edge),var(--edge)) 100% 0/14px 1.5px no-repeat,
    linear-gradient(var(--edge),var(--edge)) 100% 0/1.5px 14px no-repeat,
    linear-gradient(var(--edge),var(--edge)) 0 100%/14px 1.5px no-repeat,
    linear-gradient(var(--edge),var(--edge)) 0 100%/1.5px 14px no-repeat,
    linear-gradient(var(--edge),var(--edge)) 100% 100%/14px 1.5px no-repeat,
    linear-gradient(var(--edge),var(--edge)) 100% 100%/1.5px 14px no-repeat;
  --brk-hot:
    linear-gradient(var(--edge-hot),var(--edge-hot)) 0 0/22px 1.5px no-repeat,
    linear-gradient(var(--edge-hot),var(--edge-hot)) 0 0/1.5px 22px no-repeat,
    linear-gradient(var(--edge-hot),var(--edge-hot)) 100% 0/22px 1.5px no-repeat,
    linear-gradient(var(--edge-hot),var(--edge-hot)) 100% 0/1.5px 22px no-repeat,
    linear-gradient(var(--edge-hot),var(--edge-hot)) 0 100%/14px 1.5px no-repeat,
    linear-gradient(var(--edge-hot),var(--edge-hot)) 0 100%/1.5px 22px no-repeat,
    linear-gradient(var(--edge-hot),var(--edge-hot)) 100% 100%/22px 1.5px no-repeat,
    linear-gradient(var(--edge-hot),var(--edge-hot)) 100% 100%/1.5px 22px no-repeat;
  --font-sans:'IBM Plex Sans Hebrew','Assistant',system-ui,sans-serif;
  --font-mono:'IBM Plex Mono',ui-monospace,monospace;
  --font-jynx:'Space Grotesk','Segoe UI',sans-serif;
  color-scheme:dark;
}

[data-theme="light"]{
  --bg:#E9EAE7; --bg-sunk:#DFE1DD; --panel:#F5F6F3; --panel-raised:#EEEFEB; --panel-hi:#E4E6E1;
  --line:#D3D6D0; --line-strong:#B5B9B2;
  --edge:rgba(26,29,26,.36); --edge-hot:rgba(26,29,26,.68); --grid:rgba(0,0,0,.016);
  --text:#23282A; --text-dim:#5F6862; --text-mute:#6E766E;
  --accent:#107D57; --accent-ink:#FFFFFF; --accent-soft:rgba(16,125,87,.10);
  --warn:#8F6208; --warn-soft:rgba(169,112,10,.12);
  --danger:#B33F33; --danger-soft:rgba(194,59,46,.10);
  --info:#2F7FB8; --info-soft:rgba(47,127,184,.10); --violet:#6F52E0;
  --jynx:#7C5CFC;
  --shadow-sm:0 1px 3px rgba(26,29,26,.10); --shadow-md:0 14px 30px rgba(26,29,26,.10); --shadow-2:0 14px 30px rgba(26,29,26,.10);
  color-scheme:light;
}

/* Jynx keeps its pre-redesign palette, both themes — see file-level note */
/* above. Every token this rule sets is one Jynx's own CSS (theme.js's    */
/* .dev-fab*/.jynx-*/.env-strip-* rules below, plus every self-contained  */
/* <style> block under client/src/devtools/) actually consumes; anything  */
/* not listed here (the new --s*/--t-*/--brk tokens, --info, --violet,    */
/* --panel-hi, --text-mute, --line-strong) was never referenced by Jynx    */
/* to begin with, so it's fine for those to fall through to the new       */
/* values — inheriting an unused token has no visual effect.              */
.jynx-chrome, .jynx-ui{
  --bg:#F2F4F5; --panel:#FFFFFF; --panel-raised:#EAEDEF; --line:#DBE0E3;
  --text:#11151A; --text-dim:#5B6570; --accent:#159865; --accent-ink:#FFFFFF;
  --green:#159865; --yellow:#B3790E; --red:#C23B2E; --dev:#B3790E; --jynx:#7C5CFC;
  --shadow-sm:0 1px 2px rgba(15,18,21,.08); --shadow-md:0 12px 28px rgba(15,18,21,.12);
  --radius-card:12px;
  --font-sans:'Assistant','Segoe UI',sans-serif; --font-mono:'IBM Plex Mono',ui-monospace,monospace; --font-jynx:'Space Grotesk','Segoe UI',sans-serif;
}
[data-theme="dark"] .jynx-chrome, [data-theme="dark"] .jynx-ui{
  --bg:#0B0D0F; --panel:#15181B; --panel-raised:#1D2124; --line:#272C30;
  --text:#EDEFF1; --text-dim:#8A9199; --accent:#3ECF8E; --accent-ink:#06140D;
  --green:#3ECF8E; --yellow:#E0A73E; --red:#E2574C; --dev:#D98B32; --jynx:#9B82FF;
  --shadow-sm:0 1px 2px rgba(0,0,0,.4); --shadow-md:0 16px 34px rgba(0,0,0,.55);
}
/* .pill-tab is shared verbatim with Jynx's own filter tabs — it used a      */
/* literal 9px radius before .pill-tab switched to the new --radius-lg      */
/* token below, so pin the exact old shape here instead of touching the     */
/* token globally (which other, non-shared Jynx surfaces don't consume).    */
.jynx-chrome .pill-tab, .jynx-ui .pill-tab{ border-radius:9px; }

*{ box-sizing:border-box; }
html, body{ margin:0; background:var(--bg); }
h1,h2,h3{ font-family:var(--font-sans); font-weight:700; letter-spacing:-.015em; }
@media (prefers-reduced-motion: reduce){
  *, *::before, *::after{ animation-duration:.001ms !important; animation-iteration-count:1 !important; transition-duration:.001ms !important; }
}

/* ------------------------------------------------------------------ */
/* App shell — fixed icon sidebar + slim top bar + a soft accent glow  */
/* bleeding down from the top edge, like a powered-on console.         */
/* ------------------------------------------------------------------ */

.app-shell{
  min-height:100vh;
  display:flex;
  background:var(--bg);
  background-image:linear-gradient(var(--grid) 1px,transparent 1px),linear-gradient(90deg,var(--grid) 1px,transparent 1px);
  background-size:48px 48px,48px 48px;
  color:var(--text);
  font-family:var(--font-sans);
  font-size:14px;
  position:relative;
}
.app-glow{
  position:fixed; top:0; left:0; right:0; height:280px; pointer-events:none; z-index:0;
  background:radial-gradient(60% 100% at 50% 0%, color-mix(in srgb, var(--accent) 16%, transparent), transparent 70%);
}
/* Radar-sweep grid — the design system's own signature "something is    */
/* live here" background accent (see its own section 00 wrapper). A     */
/* colored copy of the same dot-grid, masked to a slowly-growing ring    */
/* radiating from center, looping forever underneath all real content.   */
@property --hgr{ syntax:"<percentage>"; inherits:false; initial-value:0%; }
@keyframes hg-radar{ 0%{ --hgr:0%; opacity:0; } 7%{ opacity:.5; } 65%{ opacity:.22; } 100%{ --hgr:125%; opacity:0; } }
.app-radar{
  position:fixed; inset:-10%; z-index:0; pointer-events:none;
  background-image:linear-gradient(color-mix(in srgb, var(--accent) 60%, transparent) 1px,transparent 1px),linear-gradient(90deg,color-mix(in srgb, var(--accent) 60%, transparent) 1px,transparent 1px);
  background-size:48px 48px,48px 48px;
  animation:hg-radar 8s linear infinite;
  -webkit-mask-image:radial-gradient(circle at 50% 30%,transparent calc(var(--hgr) - 10%),rgba(0,0,0,.9) var(--hgr),transparent calc(var(--hgr) + 12%));
  mask-image:radial-gradient(circle at 50% 30%,transparent calc(var(--hgr) - 10%),rgba(0,0,0,.9) var(--hgr),transparent calc(var(--hgr) + 12%));
}
@media (prefers-reduced-motion: reduce){ .app-radar{ display:none; } }

/* Corner-bracket accent — see --brk/--brk-hot in the token block above.  */
/* Applied surgically (max 2 per screen, per the design system's own      */
/* rule): the item currently selected/open, or a modal — never a whole    */
/* grid of cards, which reads as noise instead of focus.                  */
.hg-corners{ background:var(--brk),var(--panel); }
.hg-corners-raised{ background:var(--brk),var(--panel-raised); }
.hg-corners-hot{ background:var(--brk-hot),var(--panel-raised); transition:background var(--t-base) var(--ease); }

.app-sidebar{
  position:sticky; top:0; align-self:flex-start; height:100vh; flex:none; z-index:20;
  display:flex; flex-direction:column; align-items:center; gap:6px;
  width:68px; padding:16px 0; background:var(--panel); border-inline-end:1px solid var(--line);
  transition:width .18s ease;
}
.app-sidebar.expanded{ width:216px; align-items:stretch; padding-inline:12px; }
.sidebar-mark{
  width:38px; height:38px; border-radius:var(--radius-lg); background:var(--accent); color:var(--accent-ink);
  display:flex; align-items:center; justify-content:center; font-family:var(--font-mono); font-weight:700;
  font-size:12px; flex:none; margin-bottom:14px;
}
.app-sidebar.expanded .sidebar-mark{ margin-inline:auto; }

/* חטיבה → יחידה → צוות, בערימה אחת מתחת ללוגו — כל שכבה מוצגת רק אם     */
/* יש מה להציג (יחידה רק לתפקיד ששייך ליחידה אחת, צוות רק אם יש לו לוגו). */
/* כשהסיידבר פתוח (.expanded) כל פריט "נמתח" ומקבל תווית טקסט לצידו.      */
.sidebar-identity{ display:flex; flex-direction:column; align-items:center; gap:9px; width:100%; margin-bottom:16px; padding-bottom:14px; border-bottom:1px solid var(--line); }
.app-sidebar.expanded .sidebar-identity{ align-items:stretch; }
.sidebar-identity-item{ display:flex; align-items:center; gap:9px; justify-content:center; min-width:0; }
.app-sidebar.expanded .sidebar-identity-item{ justify-content:flex-start; }
.sidebar-identity-team-img{ width:19px; height:19px; border-radius:6px; object-fit:cover; flex:none; }
.app-sidebar.expanded .sidebar-identity-team-img{ width:22px; height:22px; }
.sidebar-identity-label{
  font-size:11.5px; color:var(--text-dim); font-weight:600; overflow:hidden; text-overflow:ellipsis;
  white-space:nowrap; min-width:0;
}
.sidebar-nav{ display:flex; flex-direction:column; gap:4px; width:100%; align-items:center; }
.app-sidebar.expanded .sidebar-nav{ align-items:stretch; }
.sidebar-btn{
  display:flex; align-items:center; gap:11px; width:44px; height:44px; justify-content:center;
  border-radius:var(--radius-lg); border:1px solid transparent; background:transparent; color:var(--text-dim);
  cursor:pointer; transition:background var(--t-fast) var(--ease), color var(--t-fast) var(--ease); position:relative; flex:none;
}
.app-sidebar.expanded .sidebar-btn{ width:100%; justify-content:flex-start; padding-inline:11px; }
.sidebar-btn:hover{ background:var(--panel-raised); color:var(--text); }
.sidebar-btn.active{ background:var(--accent); color:var(--accent-ink); }
.sidebar-btn::after{
  content:attr(data-tooltip); position:absolute; inset-inline-end:100%; top:50%; transform:translateY(-50%);
  margin-inline-end:8px; background:var(--panel-raised); color:var(--text); border:1px solid var(--line);
  padding:5px 10px; border-radius:var(--radius-md); font-size:12px; font-weight:600; white-space:nowrap;
  box-shadow:var(--shadow-sm); opacity:0; pointer-events:none; transition:opacity .05s ease;
}
.sidebar-btn:hover::after{ opacity:1; transition-delay:.05s; }
.app-sidebar.expanded .sidebar-btn::after{ display:none; }
.sidebar-btn-label{ display:none; font-weight:600; font-size:13.5px; white-space:nowrap; align-items:center; gap:7px; }
.app-sidebar.expanded .sidebar-btn-label{ display:inline-flex; }
.sidebar-btn-dev-dot{
  position:absolute; top:5px; left:5px; width:7px; height:7px; border-radius:50%; background:var(--dev);
  border:1.5px solid var(--panel);
}
.sidebar-btn-icon-wrap{ position:relative; display:flex; flex:none; }
.sidebar-btn-badge{
  position:absolute; top:-6px; left:-8px; min-width:15px; height:15px; padding:0 3px; border-radius:8px;
  background:var(--red); color:#fff; font-size:9px; font-weight:700; display:flex; align-items:center; justify-content:center;
  font-family:var(--font-mono); border:1.5px solid var(--panel);
}
.app-sidebar.expanded .sidebar-btn-badge{ display:none; }
.sidebar-btn-badge-inline{
  background:var(--red); color:#fff; font-size:10.5px; font-weight:700; min-width:18px; height:18px; padding:0 5px;
  border-radius:9px; display:flex; align-items:center; justify-content:center; font-family:var(--font-mono);
  margin-inline-start:auto;
}
.sidebar-btn-fav{
  display:none; align-items:center; justify-content:center; color:var(--text-dim); opacity:0; flex:none;
  transition:opacity .15s ease, color .15s ease; padding:2px; border-radius:5px; margin-inline-start:auto;
}
.app-sidebar.expanded .sidebar-btn-fav{ display:flex; }
.sidebar-btn:hover .sidebar-btn-fav{ opacity:1; }
.sidebar-btn-fav:hover{ color:var(--yellow); }
.sidebar-btn-fav.active{ opacity:1; color:var(--yellow); }
.sidebar-btn-fav.active svg{ fill:var(--yellow); }
.sidebar-spacer{ flex:1; }
.sidebar-toggle{
  width:32px; height:32px; border-radius:var(--radius-md); border:1px solid var(--line); background:var(--panel-raised);
  color:var(--text-dim); display:flex; align-items:center; justify-content:center; cursor:pointer;
  transition:color var(--t-fast) var(--ease), transform var(--t-base) var(--ease);
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
.app-topbar-title h1{ font-size:21px; font-weight:800; margin:0; }
.app-topbar-crumb{ font-size:12px; color:var(--text-dim); font-family:var(--font-mono); }

.app-topbar-mission{ flex:1; min-width:0; display:flex; justify-content:center; padding:0 16px; }
.app-topbar-mission-text{ font-size:13px; color:var(--text-dim); font-style:italic; white-space:nowrap;
  overflow:hidden; text-overflow:ellipsis; max-width:100%; }

.app-topbar-right{ display:flex; align-items:center; gap:14px; }
.icon-btn{
  width:36px; height:36px; border-radius:var(--radius-md); border:1px solid var(--line); background:var(--panel);
  color:var(--text-dim); display:flex; align-items:center; justify-content:center; cursor:pointer;
  transition:color var(--t-fast) var(--ease), border-color var(--t-fast) var(--ease); position:relative; flex:none;
}
.icon-btn:hover{ color:var(--text); border-color:var(--text-dim); }
.icon-btn-dot{
  position:absolute; top:-2px; left:-2px; min-width:16px; height:16px; padding:0 3px; border-radius:8px;
  background:var(--red); color:#fff; font-size:9.5px; font-weight:700; display:flex; align-items:center; justify-content:center;
  font-family:var(--font-mono); border:2px solid var(--bg);
}

/* מרכז התראות — פעמון בסרגל העליון + חלונית נפתחת. כל התראה קופצת ישירות  */
/* לפרטי הדרישה הרלוונטית (viewTicketDetail הקיים, אותו גשר crossNav       */
/* ששימש עד כה רק למעברי קטלוג↔דרישה). הרשימה מסוננת כבר ב-App.jsx לפי     */
/* הרשאת הצופה, כך שכל מה שמופיע כאן כבר "מותר" לו לראות.                  */
.notif-menu{ position:relative; }
.notif-dropdown{
  position:absolute; top:calc(100% + 8px); left:0; z-index:60; width:360px; max-width:90vw;
  background:var(--panel); border:1px solid var(--line); border-radius:var(--radius-lg); box-shadow:var(--shadow-md);
  animation:fadeSlideUp var(--t-base) var(--ease); overflow:hidden;
}
.notif-dropdown-head{
  display:flex; align-items:center; justify-content:space-between; padding:12px 14px; border-bottom:1px solid var(--line);
  font-family:var(--font-sans); font-weight:700; font-size:13px; color:var(--text);
}
.notif-mark-all{
  display:inline-flex; align-items:center; gap:5px; background:none; border:none; color:var(--accent);
  font-size:11.5px; font-weight:700; cursor:pointer; font-family:var(--font-sans); padding:0;
}
.notif-empty{ padding:26px 16px; text-align:center; color:var(--text-dim); font-size:13px; }
.notif-list{ max-height:420px; overflow-y:auto; display:flex; flex-direction:column; }
.notif-item{
  position:relative; display:flex; align-items:flex-start; gap:10px; padding:11px 14px; border:none;
  border-bottom:1px solid var(--line); background:var(--panel); cursor:pointer; text-align:right;
  font-family:var(--font-sans); transition:background .15s ease; width:100%;
}
.notif-item:last-child{ border-bottom:none; }
.notif-item:hover{ background:var(--panel-raised); }
.notif-item.unread{ background:color-mix(in srgb, var(--accent) 5%, var(--panel)); }
.notif-item-icon{
  flex:none; width:26px; height:26px; border-radius:50%; display:flex; align-items:center; justify-content:center; color:#fff;
}
.notif-item-icon.tone-green{ background:var(--green); }
.notif-item-icon.tone-red{ background:var(--red); }
.notif-item-icon.tone-yellow{ background:var(--yellow); }
.notif-item-icon.tone-blue{ background:var(--info); }
.notif-item-icon.tone-accent{ background:var(--accent); }
.notif-item-icon.tone-neutral{ background:var(--text-dim); }
.notif-item-body{ display:flex; flex-direction:column; gap:4px; min-width:0; flex:1; }
.notif-item-msg{ font-size:12.5px; color:var(--text); line-height:1.5; }
.notif-item-meta{ display:flex; align-items:center; gap:5px; font-size:11px; color:var(--text-dim); }
.notif-item-id{ font-family:var(--font-mono); color:var(--accent); font-style:normal; }
.notif-item-dot{ position:absolute; top:14px; left:12px; width:7px; height:7px; border-radius:50%; background:var(--accent); flex:none; }

@media (max-width:520px){
  .notif-dropdown{ position:fixed; top:64px; left:8px; right:8px; width:auto; }
}

.theme-toggle{ display:flex; align-items:center; gap:2px; background:var(--panel-raised); border:1px solid var(--line); border-radius:var(--radius-md); padding:3px; }
.theme-toggle-opt{
  display:flex; align-items:center; justify-content:center; width:30px; height:30px; border:none; background:transparent;
  color:var(--text-dim); border-radius:var(--radius-sm); cursor:pointer; transition:background var(--t-fast) var(--ease), color var(--t-fast) var(--ease);
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

.blocked-gate{
  max-width:480px; margin:60px auto; padding:36px 32px; text-align:center; display:flex; flex-direction:column;
  align-items:center; gap:10px; color:var(--red);
}
.blocked-gate h2{ color:var(--text); font-family:var(--font-sans); font-size:19px; margin:6px 0 0; }
.blocked-gate p{ color:var(--text-dim); font-size:14px; margin:0; }
.blocked-gate-reason{
  background:var(--panel-raised); border:1px solid var(--line); border-radius:var(--radius-md); padding:10px 16px;
  color:var(--text); font-size:13px; margin-top:6px;
}
.blocked-gate-hint{ color:var(--text-dim); font-size:11.5px; margin-top:14px; }

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
.env-strip-identity{
  display:flex; align-items:center; gap:8px; font-size:11px; color:var(--dev); margin-inline-start:8px;
  padding-inline-start:8px; border-inline-start:1px solid var(--dev);
}
.env-strip-identity input{
  background:var(--bg); border:1px solid var(--dev); border-radius:5px; padding:3px 8px; width:110px;
  color:var(--text); font-family:var(--font-mono); font-size:11px;
}
.env-strip-identity input:focus{ outline:none; box-shadow:0 0 0 2px color-mix(in srgb, var(--dev) 25%, transparent); }
.env-strip-member-block{ display:flex; flex-direction:column; gap:6px; margin-inline-start:8px; padding-inline-start:8px; border-inline-start:1px solid var(--dev); }
.member-identity-tabs{ margin:0; }
.member-identity-tabs .pill-tab{ padding:4px 9px !important; font-size:10.5px !important; }
.env-strip-hint{ font-size:10.5px; color:var(--text-dim); font-style:italic; max-width:220px; }
.officer-unit-pick select{
  background:var(--bg); border:1px solid var(--dev); border-radius:5px; padding:3px 8px;
  color:var(--text); font-family:var(--font-sans); font-size:11px; cursor:pointer;
}

/* Jynx הוא כלי נפרד מהאפליקציה עצמה (HANGAR, עברית/RTL) — לכן כל ה-UI שלו   */
/* עצמו (לא התוכן/הדאטה של האפליקציה שהוא מציג/עורך) באנגלית, LTR, וגופן     */
/* נבדל (Space Grotesk) — כדי שיורגש בבירור ככלי-פיתוח שיושב "מעל" המערכת,   */
/* לא כחלק ממנה. .jynx-ui הוא ה-hook המשותף לכל מכולת-שורש של Jynx.          */
.jynx-ui{ direction:ltr; text-align:left; font-family:var(--font-jynx); }
.dev-only{
  border:1px dashed var(--jynx); border-radius:9px; padding:8px 10px; position:relative;
  background:color-mix(in srgb, var(--jynx) 6%, transparent);
}
.dev-only-tag{
  position:absolute; top:-9px; left:10px; background:var(--bg); color:var(--jynx);
  font-family:var(--font-mono); font-size:9.5px; font-weight:700; letter-spacing:.06em;
  padding:0 6px; text-transform:uppercase;
}
/* בורר תפקיד/חטיבה של סביבת הפיתוח — מנוי צף בפינה הימנית-תחתונה במקום     */
/* רצועה קבועה שתפסה מקום בראש כל מסך. נשאר מעל כל תוכן (z-index גבוה) כי   */
/* הוא כלי דמו זמין תמיד, לא חלק מהתוכן התפעולי של המסך. כל כפתורי ה-Jynx    */
/* גרירים (ראו useDraggableFab.js), ולכן cursor:grab על הבסיס המשותף.        */
.dev-fab-wrap{ position:fixed; bottom:20px; right:20px; z-index:80; }
.dev-fab{
  display:flex; align-items:center; gap:6px; background:var(--panel); border:1px solid var(--jynx);
  color:var(--jynx); border-radius:20px; padding:8px 14px; cursor:grab; touch-action:none; box-shadow:var(--shadow-md);
  font-family:var(--font-jynx); font-size:12px; font-weight:700; letter-spacing:.02em; transition:background .15s ease;
}
.dev-fab:hover{ background:color-mix(in srgb, var(--jynx) 10%, var(--panel)); }
.dev-fab:active{ cursor:grabbing; }
.dev-fab svg{ color:var(--jynx); }
.dev-fab-tag{ border:1px solid var(--jynx); border-radius:3px; padding:1px 7px; }
.dev-fab-arrow{ transition:transform .18s ease; }
.jynx-logo{
  font-family:'Space Grotesk', var(--font-sans); font-weight:700; font-size:14px; letter-spacing:.03em;
  background:linear-gradient(100deg, var(--jynx), color-mix(in srgb, var(--jynx) 45%, #ffffff 55%));
  -webkit-background-clip:text; background-clip:text; color:transparent;
}
.dev-fab-arrow.open{ transform:rotate(-90deg); }
.dev-fab-panel{
  position:absolute; bottom:calc(100% + 10px); right:0; width:340px; max-width:88vw;
  background:var(--bg); box-shadow:var(--shadow-md); animation:fadeSlideUp .16s ease;
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
  padding:4px 11px; border-radius:var(--radius-md); white-space:nowrap; font-family:var(--font-mono);
}
.pill-green{ background:var(--green); color:#fff; }
.pill-yellow{ background:var(--yellow); color:#fff; }
.pill-red{ background:var(--red); color:#fff; }
.pill-blue{ background:var(--info); color:#fff; }
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
  background:transparent; border:1px solid var(--line); color:var(--text-dim); border-radius:var(--radius-lg);
  padding:9px 18px; font-family:var(--font-sans); font-weight:700; font-size:13.5px; cursor:pointer;
  transition:border-color .15s ease, color .15s ease, background .15s ease;
}
.pill-tab:hover{ color:var(--text); }
.pill-tab.active{ background:var(--accent); color:var(--accent-ink); border-color:var(--accent); }

.count-up{ font-variant-numeric:tabular-nums; }

@keyframes fadeSlideUp{ from{ opacity:0; transform:translateY(10px); } to{ opacity:1; transform:translateY(0); } }

/* ------------------------------------------------------------------ */
/* Mission bar — the setup wizard's own review/completed-step preview.  */
/* The persistent app-chrome copy was retired in favor of a compact     */
/* mission-only line in .app-topbar (see .app-topbar-mission above) —   */
/* the full card duplicated the brigade name already shown in the       */
/* topbar crumb.                                                        */
/* ------------------------------------------------------------------ */
.mission-bar{ display:flex; align-items:center; gap:14px; background:var(--panel); border:1px solid var(--line);
  border-right:3px solid var(--accent); border-radius:var(--radius-lg); padding:14px 18px; animation:fadeSlideUp var(--t-slow) var(--ease); }
.mission-icon{ display:flex; color:var(--accent); flex:none; }
.mission-name{ font-family:var(--font-sans); font-weight:700; font-size:16px; }
.mission-quote{ font-size:13px; color:var(--text-dim); margin-top:2px; }

.search-filter-row{ display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin-bottom:18px; }
.search-bar{
  display:flex; align-items:center; gap:8px; background:var(--panel); border:1px solid var(--line);
  border-radius:var(--radius-md); padding:0 12px; flex:1; min-width:220px; height:38px; transition:border-color var(--t-fast) var(--ease);
}
.search-bar:focus-within{ border-color:var(--accent); }
.search-bar-icon{ color:var(--text-dim); flex:none; }
.search-bar input{
  flex:1; background:none; border:none; outline:none; color:var(--text); font-family:var(--font-sans);
  font-size:13.5px; height:100%; padding:0;
}
.search-bar input::placeholder{ color:var(--text-dim); }
.search-bar-clear{
  background:none; border:none; color:var(--text-dim); cursor:pointer; display:flex; padding:2px;
  border-radius:5px; transition:color .15s ease; flex:none;
}
.search-bar-clear:hover{ color:var(--red); }
.search-bar-filters{ display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
.filter-select{
  background:var(--panel); border:1px solid var(--line); border-radius:var(--radius-md); color:var(--text);
  padding:0 10px; height:38px; font-family:var(--font-sans); font-size:13px; cursor:pointer;
  transition:border-color var(--t-fast) var(--ease);
}
.filter-select:hover, .filter-select:focus{ border-color:var(--accent); outline:none; }

.pagination-bar{
  display:flex; align-items:center; justify-content:space-between; gap:14px; margin-top:20px;
  padding-top:16px; border-top:1px solid var(--line); flex-wrap:wrap;
}
.pagination-summary{ font-size:12px; color:var(--text-dim); font-family:var(--font-mono); }
.pagination-controls{ display:flex; align-items:center; gap:12px; flex-wrap:wrap; }
.pagination-size-select{
  background:var(--panel); border:1px solid var(--line); border-radius:var(--radius-md); padding:6px 10px;
  font-size:12.5px; color:var(--text); font-family:var(--font-sans); cursor:pointer; transition:border-color var(--t-fast) var(--ease);
}
.pagination-size-select:hover, .pagination-size-select:focus{ border-color:var(--accent); outline:none; }
.pagination-pages{ display:flex; align-items:center; gap:4px; }
.pagination-pages button{
  min-width:30px; height:30px; border-radius:var(--radius-md); border:1px solid var(--line); background:var(--panel);
  color:var(--text-dim); font-family:var(--font-mono); font-size:12.5px; cursor:pointer; padding:0 6px;
  display:flex; align-items:center; justify-content:center; transition:border-color var(--t-fast) var(--ease), color var(--t-fast) var(--ease), background var(--t-fast) var(--ease);
}
.pagination-pages button:hover:not(:disabled){ border-color:var(--accent); color:var(--text); }
.pagination-pages button:disabled{ opacity:.35; cursor:not-allowed; }
.pagination-page.active{ background:var(--accent); border-color:var(--accent); color:var(--accent-ink); font-weight:700; }
.pagination-ellipsis{ color:var(--text-dim); padding:0 2px; font-size:12px; }

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

/* hg-loading — the design system's own loading pattern: a spinner+label */
/* line above a scanline-swept skeleton, standing in for the content     */
/* about to render. Feeds every screen through the shared Loading.jsx    */
/* component, so this one block covers all of them at once.              */
.hg-loading{ max-width:520px; margin:40px auto; padding:0 20px; }
.hg-loading-head{ display:flex; align-items:center; gap:10px; color:var(--text-dim); font-size:13.5px; margin-bottom:14px; justify-content:center; }
.hg-loading-spinner{
  width:16px; height:16px; border-radius:50%; flex:none;
  border:2px solid var(--line); border-top-color:var(--accent);
  animation:spin .7s linear infinite;
}
.hg-loading-skeleton{
  position:relative; overflow:hidden; background:var(--brk),var(--panel-raised);
  padding:16px; display:flex; flex-direction:column; gap:10px;
}
.hg-loading-scanline{
  position:absolute; inset-inline:0; top:0; height:16px; pointer-events:none;
  background:linear-gradient(180deg,transparent,var(--accent-soft));
  animation:hg-scanline 3.6s cubic-bezier(.6,0,.3,1) infinite; opacity:.6;
}
@keyframes hg-scanline{ 0%{ transform:translateY(-100%); } 100%{ transform:translateY(560%); } }
.hg-loading-skeleton i{ display:block; height:12px; background:var(--panel-hi); font-style:normal; }
@media (prefers-reduced-motion: reduce){ .hg-loading-scanline{ animation:none; display:none; } }
.unit-emblem-img{ border:1px solid var(--line); background:var(--panel); }
.logo-upload{
  display:flex; align-items:center; gap:12px; background:var(--panel-raised); border:1px dashed var(--line);
  border-radius:var(--radius-lg); padding:12px 14px;
}
.logo-upload-preview{
  width:56px; height:56px; border-radius:var(--radius-lg); border:1px solid var(--line); background:var(--panel);
  display:flex; align-items:center; justify-content:center; overflow:hidden; flex:none; color:var(--text-dim);
}
.logo-upload-preview img{ width:100%; height:100%; object-fit:cover; }
.logo-upload-body{ display:flex; flex-direction:column; gap:6px; flex:1; }
.logo-upload-label{ font-size:12.5px; color:var(--text-dim); }
.logo-upload-actions{ display:flex; align-items:center; gap:10px; }
.logo-upload-btn{
  display:inline-flex; align-items:center; gap:6px; background:var(--panel); border:1px solid var(--line);
  color:var(--text); border-radius:var(--radius-md); padding:7px 14px; font-size:12.5px; font-weight:600; cursor:pointer;
  font-family:var(--font-sans); transition:border-color var(--t-fast) var(--ease);
}
.logo-upload-btn:hover{ border-color:var(--accent); }
.logo-upload-remove{
  background:none; border:none; color:var(--text-dim); font-size:12px; cursor:pointer; text-decoration:underline;
}
.logo-upload-remove:hover{ color:var(--red); }
.logo-upload input[type="file"]{ display:none; }
.logo-upload-compact{ padding:6px; gap:8px; border-radius:var(--radius-md); }
.logo-upload-compact .logo-upload-preview{ width:34px; height:34px; border-radius:var(--radius-md); }
.logo-upload-compact .logo-upload-btn{ padding:5px 9px; font-size:11px; }
.logo-upload-compact .logo-upload-label{ display:none; }

.empty-state{
  color:var(--text-dim); font-size:13.5px; text-align:center; padding:40px 20px;
  background:var(--panel-raised); border:1px dashed var(--line); border-radius:var(--radius-card);
}

/* Classification-marking photo tile — see PhotoTile.jsx */
.photo-tile{
  position:relative; overflow:hidden; border-radius:var(--radius-lg); border:1px solid var(--line);
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
