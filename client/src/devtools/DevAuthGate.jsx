import React, { useEffect, useRef, useState } from "react";
import { Lock, Settings2, Eye, EyeOff, LogOut, MessageSquare, GripVertical, X, Loader2, Target, RotateCcw, Pencil, Users } from "lucide-react";
import { devLogin, devLogout, fetchDevMe, fetchAdminMe } from "./devApi.js";
import DevFab from "./DevFab.jsx";
import DevAdminPanel from "./DevAdminPanel.jsx";
import DevOverlay from "./overlay/DevOverlay.jsx";
import CommentsPanel from "./overlay/CommentsPanel.jsx";
import MentionsBell from "./MentionsBell.jsx";
import JynxThought from "./JynxThought.jsx";
import { useDraggableFab } from "./useDraggableFab.js";
import { useKeepInViewport } from "./useKeepInViewport.js";

// סדר ברירת המחדל של כפתורי-הפעולה בסרגל (לא כולל את הידית/שם-המשתמש/
// יציאה/קיפול — אלה קבועים בכוונה, ראו ה-JSX). "markers" תמיד נשמר ברשימה
// המלאה גם למשתמש לא-מנהל, כדי שהשוואת orderChanged תישאר יציבה בלי קשר
// למי שמחובר כרגע — הסינון לפי isAdmin קורה רק ברינדור, לא כאן.
const DEFAULT_TOOLBAR_ORDER = ["role", "overlay", "draw", "comments", "markers", "admin", "mentions"];
const TOOLBAR_ORDER_KEY = "jynx-toolbar-item-order";
const TOOLBAR_ORIENTATION_KEY = "jynx-toolbar-orientation";
// האם בורר התפקיד/חטיבה (DevFab.jsx) "מעוגן" בתוך תפריט ה-Jynx (ברירת
// המחדל, ראו הבקשה המקורית) או "מנותק" — בועה צפה עצמאית משלו כמו שהיה
// לפני זה. גרירה של פריט ה-role מחוץ לסרגל מנתקת; גרירת הבועה המנותקת
// בחזרה לתוך הסרגל (או לבועת-Jynx המכווצת) מעגנת מחדש — ראו
// handleRoleItemDragEnd למטה ו-DevFab.jsx's handleRoleDragEnd.
const ROLE_DOCKED_KEY = "jynx-role-docked";

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
  // idle | thinking | success | error — מחליף את loggingIn הבוליאני הישן.
  // "success" הוא שלב מכוון-בעצמו: לא סוגרים את הפאנל/מציבים devName באותו
  // רגע שה-login מצליח, כי אז המעבר מ"מקליד סיסמה" ל"מחובר" קורה בבזק אחד
  // בלי משוב — בדיוק התלונה שהובילה לפיצ'ר הזה. במקום זה משהים כמה מאות
  // מילישניות עם JynxThought מציג "✨ Welcome" לפני שבאמת מתחברים.
  const [loginPhase, setLoginPhase] = useState("idle");
  const [pendingWelcomeName, setPendingWelcomeName] = useState(null);
  const [adminOpen, setAdminOpen] = useState(false);
  const [overlayOn, setOverlayOn] = useState(true);
  const [commentsOn, setCommentsOn] = useState(false);
  // סימוני-מנהל הקבועים על העמוד (AdminAnnotationMarkers.jsx) — נפרד בכוונה
  // מ-overlayOn (שרק שולט על הילת-hover, לא על הנקודות הקבועות). דלוק
  // כברירת מחדל, אבל למי שמוצא אותם מפריעים על מסך עמוס יש עכשיו כפתור
  // ייעודי משלו בסרגל, לא רק "הכל או כלום" עם overlayOn.
  const [markersOn, setMarkersOn] = useState(true);
  // מצב-ציור (Ctrl/Cmd+גרירה על העמוד) — ראו DrawingCanvas.jsx. נפרד
  // מ-overlayOn: אפשר לצייר גם כשהילת-ה-hover כבויה, ולהיפך.
  const [drawMode, setDrawMode] = useState(false);
  const [toolbarOpen, setToolbarOpen] = useState(true);
  // כיוון הסרגל (אופקי/אנכי) וסדר כפתורי-הפעולה בתוכו — שני דברים נפרדים
  // שנשמרים ב-localStorage משלהם, לא קשורים למיקום הפיזי (toolbarFab.pos).
  const [toolbarOrientation, setToolbarOrientation] = useState(
    () => (localStorage.getItem(TOOLBAR_ORIENTATION_KEY) === "vertical" ? "vertical" : "horizontal")
  );
  const [toolbarOrder, setToolbarOrder] = useState(loadToolbarOrder);
  const orderChanged = JSON.stringify(toolbarOrder) !== JSON.stringify(DEFAULT_TOOLBAR_ORDER);
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
  // הידית (⋮) עצמה עכשיו גם כפתור — קליק "נקי" (לא גרירה) עליה מחליף
  // אופקי/אנכי. אותה בדיקת consumeWasDragged בדיוק כמו שאר הכפתורים בסרגל
  // הזה, כי הידית עדיין חלק מהאזור שגורר את כל הסרגל.
  function toggleOrientation() {
    if (toolbarFab.consumeWasDragged()) return;
    setToolbarOrientation((o) => {
      const next = o === "horizontal" ? "vertical" : "horizontal";
      try { localStorage.setItem(TOOLBAR_ORIENTATION_KEY, next); } catch { /* ignore */ }
      return next;
    });
  }
  // גרירה-לסידור-מחדש עם native HTML5 drag-and-drop (draggable/onDragStart/
  // onDrop) — לא pointer-based כמו useDraggableFab.js, כי זו "החלף מקום
  // ברשימה", לא "הזז חופשי ב-2D"; ה-DnD המובנה של הדפדפן פשוט מתאים יותר
  // למשימה הזאת ספציפית.
  function persistToolbarOrder(next) {
    setToolbarOrder(next);
    try { localStorage.setItem(TOOLBAR_ORDER_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  }
  function handleItemDragStart(e, id) {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
  }
  function handleItemDrop(e, targetId) {
    e.preventDefault();
    const draggedId = e.dataTransfer.getData("text/plain");
    if (!draggedId || draggedId === targetId) return;
    const next = [...toolbarOrder];
    const from = next.indexOf(draggedId);
    const to = next.indexOf(targetId);
    if (from === -1 || to === -1) return;
    next.splice(from, 1);
    next.splice(to, 0, draggedId);
    persistToolbarOrder(next);
  }
  function resetToolbarOrder() {
    persistToolbarOrder(DEFAULT_TOOLBAR_ORDER);
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
        markers: isAdmin ? () => setMarkersOn((v) => !v) : null,
        admin: () => setAdminOpen(true),
      };
      const keyableIds = toolbarOrder.filter((id) => actions[id]);
      const id = keyableIds[n - 1];
      if (id) { e.preventDefault(); actions[id](); }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [devName, toolbarOpen, toolbarOrder, isAdmin, roleDocked, devFabProps.setOpen]);

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
  // למעלה על fetchDevMe()'s retry loop), מציגים את אותה בועה נעולה עם ספינר
  // ובועת-מחשבה צפה "💤 Waking up…" (ראו JynxThought.jsx) — אינדיקציה חיה
  // אמיתית, לא קישוט, ולכן מותרת גם לפי מדיניות האנימציה (ראו theme.js).
  if (checking) {
    return (
      <div
        className="dev-fab-wrap jynx-chrome jynx-ui"
        style={{ right: lockedFab.pos.right, bottom: lockedFab.pos.bottom }}
      >
        <style>{CSS}</style>
        <JynxThought status="waking" />
        <div className="dev-fab dev-fab-locked jynx-thinking-pulse" title="Jynx is waking up the dev server — this can take up to ~30s on a cold start">
          <Loader2 size={13} className="dev-fab-waking-spinner" />
          <span className="jynx-logo">JYNX</span>
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
          <JynxThought
            status={loginPhase !== "idle" ? loginPhase : null}
            text={loginPhase === "success" ? `Welcome, ${pendingWelcomeName}!` : loginPhase === "error" ? error : undefined}
          />
        )}
        {loginOpen && (
          <div ref={loginPanelRef} className="dev-fab-panel dev-only dev-login-panel">
            <span className="dev-only-tag">JYNX — Sign in to dev mode</span>
            <label className="env-strip-identity">
              <span>Password</span>
              <input
                type="password" value={password}
                onChange={(e) => { setPassword(e.target.value); if (loginPhase === "error") setLoginPhase("idle"); }}
                onKeyDown={(e) => e.key === "Enter" && login()}
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
          <span className="jynx-logo">JYNX</span>
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
    markers: isAdmin ? (
      <button type="button" className={"dev-toolbar-icon-btn" + (markersOn ? " active" : "")} data-devblock="dev-toolbar-markers-toggle" onClick={() => setMarkersOn((v) => !v)} title={markersOn ? "Hide comment status dots on the page" : "Show comment status dots on the page"}>
        <Target size={13} />
      </button>
    ) : null,
    admin: (
      <button type="button" className="dev-toolbar-icon-btn" data-devblock="dev-toolbar-admin-btn" onClick={() => setAdminOpen(true)} title="Admin (admin only)">
        <Settings2 size={13} />
      </button>
    ),
    mentions: <MentionsBell />,
  };
  // "mentions" בכוונה לא כאן — פותח/סוגר dropdown פנימי משלו, אין לו toggle
  // חיצוני חשוף כרגע להפעלה מהמקלדת (ראו useEffect למעלה).
  const KEYABLE_IDS = ["role", "overlay", "draw", "comments", "markers", "admin"];
  let keyableIndex = 0;

  return (
    <>
      <style>{CSS}</style>
      <DevOverlay active={overlayOn || drawMode} route={route} isAdmin={isAdmin} canJynxChrome={isAdmin || canJynxComment} markersOn={markersOn} drawMode={drawMode} />
      <CommentsPanel active={commentsOn} route={route} currentDevUserId={devUserId} isAdmin={isAdmin} canJynxComment={canJynxComment} />
      {toolbarOpen ? (
        <div
          ref={toolbarFab.sizeRef}
          className={"dev-fab-toolbar jynx-chrome jynx-ui" + (toolbarOrientation === "vertical" ? " vertical" : "")}
          style={{ right: toolbarFab.pos.right, bottom: toolbarFab.pos.bottom }}
          data-jynx-dock-zone=""
          onDragOver={(e) => e.preventDefault()}
          {...toolbarFab.dragHandlers}
        >
          <button type="button" className="dev-toolbar-grip" onClick={toggleOrientation} title={`Switch to ${toolbarOrientation === "horizontal" ? "vertical" : "horizontal"} menu (drag anywhere else on the bar to move it)`}>
            <GripVertical size={13} />
          </button>
          {toolbarOrder.map((id) => {
            if (!TOOLBAR_ITEM_NODES[id]) return null;
            const isKeyable = KEYABLE_IDS.includes(id);
            const keyNum = isKeyable ? ++keyableIndex : null;
            return (
            <div
              key={id}
              className="jynx-toolbar-item"
              draggable
              onDragStart={(e) => handleItemDragStart(e, id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleItemDrop(e, id)}
              onDragEnd={id === "role" ? handleRoleItemDragEnd : undefined}
              title={id === "role" ? "Drag out of the menu to detach the role/brigade picker" : (isKeyable ? `Drag to reorder — press ${keyNum} to trigger` : "Drag to reorder")}
            >
              {keyNum && <span className="jynx-toolbar-key-badge">{keyNum}</span>}
              {TOOLBAR_ITEM_NODES[id]}
            </div>
            );
          })}
          {orderChanged && (
            <button type="button" className="dev-toolbar-icon-btn dev-toolbar-reset-btn" onClick={resetToolbarOrder} title="Reset menu item order">
              <RotateCcw size={11} />
            </button>
          )}
          <span className="dev-toolbar-devname">Hi, {devName}</span>
          <button type="button" className="dev-toolbar-icon-btn" data-devblock="dev-toolbar-logout-btn" onClick={logout} title="Log out of Jynx">
            <LogOut size={13} />
          </button>
          <button type="button" className="dev-toolbar-icon-btn" data-devblock="dev-toolbar-collapse-btn" onClick={toggleToolbarOpen} title="Collapse to the Jynx bubble">
            <X size={13} />
          </button>
        </div>
      ) : (
        <div className="dev-fab-wrap jynx-chrome jynx-ui" style={{ right: toolbarFab.pos.right, bottom: toolbarFab.pos.bottom }}>
          <button type="button" ref={toolbarFab.sizeRef} className="dev-fab jynx-breathe" data-jynx-dock-zone="" onClick={toggleToolbarOpen} {...toolbarFab.dragHandlers} title="Expand the Jynx toolbar — draggable (also a drop target for a detached role picker)">
            <span className="jynx-logo">JYNX</span>
          </button>
        </div>
      )}
      <DevFab
        {...devFabProps}
        docked={roleDocked}
        onDock={dockRole}
        dockAnchorPos={{ right: toolbarFab.pos.right, bottom: toolbarFab.pos.bottom + 40 }}
      />
      {adminOpen && <DevAdminPanel onClose={() => setAdminOpen(false)} onVerified={() => setIsAdmin(true)} />}
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

/* בועת-מחשבה צפה מעל הבועה/הפאנל — ראו JynxThought.jsx. הזנב (::after)
   מוצמד לימין כי כל כרום ה-Jynx עוגן-ימין (right/bottom פיזי, לא RTL). */
.jynx-thought{
  position:absolute; bottom:100%; right:0; margin-bottom:8px; display:inline-flex; align-items:center; gap:6px;
  background:var(--panel); border:1px solid var(--jynx); border-radius:14px; padding:6px 12px;
  font-size:12px; font-weight:700; color:var(--text); white-space:nowrap; box-shadow:var(--shadow-md);
  animation:jynxThoughtPop .22s cubic-bezier(.34,1.56,.64,1); pointer-events:none; z-index:1;
}
.jynx-thought::after{
  content:""; position:absolute; top:100%; right:16px; width:0; height:0;
  border:6px solid transparent; border-top-color:var(--jynx);
}
@keyframes jynxThoughtPop{ from{ opacity:0; transform:translateY(4px) scale(.85); } to{ opacity:1; transform:translateY(0) scale(1); } }
.jynx-thought-icon{ font-size:14px; }
.jynx-thought-thinking .jynx-thought-icon{ display:inline-block; animation:jynxThoughtBounce .6s ease-in-out infinite; }
@keyframes jynxThoughtBounce{ 0%,100%{ transform:translateY(0); } 50%{ transform:translateY(-3px); } }
.jynx-thought-success{ border-color:var(--green); }
.jynx-thought-success::after{ border-top-color:var(--green); }
.jynx-thought-error{ border-color:var(--red); animation:jynxThoughtPop .22s cubic-bezier(.34,1.56,.64,1), jynxThoughtShake .4s ease .22s; }
.jynx-thought-error::after{ border-top-color:var(--red); }
@keyframes jynxThoughtShake{ 0%,100%{ transform:translateX(0); } 25%{ transform:translateX(-3px); } 75%{ transform:translateX(3px); } }

.dev-fab-toolbar{
  position:fixed; z-index:79; display:flex; align-items:center; gap:6px;
  cursor:grab; touch-action:none;
}
.dev-fab-toolbar:active{ cursor:grabbing; }
.dev-fab-toolbar.vertical{ flex-direction:column; align-items:stretch; }
.dev-fab-toolbar.vertical .dev-toolbar-devname{ text-align:center; }
.dev-toolbar-grip{
  display:flex; align-items:center; justify-content:center; width:16px; height:30px; color:var(--text-dim);
  flex:none; background:none; border:none; padding:0; cursor:grab;
}
.dev-toolbar-grip:hover{ color:var(--jynx); }
/* פריט-בסרגל הניתן לגרירה-לסידור-מחדש — קצת שקוף בזמן שהוא עצמו נגרר, כדי
   שיהיה ברור חזותית מה זז. */
.jynx-toolbar-item{ position:relative; display:flex; flex:none; cursor:grab; }
.jynx-toolbar-key-badge{
  position:absolute; bottom:-3px; right:-3px; background:var(--jynx); color:#fff; border-radius:6px;
  font-size:8px; font-weight:700; line-height:1; padding:1px 3px; pointer-events:none; font-family:var(--font-mono);
}
.jynx-toolbar-item:active{ cursor:grabbing; }
.dev-toolbar-reset-btn{ color:var(--text-dim); border-color:var(--line); }
.dev-toolbar-reset-btn:hover{ color:var(--jynx); border-color:var(--jynx); }
.dev-toolbar-icon-btn{
  width:30px; height:30px; border-radius:8px; border:1px solid var(--jynx); background:var(--panel);
  color:var(--jynx); display:flex; align-items:center; justify-content:center; cursor:pointer;
}
.dev-toolbar-icon-btn:hover{ background:color-mix(in srgb, var(--jynx) 10%, var(--panel)); }
.dev-toolbar-icon-btn.active{ background:var(--jynx); color:#fff; }
.dev-toolbar-devname{
  background:var(--panel); border:1px solid var(--jynx); color:var(--jynx); border-radius:20px;
  padding:6px 12px; font-family:var(--font-mono); font-size:11px; font-weight:700; white-space:nowrap;
}

.dev-fab-mock-toggle-row{ display:flex; margin-bottom:6px; }
.mock-toggle{
  display:inline-flex; align-items:center; gap:6px; border-radius:20px; padding:6px 12px; border:1px solid var(--jynx);
  background:var(--panel); font-family:var(--font-mono); font-size:11px; font-weight:700; cursor:pointer;
}
.mock-toggle-mock{ color:var(--jynx); }
.mock-toggle-live{ color:var(--green); border-color:var(--green); }
`;
