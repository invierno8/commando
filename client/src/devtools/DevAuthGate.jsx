import React, { useEffect, useRef, useState } from "react";
import { Lock, Settings2, Eye, EyeOff, MessageSquare, GripVertical, GripHorizontal, X, Loader2, Target, Pencil, Users } from "lucide-react";
import { devLogin, devLogout, fetchDevMe, fetchAdminMe, fetchMentions } from "./devApi.js";
import DevFab from "./DevFab.jsx";
import DevGreetingMenu from "./DevGreetingMenu.jsx";
import DevAdminPanel from "./DevAdminPanel.jsx";
import DevOverlay from "./overlay/DevOverlay.jsx";
import CommentsPanel from "./overlay/CommentsPanel.jsx";
import MentionsBell from "./MentionsBell.jsx";
import JynxBubbleContent from "./JynxBubbleContent.jsx";
import UserProfileCard from "./UserProfileCard.jsx";
import { useOpenUserProfileListener } from "./openUserProfile.js";
import { useDraggableFab } from "./useDraggableFab.js";
import { useKeepInViewport } from "./useKeepInViewport.js";

// סדר ברירת המחדל של כפתורי-הפעולה בסרגל (לא כולל את הידית/שם-המשתמש/
// יציאה/קיפול — אלה קבועים בכוונה, ראו ה-JSX). "markers" תמיד נשמר ברשימה
// המלאה גם למשתמש לא-מנהל, כדי שסדר-השמירה יישאר יציב בלי קשר למי שמחובר
// כרגע — הסינון לפי isAdmin קורה רק ברינדור, לא כאן. השוואת orderChanged
// (האם הסדר שונה מברירת המחדל) עברה כולה ל-JynxSettings.jsx.
const DEFAULT_TOOLBAR_ORDER = ["role", "overlay", "draw", "comments", "markers", "admin", "mentions"];
const TOOLBAR_ORDER_KEY = "jynx-toolbar-item-order";
const TOOLBAR_ORIENTATION_KEY = "jynx-toolbar-orientation";
const TOOLBAR_ICON_SCALE_KEY = "jynx-toolbar-icon-scale";
// האם בורר התפקיד/חטיבה (DevFab.jsx) "מעוגן" בתוך תפריט ה-Jynx (ברירת
// המחדל, ראו הבקשה המקורית) או "מנותק" — בועה צפה עצמאית משלו כמו שהיה
// לפני זה. גרירה של פריט ה-role מחוץ לסרגל מנתקת; גרירת הבועה המנותקת
// בחזרה לתוך הסרגל (או לבועת-Jynx המכווצת) מעגנת מחדש — ראו
// handleRoleItemDragEnd למטה ו-DevFab.jsx's handleRoleDragEnd.
const ROLE_DOCKED_KEY = "jynx-role-docked";

// jynx-mt8i0n7ssax2: "the eye button didn't work, i still see the hover
// borders" — overlayOn was the one Jynx-chrome toggle in this file that
// never round-tripped through localStorage (every sibling toggle here —
// roleDocked, toolbarOrientation, iconScale, drawColor — does). It defaulted
// back to `true` on every full page reload, including the reload that
// MockDataToggle.jsx's own mock/live switch triggers — so turning the eye
// off, then flipping data mode (or just refreshing), silently turned hover
// highlighting back on with no visible cause. Persisting it closes that gap.
const OVERLAY_ON_KEY = "jynx-overlay-on";
function loadOverlayOn() {
  try {
    const raw = localStorage.getItem(OVERLAY_ON_KEY);
    return raw === null ? true : raw === "true";
  } catch { return true; }
}

// 4-swatch draw-color palette (added 2026-08-23, per QA feedback asking for
// one whenever the draw tool is turned on) — Jynx's own accent purple stays
// the default so the drawing feature keeps looking like Jynx out of the box,
// plus 3 more colors already used elsewhere in this same dev-tool chrome
// (the secondary-target highlight blue, and the app's own caution/danger
// tokens) rather than inventing new ones.
const DRAW_COLOR_KEY = "jynx-draw-color";
const JYNX_DRAW_COLORS = [
  { name: "Purple (default)", value: "var(--jynx)" },
  { name: "Blue", value: "#2F8FCE" },
  { name: "Red", value: "var(--red)" },
  { name: "Yellow", value: "var(--yellow)" },
];

function loadDrawColor() {
  const saved = localStorage.getItem(DRAW_COLOR_KEY);
  return JYNX_DRAW_COLORS.some((c) => c.value === saved) ? saved : JYNX_DRAW_COLORS[0].value;
}

function loadToolbarOrder() {
  try {
    const raw = JSON.parse(localStorage.getItem(TOOLBAR_ORDER_KEY));
    if (Array.isArray(raw) && raw.every((id) => DEFAULT_TOOLBAR_ORDER.includes(id))) {
      // תוספת-קדימה: אם נוספו ids חדשים ל-DEFAULT מאז השמירה האחרונה,
      // מוסיפים אותם בסוף במקום לאבד אותם.
      return [...raw, ...DEFAULT_TOOLBAR_ORDER.filter((id) => !raw.includes(id))];
    }
  } catch { /* ignore */ }
  return DEFAULT_TOOLBAR_ORDER;
}

/* ================================================================== */
/* השער היחיד לכל מצב הפיתוח — לא מחליף את .dev-fab הקיים, רק שומר       */
/* עליו נעול עד שמשתמש-פיתוח מזוהה מתחבר עם שם+סיסמה (ראו plan doc:      */
/* "gated, not replaced"). מבקר ללא התחברות רואה בדיוק את מה שהוא רואה    */
/* היום — MEMBER אקראי, בלי שום כפתור dev גלוי מעבר לנעילה עצמה.          */
/* ================================================================== */
export default function DevAuthGate({ route, devFabProps }) {
  const [checking, setChecking] = useState(true);
  const [devName, setDevName] = useState(null); // null = לא מחובר
  const [devUserId, setDevUserId] = useState(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  // רק לצורך "פנים" הבועה (JynxFace.jsx) — פוקוס על שדה הסיסמה עצמו מתורגם
  // ל-mood "typing", בלי לגעת בשום דבר אחר בלוגיקת ההתחברות.
  const [passwordFocused, setPasswordFocused] = useState(false);
  // idle | thinking | success | error — מחליף את loggingIn הבוליאני הישן.
  // "success" הוא שלב מכוון-בעצמו: לא סוגרים את הפאנל/מציבים devName באותו
  // רגע שה-login מצליח, כי אז המעבר מ"מקליד סיסמה" ל"מחובר" קורה בבזק אחד
  // בלי משוב — בדיוק התלונה שהובילה לפיצ'ר הזה. במקום זה משהים כמה מאות
  // מילישניות עם JynxThought מציג "✨ Welcome" לפני שבאמת מתחברים.
  const [loginPhase, setLoginPhase] = useState("idle");
  const [pendingWelcomeName, setPendingWelcomeName] = useState(null);
  // jynx-mt5qb3ak9rsz: "when the bubble is collapsed but user is logged in
  // have the bubble have that circle to it as well" — MentionsBell.jsx
  // (which already tracks/badges unread notifications) only mounts while
  // toolbarOpen is true, since it's rendered from TOOLBAR_ITEM_NODES inside
  // the expanded-toolbar branch below. To also badge the collapsed bubble,
  // this poll runs independently here (same GET /dev/mentions, same 10s
  // cadence) rather than refactoring MentionsBell into a prop-driven
  // component — a second poller hitting one low-traffic endpoint every 10s
  // is a non-issue for this internal dev tool, and keeps MentionsBell's own
  // working internals untouched.
  const [notifUnread, setNotifUnread] = useState(0);
  const [adminOpen, setAdminOpen] = useState(false);
  const [overlayOn, setOverlayOn] = useState(loadOverlayOn);
  useEffect(() => { try { localStorage.setItem(OVERLAY_ON_KEY, String(overlayOn)); } catch { /* ignore */ } }, [overlayOn]);
  const [commentsOn, setCommentsOn] = useState(false);
  // סימוני-מנהל הקבועים על העמוד (AdminAnnotationMarkers.jsx) — נפרד בכוונה
  // מ-overlayOn (שרק שולט על הילת-hover, לא על הנקודות הקבועות). דלוק
  // כברירת מחדל, אבל למי שמוצא אותם מפריעים על מסך עמוס יש עכשיו כפתור
  // ייעודי משלו בסרגל, לא רק "הכל או כלום" עם overlayOn.
  const [markersOn, setMarkersOn] = useState(true);
  // מצב-ציור (Ctrl/Cmd+גרירה על העמוד) — ראו DrawingCanvas.jsx. נפרד
  // מ-overlayOn: אפשר לצייר גם כשהילת-ה-hover כבויה, ולהיפך.
  const [drawMode, setDrawMode] = useState(false);
  // צבע-הציור הפעיל — נבחר מלוח 4 הצבעים שנפתח כשמצב-הציור דלוק (ראו
  // JYNX_DRAW_COLORS למעלה), נשמר כדי שהבחירה תישאר גם אחרי רענון דף.
  const [drawColor, setDrawColor] = useState(loadDrawColor);
  useEffect(() => { localStorage.setItem(DRAW_COLOR_KEY, drawColor); }, [drawColor]);
  const [toolbarOpen, setToolbarOpen] = useState(true);
  // כיוון הסרגל (אופקי/אנכי) וסדר כפתורי-הפעולה בתוכו — שני דברים נפרדים
  // שנשמרים ב-localStorage משלהם, לא קשורים למיקום הפיזי (toolbarFab.pos).
  const [toolbarOrientation, setToolbarOrientation] = useState(
    () => (localStorage.getItem(TOOLBAR_ORIENTATION_KEY) === "vertical" ? "vertical" : "horizontal")
  );
  const [toolbarOrder, setToolbarOrder] = useState(loadToolbarOrder);
  // תמונת-מצב יחידה, לא מחסנית-undo מלאה — "צעד אחד אחורה" בכוונה (ראו
  // הבקשה המקורית), לא undo/redo כללי.
  const [undoOrder, setUndoOrder] = useState(null);
  const [iconScale, setIconScaleState] = useState(
    () => Number(localStorage.getItem(TOOLBAR_ICON_SCALE_KEY)) || 1
  );
  // כרטיס פרופיל-משתמש (UserProfileCard.jsx) — נפתח מכל מקום (אזכור/שם-
  // מחבר) דרך אירוע DOM גלובלי, ראו openUserProfile.js. השומע חייב להיות
  // כאן, לפני כל return מוקדם (checking/!devName), כי חוקי-Hooks אוסרים
  // להתנות קריאת hook ברינדור שקורה רק אחרי אחד מהם.
  const [profileUserId, setProfileUserId] = useState(null);
  useOpenUserProfileListener(setProfileUserId);
  const [roleDocked, setRoleDocked] = useState(
    () => localStorage.getItem(ROLE_DOCKED_KEY) !== "false"
  );
  function dockRole() {
    setRoleDocked(true);
    try { localStorage.setItem(ROLE_DOCKED_KEY, "true"); } catch { /* ignore */ }
  }
  function undockRole() {
    setRoleDocked(false);
    try { localStorage.setItem(ROLE_DOCKED_KEY, "false"); } catch { /* ignore */ }
  }
  // dropEffect נשאר "none" רק כשהגרירה שוחררה מחוץ לכל יעד שקורא ל-
  // preventDefault ב-onDragOver שלו (ראו onDragOver על מכולת הסרגל למטה) —
  // בדיוק ה"שוחרר מחוץ לתפריט" שמבדיל ניתוק מסידור-מחדש רגיל בתוך הסרגל.
  function handleRoleItemDragEnd(e) {
    if (e.dataTransfer.dropEffect === "none") undockRole();
  }
  // ידוע מראש (בלי לפתוח את פאנל הניהול) כדי ש-DevOverlay יוכל לסמן
  // אוטומטית "פעולה" על הערות שהמנהל עצמו כותב, ולהציג סימוני מנהל קבועים
  // על המסך — גם מיד אחרי רענון דף, כל עוד עוגיית המנהל עדיין תקפה.
  const [isAdmin, setIsAdmin] = useState(false);
  // "Jynx commenter" (2026-08-21) — הרשאה נפרדת ופחות-חמורה מ-isAdmin, ראו
  // data/config/dev-users.json / DevAdminUsersScreen.jsx. נטען מ-/dev/me
  // (טרי מהמרשם בכל בקשה, לא מהטוקן) כדי שביטול/הענקה על ידי מנהל ייכנס
  // לתוקף בלי דרישה להתחבר מחדש.
  const [canJynxComment, setCanJynxComment] = useState(false);
  // כל חלק בכרום של Jynx גרירי בנפרד (מיקום/localStorage משלו) — כך שלא
  // יסתיר בטעות תוכן קבוע במסך כלשהו, גם אחרי שמתחברים ומופיע גם הסרגל.
  const lockedFab = useDraggableFab("jynx-fab-pos");
  const toolbarFab = useDraggableFab("jynx-toolbar-pos", { right: 20, bottom: 76 });
  const drawPaletteFab = useDraggableFab("jynx-draw-palette-pos", { right: 20, bottom: 132 });
  // פאנל ההתחברות עצמו לא גרירי (הוא נפתח יחסית לכפתור הנעול) אבל יכול
  // בהחלט לצאת מה-viewport אם הכפתור נגרר קרוב לקצה — ראו useKeepInViewport.js.
  const loginPanelRef = useRef(null);
  useKeepInViewport(loginPanelRef, loginOpen, 8, [error]);

  // גרירה אמיתית לא אמורה גם לפתוח/לסגור את פאנל ההתחברות — רק קליק "נקי".
  function onFabClick() {
    if (lockedFab.consumeWasDragged()) return;
    setLoginOpen((v) => !v);
  }
  // גרירה אמיתית של הסרגל לא אמורה גם לקפל/לפתוח אותו — רק קליק "נקי" על
  // כפתור הקיפול או על הבועה המכווצת.
  function toggleToolbarOpen() {
    if (toolbarFab.consumeWasDragged()) return;
    setToolbarOpen((v) => !v);
  }
  // הידית (⋮/⋯, ראו TOOLBAR_ITEM_NODES) עצמה עכשיו גם כפתור — קליק "נקי" (לא
  // גרירה) עליה מחליף אופקי/אנכי. אותה בדיקת consumeWasDragged בדיוק כמו שאר
  // הכפתורים בסרגל הזה, כי הידית עדיין חלק מהאזור שגורר את כל הסרגל.
  // jynx-mth59kjpe6wk: "make it the center of movement, currently it flips to
  // the right side" — הסרגל ממוקם עם right/bottom קבועים, אז מעבר אופקי↔אנכי
  // (שמשנה דרמטית את הרוחב — שורה רחבה מול עמודה צרה) הזיז בפועל רק את
  // הקצה השמאלי, כי הקצה הימני (המעוגן) נשאר קבוע; מה שהמשתמש חווה כ"הכל
  // קופץ ימינה/שמאלה" בכל לחיצה. פותר על ידי מדידת הרוחב לפני/אחרי המעבר
  // ותיקון right כך שהמרכז הגיאומטרי (לא הקצה) יישאר במקום — ראו
  // useDraggableFab.js's nudgePos. double rAF כדי לוודא שהדפדפן כבר סיים
  // layout עם המחלקה/הכיוון החדשים לפני המדידה השנייה.
  function toggleOrientation() {
    if (toolbarFab.consumeWasDragged()) return;
    const el = toolbarFab.sizeRef.current;
    const oldWidth = el?.offsetWidth || 0;
    setOrientation(toolbarOrientation === "horizontal" ? "vertical" : "horizontal");
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const newWidth = el?.offsetWidth || 0;
        const delta = newWidth - oldWidth;
        if (delta) toolbarFab.nudgePos(-delta / 2);
      });
    });
  }
  function setOrientation(next) {
    setToolbarOrientation(next);
    try { localStorage.setItem(TOOLBAR_ORIENTATION_KEY, next); } catch { /* ignore */ }
  }
  function setIconScale(next) {
    setIconScaleState(next);
    try { localStorage.setItem(TOOLBAR_ICON_SCALE_KEY, String(next)); } catch { /* ignore */ }
  }
  // סידור-מחדש עבר כולו ל-JynxSettings.jsx (ראו שם) — לא עוד draggable חי
  // על פריטי הסרגל עצמם. הסיבה: פריט-בסרגל וה-container שמסביבו (שהוא עצמו
  // גריר-להזזה, ראו useDraggableFab.js) חלקו את אותה מחוות-עכבר — ניסיון
  // לגרור פריט כדי לסדר מחדש לפעמים גם הזיז את כל הסרגל, "drag and drop
  // fucked" בלשון התלונה שהתקבלה. הפאנל החדש לא גריר-כמכלול, אז שום דבר שם
  // לא מתחרה עם שום דבר אחר.
  function persistToolbarOrder(next) {
    setUndoOrder(toolbarOrder);
    setToolbarOrder(next);
    try { localStorage.setItem(TOOLBAR_ORDER_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  }
  function resetToolbarOrder() {
    persistToolbarOrder(DEFAULT_TOOLBAR_ORDER);
  }
  function undoToolbarOrder() {
    if (!undoOrder) return;
    setToolbarOrder(undoOrder);
    try { localStorage.setItem(TOOLBAR_ORDER_KEY, JSON.stringify(undoOrder)); } catch { /* ignore */ }
    setUndoOrder(null);
  }

  // הבקאנד (Render, שכבה חינמית) יכול "לישון" אחרי חוסר פעילות ולקחת עד
  // 30-50 שניות להתעורר על הבקשה הראשונה. בלי retry+catch כאן, כשל/timeout
  // חד-פעמי על fetchDevMe() באותו חלון-התעוררות היה משאיר checking=true
  // לתמיד (ה-.then() אף פעם לא רץ) — וכל ה-UI של Jynx נעלם, אפילו הכפתור
  // הנעול, בלי שום דרך לתקן חוץ מרענון ידני. עכשיו יש נסיון חוזר עם השהיה
  // גדלה (2s/4s/6s/8s/10s ≈ 30s בסך הכל, קרוב לזמן ההתעוררות המקסימלי), וגם
  // בכישלון סופי — checking תמיד יורד ל-false, כך שלפחות הכפתור הנעול מוצג
  // ואפשר לנסות שוב ידנית (התחברות) במקום שהכל ייעלם בלי הסבר.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (let attempt = 0; attempt < 5; attempt++) {
        if (cancelled) return;
        try {
          const d = await fetchDevMe();
          if (cancelled) return;
          setDevName(d?.name || null);
          setDevUserId(d?.id || null);
          setCanJynxComment(!!d?.canJynxComment);
          setChecking(false);
          return;
        } catch {
          if (attempt === 4) { if (!cancelled) setChecking(false); return; }
          await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
        }
      }
    })();
    fetchAdminMe().then((d) => { if (!cancelled) setIsAdmin(!!d?.authenticated); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // ראו ההערה על notifUnread למעלה — פועם כל עוד מחוברים, לא רק כש-toolbarOpen,
  // כדי שהתג יופיע גם על הבועה המכווצת.
  useEffect(() => {
    if (!devName) return;
    let cancelled = false;
    function reload() {
      fetchMentions().then((list) => { if (!cancelled) setNotifUnread(list.filter((m) => !m.read).length); }).catch(() => {});
    }
    reload();
    const t = setInterval(reload, 10000);
    return () => { cancelled = true; clearInterval(t); };
  }, [devName]);

  // ניווט-מקלדת בסרגל — מספר N מפעיל את הכפתור ה-N-י בסדר הנוכחי (אחרי
  // סידור-מחדש, ראו toolbarOrder), לא לפי מיקום קבוע. לא כולל "mentions"
  // (פותח/סוגר dropdown פנימי משלו, אין לו toggle חיצוני חשוף כרגע) —
  // מספור מדלג עליו, לא משאיר "חור" עם מספר מת. מתעלם מהקלדה בתוך
  // input/textarea (כדי לא להפריע לכתיבת תגובה/סיסמה) ומ-Ctrl/Cmd/Alt
  // (לא להתנגש עם קיצורי דפדפן/מערכת).
  useEffect(() => {
    if (!devName || !toolbarOpen) return;
    function onKeyDown(e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const tag = e.target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || e.target?.isContentEditable) return;
      const n = Number(e.key);
      if (!Number.isInteger(n) || n < 1) return;
      const actions = {
        role: roleDocked ? () => devFabProps.setOpen((v) => !v) : null,
        overlay: () => setOverlayOn((v) => !v),
        draw: () => setDrawMode((v) => !v),
        comments: () => setCommentsOn((v) => !v),
        markers: (isAdmin || canJynxComment) ? () => setMarkersOn((v) => !v) : null,
        admin: () => setAdminOpen(true),
      };
      const keyableIds = toolbarOrder.filter((id) => actions[id]);
      const id = keyableIds[n - 1];
      if (id) { e.preventDefault(); actions[id](); }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [devName, toolbarOpen, toolbarOrder, isAdmin, canJynxComment, roleDocked, devFabProps.setOpen]);

  async function login() {
    setError("");
    setLoginPhase("thinking");
    try {
      const res = await devLogin(password);
      setPendingWelcomeName(res.name);
      setLoginPhase("success");
      await new Promise((r) => setTimeout(r, 700));
      setDevName(res.name);
      if (res.isAdmin) setIsAdmin(true);
      setLoginOpen(false);
      setPassword("");
      setLoginPhase("idle");
      setPendingWelcomeName(null);
      const me = await fetchDevMe();
      setDevUserId(me?.id || null);
      setCanJynxComment(!!me?.canJynxComment);
    } catch (e) {
      setError(e.message);
      setLoginPhase("error");
    }
  }
  async function logout() {
    await devLogout();
    setDevName(null);
    setDevUserId(null);
    setIsAdmin(false);
    setCanJynxComment(false);
  }

  // "Jynx בועה נעלמת בלי הסבר בזמן ה-cold start" — תיקון: במקום return null
  // (שמשאיר את המשתמש בלי שום סימן שמשהו קורה במשך עד ~30 שניות, ראו ההערה
  // למעלה על fetchDevMe()'s retry loop), מציגים את אותה בועה נעולה עם ספינר.
  // הטקסט "מתעורר..." יושב היום בתוך הבועה עצמה (JynxBubbleContent.jsx),
  // לא בבועת-מחשבה צפה מעליה — ראו ההערה שם למה (jynx-mt5e8ngp3qvx).
  if (checking) {
    return (
      <div
        className="dev-fab-wrap jynx-chrome jynx-ui"
        style={{ right: lockedFab.pos.right, bottom: lockedFab.pos.bottom }}
      >
        <style>{CSS}</style>
        <div className="dev-fab dev-fab-locked jynx-thinking-pulse" title="Jynx is waking up the dev server — this can take up to ~30s on a cold start">
          <Loader2 size={13} className="dev-fab-waking-spinner" />
          <JynxBubbleContent mood="waking" />
        </div>
      </div>
    );
  }

  if (!devName) {
    return (
      <div
        className="dev-fab-wrap jynx-chrome jynx-ui"
        style={{ right: lockedFab.pos.right, bottom: lockedFab.pos.bottom }}
        tabIndex={-1}
        onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget) && loginPhase !== "thinking" && loginPhase !== "success") setLoginOpen(false); }}
      >
        <style>{CSS}</style>
        {loginOpen && (
          <div ref={loginPanelRef} className="dev-fab-panel dev-only dev-login-panel">
            <span className="dev-only-tag">JYNX — Sign in to dev mode</span>
            <label className="env-strip-identity">
              <span>Password</span>
              <input
                type="password" value={password}
                onChange={(e) => { setPassword(e.target.value); if (loginPhase === "error") setLoginPhase("idle"); }}
                onKeyDown={(e) => e.key === "Enter" && login()}
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
                disabled={loginPhase === "thinking" || loginPhase === "success"}
                autoFocus
              />
            </label>
            <button type="button" className="dev-login-submit" onClick={login} disabled={!password.trim() || loginPhase === "thinking" || loginPhase === "success"}>
              {loginPhase === "thinking" ? <Loader2 size={13} className="dev-login-spinner" /> : "Sign in"}
            </button>
          </div>
        )}
        <button
          type="button"
          ref={lockedFab.sizeRef}
          className={"dev-fab dev-fab-locked" + (loginPhase === "thinking" ? " jynx-thinking-pulse" : " jynx-breathe")}
          onClick={onFabClick}
          {...lockedFab.dragHandlers}
          title="Sign in to dev mode — draggable"
        >
          <Lock size={13} />
          <JynxBubbleContent
            mood={loginPhase !== "idle" ? loginPhase : (passwordFocused ? "typing" : "idle")}
            welcomeName={pendingWelcomeName}
            errorText={error}
          />
        </button>
      </div>
    );
  }

  // מרשם כפתורי-הפעולה הניתנים-לסידור-מחדש — ראו DEFAULT_TOOLBAR_ORDER
  // למעלה. "markers" תמיד ברשימה (גם לא-מנהל) כדי שסדר-השמירה יישאר יציב;
  // מוסר כאן ברינדור בלבד דרך .filter(Boolean).
  const TOOLBAR_ITEM_NODES = {
    role: roleDocked ? (
      <button type="button" className="dev-toolbar-icon-btn" data-devblock="dev-toolbar-role-btn" onClick={() => devFabProps.setOpen((v) => !v)} title="Role & brigade simulator — drag this out of the menu to detach it">
        <Users size={13} />
      </button>
    ) : null,
    overlay: (
      <button type="button" className="dev-toolbar-icon-btn" data-devblock="dev-toolbar-overlay-toggle" onClick={() => setOverlayOn((v) => !v)} title={overlayOn ? "Turn off hover overlay" : "Turn on hover overlay"}>
        {overlayOn ? <Eye size={13} /> : <EyeOff size={13} />}
      </button>
    ),
    draw: (
      <button type="button" className={"dev-toolbar-icon-btn" + (drawMode ? " active" : "")} data-devblock="dev-toolbar-draw-toggle" onClick={() => setDrawMode((v) => !v)} title={drawMode ? "Turn off drawing (Ctrl/Cmd+drag draws while on)" : "Turn on drawing — hold Ctrl/Cmd and drag on the page to draw"}>
        <Pencil size={13} />
      </button>
    ),
    comments: (
      <button type="button" className={"dev-toolbar-icon-btn" + (commentsOn ? " active" : "")} data-devblock="dev-toolbar-comments-toggle" onClick={() => setCommentsOn((v) => !v)} title={commentsOn ? "Hide screen comments" : "Show all comments on this screen"}>
        <MessageSquare size={13} />
      </button>
    ),
    markers: (isAdmin || canJynxComment) ? (
      <button type="button" className={"dev-toolbar-icon-btn" + (markersOn ? " active" : "")} data-devblock="dev-toolbar-markers-toggle" onClick={() => setMarkersOn((v) => !v)} title={markersOn ? "Hide comment status dots on the page" : "Show comment status dots on the page"}>
        <Target size={13} />
      </button>
    ) : null,
    admin: (
      <button type="button" className="dev-toolbar-icon-btn" data-devblock="dev-toolbar-admin-btn" onClick={() => setAdminOpen(true)} title="Settings — admins see and manage more here">
        <Settings2 size={13} />
      </button>
    ),
    mentions: <MentionsBell />,
  };
  // "mentions" בכוונה לא כאן — פותח/סוגר dropdown פנימי משלו, אין לו toggle
  // חיצוני חשוף כרגע להפעלה מהמקלדת (ראו useEffect למעלה).
  const KEYABLE_IDS = ["role", "overlay", "draw", "comments", "markers", "admin"];
  let keyableIndex = 0;
  // Labels for the "Hi" menu's keyboard-shortcuts list (jynx-mth50gvydy9j:
  // "the hotkey is not clearly stated ... under 'hi' menu, and make it
  // changeable"). The numbers here are exactly toolbarOrder's current
  // position among KEYABLE_IDS — the same computation the keydown handler
  // above uses — so this list is always accurate, never a stale hardcoded
  // copy. "Changeable" is the existing Settings → Menu order drag-to-
  // reorder feature (JynxSettings.jsx / JynxMenuSettingsFields), which
  // already changes which number does what; DevGreetingMenu links straight
  // to it instead of building a second, separate remapping UI.
  const SHORTCUT_LABELS = {
    role: "Role & brigade", overlay: "Hover overlay", draw: "Drawing",
    comments: "Comments panel", markers: "Status dots", admin: "Settings",
  };
  const keyboardShortcuts = toolbarOrder
    .filter((id) => TOOLBAR_ITEM_NODES[id] && KEYABLE_IDS.includes(id))
    .map((id, i) => ({ num: i + 1, label: SHORTCUT_LABELS[id] || id }));

  return (
    <>
      <style>{CSS}</style>
      <DevOverlay active={overlayOn || drawMode} hoverOn={overlayOn} route={route} isAdmin={isAdmin} canJynxChrome={isAdmin || canJynxComment} markersOn={markersOn} drawMode={drawMode} drawColor={drawColor} />
      <CommentsPanel active={commentsOn} route={route} currentDevUserId={devUserId} isAdmin={isAdmin} canJynxComment={canJynxComment} />
      {drawMode && (
        <div
          ref={drawPaletteFab.sizeRef}
          className="jynx-draw-palette jynx-chrome jynx-ui"
          style={{ right: drawPaletteFab.pos.right, bottom: drawPaletteFab.pos.bottom }}
          {...drawPaletteFab.dragHandlers}
          title="Ctrl/Cmd+drag on the page to draw · release and drag again to add another stroke · Esc to finish and comment"
        >
          {JYNX_DRAW_COLORS.map((c) => (
            <button
              key={c.value}
              type="button"
              className={"jynx-draw-swatch" + (drawColor === c.value ? " active" : "")}
              style={{ background: c.value }}
              onClick={() => setDrawColor(c.value)}
              title={c.name}
            />
          ))}
        </div>
      )}
      {toolbarOpen ? (
        <div
          ref={toolbarFab.sizeRef}
          className={"dev-fab-toolbar jynx-chrome jynx-ui" + (toolbarOrientation === "vertical" ? " vertical" : "")}
          style={{ right: toolbarFab.pos.right, bottom: toolbarFab.pos.bottom, "--jynx-icon-scale": iconScale }}
          data-jynx-dock-zone=""
          onDragOver={(e) => e.preventDefault()}
          {...toolbarFab.dragHandlers}
        >
          <button type="button" className="dev-toolbar-grip" onClick={toggleOrientation} title={`Switch to ${toolbarOrientation === "horizontal" ? "vertical" : "horizontal"} menu (click here — drag anywhere else on the bar to move it)`}>
            {toolbarOrientation === "vertical" ? <GripHorizontal size={15} /> : <GripVertical size={15} />}
          </button>
          {toolbarOrder.map((id) => {
            if (!TOOLBAR_ITEM_NODES[id]) return null;
            const isKeyable = KEYABLE_IDS.includes(id);
            const keyNum = isKeyable ? ++keyableIndex : null;
            return (
            <div
              key={id}
              className="jynx-toolbar-item"
              draggable={id === "role"}
              onDragStart={id === "role" ? (e) => { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", id); } : undefined}
              onDragEnd={id === "role" ? handleRoleItemDragEnd : undefined}
              // jynx-mt5qe3axvwkl: "the drag just stuck for the entire menu" —
              // this item's native-HTML5 drag (onDragStart above) and the
              // whole-toolbar pointer-drag (toolbarFab.dragHandlers on the
              // container, see useDraggableFab.js) both listen to the same
              // pointerdown gesture; stopping propagation here keeps a
              // press-and-drag on this one icon from also arming the
              // container's own drag state (which native DnD then leaves
              // stuck mid-gesture, since the browser stops delivering
              // pointermove/pointerup once native DnD takes over). A plain
              // click still reaches this item's own onClick normally —
              // stopPropagation only blocks the event from bubbling up to
              // the container's onPointerDown, it doesn't cancel it here.
              onPointerDown={id === "role" ? (e) => e.stopPropagation() : undefined}
              title={id === "role" ? "Drag out of the menu to detach the role/brigade picker (or use Settings → Role picker)" : undefined}
            >
              {keyNum && <span className="jynx-toolbar-key-badge">{keyNum}</span>}
              {TOOLBAR_ITEM_NODES[id]}
            </div>
            );
          })}
          <DevGreetingMenu devName={devName} onOpenSettings={() => setAdminOpen(true)} onLogout={logout} shortcuts={keyboardShortcuts} />
          <button type="button" className="dev-toolbar-icon-btn" data-devblock="dev-toolbar-collapse-btn" onClick={toggleToolbarOpen} title="Collapse to the Jynx bubble">
            <X size={13} />
          </button>
        </div>
      ) : (
        <div className="dev-fab-wrap jynx-chrome jynx-ui" style={{ right: toolbarFab.pos.right, bottom: toolbarFab.pos.bottom }}>
          <button type="button" ref={toolbarFab.sizeRef} className="dev-fab jynx-breathe dev-fab-collapsed" data-jynx-dock-zone="" onClick={toggleToolbarOpen} {...toolbarFab.dragHandlers} title="Expand the Jynx toolbar — draggable (also a drop target for a detached role picker)">
            <JynxBubbleContent mood="idle" />
            {notifUnread > 0 && <span className="dev-fab-collapsed-badge">{notifUnread > 9 ? "9+" : notifUnread}</span>}
          </button>
        </div>
      )}
      <DevFab
        {...devFabProps}
        docked={roleDocked}
        onDock={dockRole}
        // jynx-mth57nfhogk9: "make sure the position is aware so that no
        // items hides another" — this used to be a fixed "+40" guess for
        // the gap above the toolbar, which is only tall enough for a
        // single-row horizontal toolbar. In vertical orientation (or with
        // several extra items/large icon scale) the real toolbar is far
        // taller than 40px, so the docked role/brigade panel — whose first
        // row is dev-fab-mock-toggle-row, the exact spot this comment was
        // left on — opened low enough to render on top of, and hide, the
        // toolbar's own buttons. Anchoring off the toolbar's own measured
        // height (toolbarFab.sizeRef, the real DOM node) instead of a
        // guess keeps the panel clear of it regardless of orientation/
        // item count/icon size; falls back to the old 40 before the first
        // measurement lands.
        dockAnchorPos={{
          right: toolbarFab.pos.right,
          bottom: toolbarFab.pos.bottom + (toolbarFab.sizeRef.current?.offsetHeight || 40) + 8,
        }}
      />
      {adminOpen && (
        <DevAdminPanel
          onClose={() => setAdminOpen(false)}
          onVerified={() => setIsAdmin(true)}
          menuSettings={{
            orientation: toolbarOrientation,
            onSetOrientation: setOrientation,
            order: toolbarOrder,
            defaultOrder: DEFAULT_TOOLBAR_ORDER,
            availableIds: Object.keys(TOOLBAR_ITEM_NODES).filter((id) => TOOLBAR_ITEM_NODES[id]),
            onReorder: persistToolbarOrder,
            onReset: resetToolbarOrder,
            onUndo: undoToolbarOrder,
            canUndo: !!undoOrder,
            iconScale,
            onSetIconScale: setIconScale,
            roleDocked,
            onSetRoleDocked: (docked) => (docked ? dockRole() : undockRole()),
          }}
        />
      )}
      {profileUserId && <UserProfileCard userId={profileUserId} onClose={() => setProfileUserId(null)} />}
    </>
  );
}

const CSS = `
.dev-login-panel{ display:flex; flex-direction:column; gap:8px; }
.dev-login-error{ color:var(--red); font-size:11.5px; }
.dev-login-submit{
  background:var(--jynx); color:#fff; border:none; border-radius:8px; padding:7px 0; font-weight:700;
  font-size:12.5px; cursor:pointer; font-family:var(--font-sans);
}
.dev-login-submit:disabled{ opacity:.5; cursor:not-allowed; }
.dev-login-spinner{ display:block; margin:0 auto; animation:devLoginSpin .7s linear infinite; }
@keyframes devLoginSpin{ to{ transform:rotate(360deg); } }

.dev-fab-waking-spinner{ animation:devLoginSpin .9s linear infinite; }

/* פנים זעירות בתוך הבועה עצמה (jynx-mt51mv19l46u) — שתי "עיניים" בלבד, לא
   SVG/נכס חיצוני, יושבות בתוך אותה שורת-flex כמו האייקון/הלוגו הקיימים
   (ראו .dev-fab בtheme.js). ברירת המחדל (idle) מהבהבת ועוקבת קלות אחרי
   העכבר (ראו JynxFace.jsx); שאר המצבים משנים צבע/תזוזה כדי להתאים לאותה
   שפת-צבע שכבר קיימת (ירוק=success, אדום=error) בלי לפתוח פלטה חדשה. */
.jynx-face{ display:inline-flex; align-items:center; gap:3px; height:8px; }
.jynx-face-eye{
  width:3.5px; height:3.5px; border-radius:50%; background:currentColor; flex:none;
  transition:height .12s ease, transform .12s ease, background .15s ease;
}
.jynx-face-blink{ height:1px; }
.jynx-face-thinking .jynx-face-eye{ animation:jynxFaceDart .8s ease-in-out infinite; }
@keyframes jynxFaceDart{ 0%,100%{ transform:translateX(-1.5px); } 50%{ transform:translateX(1.5px); } }
.jynx-face-typing .jynx-face-eye{ height:2.5px; }
.jynx-face-success .jynx-face-eye{ background:var(--green); transform:scale(1.3); }
.jynx-face-error .jynx-face-eye{ background:var(--red); animation:jynxFaceShake .3s ease; }
@keyframes jynxFaceShake{ 0%,100%{ transform:translateX(0); } 25%{ transform:translateX(-1.5px); } 75%{ transform:translateX(1.5px); } }

/* "חי" — נשימה עדינה כשאין שום דבר אחר קורה, כדי שהבועה לעולם לא תיראה
   קפואה/מתה גם כשהיא רק יושבת שם וממתינה. */
.jynx-breathe{ animation:jynxBreathe 3s ease-in-out infinite; }
@keyframes jynxBreathe{
  0%, 100% { transform:scale(1); box-shadow:0 0 0 0 color-mix(in srgb, var(--jynx) 35%, transparent); }
  50% { transform:scale(1.04); box-shadow:0 0 10px 2px color-mix(in srgb, var(--jynx) 25%, transparent); }
}
/* "חושב" — פועם מהר וחזק יותר מהנשימה הרגילה, קצב שונה בבירור כדי שיהיה
   ברור שמשהו קורה עכשיו (מתעורר/מתחבר), לא רק "חי כרגיל". */
.jynx-thinking-pulse{ animation:jynxThinkingPulse .9s ease-in-out infinite; }
@keyframes jynxThinkingPulse{
  0%, 100% { transform:scale(1); box-shadow:0 0 0 0 color-mix(in srgb, var(--jynx) 60%, transparent); }
  50% { transform:scale(1.08); box-shadow:0 0 14px 4px color-mix(in srgb, var(--jynx) 45%, transparent); }
}

/* הטקסט שהיה פעם בבועת-מחשבה צפה (JynxThought.jsx, הוסר — ראו
   JynxBubbleContent.jsx) יושב עכשיו בתוך הבועה עצמה, עם ה-jynx-logo הרגיל —
   .jynx-logo-error רק משנה צבע, לא צריך מסגרת/זנב/מיקום נפרדים יותר. */
.jynx-logo-error{ background:none; -webkit-background-clip:initial; background-clip:initial; color:var(--red); }

.dev-fab-toolbar{
  position:fixed; z-index:79; display:flex; align-items:center; gap:6px;
  cursor:grab; touch-action:none;
}
.dev-fab-toolbar:active{ cursor:grabbing; }
.dev-fab-toolbar.vertical{ flex-direction:column; align-items:stretch; }
/* הידית עצמה עכשיו כפתור אמיתי (מחליף אופקי/אנכי) — לא רק "אזור-גרירה
   שיושב שם", אז צריך רמז ברור שהיא לחיצה: קצת יותר גדולה מכל שאר האייקונים
   ותוחם עדין (border) כדי לא "להיבלע" בתוך פס-הכלים כמו לפני. */
.dev-toolbar-grip{
  display:flex; align-items:center; justify-content:center; width:22px; height:30px; color:var(--text-dim);
  flex:none; align-self:center; background:none; border:1px dashed color-mix(in srgb, var(--jynx) 40%, transparent); border-radius:6px;
  padding:0; cursor:pointer; transition:color .12s, border-color .12s;
}
.dev-toolbar-grip:hover{ color:var(--jynx); border-color:var(--jynx); }
/* align-self:center — בלעדיו, ".dev-fab-toolbar.vertical"'s align-items:
   stretch מותח כל פריט לרוחב המלא של העמודה, אז תג/תוכן פנימי-לא-ממורכז
   נוחת רחוק מהאייקון עצמו במקום עליו. עם align-self הפריט מתכווץ לגודל
   האייקון (30px), והתג יושב עליו ממש. (DevGreetingMenu.jsx's own
   .dev-greeting-wrap needs, and has, the identical fix — see there.) */
.jynx-toolbar-item{ position:relative; display:flex; flex:none; align-self:center; }
/* התג עם מספר-המקלדת — בעבר bottom:-3px/right:-3px, מה שגרם לו להיחתך/
   להתחפף עם הפריט הבא כשהסרגל אנכי (הפריטים נערמים אז ה"מטה" של אחד הוא
   כמעט ה"מעלה" של הבא). "top" יציב בשני הכיוונים; קצת יותר גדול/כהה כדי
   שיהיה קריא על רקע גם בהיר וגם כהה. */
.jynx-toolbar-key-badge{
  position:absolute; top:-4px; right:-4px; background:var(--jynx); color:#fff; border-radius:7px;
  font-size:9px; font-weight:800; line-height:1; padding:2px 4px; pointer-events:none; font-family:var(--font-mono);
  border:1px solid var(--panel); box-shadow:0 1px 2px rgba(0,0,0,.35); z-index:1;
}
.dev-toolbar-icon-btn{
  width:calc(30px * var(--jynx-icon-scale, 1)); height:calc(30px * var(--jynx-icon-scale, 1)); border-radius:8px;
  border:1px solid var(--jynx); background:var(--panel); color:var(--jynx); display:flex; align-items:center;
  justify-content:center; cursor:pointer;
}
.dev-toolbar-icon-btn:hover{ background:color-mix(in srgb, var(--jynx) 10%, var(--panel)); }
.dev-toolbar-icon-btn.active{ background:var(--jynx); color:#fff; }
.dev-toolbar-icon-btn svg{ transform:scale(var(--jynx-icon-scale, 1)); }

/* jynx-mt5qb3ak9rsz: "when the bubble is collapsed but user is logged in
   have the bubble have that circle to it as well" — .dev-fab (theme.js) has
   no position:relative of its own (it's reused by several unrelated fabs),
   so this scoped-here class adds it just for the collapsed Jynx bubble,
   without touching the shared base rule. Same badge look as
   MentionsBell.jsx's .mentions-bell-badge, duplicated rather than shared
   per this codebase's "every component owns self-contained CSS" rule (that
   component isn't even mounted while the toolbar is collapsed). */
.dev-fab-collapsed{ position:relative; }
.dev-fab-collapsed-badge{
  position:absolute; top:-4px; right:-4px; background:var(--red); color:#fff; border-radius:8px;
  font-size:9px; font-weight:700; line-height:1; padding:2px 4px; min-width:14px; text-align:center;
  font-family:var(--font-mono);
}

.jynx-draw-palette{
  position:fixed; z-index:79; display:flex; align-items:center; gap:6px; padding:6px;
  background:var(--panel); border:1px solid var(--jynx); border-radius:20px; box-shadow:var(--shadow-md);
  cursor:grab; touch-action:none;
}
.jynx-draw-palette:active{ cursor:grabbing; }
.jynx-draw-swatch{
  width:20px; height:20px; border-radius:50%; border:2px solid transparent; padding:0; cursor:pointer;
}
.jynx-draw-swatch.active{ border-color:var(--text); box-shadow:0 0 0 2px var(--panel), 0 0 0 3px var(--text); }

.dev-fab-mock-toggle-row{ display:flex; margin-bottom:6px; }
.mock-toggle-wrap{ display:flex; flex-direction:column; gap:4px; }
.mock-toggle{
  display:inline-flex; align-items:center; gap:6px; border-radius:20px; padding:6px 12px; border:1px solid var(--jynx);
  background:var(--panel); font-family:var(--font-mono); font-size:11px; font-weight:700; cursor:pointer;
}
.mock-toggle:disabled{ opacity:.6; cursor:wait; }
.mock-toggle-mock{ color:var(--jynx); }
.mock-toggle-live{ color:var(--green); border-color:var(--green); }
.mock-toggle-error{
  font-size:10.5px; color:var(--red); font-family:var(--font-sans); padding:0 4px;
  overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:220px;
}
`;
