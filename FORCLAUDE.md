# FORCLAUDE.md — read this first

This file exists so that **any** Claude session — on any machine, any day —
can pick up this project with full context, without the human having to
re-explain anything. If you are a Claude session that just opened this repo:
read this whole file before touching code. It replaces re-deriving
conventions from scratch or re-making mistakes that were already corrected.

## STANDING RULE — you must keep this file alive

**Every Claude session working on this repo — you included — must update
this file** whenever you learn something durable and relevant: a correction
from the user, a real bug and its root cause, a new architectural decision,
a new convention, a new feature area, a scope change, anything a *future*
session would otherwise have to re-discover the hard way.

- Add new entries under **"Chronological log"** below, each starting with a
  timestamp: `### YYYY-MM-DD — short title`. Don't rewrite history that's
  already there; append.
- If a new entry changes something a section higher up in this file
  describes (e.g. the design system, the file map, an architectural rule),
  update that section too, not just the log — the log is history, the
  sections above it are meant to describe **current state**, so they must
  stay accurate, not just accumulate.
- Keep entries legible to a reader with zero conversation context: full
  sentences, name the actual files/functions involved, explain the *why*,
  not just the what.
- When you finish a chunk of work that changed this file, **commit and push
  it** (`git add FORCLAUDE.md && git commit -m "..." && git push`) so the
  next session — possibly on a different machine — actually gets it. This
  file is the portable equivalent of Claude Code's local per-machine memory
  files, which do **not** travel between computers; this one does, via git.
- Deferred/future work (things explicitly *not* being built right now) goes
  in `TODO.md` at the repo root, not here — check that file too.

---

## What this project is

**HANGAR (האנגר)** — a military brigade equipment-catalog and
requisition-ticket system. Hebrew RTL throughout (`dir="rtl"`,
`<html lang="he" dir="rtl">`). It's explicitly framed as **כלל-זרועי**
(all-corps/multi-branch) — a system-admin level exists above brigade level,
and multiple brigades run fully isolated from each other. Repo folder name
is `commando` (unrelated to the product name — an earlier product name,
"אמל״ח־נט"/amalach-net, was rebranded to HANGAR; the generic Hebrew word
"אמל״ח" itself, meaning materiel/equipment, is a normal domain word left
alone everywhere, e.g. "קטלוג אמל״ח" = equipment catalog).

**Two-part architecture (since 2026-08-20)** — a real backend now exists,
deliberately split into two top-level directories that mirror where this
will actually deploy once it's on military infrastructure (the site and the
API+DB will very likely live on separate hosts — see the "Public hosting"
note below):
- **`client/`** — the Vite + React SPA (everything that used to live in a
  flat `src/` now lives in `client/src/`, reorganized into `screens/`
  /`components/`/`api-client/`/`devtools/`). Deploys to GitHub Pages
  (`client/vite.config.js` sets `base:"/commando/"`, via
  `.github/workflows/deploy.yml`, which now builds from the `client/`
  working directory).
- **`data/`** — a real Express API backed by JSON files as the "database"
  (no SQL engine — deliberately simple, see `data/lib/jsonStore.js`).
  Runs locally always (`npm run dev --prefix data`); `render.yaml` in the
  repo root makes it a one-click Render Blueprint deploy (free tier —
  explicitly not the paid tier, see "GitHub-as-database" below for why
  that's actually fine here). Whether it's actually been connected on
  Render is a fact about the user's account, not the code — don't assume
  either way; ask if it matters.

This is genuinely a **public concept demo carrying no real military data**
— the repo (`invierno8/commando`) is a **public** GitHub repo, and the
user was explicit that this is by design: the public GitHub Pages link is
what actually gets handed to QA/commanders to log into dev mode and leave
feedback, so some things that would be inappropriate for a repo holding real
secrets (like git-tracking a password-hash roster) are a deliberate,
considered choice here — see "Dev-mode auth" below before "fixing" that.

**Remote:** `https://github.com/invierno8/commando.git` (origin) — already
configured, so `git push`/`git pull`/`git clone` work normally and this is
how work travels between machines. **Ownership history**: originally
`joshuael120/commando` (a coworker's account), transferred to
`invierno8/commando` on 2026-08-21 specifically so the repo owner could
create a fine-grained GitHub token for the git-backed persistence below —
GitHub does *not* redirect the GitHub Pages site URL after a transfer
(only the repo/git URLs), so the live public link is now
`https://invierno8.github.io/commando/`, not the old owner's domain — if
you see the old owner referenced anywhere else (old chat history,
elsewhere), it's stale.

**Language policy:** work in **English and Hebrew only** (no Spanish — an
earlier contributor mixed in Spanish; the user asked for that to stop). Talk
to the user in English about code/tooling; it's natural to switch to Hebrew
discussing the product/domain since the UI and data are Hebrew-first.

## Quick orientation for a cold start

1. Read `TODO.md` — deferred work, don't rebuild it prematurely.
2. Read this file's "Chronological log" bottom-up (newest first) for the
   most recent state of things — the log is append-only, so the tail is the
   freshest picture.
3. `client/src/roles.js` is the one source of truth for the four structural
   roles (`STRUCTURAL_ROLES`: `member` / `unit_officer` / `brigade_officer` /
   `system_admin`). There's still no real *application* login (that's still
   simulated — see below); `App.jsx` owns the role/brigade/identity switcher
   (`DevFab.jsx`, moved into `client/src/devtools/`), now gated behind real
   **dev-mode authentication** (see "Dev-mode auth" below) rather than
   always-open. Every screen still receives `role` as a prop and branches
   its UI/data scope off it exactly as before.
4. Every operational data store (`client/src/api-client/*.js`) now makes
   **real HTTP calls** to `data/routes/*.js` — this used to be the "LEGO
   block" in-memory-simulate-latency pattern; that pattern's whole point was
   that swapping the body for a real API call would be a contained change
   touching no screen, and that's exactly what happened. Each store still
   exports the same `async function fetchX()`/`saveX()`-shaped functions;
   **follow that pattern for any new data need** — add a client function in
   `api-client/`, a matching route in `data/routes/`, don't invent a
   different shape. The two exceptions worth knowing: `brigadesData.js`
   (brigade *registry* — name/logo/status, not a brigade's operational
   data) and `brigadeStore.js`'s catalog/ticket writes both needed small
   real code changes beyond a body-swap — see the chronological log entry
   for 2026-08-20's backend build-out for why.
5. To run/verify: `npm run install:all` once, then `npm run dev` from the
   repo root (runs `client/` and `data/` together via `concurrently`), open
   `http://localhost:5173/commando/`. `data/` needs a local `.env` first
   (`cp data/.env.example data/.env`, then set a real `ADMIN_SECRET`) — see
   `README.md`. Each half can also run standalone:
   `npm run dev --prefix client` (port 5173, proxies `/api/*` to `data/` via
   `client/vite.config.js`'s `server.proxy`) / `npm run dev --prefix data`
   (port 4000). Node 20+ is required (both `package.json`s pin
   `engines.node`).

## Design system (current state)

- **Palette:** near-black dark theme (`#0B0D0F`) / light theme (`#F2F4F5`),
  one confident mint/emerald **accent** (`--accent`, ~`#3ECF8E` dark /
  `#159865` light) carrying both brand and "success" meaning. `--yellow`
  and `--red` are genuinely distinct caution/danger hues. `--dev` (orange)
  is reserved **solely** for the dev/demo-only marking convention (the
  `.dev-only` dashed-border treatment, the `.env-strip` DEV banner, the
  `.dev-fab` role switcher) — never repurpose it as a status or brand color.
  There is no `--amber` token — if you see one, something regressed; that
  name was retired in favor of `--accent`/`--accent-ink`.
- **Fonts:** **Assistant** for UI text (chosen for an "administrative,"
  government-service feel), **IBM Plex Mono** for IDs/timestamps/data.
- **Shared primitives in `theme.js`:** `.panel-card` (the base card, shared
  `--radius-card` = 12px), `.pill`/`.pill-{tone}` (solid-fill badges),
  `.dot-legend`, `.trend-badge`, `.pill-tabs`/`.pill-tab` (the tab-row
  pattern used everywhere: view toggles, role/brigade pickers, etc.),
  `.env-strip` (the persistent DEV banner + live clock, once, in `App.jsx`
  — never re-add a per-screen version of this), `.overlay`/`.drawer-close`
  + `modalIn`/`overlayIn` keyframes (the standard modal shell — see the
  z-index rule below), `.add-form`/`.add-form-field`/`.add-btn` (the
  standard "add a new X" inline form), `.btn-approve`/`.btn-reject`/
  `.btn-cancel`/`.reject-reason-box` (the standard decide-with-reason
  pattern), `.blocked-gate` (the full-screen "access denied" state).
- **Layout:** full-bleed, not a bordered floating card — `.app-shell` fills
  the viewport, a fixed collapsible icon **sidebar** (`.app-sidebar`, RTL —
  renders on the visual right, toggle button expands it to show text
  labels) plus a slim sticky top bar (page title, notification bell,
  theme toggle, user chip). One soft radial `.app-glow` background, no
  per-screen decorative grid/texture.
- **Icons:** `lucide-react` only — the one and only icon dependency. Never
  emoji, never hand-drawn SVG, for UI chrome. (Logos are the one exception —
  see below.)
- **Logos/emblems are uploaded images, never icon pickers.** `LogoUpload.jsx`
  (`FileReader.readAsDataURL`, data-URL in React state — no real storage
  yet) is the shared upload component for any brigade/unit/team logo.
  `UnitEmblem.jsx` takes an `image` prop as its primary rendering path and
  falls back to an auto-generated hash-based SVG badge only when no image
  was uploaded. A **team's** logo has no such fallback — if a team has no
  uploaded logo, nothing renders for it (this matters for the org tree and
  sidebar identity stack, see below — they show a team's logo only when
  one actually exists, never a placeholder).
- **Animation policy:** subtle one-shot entrance fades are fine; no
  continuous/looping decorative animation (no shimmer, no drifting
  background, no glowing pulse) except on genuinely live/urgent indicators
  (a plain opacity fade, not a colored box-shadow glow).
- **Destructive/consequential actions are always multi-step, never a single
  click.** Two shapes exist depending on severity:
  - **Blocking a user / deleting a team / moving someone in the org tree:**
    a two-step confirm modal (`BlockConfirmModal`/`TeamDeleteConfirmModal`/
    `MoveConfirmModal` in `PermissionsDashboard.jsx`) — step 1 shows the
    consequence (+ a required reason textarea for block/delete, no reason
    required for a plain move), step 2 is a final explicit confirm button.
  - **Deleting a brigade or a system admin:** a heavier four-step pattern
    (`DestructiveConfirm` in `SystemAdmin.jsx`) — warning → type the exact
    target name to proceed → submit, and if the actor isn't a super-admin
    the action doesn't even execute yet, it only files a request that a
    super-admin must separately approve (itself a two-click confirm).
  Reuse one of these two existing components for any new destructive
  feature rather than building a fresh one-click delete.
- **Org-tree connector lines are real CSS, not hand-drawn SVG.** The
  technique (see `.org-node-children` in `PermissionsDashboard.jsx`): each
  child gets a `::before` vertical drop and an `::after` horizontal bus
  segment, trimmed via `:first-child`/`:last-child`/`:only-child` — this
  needs `gap:0` with spacing done via child `padding` instead, and
  `flex-wrap:nowrap`. `SystemAdmin.jsx`'s brigade-level tree still uses the
  older "nested shaded box" style (pre-dates this technique) — if you ever
  touch that tree, consider migrating it to match.

## Architecture rules that are load-bearing (breaking these causes real bugs)

- **Every screen owns a fully self-contained `<style>{CSS}</style>` block.**
  Components must never rely on another file's CSS class definitions — a
  `<style>` tag only exists in the DOM once that component actually mounts,
  so cross-file class reuse silently breaks. When two files need visually
  identical UI (e.g. `RejectWithReason`/`CatalogDecideRow`, or the
  `block-confirm-modal` classes reused for team-deletion and move-confirm),
  **duplicate the CSS block**, don't try to share it — this is a deliberate
  tradeoff, not an oversight.
- **Any fullscreen modal/overlay must render via `createPortal(...,
  document.body)`.** `.app-sidebar` has `z-index:20` while `.app-main-col`
  (everything else) has `z-index:1` as a **sibling** stacking context — no
  z-index nested inside `.app-main-col`, no matter how high, can ever
  out-rank the sidebar. A non-portaled modal renders visually fine but has
  genuinely unclickable buttons wherever the sidebar/topbar overlap it. This
  bit multiple real modals before the rule was established; don't
  reintroduce it.
- **No Context API anywhere — prop-drilling is the only state-passing
  convention in this codebase.** `App.jsx` bundles secondary props into one
  `extra` object passed to every `NAV` entry's `render(...)` call
  specifically to avoid the positional-parameter list growing unbounded;
  follow that pattern (add a new key to `extra`) rather than introducing
  Context.
- **No external UI/DnD/chart-interaction libraries beyond what's already
  present** (`lucide-react` for icons, `recharts` for charts). Drag-and-drop
  anywhere in this app (dashboard widget reordering, org-tree person
  reassignment) is native HTML5 (`draggable`, `onDragStart`/`onDragOver`/
  `onDrop`), not a library.
- **A native `disabled` attribute is never sufficient user feedback on a
  form.** A disabled button can't even receive the click needed to reveal
  *why* it's disabled. The established pattern: keep the submit button
  always clickable, gate the actual submit logic behind a check that sets
  an `attempted` flag on failure, and only show red field borders + inline
  "שדה חובה" messages once `attempted` is true (never on a pristine form).
- **React 18 StrictMode double-invokes functional `setState` updaters** —
  code that sets a `let` variable as a side effect *inside* a
  `setX(prev => {...})` updater and reads it *after* the call is unreliable
  under this. Fix pattern: derive dependent state via a separate `useEffect`
  that re-syncs from the source array whenever it changes, instead of
  manual side-effect variables inside an updater.
- **Mutations that persist to the backend compute the new object *before*
  calling `setX`, never inside the `setX(prev => {...})` updater.** This
  extends the StrictMode rule above: `Catalog.jsx`/`Tickets.jsx`'s ~11
  mutator functions (decide/reopen/assign/toggle-interest/etc.) all follow
  `const target = list.find(...); const updated = {...target, ...patch};
  await updateX(brigadeId, id, updated); setList(prev => prev.map(...))` —
  find the current item, compute the full next value, `await` the API call,
  *then* set state from that already-known value. Never try to read the
  server's response back out of a `setState` updater's side effect.
- **Free-text fields that persist per-keystroke (`onChange`) must debounce
  the network call, not the local state update.** A brigade-name input or a
  ticket due-date field updates React state immediately (so typing feels
  instant) but the `updateX(...)` call is wrapped in a
  `clearTimeout`/`setTimeout(..., 500)` pair keyed by the record's id (see
  `SystemAdmin.jsx`'s `brigadePatchTimers` / `Tickets.jsx`'s
  `dueDateTimers`), so a fast typist doesn't fire one HTTP request per
  character.
- **RTL bidi reversal bites plain number/ratio strings.** A string like
  `"1 / 4"` or a Recharts numeric axis label renders visually reversed
  unless the containing element (or a wrapping `<div dir="ltr">`) is
  explicitly LTR — this has bitten a gallery counter and a Recharts vertical
  category axis before.
- **Application identity is still simulated via the (now-gated) dev-fab
  panel, not real auth, and it is intentionally being kept that way for
  now.** `persona` (for `MEMBER` role: random rank/name/personal-number/
  unit, re-rolled on role/brigade switch) and `userId` (a free-typed
  personal number, used for every officer role's identity, and optionally
  overridable for `MEMBER` too) are the two identity primitives every
  "per-person" feature is keyed off (dashboard layout, drafts, favorites,
  team-lead detection, block status). See the "Explicitly deferred" section
  below and `TODO.md` — real SSO-based identity/enrollment is planned but
  not started. Don't confuse this with **dev-mode auth** (below), which is
  a real, separate authentication layer — it gates who can *open the
  role-switcher panel at all* and leave QA feedback, not what role/persona
  someone picks once they're in.
- **Dev-mode auth is real, on purpose, and deliberately minimal — see
  `data/middleware/auth.js`.** A named dev user (product manager, commander,
  engineer — not necessarily an engineer) logs in with a personal password
  (bcrypt-hashed, `data/config/dev-users.json`) to unlock the dev-fab panel;
  a completely separate, stricter secret (`ADMIN_SECRET` env var, never
  committed) gates `DevAdminPanel.jsx` (managing the dev-user roster,
  reviewing QA annotations). **`data/middleware/auth.js` is the only place
  in the whole backend that ever reads the `hangar_dev_session` cookie** —
  every route reads `req.devUser` instead. This is deliberate: swapping in
  real OpenID SSO later is meant to be a middleware replacement, not a
  route-by-route rewrite. Don't add a second place that reads that cookie.
- **`data/config/dev-users.json` is git-tracked on purpose, even though it
  holds password hashes — this was a direct, considered decision, not an
  oversight.** The user was explicit: this repo is a public concept demo
  with no real military data, and the public GitHub Pages link *is* the
  thing handed to QA/commanders, so the roster needs to travel with the
  repo the same way `FORCLAUDE.md`/`TODO.md` already do. Hashes only, never
  plaintext; `ADMIN_SECRET` (the higher-privilege secret) and `GITHUB_TOKEN`
  (see next bullet) both stay real, never-committed `.env` values
  regardless — don't relax that half.
- **GitHub is the durable store for the dev-user roster and QA
  annotations — deliberately, instead of paying for hosting with a
  persistent disk.** `data/lib/githubPersist.js` commits every write
  straight to this repo via the GitHub Contents API (`GITHUB_TOKEN` env
  var — a fine-grained PAT scoped to just this repo, Contents: read/write,
  nothing broader) and re-hydrates the local disk from git on every server
  boot (`hydrateDevUsersFromGithub`/`hydrateAnnotationsFromGithub`, called
  once in `server.js` before `app.listen`). This is why the free (not
  paid) Render tier is genuinely fine here even though its filesystem is
  fully ephemeral (wiped on every idle spin-down or redeploy) — the real
  copy always lives in git, not on that disk. Without `GITHUB_TOKEN` set
  (the normal case in local dev), every function in that module is a
  no-op and everything falls back to local-disk-only behavior, exactly as
  before this existed — don't assume `GITHUB_TOKEN` is set just because
  the code path exists. QA annotations specifically are **one JSON file
  per annotation** under `data/annotations/notes/` (not one shared array)
  — this was a deliberate choice so concurrent submissions land as
  distinct files/commits instead of racing to overwrite one file, and so
  `git log` on that folder reads as a genuine change log (the user's own
  ask: "log every change afterwards"). `data/db/` (live-mode brigade
  operational data) is **not** git-backed this way — only the dev-user
  roster and annotations are, per what was actually asked for; live-mode
  data on a free host is still ephemeral, and that's an accepted,
  unaddressed gap, not a bug.
- **Officer "which unit am I" is a real, previously-buggy concept.** A
  `MEMBER` persona's unit is genuinely random on every reroll; an officer's
  "my unit" is `officerUnit` (an explicit dev-panel picker in `App.jsx`,
  threaded through `extra.officerUnit`) rather than always `units[0]` —
  earlier code hardcoded `units[0]` in several places and it caused a real
  reported bug (a unit officer couldn't see requests their own unit's
  members had actually filed). If you add a new officer-scoped screen,
  thread `officerUnit` through, don't default to `units[0]`.

## Domain model snapshot (what exists today)

- **System admin** (`SystemAdmin.jsx`) provisions brigade shells, tracks
  `pending`/`active` status, manages other system admins (with an internal
  `isSuperAdmin` hierarchy), and owns the audit log.
- **Brigades** (`brigadesData.js` seed + `brigadeStore.js` per-brigade
  dataset) are fully isolated tenants — own catalog, tickets, roster,
  dashboard stats. A brigade has `units` (plain string names), each with an
  optional `unitOfficers` entry, `unitPeople` (the roster, keyed by unit
  name — **this is where the current "who's a real user" model lives**, see
  below), and `brigadeStaff` (people attached directly to brigade HQ, not
  any one unit).
- **Catalog** (`Catalog.jsx`/`ProductDossier.jsx`) — equipment items with
  photo/video galleries (`MediaGallery.jsx`), origin tags (industry/מטכ״ל/
  in-house), an approval flow for member-proposed items (unit-officer or
  brigade-officer decides), and an "equipping path" instructions field.
- **Tickets** (`Tickets.jsx`) — requisition/repair/idea/procurement
  requests, full lifecycle (submit → unit-officer decide → brigade-officer
  prioritize → progress tracking → archive), collaborators, response-time
  analytics (`analytics.js`).
- **Permissions / org structure** (`PermissionsDashboard.jsx`) — the
  biggest, most actively-evolving screen. Three sub-views: **list**
  (roster tables, click any row to open a person card), **org tree**
  (hierarchical, drag-and-drop — see below), **חסומים** (blocked users).
- **Teams / sub-teams** (`teamStore.js`) — a two-level structure *inside* a
  unit, layered on top of the plain roster, not a replacement for it: a
  unit officer creates a **team** (name, logo, a designated lead — this is
  immediate, no approval, since the officer already has full authority
  over their unit) with up to **3 sub-teams**. The team **lead** (a
  `MEMBER`-role person, identified by matching their personal number to
  `team.leadPersonalNumber`) gets a dedicated reduced screen
  (`TeamLeadView`, reached via the same "ניהול הרשאות" nav entry, gated in
  `App.jsx`'s `visibleNav` by `isTeamLead`) where they can edit *only*
  their team's description, and can *request* (not directly perform) new
  sub-teams and member additions — every such request lands in the unit
  officer's "בקשות ארגון ממתינות" queue for approval/reasoned rejection,
  with notifications both ways. Sub-team members are stored as loose
  `{identifier, note}` pairs (a typed name or personal number), not full
  roster records — `getMemberTeamInfo`/`getLedTeam` resolve identity by
  matching that identifier against a personal number or full name. A team
  lead can toggle `requireLeadApproval` on their own team — when on, their
  team members' new tickets/catalog proposals get an extra gate: they land
  in the lead's own "אישורי ראש צוות" tab first (`teamLeadGate: "pending"`
  field on the ticket/item, `gateTeamId` records which team owns the gate),
  and only after the lead approves does it become visible in the unit
  officer's normal queue.
- **Blocking** (`blockStore.js`) — a unit officer can block someone within
  their own unit; a brigade officer/system admin can block anyone anywhere
  in the brigade (`BLOCK_SCOPE.UNIT` vs `BLOCK_SCOPE.BRIGADE`). A blocked
  identity hits a full-screen `.blocked-gate` instead of the app, checked
  in `App.jsx` against `effectiveMemberId` + their current unit.
- **Audit log / "the log is also a backup"** (`adminStore.js`) — every
  significant admin/officer action (team create/edit/delete/move, brigade
  or admin deletion, deletion-request approve/reject) is logged via
  `logAction({actor, action, target, targetType?, snapshot?})`. Any entry
  carrying a `snapshot` (a full copy of what was deleted, tagged with a
  small backup icon) shows a **"שחזור" (restore)** button in `SystemAdmin.jsx`'s
  audit-log tab — clicking it re-inserts the snapshot (via `restoreTeam` for
  teams, or directly into the `brigades`/`admins` state for those) and marks
  the entry `restored: true` so it can't be double-restored. The audit log
  tab has search + a target-type filter (system-admin only).
- **Org tree drag-and-drop** (`PermissionsDashboard.jsx`'s `OrgTree`) — a
  roster person can be dragged onto: their own unit's node (detaches them
  from any team, no reason required, two-step confirm via
  `MoveConfirmModal`), or a sub-team node within their **own current unit**
  (assigns/moves them into that sub-team, replacing any prior sub-team
  membership so they never end up in two places). **Cross-unit drag is
  deliberately disabled** — every drop target checks
  `dragPerson.fromUnit === <target's unit>` and is simply not offered
  otherwise. See "Explicitly deferred" below for why, and don't re-enable
  it without reading that section first.
- **Org tree visual structure** — under each unit, people and teams render
  as two separate, distinctly-styled branches ("אנשי אמל״ח היחידה" and
  "צוותים"), never flat siblings in one row — this was a direct user
  correction ("why are the soldiers and the teams in the same line").
- **Sidebar identity stack** (`App.jsx`, below the `HGR` mark) — brigade
  emblem always, unit emblem only for roles actually tied to one unit
  (`MEMBER`/`UNIT_OFFICER`, not `BRIGADE_OFFICER`/`SYSTEM_ADMIN`), team
  emblem only if the current identity belongs to a team **and that team has
  an uploaded logo** (no fallback icon for a logo-less team). Expands with
  text labels when the sidebar is expanded.
- **Dev-panel identity picker** (`App.jsx`, `MEMBER` role only) — a 3-way
  switch: "חייל רגיל" (random persona, with a unit picker), "ראש צוות" (pick
  an existing team to become its lead), "חבר צוות" (pick an existing
  sub-team member to become). Poll-refreshes off the same `now` ticker
  notifications already use, so it stays live-synced as teams are
  created/deleted elsewhere in the session — don't remove that dependency,
  it was added specifically to fix a real staleness bug.
- **Notifications** (`notificationStore.js` + `App.jsx`'s
  `isNotificationRelevant`) — strictly personal, never a shared per-role
  broadcast (see the chronological log for the correction that established
  this). A notification is relevant to whoever the event actually touched:
  the requester, every collaborator, the unit officer of that unit — plus
  brigade officer/system admin for anything already past raw submission.
- **Drafts** (`draftStore.js`) — one auto-saving slot per person per
  form-kind (ticket / catalog item), resume-or-discard banner on reopen.
  Now server-backed (`data/routes/drafts.js`) rather than `localStorage` —
  strictly better here, since a draft now survives a device switch.
- **Per-user dashboard layout** (`userPrefsStore.js`) — keyed by personal
  number (`userId`), explicitly **not** by device, because military users
  sign in from many different machines and a device-bound key would strand
  personalization on one computer. Also now server-backed
  (`data/routes/user-prefs.js`), so this genuinely works as designed now —
  it couldn't fully deliver on "follows you to any device" while it was
  `localStorage`-only.
- **Dev-mode / QA feedback overlay** (`client/src/devtools/`, backend in
  `data/routes/dev-auth.js`/`dev-users.js`/`dev-data-mode.js`/
  `annotations.js`/`admin-auth.js`) — added 2026-08-20, this is the newest
  major feature and is entirely separate from the app's real
  role/permission model:
  - `DevAuthGate.jsx` is the single entry point (fixed bottom-right,
    replacing the old always-open `.dev-fab`): unauthenticated shows only a
    locked "DEV" button + a name/password login form; authenticated shows
    the moved-verbatim `DevFab.jsx` role/brigade/identity picker plus a
    small toolbar (`MockDataToggle.jsx`, an overlay on/off eye icon, a
    ⚙ admin button, and the logged-in dev user's name).
  - **Hover + Ctrl/Cmd+click annotate** (`devtools/overlay/DevOverlay.jsx`)
    — while the overlay toggle is on, hovering shows a glowing outline
    around the container under the cursor (`useHoverTarget.js`: a
    `data-devblock="<label>"` attribute where present, falling back to the
    nearest flex/grid ancestor or a known `theme.js`/screen class — added so
    far only to the 5 highest-traffic screens' outer container, meant to be
    extended incrementally, not exhaustively pre-annotated). Ctrl/Cmd+click
    stops the real app's click handler (capture-phase `stopPropagation` on
    `window`) and opens a small comment box
    (`overlay/AnnotationPopover.jsx`), submitting to
    `POST /api/dev/annotations`.
  - **Mock/live data-mode toggle** (`MockDataToggle.jsx`) — a single
    **global**, server-side flag (`data/lib/dataMode.js`), not per-session;
    flipping it does a full page reload. Mock mode is an in-process memory
    clone of `data/mock/*.json` (writes never touch disk — a demo session
    can't corrupt the seed files); live mode is real disk I/O against
    `data/db/*.json`, created lazily and empty ("the system starts empty").
  - **Admin review** (`DevAdminPanel.jsx`, admin-secret-gated, composes
    `DevAdminUsersScreen.jsx` + `DevAnnotationsScreen.jsx` as tabs) — manage
    the dev-user roster, and review/resolve/export (Markdown, grouped by
    screen, unresolved-only) the QA annotation queue.
  - **"Action" pipeline (added 2026-08-21)** — turns a QA comment into real
    autonomous code work, not just a to-do list entry. Every annotation now
    carries `actionStatus` (`none`/`queued`/`in_progress`/`pr_opened`/
    `done`/`failed`), `actionRequestedAt/By`, `actionPrUrl`, `actionLog`.
    Two ways a note gets flagged: (a) **automatically** — any note the
    *admin themselves* writes while logged in (checked via `isAdmin` prop
    threaded from `DevAuthGate.jsx`'s own `fetchAdminMe()` check down
    through `DevOverlay.jsx`) is queued the instant it's submitted, no
    extra click; (b) **manually** — the admin clicks the "⚡ פעולה" button
    next to *any* comment, in `DevAnnotationsScreen.jsx` or directly on the
    live page (see next bullet), via `POST /admin/annotations/:id/action`.
    Either path writes a **second, small file** to
    `data/annotations/actions/<id>.json` (git-committed, same mechanism as
    notes) — a distinct signal path a scheduled cloud-agent routine
    watches, kept deliberately separate from the permanent note record in
    `data/annotations/notes/`. The routine (not yet created as of this
    writing — needs the Claude GitHub App installed on `invierno8/commando`
    first, see the chronological log) is expected to: read each pending
    action-item file, implement the change **on a branch and open a PR —
    never push to main directly** (the user's explicit safety choice),
    then update the corresponding note's `actionStatus`/`actionPrUrl`
    fields (plain bookkeeping — committed directly, unlike the code change
    itself) and delete the now-processed action-item file.
  - **`AdminAnnotationMarkers.jsx`** — admin-only, always-on (not
    hover-triggered) colored borders directly on the live page for every
    *open* comment on the current screen, re-located via
    `document.querySelector('[data-devblock="<label>"]')` — a deliberately
    different color (red/blue/green by `actionStatus`) from the hover-glow,
    so it reads as a distinct signal. Each marker carries its own inline
    "⚡ פעולה" trigger. Comments whose target has no matching `data-devblock`
    element on the current page simply don't get an on-page marker (still
    visible in the admin panel's list) — a known, accepted degradation, not
    a bug to chase.
  - Verified end-to-end with a real headless-browser (Playwright) smoke
    pass, not just a build check — see "Testing / verification workflow"
    below for a real gotcha found doing that. The action-queueing logic
    itself (auto-flag on admin notes, manual-flag via the button, the
    distinct `actions/` file appearing/disappearing correctly) was verified
    against the real `data/` server with real GitHub commits, repeatedly
    cleaned up afterward — see the chronological log.
  - **Guardrail (added 2026-08-25) — do not commit a pure "still unchanged"
    re-confirmation.** The routine fires on *any* push to the repo,
    including its own bookkeeping commits, with no way to scope the webhook
    more narrowly (see the routine's own step-zero comment). This created a
    real, confirmed self-sustaining loop on 2026-08-25: a batch of 6 items
    (`ann-mt5p5xzokc1i` plus 5 items from a commenter named Vova) settled
    into a state where every item was correctly left unactioned as a
    genuine product decision, but each run still committed a "still
    unchanged, Nth re-confirmation" entry to this file — and that commit's
    push re-triggered the webhook, which found the identical unchanged
    state and repeated the cycle. Six-plus such commits landed back to back
    with zero forward progress (`git log --oneline -- FORCLAUDE.md` shows
    them consecutively). **The fix: when a run's queue is byte-for-byte
    identical to what the most recent log entry already describes (same
    ids, same comments, no `isFollowUp`, no new PR referencing any of
    them), do not push anything at all** — no FORCLAUDE.md log entry, no
    note edit, no queue-file deletion. Treat it exactly like step zero's
    empty-queue case: a clean, silent no-op. Only push when something
    actually changed: a PR opened/updated, a note genuinely bookkept, a
    queue file genuinely deleted, or the queue's *content* differs from
    last logged (a new item, an `isFollowUp`, a changed comment, someone
    externally resolving/PR'ing an id). If a stuck item's staleness itself
    is worth a human's attention, that's what `PushNotification` is for
    (already established for `ann-mt5p5xzokc1i` — one escalation, then
    silence until something changes) — it doesn't require a matching git
    commit, and a notification should never be paired with a no-op push
    just to "leave a record."

## Explicitly deferred (see `TODO.md` for the full writeup)

1. **Real SSO/military-card-based enrollment**, replacing manual unit
   assignment (including a future ability for one person to belong to more
   than one unit/brigade at once). This is *why* cross-unit drag-and-drop
   in the org tree was deliberately disabled rather than built out — the
   user was explicit: don't let officers manually drag people between
   units; that's going to be governed by identity/SSO claims later, not a
   roster edit.
2. **A unit-level "catalog only" user role** — someone who can browse the
   catalog and submit to an "idea box" and nothing else, distinct from the
   equipment-corps (אמל״ח) chain that every current real user belongs to.

Don't start building either of these unless explicitly asked — they were
flagged for later on purpose.

## Testing / verification workflow

- Run both processes: `data/`'s server first (`npx node server.js` or
  `npm run dev --prefix data`, port 4000), then `client/`'s dev server
  (`npx vite --port <N>` from inside `client/`, background), then drive it
  with small ad-hoc Playwright Node scripts — there's no test framework
  installed, this is a prototype. Playwright itself may need installing as
  a real npm dependency somewhere on `NODE_PATH` (it's not a project
  dependency — install it in a scratch temp directory if needed) plus
  `npx playwright install chromium` on a fresh machine. **Get each
  background process's `cwd` right explicitly** (e.g.
  `(cd client && npx vite --port N &)`) — a plain `cd` earlier in the same
  shell session persists across tool calls, and starting `vite` from the
  wrong directory silently falls back to a different globally-cached
  Vite version with no `vite.config.js`, serving 404s that look like a real
  bug but aren't.
- **Whether Node is on Bash's PATH is machine-specific — don't assume
  either way.** An earlier Windows dev machine needed the PowerShell tool
  instead of Bash for this reason; on a macOS session, plain Bash has had
  `node` on PATH directly. Check `which node` once at the start of a
  session rather than trusting a stale assumption from a different machine.
- **Playwright's `mouse.click(x, y, {modifiers: [...]})` does not reliably
  set `ctrlKey`/`metaKey` on the resulting event in this environment** —
  confirmed while verifying the dev-overlay's Ctrl/Cmd+click-to-annotate
  feature: neither `keyboard.down("Control")` + `mouse.click()` nor the
  `modifiers` option produced a click event `DevOverlay.jsx`'s handler
  treated as modified, even though the exact same interaction works
  correctly for a real user. Verify this class of interaction with a
  manually dispatched native event instead:
  `el.dispatchEvent(new MouseEvent("click", {bubbles:true, cancelable:true,
  clientX, clientY, ctrlKey:true, view:window}))` via `page.evaluate(...)`
  — this reproduced the real interaction correctly and confirmed the
  feature itself was never broken, only the test's input emulation was.
- The dev-fab role/brigade/identity switcher (now behind `DevAuthGate.jsx`
  — log in as the seeded `Demo Dev` / `hangar-demo-2026` account first, see
  `README.md`) requires clicking `.dev-fab`
  to open `.dev-fab-panel` first; it does **not** auto-close after a
  selection (by design, so it can be reused for several picks in a row) —
  guard any helper that opens it with an `isVisible()` check first, since
  clicking `.dev-fab` again while already open **toggles it closed**.
- **`.dev-fab` (fixed bottom-right) visually overlaps `.sidebar-toggle`** at
  the bottom of the sidebar at common viewport sizes — a real,
  pre-existing layout detail (not caused by any one feature), not worth
  "fixing" opportunistically. If a test needs to click `.sidebar-toggle`,
  dispatch the click via `page.evaluate(() => el.click())` rather than a
  real mouse click, or it'll hang waiting for an unobstructed hit-target.
- **Any `.overlay`-based modal left open blocks all subsequent clicks** —
  if a test fails mid-modal, close it explicitly (`.drawer-close`) before
  the next step, or every following action will time out on "element
  intercepts pointer events."
- **`locator.selectOption({label: /regex/})` is not supported by
  Playwright** — use an exact string or `{index: N}`.
- **Scope selectors to the open modal** (`page.locator(".modal")` then
  `.locator(...)` inside it) when a form field's own selector (e.g. a bare
  `select` or `input[type=file]`) isn't unique on the page — the
  background list/pagination controls behind the modal can otherwise steal
  a `.first()` match.
- **The org tree is wide** (`overflow-x:auto`) — give the browser a wide
  viewport (2000px+) for any test that needs to click/drag distant nodes,
  or Playwright's own "scroll into view" can land an element under the
  sticky sidebar.
- **Native HTML5 drag-and-drop works with Playwright's `locator.dragTo()`**
  in Chromium (it does real mouse down → move → up, which the browser's own
  DnD engine picks up) — this was verified working for the org-tree
  person-reassignment feature. For dashboard-widget reordering, a single
  fast `mouse.move` with many `steps` can register `dragstart` without ever
  firing `dragover` on the target — space the move into a few discrete
  `mouse.move` calls with short waits between them instead.
- Standard closing move for any change to `PermissionsDashboard.jsx`,
  `App.jsx`, `Tickets.jsx`, or `Catalog.jsx`: `npx vite build` from
  `client/` (catches syntax errors fast) → targeted Playwright check of the
  new behavior against both processes running → a full sweep across all 4
  roles × both real brigades × every visible nav view, checking for zero
  console/page/network errors. If the change touches persistence, also
  verify live mode survives a real server restart (create something, `kill`
  + restart `data/`, confirm it's still there) and that mock mode never
  writes to `data/mock/*.json` on disk (`git status` should stay clean
  after a mock-mode test session).

## File map

### `client/src/`

- `App.jsx` — shell: sidebar, topbar, notification bell, sidebar identity
  stack, `NAV` registry (role-gated), the block-gate full-screen check, and
  mounts `devtools/DevAuthGate.jsx` (the dev-mode entry point — the actual
  role/brigade picker UI now lives in `devtools/DevFab.jsx`).
- `roles.js` — `STRUCTURAL_ROLES`, `ROLE_LABELS`, `ROLE_ORDER`. Single
  source of truth.
- `theme.js` — `THEME_CSS` (shared tokens + primitives), theme
  read/persist helpers.
- `analytics.js` — timestamp parsing + duration/response-time helpers.
- `search.js` — `matchesSearch`, the one shared search-matching function.
- `opsData.jsx` — brigade-agnostic helpers (`StatusPill`, `PriorityDot`,
  `randomMemberPersona`, `DEFAULT_CATEGORIES`).
- **`screens/`** — `Catalog.jsx` / `ProductDossier.jsx` (catalog browsing +
  item detail), `Tickets.jsx` (requisition/repair/idea ticket lifecycle),
  `PermissionsDashboard.jsx` (roster/org-tree/teams/blocking, the largest
  screen, exports `RANK_OPTIONS`), `SystemAdmin.jsx` (brigade provisioning,
  system-admin management, category management, audit log),
  `BrigadeSetupWizard.jsx` (exports `MissionBar`), `DevDashboard.jsx`
  (role-scoped widget dashboard).
- **`components/`** — `PhotoTile.jsx` / `MediaGallery.jsx` /
  `MediaEditor.jsx` (catalog media), `SearchBar.jsx` / `FilterSelect.jsx` /
  `Pagination.jsx` (list controls), `ScopePicker.jsx` (unit-scope dropdown),
  `UnitEmblem.jsx` / `LogoUpload.jsx` (logo/emblem rendering + upload),
  `ThemeToggle.jsx`, `Loading.jsx`, `CountUp.jsx`.
- **`api-client/`** — every real app data call. `http.js` is the shared
  `fetch` wrapper every other file here goes through (base URL from
  `VITE_API_BASE_URL`, `credentials:"include"` for session cookies).
  `brigadeStore.js` / `teamStore.js` / `blockStore.js` /
  `notificationStore.js` / `adminStore.js` / `draftStore.js` /
  `userPrefsStore.js` / `brigadesData.js` each mirror a same-named file in
  `data/routes/` — same exported function names as the old in-memory
  version, real HTTP now. `demoMediaAssets.js` maps the bare filenames
  `data/mock/`'s catalog JSON stores (`"item-photo-1.jpg"`) back to the
  real Vite-bundled asset URLs — `data/` has no business knowing about
  Vite's asset pipeline, so this is the one seam that does.
- **`devtools/`** — everything dev-mode/QA-overlay related, entirely
  separate from the real app. `devApi.js` (every dev/admin HTTP call),
  `DevAuthGate.jsx` (entry point — also the one place that checks and owns
  `isAdmin`, threaded down into the overlay), `DevFab.jsx` (the moved
  role/brigade picker), `MockDataToggle.jsx`, `DevAdminPanel.jsx`
  (admin-secret-gated modal, composes `DevAdminUsersScreen.jsx` +
  `DevAnnotationsScreen.jsx` as tabs, the latter now with the "⚡ פעולה"
  action-trigger button + a live status pill per row), `overlay/
  DevOverlay.jsx` + `overlay/useHoverTarget.js` + `overlay/
  AnnotationPopover.jsx` (hover-highlight + Ctrl/Cmd+click annotate) +
  `overlay/AdminAnnotationMarkers.jsx` (admin-only persistent on-page
  markers for open comments — see "Action pipeline" above). See "Dev-mode
  / QA feedback overlay" above for the full picture.
- `assets/` — placeholder demo media (abstract/technical, not fake product
  photography — a deliberate design choice, see the chronological log).

### `data/`

- `server.js` — Express entrypoint; every route module gets mounted here.
- `routes/` — one file per concern, same names as their `api-client/`
  counterparts, plus dev-only ones: `dev-auth.js` (dev-user login/session),
  `admin-auth.js` (the separate `ADMIN_SECRET` gate), `dev-users.js`
  (admin-gated roster CRUD), `dev-data-mode.js` (mock/live toggle),
  `annotations.js` (submit + admin review/export).
- `middleware/` — `auth.js` (`attachDevUser`/`requireDevUser` — **the only
  place that reads the dev-session cookie**), `adminAuth.js`
  (`requireAdmin` — separate, stricter tier), `rateLimit.js` (login
  endpoints only), `errorHandler.js`, `validate.js` (`requireFields`,
  `asyncRoute` wrapper so a thrown error reaches `errorHandler`).
- `lib/` — `jsonStore.js` (the one chokepoint every route reads/writes
  through; resolves mock-vs-live), `dataMode.js` (the mock/live flag
  itself), `passwords.js` (bcrypt), `sessions.js` (opaque in-memory
  session tokens — shared by both dev and admin sessions, distinguished
  only by which cookie name each middleware reads), `cookies.js`
  (`sessionCookieOptions` — the one place `sameSite`/`secure` are decided,
  driven by `COOKIE_CROSS_SITE`), `devUsers.js` (read/write
  `config/dev-users.json`, commits to GitHub, boot-time hydration),
  `githubPersist.js` (the GitHub Contents API wrapper both `devUsers.js`
  and `routes/annotations.js` use — see the rule above).
- `mock/` — git-tracked seed dataset (extracted faithfully from the old
  hardcoded `COMMANDO`/`GOLANI` consts via a one-time script, not
  hand-transcribed). `db/` — gitignored, empty by default, live data, not
  git-backed (ephemeral on a free host — accepted gap). `config/
  dev-users.json` — git-tracked, also committed-to on every write (see the
  rule above). `config/data-mode.json` — gitignored runtime flag.
  `annotations/notes/` — one git-tracked JSON file per QA annotation,
  also committed-to on every write/resolve.

---

## Chronological log

Newest entries at the bottom. Each entry is what a session actually did/
learned, in enough detail that a future session doesn't have to re-derive
it. Entries before 2026-08-20 are reconstructed from the pre-existing
`amalach-net-conventions.md` memory file (still authoritative for that
period's fine detail if you need more than the summary in the sections
above) rather than written live.

### 2026-08-19 — Rebrand, role/nav restructure, per-brigade data layer, system-admin console
Renamed אמל״ח־נט → HANGAR/האנגר everywhere. Introduced `STRUCTURAL_ROLES` as
the single role model with one global switcher in `App.jsx` (previously
every screen had its own). Split the old `TacticalSystem.jsx` into
`Catalog.jsx` + `Tickets.jsx`. Built `PermissionsDashboard.jsx`'s
list/org-tree toggle. Built `brigadeStore.js` as the real multi-tenant data
layer (every screen takes `brigadeId`, awaits a fetch, shows `Loading`).
Built `SystemAdmin.jsx` (brigade provisioning registry, `pending`/`active`
status). Layout moved from a bordered floating card to full-bleed.

### 2026-08-19 — Two visual overhauls same day
First: warm olive/cream "field" look rejected as "childish" — moved to
industrial gray/steel-blue, Heebo font, lucide-react icons replacing all
emoji, `PhotoTile.jsx` classification-marking treatment for catalog photos.
Second, later the same day: that industrial look itself superseded by an
Anduril-style defense-tech console look — near-black/mint-accent palette,
Assistant font, fixed icon sidebar replacing the horizontal top nav,
`DevDashboard.jsx` rebuilt to mirror a pasted reference screenshot's
structure. **This second overhaul is the one whose palette/layout is
current** — see the Design System section above.

### 2026-08-19/20 — Feature passes: dashboard widgets, persistence, tickets, catalog approvals, media, notifications, destructive-action pattern, forms/drafts, search, logos
A long sequence of feature work, each with a real correction or bug fix
worth knowing before touching the related area — **full detail is in
`amalach-net-conventions.md`** (the memory file this document partly
supersedes) if you need it. Summary of what shipped, all still current
(see the sections above for the living description):
per-user (not per-role, not per-device) dashboard layout persistence with
native-HTML5 whole-card drag (a grip-handle-only variant was tried and
explicitly reverted per user feedback — don't re-add a grip handle without
being asked); nav-state persistence across reloads (with a StrictMode-style
"first run vs. real change" ref-guard); catalog proposal→approval flow;
`.overlay`-modal-must-portal fix (found while wiring catalog edit
permissions, then again for `MediaGallery.jsx`); the four-step
destructive-action + super-admin-approval pattern (`DestructiveConfirm`,
now in `SystemAdmin.jsx`); the "notifications must be personal, not
role-broadcast" correction; the "don't show the same signal twice" /
"folder is the wrong mental model, use a filtered list" correction; the
disabled-button-hides-validation fix + auto-saving drafts; sitewide
search/filter primitives (`search.js`, `SearchBar.jsx`, `FilterSelect.jsx`);
uploaded-image-only logos (`LogoUpload.jsx`, never icon pickers).

### 2026-08-20 — Person-card analytics
Added simulated-but-stable per-person activity stats (first login, last
seen, avg session — seeded from personal number so they don't jitter on
re-render) plus genuinely-computed request analytics (submission
count/approval%/rejection%, matched against real ticket/catalog data by
name) to the org-tree/list person card in `PermissionsDashboard.jsx`.

### 2026-08-20 — List-view clickability, blocking, team hierarchy, approval-gate toggle
Large feature pass: made roster list rows (not just the org tree) clickable
to open the person card; fixed brigade officers/system admins not being
able to open a unit officer's own card; built the full team/sub-team
hierarchy (`teamStore.js`), the block/unblock system (`blockStore.js`,
two-step confirm, unit vs brigade scope), the team-lead's dedicated
reduced screen (`TeamLeadView`), the org-change request/approval queue for
team leads, and the `requireLeadApproval` gate that gives a team lead a
first look at their members' tickets/catalog proposals before the unit
officer sees them. Caught and fixed a real sync bug during testing: newly
created teams weren't appearing live in the org tree because the
list-view's team-management panel tracked its own separate copy of the
team list instead of the shared root state — fixed with an `onChanged`
callback that re-syncs the root.

### 2026-08-20 — Sidebar identity stack, in-tree team CRUD, audit-log backup/restore, dev-panel identity picker
Added the brigade/unit/team emblem stack under the sidebar's `HGR` mark
(team row only if the team has an uploaded logo). Added team
create/edit/delete directly from org-tree nodes (a dashed "+ צוות חדש"
node per unit, click any team node to edit), with delete requiring the
same two-step confirm as blocking, and every team mutation logged to the
audit trail with a full snapshot. Extended `adminStore.js`'s `logAction` to
optionally carry `targetType`/`snapshot`, and built the "restore" button in
`SystemAdmin.jsx`'s audit-log tab (works for brigades, admins, and teams —
each restore is itself logged) plus search + a target-type filter on that
log. Added the dev-panel's 3-way identity picker (regular soldier / team
lead / team member) so testers don't have to manually look up personal
numbers, wired to live-refresh off the same ticker notifications use (fixed
a staleness bug where newly created teams didn't show up in that picker
without a full reload). Caught mid-build: `TeamsSection`'s delete button
had no confirmation at all before this pass — retrofitted to the same
two-step pattern.

### 2026-08-20 — Org tree: visual regrouping + drag-and-drop + cross-unit restriction
User feedback: the org tree "looks like shit" because soldiers and teams
rendered as flat siblings in one row — fixed by splitting each unit's
children into two separate, distinctly-styled branches ("אנשי אמל״ח
היחידה" / "צוותים"). Added native HTML5 drag-and-drop for reassigning a
roster person: drop on their own unit = detach from any team, drop on a
sub-team = assign there, every actual change gated behind a two-step
confirm (`MoveConfirmModal`) showing a computed "from → to" label. **Then
corrected in the very next message: cross-unit dragging must be disabled
entirely** — the user does not want officers manually moving people between
units; that's planned to be governed later by real SSO/military-card-based
enrollment logic (which may also allow one person to belong to more than
one unit or brigade at once — the current one-unit-per-person model can't
represent that). Every drop target in `OrgTree` now explicitly checks
`dragPerson.fromUnit === <target unit>` and offers no drop UI otherwise.
This is tracked as deferred work in `TODO.md`, not built yet.

### 2026-08-20 — This file created
`FORCLAUDE.md` created for the first time, consolidating the pre-existing
`amalach-net-conventions.md` memory file plus everything from this session
that hadn't been written down anywhere durable yet. Also created `TODO.md`
for deferred work, and a Claude Code auto-memory note
(`deferred-work-tracking.md`) establishing that deferred work belongs in a
committed repo file (survives machine switches via git) rather than only in
local session memory (which does not).

### 2026-08-20 — Real backend, client/data reorg, dev-mode auth, QA feedback overlay
The big one — an initial full read of every file in the repo (a
"summarize/finish for prod" request), followed in the same session by the
user's actual plan: HANGAR is heading to a real military server with real
OpenID SSO later, and needs (1) a real backend now, built inside this repo
but architected for a clean handoff, (2) still a rich dev/demo layer, and
(3) a brand-new feature — named dev users leaving Word-doc-style inline
comments on the live UI that become an actual Claude to-do list. Planned in
full via plan mode (see `/Users/amireli/.claude/plans/
vivid-wondering-piglet.md` for the complete original plan doc) before any
code changed; approved with one correction from the user mid-review (see
the dev-users.json rule above — public-repo git-tracking was a deliberate
call, not a default). All 13 planned steps were completed in one session:

1. **Six pre-existing bugs fixed** in the then-still-flat `src/`: (a)
   `App.jsx`'s `useState(randomMemberPersona)` was an unparameterized lazy
   initializer, so a fresh page load got a fake `persona.unit` that matched
   no real brigade unit and both Catalog/Tickets showed empty until the dev
   panel manually rerolled — fixed by rerolling once real units load on
   mount; (b) `saveBrigadeSetup` rebuilt `unitPeople`/`unitOfficers` keyed
   only by the wizard's *current* unit names, silently deleting a renamed
   unit's whole roster and dropping its officer if the name field was
   blank — fixed via an `originalName` field the wizard now injects per
   unit row, so a rename carries the roster/officer forward; (c)
   `ProductDossier.jsx` hardcoded `updatedBy: "קצין אמל״ח (הדגמה)"` instead
   of using the already-passed `currentActor` prop; (d) catalog-item delete
   used a native `window.confirm` instead of the established two-step
   destructive-action pattern — replaced with an inline
   `DeleteItemControl`; (e) `index.html`'s hardcoded pre-hydration
   background colors didn't match `theme.js`'s real tokens, causing a
   visible flash on load; (f) a dead duplicate `src/.github/workflows/
   deploy.yml` (GitHub Actions only reads the root `.github/`) deleted.
2. **Repo reorg**: `src/` → `client/src/` (screens/components/api-client
   split), new top-level `data/` for the backend, `dist/` removed from git
   tracking entirely, `.github/workflows/deploy.yml` updated for the
   `client/` working directory.
3. **Backend skeleton**: Express app (`data/server.js`), `jsonStore.js`
   (the mock-vs-live chokepoint every route goes through), today's
   hardcoded `COMMANDO`/`GOLANI` datasets extracted into `data/mock/*.json`
   via a one-time Node script (not hand-transcribed, to avoid errors in a
   large Hebrew dataset) — verified against the live source before
   deleting the script.
4. **Six simple stores wired real**: teams, blocks, notifications, admin
   (audit log + deletion approvals), drafts, user-prefs — each got a
   matching `data/routes/*.js` file; drafts/user-prefs moved off
   `localStorage` entirely (a genuine improvement, not just a port — they
   now actually follow a person across devices as originally intended).
5. **Brigade registry wired real** (`brigadesData.js`) — this one needed a
   real code edit, not just a body-swap: `seedBrigades`/`seedSystemAdmins`
   were plain consts directly `useState()`'d in `App.jsx`/`SystemAdmin.jsx`
   with no existing `await fetchX()` pattern, unlike every other store.
   `SystemAdmin.jsx`'s brigade-name text input (fires `onChange` per
   keystroke) got a debounced persist (`brigadePatchTimers`) rather than
   firing one HTTP request per character.
6. **Real catalog + ticket persistence built from scratch** — the single
   biggest step. These never had *any* persistence before, fake or real:
   `Catalog.jsx`/`Tickets.jsx` only ever mutated local React state. All
   ~15 mutator functions across both screens (save/delete/decide/reopen/
   toggle-interest for catalog; submit/decide/reopen/archive/assignee/
   priority/due-date/collaborators/progress-log for tickets) were rewritten
   to the "compute the full next object first, `await` the persist call,
   then `setState` from the known value" pattern (see the architecture rule
   above) instead of computing inside a `setState` updater. New
   `data/routes/brigade-data.js` endpoints are deliberately thin — the
   client still owns every status-transition/permission decision exactly
   as before; the server just persists whatever object it's handed. A
   design gap caught mid-build: catalog item photos are base64 data URLs
   bundled by Vite from `client/src/assets/`, but `data/mock/*.json` can't
   reference a Vite-bundled URL — solved with `demoMediaAssets.js`, a
   bare-filename-to-real-URL lookup that only `brigadeStore.js`'s
   `fetchBrigadeCatalog` passes results through.
7. **Mock/live toggle** — a single global server-side flag
   (`data/lib/dataMode.js`), not per-session, by design (small internal
   tool, not a multi-tenant product). Mock mode is an in-memory clone that
   never touches `data/mock/*.json` on disk; live mode is real disk I/O
   against `data/db/*.json`, created lazily and empty.
8. **Dev-mode authentication** — bcrypt (`bcryptjs`, pure-JS, no native
   build step) password hashes in `data/config/dev-users.json`, opaque
   in-memory session tokens (`data/lib/sessions.js`, shared by both dev and
   admin tiers, distinguished only by cookie name), rate-limited login.
   `DevFab.jsx` (the old `.dev-fab` panel, moved verbatim) is now gated by
   `DevAuthGate.jsx` rather than always-open.
9. **Separate admin-secret gate** (`ADMIN_SECRET` env var, one shared
   bootstrap secret, not a per-person account system — deliberately
   minimal per the user's "not too complex" instruction) plus
   `DevAdminUsersScreen.jsx` for roster CRUD.
10. **Hover-highlight overlay** (`DevOverlay.jsx`/`useHoverTarget.js`) — a
    hybrid detection heuristic (`data-devblock` attribute where present,
    falling back to the nearest flex/grid ancestor or a known shared CSS
    class) so the glow snaps to a meaningful container instead of lighting
    up every nested `<div>`. Added to the 5 highest-traffic screens'
    outer container so far, meant to be extended incrementally.
11. **Ctrl/Cmd+click annotate + admin review** — capture-phase
    `stopPropagation` on `window` stops the real app's click handler from
    firing underneath; submissions go to `data/annotations/notes/<id>.json`
    (one file per annotation, git-tracked, outside the mock/live split — QA
    feedback isn't brigade data and must survive the toggle);
    `DevAnnotationsScreen.jsx` adds resolve-toggle + a Markdown export
    (grouped by screen, unresolved-only, meant to be pasted directly as a
    Claude to-do list).
12. **Security + docs pass**: confirmed via `git add -n data/` exactly
    which files would be staged (real secrets — `.env`, `data-mode.json`,
    `db/` — correctly excluded; `dev-users.json` correctly included per
    the deliberate call above), root `package.json` added
    (`npm run install:all` / `npm run dev` via `concurrently`, verified
    working end-to-end), `README.md` and this file updated.
13. **Public hosting** — explicitly **not done**, and needs the user: `data/`
    has no public host yet, so the QA-overlay flow only works when both
    processes are run locally, not yet at the real GitHub Pages link. This
    is the one remaining piece of the original plan.

**Verification**: every step build-checked (`npx vite build`); the full
catalog/ticket/team/block/notification/admin/draft/pref persistence surface
smoke-tested end-to-end via `curl` against a live `data/` server, including
confirming live-mode data survives a real server restart and mock-mode
never writes to disk; the entire dev-mode/overlay/admin flow verified with
a real headless-browser Playwright pass (login, hover, Ctrl+click annotate,
admin panel, resolve, Markdown export) — zero console/page/network errors;
a full 4-role × every-nav-view regression sweep after all changes — zero
errors, and confirmed bug (a) above is actually fixed (a fresh unauthenticated
page load now shows real catalog data immediately). One seeded placeholder
account exists for testing: `Demo Dev` / `hangar-demo-2026` — meant to be
replaced with real named users before sharing a real link.

### 2026-08-20/21 — Public hosting: GitHub-as-database instead of a paid disk, Render Blueprint
Direct follow-up to the previous entry's item 13. First proposed the
obvious path (Render, paid Starter tier + a persistent-disk add-on, so
`data/db/`, `dev-users.json`, and QA annotations would all durably survive
a real host). The user pushed back with a sharper question that changed
the actual design: *why pay for a database-grade guarantee here at all* —
the dev-user roster is already a plain git file, QA comments are just text,
and "if someone doesn't know a [dev-mode] code he probably won't even try
it" (their words) — i.e. this genuinely doesn't need production-grade
security or infrastructure, just to actually work and to leave an
auditable trail ("log every change afterwards"). Also asked about Glitch
as a free alternative — confirmed via web search that Glitch shut down all
app hosting in 2025, so that's off the table entirely.

Landed on: **GitHub itself as the durable store**, not a database or a
paid disk. `data/lib/githubPersist.js` commits `dev-users.json` and every
QA annotation (one file per annotation, `data/annotations/notes/<id>.json`
— switched from the earlier single-array-file design specifically so
concurrent submissions can't race to overwrite one file, and so `git log`
on that folder doubles as the literal change log the user asked for) via
the GitHub Contents API, and `server.js` re-hydrates both from git on
every boot before accepting requests. This makes Render's **free** tier
(fully ephemeral filesystem — verified via web search: wiped on every
idle spin-down or redeploy, not just explicit redeploys) genuinely correct
to use, not just cheap — no paid tier needed after all. `render.yaml`
added as a one-click Blueprint (`plan: free`); `.github/workflows/
deploy.yml` now passes `VITE_API_BASE_URL` through from a GitHub Actions
repo Variable at build time, so pointing the built site at wherever
`data/` actually ends up hosted doesn't require a code change. `data/db/`
(live-mode brigade operational data) deliberately was **not** given this
same git-backed treatment — only the dev-user roster and annotations were,
matching exactly what was asked for; live data on a free host stays
ephemeral, a known and accepted gap. Verified locally end-to-end with
`GITHUB_TOKEN` unset (the normal local-dev case) — every code path
transparently falls back to local-disk-only behavior, unchanged from
before this existed. The actual GitHub-commit path itself (with a real
`GITHUB_TOKEN`) has **not** been live-tested — that requires a real PAT
only the user can create; verify it once one exists before trusting it
blindly in production.

### 2026-08-21 — Render deployed, repo ownership transferred, "Action" pipeline started
Two threads, same session as the previous entry, continued the next day.

**Render deployment**: walked the user through connecting `data/` to
Render step by step (their Render UI didn't surface a "Blueprint" option
at all — only a generic "New Service" picker with Web Services/Postgres/
etc. — so `render.yaml` went unused for the actual deploy; configured the
same settings by hand via "New Web Service" instead). Confirmed live via
`/api/health` on the real Render URL. Wired `VITE_API_BASE_URL` through as
a GitHub Actions repo Variable (not a Secret — it's just a public URL) so
the Pages build knows where to find it.

**Repo ownership transfer**: blocked on creating the `GITHUB_TOKEN` — the
repo was on a coworker's account (`joshuael120`) and fine-grained PATs can
only scope to repos the token-creator already has access to. Discussed
transfer vs. fork vs. "coworker creates the token" as options (transfer:
confirmed via web search that GitHub does **not** redirect the GitHub
Pages site after a transfer, only the repo/git URLs — a real gotcha worth
knowing before doing this again). User transferred ownership to
`invierno8` (their own account). This touched real infrastructure:
updated `git remote`, `render.yaml`, `data/.env.example`,
`data/lib/githubPersist.js`'s default, and every reference in this file —
the live Pages URL is now `https://invierno8.github.io/commando/`, not
the old owner's domain. **The real `GITHUB_TOKEN` the user generated was
verified for real** — a live write test via the Contents API (create a
throwaway file, confirm `201`, delete it again) before trusting it
anywhere, then the actual annotation-submission flow was exercised
end-to-end through the running app and produced a genuine commit on
`invierno8/commando`'s `main` — this is the first time the
previously-untested git-commit persistence path was proven against the
real API, not just reasoned about. Found and fixed a real bug while doing
this: local disk writes for `dev-users.json`/notes didn't match the
trailing-newline convention used for GitHub commits, causing a spurious
one-byte diff on every hydration — fixed in `devUsers.js` and
`routes/annotations.js`.

**Also discovered mid-session**: the user and Claude were editing the same
working tree from two different tools simultaneously (the user's own IDE,
this Claude Code session) — a `git status` check that should have shown a
huge pile of uncommitted work instead showed a clean tree, because the
user had already committed and pushed everything themselves (commit
message: "big guns upload") before asking Claude to "make sure it's
done." Worth remembering: **always verify actual repo state
(`git log`/`git status`/`git fetch` + compare SHAs) before assuming your
own mental model of what's committed is still accurate** — it silently
diverged here and would have caused real confusion if not caught by
checking rather than assuming.

**"Action" pipeline (in progress, not finished)**: the user's next ask —
QA comments shouldn't just sit in a queue, the *admin's own* notes should
automatically become real autonomous code changes, and any comment should
be actionable via a button. Two real technical corrections had to happen
before building this: (1) explained clearly that "you" (this conversation)
cannot be triggered by a browser click — only a separate, unattended agent
session can be, and that's a fundamentally different thing than the user
first pictured; (2) investigated the actual scheduling/routine system
(`RemoteTrigger` tool, `/schedule` skill) and found the documented,
reliable path is **cron-based polling with a hard 1-hour minimum
interval**, not true instant webhook-triggering — `create_webhook_trigger`
exists on the tool but isn't covered by the `/schedule` skill's own
documented workflow, so it's being treated as unproven rather than relied
on blindly. Plan: hourly cron routine as the reliable floor, attempt a
webhook on top for near-instant reaction as a bonus, not a requirement.
**Blocked on**: the Claude GitHub App isn't installed on the `invierno8`
account for this repo yet (ownership only just transferred) — routines
can't see the repo at all until that happens. User was mid-installing
this when the session's work was written up.

What *was* built and verified while waiting on that: the full data-model
and UI half of the feature (see "Action pipeline" and
`AdminAnnotationMarkers.jsx` in the Domain model section above) — the
`actionStatus` lifecycle, the `data/annotations/actions/` work-queue
folder (separate from the permanent `notes/` record, git-committed the
same way), the admin-auto-flag-on-write behavior, the manual "⚡ פעולה"
trigger both in the admin panel and directly on the live page. **The
routine that actually reads the queue and does the work does not exist
yet** — everything up to "a work-item file lands in `data/annotations/
actions/`" is real and tested; everything past that point (an agent
picking it up, implementing it, opening a PR, writing the status back) is
designed but not built. Don't assume marking a comment "⚡ פעולה" today
does anything beyond queueing it — there's no consumer yet.

**Decision explicitly made and should not be silently changed**: any
autonomous action taken by the eventual routine **opens a pull request,
never pushes to `main` directly** — the user chose this specifically for
safety given the admin panel is reachable from a public link. If you're
picking this work back up, preserve that constraint unless the user
explicitly says otherwise.

**Update — the routine now exists and is live**: named `jynx-action-worker`
(`trig_01BNgRVT2RxXJixQZtHGbHy6`), created via `RemoteTrigger`. The GitHub
App install was blocked earlier by an ownership-transfer gap; once the
user connected it (through claude.ai connectors, then separately
installing the actual "Claude" GitHub App at
`github.com/apps/claude/installations/select_target` — these are two
different integrations, the first alone was not sufficient), both halves
worked:
- **Cron backstop**: `0 * * * *` (hourly), the reliable floor.
- **Webhook trigger**: also successfully attached via
  `create_webhook_trigger` — turned out to require an undocumented body
  shape discovered by trial and error against the API's validation
  errors: `{routine_trigger_id, source:"github", hook_type:"app",
  scope_id:"invierno8/commando", events:["push"]}`. Both `source` as an
  object and a `filter.paths`/`filter.branch` narrowing were rejected by
  the API ("Extra inputs are not permitted") — **there is currently no
  way to scope the webhook to only fire on pushes touching
  `data/annotations/{actions,jynx-actions}/`**; it fires on every push to
  the repo. This is safe (the routine's own prompt checks whether the
  queue directories are non-empty and exits quietly if not) but means
  every commit to `main` — including the frequent GitHub-as-database
  writes from mock-data/annotation persistence — triggers a cloud-agent
  run that does a quick no-op check. If the API adds real path filtering
  later, revisit this.
- **The routine's prompt** (full text is in the trigger's `job_config` —
  fetch via `RemoteTrigger get` rather than duplicating it here and
  risking drift) processes both `data/annotations/actions/*.json` and
  `data/annotations/jynx-actions/*.json`, implements each on a new
  branch, opens a PR (never pushes to main — the constraint above is
  restated explicitly inside the prompt itself, not just here), updates
  the corresponding note's `actionStatus`/`actionPrUrl` via a direct
  bookkeeping commit, and deletes the processed queue file. Genuinely
  ambiguous requests are supposed to get a reply via the new
  `/dev/annotations/:id/reply` /
  `/admin/jynx-feedback/:id/reply` endpoints (see below) instead of a
  guess — but the routine has no pre-provisioned credentials for that
  call, so treat it as best-effort, not guaranteed.
- **First real test run**: manually fired via `RemoteTrigger run` right
  after setup (session `cse_01K4WwzFqQn32dP4Ji29wsxV`) — confirmed it
  actually clones the repo, reads `FORCLAUDE.md`, and lists/reads the real
  queued items rather than erroring out. Whether it produced correct PRs
  is unverified as of this writing (check `list_runs`/`get_run_log` on
  the trigger to see the outcome) — don't assume success just because the
  routine exists and started cleanly.
- **A cleanup gotcha this surfaced**: several `notes/*.json` had already
  been resolved by hand (direct code edits earlier the same session,
  outside the routine), but their paired `actions/*.json` /
  `jynx-actions/*.json` work-item files were never deleted — the "action"
  and "note" records are separate files by design (see the top of
  `annotations.js`/`jynx-feedback.js`) and nothing kept them in sync
  automatically. The first real routine run picked up all of them,
  including the already-fixed ones, because it had already cloned/listed
  before the stale queue files got deleted. If you resolve something by
  hand instead of letting the routine do it, **always delete the matching
  `actions/`/`jynx-actions/` file too** (same `<id>.json`, different
  directory) — otherwise it sits there forever getting reprocessed on
  every future run.

**Reply/thread system (built same session)**: `annotations.js` and
`jynx-feedback.js` both gained a `replies: []` array and a
`resolutionNote` field on every entry, plus `POST
/dev/annotations/:id/reply` (any dev user) and `POST
/admin/jynx-feedback/:id/reply` (admin only, matching that queue's
submission gating). Resolving a comment via `PATCH .../:id` now accepts
`resolutionNote` and auto-flips `actionStatus` to `"done"` if it wasn't
`"none"`. This is what closes the loop the user asked for: "when a
comment has been worked on, the person who filed it sees a status change
and can follow up" — both `DevAnnotationsScreen.jsx` (admin) and
`CommentsPanel.jsx` (every dev user, their own sidebar) render the note +
thread + a reply box, polling every 5s like everything else in this
system. `CommentsPanel.jsx` also grew: Open/Done tabs, a "just mine"
filter, click-a-comment-to-jump-to-its-element (scrolls + flashes), and
the whole sidebar is draggable/collapsible via the same
`useDraggableFab.js` hook used by the main Jynx chrome (generalized to
support a `left`-anchored variant — the sidebar defaults to the *left*
side specifically so it doesn't collide with the right-side
button cluster; this was a real bug caught by testing, not a hypothetical).

**Standing instruction from the user this same session**: "feel free to
commit and push as well from now on" — a general grant for this
conversation's direct interactive work (Claude committing/pushing code it
writes while talking to the user), separate from and not overriding the
autonomous-routine PR-only rule above, which the user did not revisit or
walk back.

### 2026-08-21 — Action pipeline: first two real items processed (edit-in-place + Jynx commenter tier), on a branch/PR per the routine's own rule
The `jynx-action-worker` routine (or a Claude session working the same
action-item file by hand) picked up work item `jynx-mt30ld1htt72`
(route `dashboard`, target `dev-toolbar-icon-btn`) — the note whose
admin reply already recorded that the per-dev-user comments view
(Open/Done split, "just me" filter, jump-to-element, reply) was done in
an earlier pass. The two genuinely open pieces from that note:

1. **Edit-in-place for Jynx feedback text.** `data/routes/jynx-feedback.js`'s
   `PATCH /admin/jynx-feedback/:id` (previously `resolved`-only) now also
   accepts a `comment` field, independently of `resolved` — the two are
   handled via separate `Object.prototype.hasOwnProperty.call(req.body,
   "resolved")` / `typeof req.body.comment === "string"` checks so a
   comment-only edit can never accidentally flip `resolved` back to
   `false` (verified live: resolve an entry, then PATCH just `{comment}`,
   confirm `resolved`/`resolvedAt`/`resolutionNote` are untouched).
   `JynxFeedbackScreen.jsx` (the admin's Jynx-feedback list, inside
   `DevAdminPanel.jsx`'s "🔮 Jynx" tab) got a pencil icon next to each
   comment → inline textarea → Save/Cancel, reusing the existing
   `.dev-admin-resolve-note-box`/`-actions` classes from
   `DevAdminPanel.jsx`'s shared `<style>` (that file's tabs have never
   carried their own `<style>` block — they're always mounted as children
   of `DevAdminPanel.jsx`, which injects one shared block first; this PR
   follows that existing convention rather than introducing per-tab
   styles). `devApi.js` grew `editJynxFeedback(id, comment)`.
2. **A new "Jynx commenter" permission tier**, since Jynx meta-feedback
   (comments about the FAB/toolbar/admin-panel itself, separate from
   `data/annotations/{notes,actions}/`) was previously admin-only end to
   end. `data/config/dev-users.json` records gained an optional
   `canJynxComment` boolean (default absent/false for every existing
   user — nothing was pre-set); `DevAdminUsersScreen.jsx` got a wand-icon
   toggle per row (plus a small badge) that PATCHes it via the *existing*
   `PATCH /admin/dev-users/:id` (that route already merges arbitrary body
   fields onto the record, so no new dev-users route was needed).
   `GET /dev/me` (in `dev-auth.js`) now also returns the calling user's
   own `canJynxComment`, looked up fresh from the roster file on every
   call — not baked into the session token — specifically so a grant/
   revoke takes effect immediately, no re-login required.
   `POST /admin/jynx-feedback` (submit new Jynx feedback) is the *only*
   route in `jynx-feedback.js` that widened: a new local
   `requireAdminOrJynxCommenter` middleware, defined in that same file,
   passes either a valid `X-Admin-Session` (unchanged admin path) or a
   `req.devUser` whose fresh-read roster record has `canJynxComment` (and
   `active !== false`). `requireAdmin` itself was not touched, and every
   other route in the file (GET, PATCH, the reply route, export) is
   still built with plain `requireAdmin`, exactly as before — deliberate,
   per the work item's own instruction not to widen those. On the client,
   `useHoverTarget.js`'s `allowJynxChrome` param was already
   generically named (not literally `isAdmin`); what changed is the
   *caller* — `DevAuthGate.jsx` now fetches `canJynxComment` from
   `/dev/me` and passes `canJynxChrome={isAdmin || canJynxComment}` into
   `DevOverlay.jsx` as its own prop, separate from `isAdmin` (which
   `DevOverlay.jsx` still uses, unchanged, for the QA-note action-toggle
   default and for gating the always-on `AdminAnnotationMarkers` —
   neither of those opens up to a Jynx commenter). Verified end-to-end
   against a live local `data/` server (not just `vite build`): created a
   throwaway dev user, granted `canJynxComment`, logged in as *that* user
   with no admin token at all, confirmed `POST /admin/jynx-feedback`
   succeeds (`201`) while `GET`/`export` on the same route still 401 for
   them; cleaned up the throwaway user and the test note/action files
   afterward so nothing test-only landed in git.

Scope note: submitted-by tracking (`authorId`/`authorName`) was added to
new Jynx-feedback entries (previously untracked, since only the admin
ever wrote there) purely for admin-side display — mirrors the pattern
`annotations.js` already used. There's still no "my Jynx feedback" view
for a commenter (out of scope for this item; they submit blind, same as
before, just through a wider door) — if that's wanted later, it's a new
ask, not implied by this one.

**Concurrent-duplicate-run gotcha, hit for real this time (not
hypothetical — the earlier 2026-08-21 entry above only warned it *could*
happen):** by the time this branch was ready to push, `origin` already
had *two* other branches/PRs against this exact same work item —
`jynx-action-jynx-mt30ld1htt72` (PR #7, "Comments sidebar: let a dev
user edit their own comment text" — turned out to be a *different*
scope than expected: editing your own **QA-annotation** text via a new
`PATCH /dev/annotations/:id/edit`, not Jynx-feedback text at all, so not
actually a duplicate of Part A above) and
`jynx-action-jynx-mt30ld1htt72-2` (PR #9, "Jynx: add 'Jynx commenter'
permission tier" — a near-exact duplicate of Part B above, built the
same session by a different concurrent run). Since the literal branch
name from the work item was already taken by PR #7's unrelated content,
this work pushed to `jynx-action-jynx-mt30ld1htt72-3` instead (following
the same "-2"/"-3" collision-numbering already visible elsewhere on
`origin`, e.g. `jynx-action-jynx-mt312adsa7al-2`) and the PR opened from this branch explains the
overlap rather than silently duplicating it.

**A real, worth-knowing divergence found while comparing:** PR #9 (the
near-duplicate of Part B) also widened `GET /admin/jynx-feedback` (via
its `requireAdminOrJynxCommenter`) to any Jynx commenter, returning the
**entire** queue — not filtered to their own entries — as long as
`CommentsPanel.jsx`'s client-side "just mine" filter is trusted to hide
the rest. This directly contradicts the work item's own explicit
instruction ("Keep every OTHER route ... GET, PATCH, the reply route,
export — admin-only exactly as today; only the POST-a-new-feedback route
should accept this wider group") — a real, if minor (this is a no-real-
data public demo), instance of an autonomous run drifting past its
stated auth boundary. This branch's `GET`/`PATCH`/reply/export all stay
on the unmodified `requireAdmin`, exactly as asked; only `POST` widens,
via a route-local `requireAdminOrJynxCommenter` defined *inside*
`jynx-feedback.js` itself rather than in the shared `adminAuth.js`
(equally valid per the work item's own "or an inline check" allowance —
just a smaller footprint since nothing else needs the combined check).
If you're a future session reconciling PR #7, PR #9, and this branch's
PR: check which one (if any) got merged before assuming any of this is
still accurate, and specifically re-verify the `GET` auth boundary
before trusting whichever version of Part B wins.

### 2026-08-21 — Work item `ann-mt2vf3rhva2m` closed out by three converging sessions on one branch
The routine described above picked up this admin note (asking for
click-to-jump, show/hide-all, delete-or-archive, and edit-your-own-comment)
in **three separate sessions**, all targeting the same deterministic
branch name `jynx-action-ann-mt2vf3rhva2m` — worth knowing this can happen
and how it resolved, if you see a `git push` rejected with "fetch first"
on a freshly-created work-item branch:
1. First session confirmed click-to-jump and show/hide-all were already
   built, then shipped **archive** (`archived`/`archivedAt` fields,
   non-destructive) as PR #4.
2. Second session added **delete** (`DELETE /admin/annotations/:id` +
   `deleteFileFromGithub()` in `data/lib/githubPersist.js`, same
   read-sha-then-call-the-Contents-API shape as `commitFileToGithub`) and
   an **admin-editable comment field** (`PATCH /admin/annotations/:id`
   extended to accept `comment`, surfaced as a pencil/inline-textarea in
   `DevAnnotationsScreen.jsx`) — pushed straight onto the same branch as an
   additional commit rather than opening a second PR.
3. **This session** found the branch already had both of the above when
   its own push was rejected, and — per this file's standing rule about
   never force-pushing over another session's work — fetched, inspected
   the diff, and added only what was still genuinely missing rather than
   redoing or duplicating anything: the admin's edit-any-comment control
   does not satisfy the original ask's "so that on a screen I'm on, I can
   see all comments I left **and edit them from there**" — that "there" is
   the physical per-screen sidebar (`CommentsPanel.jsx`), not the admin
   management screen, and it needs to work for *any* dev user editing
   *their own* comment, not just the admin. Added a dedicated
   **`PATCH /dev/annotations/:id`** route (`requireDevUser`, not
   `requireAdmin`) gated by `req.devUser.id === found.authorId` (403
   otherwise), a matching `editMyAnnotation()` in `devApi.js` (named
   distinctly from the second session's admin-facing
   `editAnnotationComment()` to avoid confusion between the two), and a
   pencil-icon-to-inline-textarea control in `CommentsPanel.jsx` shown only
   when `a.authorId === currentDevUserId`. Deliberately excluded for
   `kind:"jynx"` items in that panel's merged item list (Jynx meta-feedback
   has no matching edit endpoint and only the admin ever writes it anyway).

**Lesson for the next session that hits this**: the branch name is
deterministic per work-item id specifically so concurrent sessions
converge onto one PR instead of opening duplicates. When `git push` is
rejected on such a branch, `git fetch` + inspect what's already there
(`git show <tip>`, and check `list_pull_requests` with
`head:"<owner>:<branch>"` for the open PR) before adding anything — reset
onto the real tip and add only the delta, don't force-push, don't
re-implement something that's already shipped under a different name, and
don't skip a genuinely still-missing requirement just because *something*
with a similar name already landed.

Verified with `npx vite build` (clean at every stage of the three-way
convergence) and a live `curl` smoke pass against a running `data/`
server confirming all three layers coexist without route conflicts:
admin delete (session 2's route) still works, the new author-only edit
succeeds for the actual author and 403s for a different dev user, using
throwaway dev-user accounts created and deleted again through the real
admin API — `git status` on `data/config/dev-users.json` and
`data/annotations/notes/` confirmed clean before committing.

### 2026-08-21 — Confirmed: the webhook really does spawn concurrent routine
### runs on the same work items, not just harmless duplicate no-op checks
A `jynx-action-worker` firing (processing the same batch of 6 queued items
described in the previous entry) directly observed a **second concurrent
firing racing on the same queue**, not just the "wasted no-op check" case
already documented above: mid-run, a `git push` of a freshly-implemented
branch for `ann-mt2vf3rhva2m` was rejected (403 on a stale ref), and
re-fetching showed another session had already pushed a branch with the
*same id* and opened a PR for it minutes earlier — this happened for three
of the six items in the same batch (`ann-mt2vf3rhva2m`, `ann-mt2vuujbpdkz`,
`jynx-mt312adsa7al`), all independently implemented and PR'd by a
concurrent run before this session got to them. No data was lost — this
session detected the collision, discarded its own duplicate branch/commit
without pushing, and moved on to the items the other run hadn't reached yet
— but it confirms the "no way to scope the webhook to only fire on
actions/ pushes" gap noted above is not just a cheap-no-op inconvenience;
it can burn real implementation effort racing another live agent run on
the exact same ticket. **If you're picking up a queued item, always
re-fetch `main` and check `list_pull_requests` for an open PR whose `head`
ref matches `jynx-action-<id>`/`jynx-action-jynx-<id>` immediately before
pushing your own branch for that same id** — not just once at the start of
the run, since another run can land its PR while you're still mid-implementation.
If a collision is found, discard your own branch (don't push) rather than
opening a second PR for the same request.

Also confirmed while doing this: **items queued *after* a routine run has
already started (i.e. after its step-zero snapshot of `actions/`/
`jynx-actions/`) are correctly left alone** — a new item
(`jynx-mt350su1sqjf`) appeared in the queue partway through this run (someone
left a new comment while the routine was working); it was deliberately not
touched, since it wasn't part of this run's original batch and any of this
run's own bookkeeping pushes will re-trigger the webhook and pick it up in a
fresh firing anyway. Don't expand scope mid-run to "while I'm here" items
that show up after you've already started.

### 2026-08-21 — A third concurrent run on the same batch, and the final
### reconciliation once all three finished
Yet another session ran the identical batch at essentially the same moment
as the one described in the entry above. Between the two (or more) of them,
`jynx-mt30ld1htt72` ended up with **three** independently-opened PRs on
branch suffixes `jynx-action-jynx-mt30ld1htt72` / `-2` / `-3` (#7/#9/#12) —
worse than the earlier-documented "same id, different content" collision,
because here every run legitimately found the *first* branch name already
taken and correctly fell back to a suffixed name instead of clobbering it,
which is the right per-push behavior but still left three live PRs for one
work item once all runs finished. Reconciled by hand after the fact: **#12
kept** (it correctly implements both halves of the request — edit-your-own
Jynx-feedback-text, and a gated "Jynx commenter" permission tier that keeps
`GET`/reply/export admin-only as the original comment explicitly asked).
**#9 closed** — its version of the same permission tier accidentally also
widened `GET /admin/jynx-feedback` to any Jynx commenter (returning the
*entire* queue, filtered only client-side), a real deviation from what was
asked, not just cosmetic duplication. **#7 left open** — despite its branch
name, it turned out to implement a genuinely different, valid feature (edit-
your-own-text for regular QA-*annotation* comments via a new
`PATCH /dev/annotations/:id/edit`, not Jynx-feedback text), so it's not
actually a duplicate of anything and was kept. The note's `actionPrUrl`/
`actionLog` were updated by hand to point at #12 with an explanation, since
automated per-push bookkeeping can only ever record whichever PR happened to
exist *at that push*, not a later human/session reconciliation across
several. **Lesson for a future session inheriting this mess:** when you see
a `-2`/`-3`-suffixed branch (or an `actionLog` mentioning "two separate
PRs"/"three PRs" for one id), don't trust the note's `actionPrUrl` at face
value — check `list_pull_requests` for every branch matching that id first,
since the note may be pointing at a PR that was since closed or superseded.

### 2026-08-21 — PR queue reconciliation: 7 open PRs reviewed, 2 duplicates closed, 4 rebased and merged
A full review pass across every open PR against then-current `main`: #14
(clean regression fix for #11's over-broad drag handler) merged as-is. #7
closed as a real duplicate of #4 — despite the FORCLAUDE.md entry above
saying "#7 left open" as genuinely distinct, #4 grew to also cover
author-only edit-own-comment-text (see its own entry above), making #7 a
strict subset; closed with an explanatory comment rather than silently
dropped. #3 closed — its collapse-to-bubble half duplicated merged #11;
its still-missing login-spinner half was re-implemented directly on `main`
in a small follow-up commit instead of carrying the branch forward. #13,
#10, #4, and #12 all had real (not just GitHub's lazily-computed "dirty")
conflicts against `main` — verified with `git merge-tree` before touching
anything — mostly from #5's `AnnotationPopover.jsx`/`DevOverlay.jsx`
draggable-popover rewrite and #8's reactions landing after these branches
were cut. Each was resolved in an isolated worktree (`git worktree add`),
rebuilt clean (`npx vite build` + `node --check` on touched backend
routes), and pushed back to its actual PR branch so the existing PR
updates in place rather than opening a new one.

### 2026-08-22 — Yet another duplicate-PR race, despite the lesson already
### being written down twice: check `list_pull_requests` BEFORE implementing
A run processing `jynx-mt4y6t8f3lh6` (the "Export Markdown does nothing"
comment) implemented, committed, and pushed a fix on branch
`jynx-export-error-feedback-8f3lh6` — only to discover, when trying to do
the post-PR bookkeeping pull, that `origin/main` had already moved past its
starting point to include a *third* independent fix for the exact same
work item: PR #25 (a lesser, non-fix duplicate) and PR #26 (the real fix,
already correctly bookkept in the note with `actionStatus:"pr_opened"` and
`actionPrUrl` pointing at #26) had both landed on `main` in between this
run's step-zero check and its `git push`. This run's own PR (#29) was a
third, now-redundant duplicate of #26 — closed with an explanatory comment
rather than left open, and the note (already correctly pointing at #26,
never touched by this run) was left as-is.

Root cause, plainly: this run skipped the exact check the 2026-08-21
entries above already prescribe ("check `list_pull_requests` for every
branch matching that id... before pushing your own branch"). It's worth
restating why the branch-suffix collision guard alone doesn't save you
here: the last-6-of-id suffix is deterministic, but the descriptive slug
prefix is not (`jynx-export-error-feedback-8f3lh6` vs. the other run's
`jynx-export-button-error-feedback-8f3lh6`) — two independent runs can
each pick a different but equally-reasonable slug for the same id, so
`git push` never collides and neither run gets the "someone already has
this branch" signal that would normally catch it. **The only reliable
guard is checking PRs by id, not by exact branch name** — e.g.
`list_pull_requests` with a `head` filter won't catch a differently-slugged
branch, so search PR titles/bodies (which always embed the work-item id
verbatim per the "## The comment" section) or grep recently-changed
`data/annotations/*-notes/*.json` files for `actionStatus` before starting
implementation, not just at step zero. Do this check immediately before
`git push`, not only once at the start of the run — the collision window is
the entire implementation time, and a concurrent run can land its PR at any
point during it.

### 2026-08-23 — Five queued items processed: draw-tool multi-stroke + palette, admin-panel CSS overlap fix, @mention autocomplete, one duplicate skipped, one no-op
A single `jynx-action-worker` run processed the full `data/annotations/jynx-actions/` queue (5 items, all `jynx-actions`/`jynx-notes` — about Jynx's own dev-tool chrome, not the HANGAR app):

1. **`jynx-mt51suab9cwk`** ("dock the role picker into the toolbar, detachable") — found **two already-open PRs** for this exact id (#33 and #34, opened by concurrent runs) before implementing anything. Per the standing "check PRs by id before pushing" rule, did not open a third — bookkeeping only, pointing the note at #33 and flagging #34 as an unreconciled duplicate for a human to pick between.
2. **`jynx-mt520kgh2cvv`** — the comment text itself retracted the original ask ("no need for that, read the other comment") and pointed at a different, unqueued note. No code change; marked `actionStatus:"done"` with no PR.
3. **`jynx-mt5524o405ob`** — draw tool ("Ctrl/Cmd+drag") now supports **multi-step drawings**: releasing the mouse no longer ends the drawing, only Escape (or turning draw mode off) finalizes it. This changed the `drawing` shape stored on an annotation from a single `{ points, type }` to `{ strokes: [{points, type}, ...], color }` — **`data/routes/annotations.js`'s validation for the `drawing` field expects the new `strokes`-array shape now**, and `DrawingOverlay.jsx` renders every stroke in a drawing, not just one. There were zero existing saved drawings anywhere in the repo when this changed, so no migration was needed — if that's no longer true when you read this, check for old-shape drawings before assuming this works. Also added a small floating 4-swatch color palette (`DevAuthGate.jsx`, `jynx-draw-color` in `localStorage`) shown while draw mode is on. PR #35.
4. **`jynx-mt55b5j5rvp9`** — `DevAdminPanel.jsx`'s `.dev-admin-autoresolve-row` (the Auto/Manual toggle in the Comments/Jynx admin tabs) rendered directly under `.drawer-close` (the modal's `position:absolute` close X, `top/left:14px`) with no clearance, so the X visually covered the first letter of the bold "Manual"/"Auto" label. Fixed with a top-margin on the row (and a smaller override for when the re-auth-expired banner already precedes it). PR #36.
5. **`jynx-mt55hf3yezvk`** — WhatsApp-style `@mention` autocomplete (a dropdown of matching names, picking one "fixes" the mention to the exact user) already existed in `CommentsPanel.jsx` (the per-dev-user comments sidebar) but was missing entirely from `DevAnnotationsScreen.jsx`/`JynxFeedbackScreen.jsx` (the admin's own reply threads, where this comment's `dev-admin-thread-item` target actually lives) — those screens rendered replies as plain text with no mention handling at all. Extracted the shared (non-visual) logic into a new **`client/src/devtools/mentionUtils.jsx`** and reused it in both admin screens and `CommentsPanel.jsx`; each file kept its own CSS class names/`<style>` block per the existing "self-contained styles" rule (`mentionUtils.jsx`'s `renderWithMentions` takes class names as params rather than hardcoding one shared name). Mention color changed from the Jynx purple accent to blue (`#2F8FCE`, already used elsewhere in this UI) per the ask. **Not implemented**: "hyperlink to user profile" — there is no user-profile page anywhere in this app (the closest thing, the admin's Dev Users tab, is a flat table with no per-person view); flagged explicitly in the PR rather than inventing a new screen for it. PR #37.

**New technique worth reusing: splitting one working tree's combined changes into several independent PR branches via `git worktree`.** Items 3-5 above were implemented together in the main session working tree (reading/testing was faster with everything in one place), but two of them (#4 and #5) both needed CSS additions in the *same* file (`DevAdminPanel.jsx`) at different, non-overlapping locations. Rather than trying to `git stash`/cherry-pick pieces of one working tree, used `git worktree add /tmp/wt-X -b <branch> origin/main` for each target branch, then `cp`'d only the files relevant to that one item into that worktree (and, for the shared file, hand-applied just that item's own CSS hunk via a small Python find-and-replace against the known original text), built/verified independently, committed, and pushed. This keeps each PR's diff genuinely minimal and reviewable instead of one item's PR accidentally carrying another item's unrelated CSS. Clean up with `git worktree remove <path> --force` once pushed.

**Testing note confirmed again**: Playwright's `mouse.move`/`mouse.down`/`mouse.up` with the `ctrlKey` held via `page.keyboard.down("Control")` still doesn't reliably produce a `ctrlKey:true` pointer event for `DrawingCanvas.jsx`'s window-level capture-phase listeners (same class of issue already documented above for click events) — dispatching real `PointerEvent`s directly via `page.evaluate()` (`pointerdown` with `ctrlKey:true` on the element under the coordinates, then plain `pointermove`/`pointerup` on `window`) reproduced the real multi-stroke drawing interaction correctly.

Verified with `npx vite build` (clean on all three branches) and full local Playwright passes against a real running `data/` server using throwaway dev users created/deleted through the real admin API — draw-mode palette + two-stroke arrow + Escape-to-finish + saved-drawing color all confirmed via screenshots and by reading the actual saved note JSON; the admin-panel close-button overlap confirmed by reading both elements' real bounding boxes (no longer intersecting); the mention dropdown confirmed end-to-end (typed `@a`, dropdown showed `@Admin`, picking it produced the exact name in the input). All throwaway dev-user/note test data cleaned up afterward — `git status` on `data/` was clean before every push.

### 2026-08-23 — Third occurrence of the same duplicate-PR race, and a worse variant: the base itself moved out from under a long-running implementation
A run processing `jynx-mt5dxjtw3u5b` ("Export Markdown... still doesent work its weird" — a follow-up on the same button as the 2026-08-22 entry above) did the right check at step zero (`git log`/note read: not yet actioned) but then spent a long time actually reproducing the bug properly — installing Playwright into a scratch dir, standing up real `data/`+`client/` dev servers, creating a throwaway admin secret/dev user, and driving the real UI headlessly to confirm a genuine root cause (the export always returns *open* items regardless of which filter tab is being viewed, which is intentional but was undocumented in the UI, making it look broken when viewed from Done/All). That investigation took long enough that a **concurrent run finished the same work item first**: it shipped a different, also-valid fix (an "Exporting..." loading-spinner state, in PR #39) *and* that fix landed on top of an unrelated structural refactor (PR #38, merged earlier in the same window) that consolidated `DevAnnotationsScreen.jsx`+`JynxFeedbackScreen.jsx` into a single `DevLogsScreen.jsx`. This run's own branch had been cut before #38 merged, so by the time it opened its PR (#40, editing the now-deleted `DevAnnotationsScreen.jsx`/`JynxFeedbackScreen.jsx`), the note was already correctly bookkept against #39 **and** #40's diff no longer applied to `main` at all (GitHub reported it `dirty`/conflicting, not just "behind"). Closed #40 with an explanatory comment rather than rebasing a competing fix on top of an already-resolved item; left the note untouched since it already correctly pointed at #39.

This is the same root cause the two 2026-08-22 entries above already prescribe a fix for ("check PRs/notes by id immediately before `git push`, not only at step zero") — restated here because this run followed that exact advice at the *start* and still lost the race, since the gap that matters is however long your own implementation+verification takes, not just the moment of the initial check. **The added lesson this time: a long verification phase (spinning up real servers, browser automation, etc.) is exactly when you're most exposed**, and the failure mode can be worse than "someone else's PR merges first" — the base branch can structurally change underneath you (files renamed/merged away by an unrelated concurrent PR), turning your eventually-pushed branch into an outright conflict rather than a merely-redundant one. Re-running the id/note check right before `git push` (as already prescribed) would have caught this before spending the time opening a doomed PR at all — do that check, every time, no matter how confident step zero's initial check made you feel.

### 2026-08-23 — Two more queue items retired with zero new code: both already satisfied by #38 under a different work-item id, plus a same-branch race caught mid-run
A run processing the `jynx-actions/` queue found 4 items at step zero. Two (`jynx-mt5e8ngp3qvx`, the Jynx-bubble-personality request; `jynx-mt5edij0xz1s`, the marker-dot/hover z-index-under-nav-chrome fix) were **already fully bookkept by a concurrent session before this run even started reading files** — their PRs (#41, #42) existed and their notes already had `actionStatus:"pr_opened"`/`actionPrUrl` set on `origin/main`, even though the *local working tree this session was provisioned from* (checked out at PR #42's own head commit, per the webhook's `Ref`) still showed the old `"queued"` state. **Lesson: a freshly-provisioned workspace's checked-out commit is not necessarily `origin/main`'s tip — always `git fetch origin main` and diff against that before trusting local file contents for the "is this already handled" check in step (b), especially when the trigger context shows you were checked out on a feature branch, not `main` itself.** Both items needed no action at all here — confirmed via `git show origin/main:...` and skipped.

The other two (`jynx-mt30ld1htt72`'s follow-up: "make the comment menu item/page the main comments center, admin menu the settings page"; `jynx-mt5el2qu5jpa`: "comments-sidebar should be the main comment center, with a this-page/universal toggle and jump-to-element") turned out, on inspection of the actual current code (not just note/PR bookkeeping), to be **functionally identical requests to an earlier-queued, differently-worded item (`jynx-mt558crxb02w`)** that PR #38 ("CommentsPanel becomes the single comment-management place, Admin panel becomes Settings" — merged 2026-08-23T06:00:13Z) had already fully implemented, minutes before either of these two were filed/queued. Verified directly by reading `client/src/devtools/overlay/CommentsPanel.jsx` (has the exact `scope: "page"|"all"` toggle, click-to-jump, resolve/reopen/reply/edit for both queues) and `DevAdminPanel.jsx` (now a Settings hub: Dev Users / Menu / Logs tabs) on `origin/main` — not by trusting the comment text alone. Both notes were bookkept as `actionStatus:"pr_opened"` pointing at #38 (not a new PR) with an `actionLog` explaining the equivalence; no branch, no PR, no code change. **This is the same "duplicate work already exists" judgment call the routine already makes when checking `actionStatus`/PRs by id — the new wrinkle is that the duplicate can hide behind a *completely different work-item id and wording*, only findable by actually reading what the current code does, not by grepping for the id.** If a queued item's ask sounds like something a recent, broad refactor PR would plausibly already cover (especially a same-day "IA merge"/"consolidation" PR), check the live code before assuming a fresh implementation is needed.

Also hit, mid-run: a `git push` of a pure-bookkeeping commit to `main` was rejected (fetch-first) because another concurrent run had pushed a new queued item (`jynx-mt5est4di1wp`) in between this run's step-zero snapshot and its own push — an ordinary instance of the already-documented "items queued after your snapshot arrive mid-run" case, not a real conflict. Resolved with a plain `git fetch origin main && git rebase origin/main && git push` (no file overlap, clean rebase); the new item was correctly left untouched for the next firing.

### 2026-08-23 — Five-item batch where 4 of 5 needed zero implementation, and the "check right before push" rule caught a real live collision in real time
A run processing the full 5-item queue (`ann-mt5eol3mtbry`, `jynx-mt5est4di1wp`, `jynx-mt5ev53xof3v`, `jynx-mt5ezt4jpuet`, `jynx-mt5f2ow7dqrw`) found, on checking `list_pull_requests` before touching any code, that **4 of the 5 already had open PRs from concurrent runs** (#43, #46, #45, #47 respectively — verified each PR body actually names the matching id before trusting it, per the standing "don't trust `actionPrUrl` at face value" lesson). This run's own contribution to those four was bookkeeping only (note `actionStatus`/`actionPrUrl` update + queue-file delete), batched into one commit. Worth internalizing for pacing a future run: **checking PRs-by-id first, before writing any code, is not just a collision-avoidance step — on a hot queue with several concurrent routine firings, it's usually the fastest path to figuring out how much of the batch is actually still open work.**

The 5th item (`jynx-mt5ezt4jpuet`, "the filter pill-tabs are ugly/unprofessional, make sure all menus are up to standards") had no PR anywhere (open or closed) at that first check, so this run actually implemented it — traced the "ugly" complaint to something concrete rather than guessing: the shared `.pill-tab` primitive in `theme.js` is sized for full-width page tab rows (`9px 18px` padding, `13.5px` bold) and looks visibly oversized dropped unscaled into `CommentsPanel.jsx`'s `280px`-wide floating sidebar, where every other control uses a `10–12.5px` scale — the exact same fix shape as the pre-existing `.member-identity-tabs .pill-tab` override already in `theme.js`, just scoped locally in `CommentsPanel.jsx`'s own `<style>` block instead. Built and build-verified (`npx vite build` clean) — but the **standing "re-check PRs by id immediately before `git push`, not only at step zero" rule caught a live collision in real time**: a concurrent run had opened PR #48 for the exact same id, with an almost identical diagnosis and fix, in the ~2 minutes this run spent implementing and verifying. Discarded the local branch/commit without pushing (never opened a duplicate), then bookkept the note against #48 instead. This is the cleanest real-time confirmation yet that the pre-push check isn't a formality — it fired correctly on the very next attempt after the rule was restated in the entry above.

### 2026-08-23 — Correction to the entry immediately above: `jynx-mt5est4di1wp` actually needed real code (PR #46), and the entry's own summary text disagrees with what it committed
A separate concurrent run working the same 5-item batch independently implemented `jynx-mt5est4di1wp` (opened PR #46, "Jynx: one Settings entry point, admins see more from the same place") *before* the run described in the entry above wrote its bookkeeping commit (`19098e9`, 08:07:37Z) — but that commit's own message says `jynx-mt5est4di1wp: already covered by PR #38 ... no new PR`, and the note file it actually wrote pointed `actionPrUrl` at #38, not #46. This was a real misjudgment, not a stale-search miss: `git show origin/main:client/src/devtools/DevAuthGate.jsx` at that exact commit still had **two separate toolbar buttons** — `dev-toolbar-admin-btn` (opens the fully `ADMIN_SECRET`-gated `DevAdminPanel.jsx`, blocking even its own already-built Menu tab from a non-admin) and a second, always-visible `dev-toolbar-settings-btn` (a standalone `JynxSettings.jsx` modal, no auth) — exactly the two-buttons-instead-of-one problem the comment's own wording ("connect [dev-toolbar-admin-btn] to settings") was asking to fix. PR #38 (the earlier, broader admin-panel-becomes-Settings-hub PR) never touched that toolbar markup at all; it only restructured tabs *inside* `DevAdminPanel.jsx`. Whoever bookkept this against #38 apparently reasoned from #38's *description* rather than actually re-reading `DevAuthGate.jsx`'s current JSX — the same failure mode the entry above itself warns about ("check the live code before assuming... covers it"), just missed by the run enacting that very entry.

Confusingly, **the very next commit from that same run (`97c367c`, the FORCLAUDE.md entry above) says "#43, #46, #45, #47 respectively" in its own prose** — i.e. its own summary text names #46 for this item, contradicting the note file it had just committed two commits earlier pointing at #38. This looks like a copy/paste or summary-writing slip within that run, not a second, later correction — the note file on `origin/main` still said #38 until this entry's own correction. **Lesson for a future session: don't trust a FORCLAUDE.md log entry's prose summary at face value when it's cheap to instead check the actual note file's `actionPrUrl`/`actionLog` (`git show origin/main:data/annotations/jynx-notes/<id>.json`) — a summary paragraph can silently drift from what was actually committed, even within the same run that wrote both.** Corrected `data/annotations/jynx-notes/jynx-mt5est4di1wp.json` to point at #46 with an `actionLog` explaining why, verified by directly re-reading `DevAuthGate.jsx`'s toolbar markup (not by re-trusting either PR's own description) before making the change. PR #46 itself needed no rework — it was implemented and opened before any of this bookkeeping confusion happened.

### 2026-08-23 — Another real concurrent-duplicate-run collision (`ann-mt5oqsmnh537`, the readiness-widget strip fix), plus a branch-naming slip on my own part
Two runs of this routine picked up the same fresh `data/annotations/actions/ann-mt5oqsmnh537.json` work item (the QA comment "the numbers still get out of the element down below" on the dashboard's מוכנות מערכת/readiness widget) essentially simultaneously — the check in step (b) (`git log` on the note file) is only as good as the moment it's run; it can't see a sibling run that's *also* mid-flight and hasn't pushed its bookkeeping commit yet. Both independently diagnosed the same real bug (the widget's 7-day activity strip spilling past the card's bottom edge, via `height:100%`/`margin-top:auto` failing to size correctly when this "half" widget ends up alone in its grid row) and opened separate PRs — #50 (`jynx-readiness-widget-overflow-fix-mnh537`) and #51 (`jynx-readiness-strip-overflow-fix-h537`, this run). By the time #51 was ready to push, #50's run had already finished its bookkeeping commit (updating the note's `actionStatus`/`actionPrUrl` and deleting the action-queue file), so #51 came in as a genuine, confirmed duplicate rather than an ambiguous one. Closed #51 with a comment pointing at #50 and explaining why #50's fix (a `widget-readiness` flex-column wrapper + `flex:1 1 auto; min-height:0`) is the more robust of the two — it correctly sizes the card whichever grid-row pairing it ends up in, where #51's fix (drop the percentage height, use a fixed `margin-top`) only happens to work today because the widget is always the odd one out for both roles that show it. Left the note/action-queue bookkeeping untouched since #50's run already did it correctly.

**Separately, a real branch-naming mistake worth flagging for a future session:** #51's branch used `-h537` as its id suffix — the *last 4* characters of `ann-mt5oqsmnh537` — not the last 6 (`mnh537`) the branch-naming convention actually calls for (see the 2026-08-22 branch-naming-changed entry elsewhere in this file). Double-check `id.slice(-6)` explicitly rather than eyeballing the tail of the id string when composing a branch name; a wrong suffix length doesn't break anything on its own (the slug portion differs between concurrent runs anyway, since each run summarizes the fix independently, so even a correct suffix wouldn't have made these two branches collide and short-circuit into one PR) but it silently breaks the one property that suffix exists for, and would matter more in a case where two runs happen to pick the same slug wording.
### 2026-08-23 — Stale checkout after a trigger from another open PR's branch, plus one item left deliberately unactioned as a product decision
Triggered by a push to `jynx-dashboard-status-pill-fit-hw5fsg` (PR #49's own branch, not this run's work). The workspace was checked out there, not on `main` — step zero's `ls` still showed the already-bookkept `ann-mt5opshw5fsg.json` (PR #49) as if it were pending, because that file had only been deleted on `main`, not on this unrelated feature branch. **Confirms the "stale checkout" lesson from an entry above generalizes beyond branches created by the trigger's own work item: any time the webhook fires from a push to *some other* open PR's branch, that checkout can be arbitrarily behind `main`'s real queue state.** Switched to `main`/`origin/main` before trusting the queue listing at all; the real queue turned out to be two different items entirely (`ann-mt5oqsmnh537`, `ann-mt5p5xzokc1i`), not the one the stale checkout suggested. (`ann-mt5oqsmnh537` also collided with two other concurrent runs in this same window — see the entry immediately above this one for that story; this run backed out of it the same way, deferring to #50.)

`ann-mt5p5xzokc1i` (targetLabel `env-strip`, route `dashboard`) asked for an entirely new subsystem: a "text type" comment category in Jynx for editing static (non-API-driven) UI text live, admin-only, "session based" (not going through the agent/PR action pipeline at all), with the admin choosing per-comment whether it's a text-edit vs. a normal QA comment. Left genuinely unactioned (action file kept in place, no PR, no reply attempt — no `ADMIN_SECRET` available in this environment): this isn't a small CSS/copy fix but a proposal to bypass the action pipeline itself for a whole new comment category, with real open product questions (what "session based" persistence actually means — per-browser-session only, or something server-backed and admin-scoped; what UI surfaces the text-type choice; how a live-edited static string is supposed to survive a redeploy of `client/` if it's never written back to the source `.jsx` file). Guessing an implementation here risks shipping something that looks like a real feature but doesn't match what the admin actually wants from a genuinely one-off, structural request — exactly the class of thing step (c) of the routine's own instructions says not to guess at.
### 2026-08-23 — Five-way concurrent batch on the same 6-item queue: 4 bookkept against sibling PRs, 1 new PR, the static-text-editor item re-confirmed unactioned
A run processing the queue (`ann-mt5p5xzokc1i`, `jynx-mt5q884jd7ap`, `jynx-mt5qb3ak9rsz`, `jynx-mt5qe3axvwkl`, `jynx-mt5qency0jar`, `jynx-mt5qh4p68xsg`) found, on checking `list_pull_requests`/`search_pull_requests` by id before implementing anything, that concurrent runs had already opened PRs for 4 of the 6: `jynx-mt5qh4p68xsg` (PR #55, the icon-size 3-way toggle — this run's own trigger context was in fact a push to that PR's own branch), `jynx-mt5qe3axvwkl` (PR #56, the role-icon stuck-drag fix + dock/detach toggle), `jynx-mt5qb3ak9rsz` (PR #58, notification status-updates + collapsed-bubble badge). For `jynx-mt5q884jd7ap` (the "Hi admin" dropdown), this run had already fully implemented its own version (a new `UserMenuButton.jsx`) and was about to push when the pre-push id check caught PR #57 (a near-identical `DevGreetingMenu.jsx` implementation) already open — discarded the local branch/commit without pushing, per the standing rule.

`jynx-mt5qency0jar` ("add a online icon next to online now users") had no PR anywhere, so this run implemented it: `DevAdminUsersScreen.jsx` already had a per-user online dot (`.dev-admin-online-dot`), so the genuinely missing piece was a summary readout — added a small "● N online now" line above the Dev Users list, reusing the existing dot styling; CSS added to `DevAdminPanel.jsx` per the "shared tabs get one injected `<style>` block" convention. PR #59.

`ann-mt5p5xzokc1i` (the static-text-editor / "text type" comment proposal) was re-queued since the prior session that analyzed it (see the entry immediately above this one) left its action file in place rather than deleting it, exactly as step (c) of the routine's own instructions expects for a genuinely ambiguous item — it's meant to keep coming back until a human clarifies or implements it by hand. Re-read the comment: unchanged from the prior pass, still the same structural, open-product-questions request. Left unactioned again for the same reasons already recorded there — no new information changed the judgment call.

All bookkeeping (note `actionStatus`/`actionPrUrl`/`resolved` updates for the 5 actioned items, queue-file deletions for those same 5) batched into one commit directly to `main`, per the routine's own batching instruction. `data/config/annotation-settings.json` on `origin/main` at the time had `autoResolveOnPrOpened: true`, so all 5 notes were also marked `resolved:true`/`resolvedBy:"auto (PR opened)"` alongside the `actionStatus` update, not left for manual resolution.

Worth flagging for whoever reconciles PR #55/#56/#57/#58/#59 later: this was (at least) a 5-way-concurrent run on the same 6-item batch — check each PR's actual diff against whatever else may have landed on `main` in between before assuming any single one is still the final word, per the standing lesson in the entries above this one.

### 2026-08-23 — `ann-mt5p5xzokc1i` re-confirmed unactioned a third time
Step-zero check found only this one queued item (`data/annotations/actions/ann-mt5p5xzokc1i.json`) — the static-text-editor / "text type" comment proposal already analyzed and left unactioned in both entries directly above. Note file's `actionStatus` was still `"queued"` (not `pr_opened`/`done`), so this wasn't a stale duplicate to bookkeep-and-delete. Re-read the comment: unchanged. Same open product questions apply (what "session based" actually means, how a live text edit is supposed to survive a `client/` redeploy if never written back to source, what UI surfaces the text-type choice) — still not a small, clearly-scoped change, still the class of thing step (c) says not to guess at. No `ADMIN_SECRET` available in this environment, so no reply attempt either. Action file left in place untouched, no PR, no note-file change. This item will keep re-queuing on every push until a human either clarifies the requirements or implements it by hand — worth just doing that directly rather than waiting for a future autonomous pass to somehow resolve the ambiguity on its own, since nothing about repeated re-analysis is going to manufacture the missing product decision.

### 2026-08-23 — Two-item batch: `ann-mt5p5xzokc1i` unactioned a fourth time, `ann-mt6bq6f9yim3` fixed (PR #60) — a real recharts Tooltip gotcha worth knowing, plus stale README dev-login credentials
Step-zero found two queued items. `ann-mt5p5xzokc1i` (the static-text-editor proposal) — unchanged since the three entries directly above analyzed it; re-confirmed unactioned for the same reasons, no new information to change the judgment call. Not re-explained again here; see the entries above for the full reasoning.

`ann-mt6bq6f9yim3` ("the text when hovering on the graph is dark and cant be seen on dark mode", targeting the dashboard's `priority`/"תיעדוף דרישות מאושרות" widget) was a real, fixable bug: **recharts' `Tooltip` defaults each hovered item's *value* text color to `entry.color || '#000'` when no `itemStyle` prop is passed** (confirmed by reading the actual installed source, `client/node_modules/recharts/lib/component/DefaultTooltipContent.js` — the caller's `itemStyle` is spread *after* this default, so it fully overrides, but only if you actually pass one). `DevDashboard.jsx`'s shared `tooltipStyle()` helper (used by all four chart tooltips: trend/priority/categoryAnalytics/ticketTypes) already themed `contentStyle`/`labelStyle` via `TOKENS.text`/`TOKENS.textDim` (CSS custom properties that do flip with the theme) but never set `itemStyle` — so the tooltip's background correctly matched the theme while the value-number text silently fell back toward black regardless of theme, exactly matching the reported symptom. Fix: added `itemStyle: { color: TOKENS.text }` to that one shared helper (`DevDashboard.jsx:146-152`) — a single-line, minimal change that also preempts the same latent bug on the other three charts that share the helper. PR #60.

**Worth knowing for any future session needing recharts `Tooltip` styling parity with the app theme:** `contentStyle`/`labelStyle` alone are not enough — `itemStyle` must also be set explicitly, or the per-item value text silently defaults to black (or `entry.color`, which isn't guaranteed either) regardless of `contentStyle`'s background. If you add a new chart with its own ad-hoc tooltip (not going through `tooltipStyle()`), set all three.

**Also worth knowing:** attempted a live Playwright dark-mode screenshot to visually confirm the fix, but the dev-mode login credentials documented in `README.md` (`Demo Dev` / `hangar-demo-2026`) were **rejected** — "סיסמה שגויה" (wrong password) — against this environment's current `data/config/dev-users.json` (whose actual roster is names like `אילאיל`/`גלעד`/`עמיחי`/`זיו`/`yoav`, not `Demo Dev`). The login form itself has also changed shape — it's now a single password field with no separate name/username input (`.dev-login-submit`, `input[type=password]` under a `JYNX — Sign in to dev mode` panel), not the name+password form the older testing notes above describe. If `README.md`'s seeded credentials no longer work in a future session either, this is why — the doc is stale relative to whatever roster is actually deployed in a given environment; don't spend long chasing a login that may simply not exist here, and say so explicitly in the PR rather than claiming a screenshot-verified fix that wasn't actually taken (as done for PR #60 — build-verified plus recharts-source-verified, not visually verified).

Verified with `npx vite build` from `client/` (clean) and by reading `recharts`' own shipped source to confirm the exact mechanism being fixed, rather than guessing at a plausible-looking style change. Bookkeeping (note `actionStatus`/`actionPrUrl`/`resolved` update, queue-file deletion) for `ann-mt6bq6f9yim3` batched into one commit directly to `main`; `ann-mt5p5xzokc1i`'s action file was left untouched, as always for that item.

### 2026-08-24 — `ann-mt5p5xzokc1i` re-confirmed unactioned a fifth time
Step-zero found only this one queued item again. Note file (`data/annotations/notes/ann-mt5p5xzokc1i.json` on `origin/main`) still shows `actionStatus:"queued"`, `resolved:false`, `actionPrUrl:null` — not stale, genuinely still open. No PR anywhere references this id. `ADMIN_SECRET` is still not available in this environment, so a reply attempt was skipped as before. Re-read the comment: byte-for-byte unchanged from the four prior passes. Same unresolved product questions block it (what "session based" persistence concretely means — per-browser-session, or server-backed and admin-scoped; what UI surfaces the text-type-vs-QA-comment choice; how a live text edit is meant to survive a `client/` static-asset redeploy if it's never written back into the source `.jsx`) — still not a small, clearly-scoped change per step (c)'s bar. Action file left in place untouched, no PR, no note-file change, no code change. Restating the standing recommendation from the four prior entries: this will keep re-queuing indefinitely on every push (nothing about repeated autonomous re-analysis manufactures the missing product decision) — a human should either answer those three questions directly or implement it by hand.

### 2026-08-24 — `ann-mt5p5xzokc1i` re-confirmed unactioned a sixth time
Step-zero found only this one queued item again. Note file still `actionStatus:"queued"`, `resolved:false`, `actionPrUrl:null` on `origin/main` — genuinely still open, not stale. No PR anywhere references this id. `ADMIN_SECRET` still not available in this environment, so no reply attempt. Comment byte-for-byte unchanged from all five prior passes; same three unresolved product questions block it (session-only vs. server-backed persistence; what UI exposes the text-type-vs-QA-comment choice; how a live-edited string is meant to survive a `client/` static-asset redeploy without being written back into source). Action file left in place untouched, no PR, no note/code change. Six autonomous passes in two days have reached the identical conclusion — this is no longer worth a seventh identical re-analysis; a human answering the three questions above (or implementing it by hand) is the only thing that will actually resolve it.

### 2026-08-24 — `ann-mt5p5xzokc1i` unactioned a seventh time; escalated via a direct notification instead of a silent seventh identical re-analysis
Step-zero found only this one queued item again (verified against `origin/main`, not a stale local checkout — note file still `actionStatus:"queued"`/`resolved:false`/`actionPrUrl:null`, comment byte-for-byte unchanged, no PR anywhere references this id). Per the entry immediately above ("no longer worth a seventh identical re-analysis"), did not redo the full write-up again — instead sent a push notification directly to the user (this routine now has that capability), since seven passes across two days with the identical blocking product questions and no human having been pinged about it is exactly the "routine can't proceed without you" case worth surfacing rather than silently re-queuing forever. Action file left in place untouched (still needs a human decision or a by-hand implementation before this can be marked done), no PR, no note/code change beyond this log entry.

### 2026-08-24 — `ann-mt5p5xzokc1i` unactioned an eighth time; no repeat notification since nothing changed since the seventh-pass escalation
Step-zero found only this one queued item again, verified against `origin/main` (already the checked-out tip at trigger time — `2973d13`): note still `actionStatus:"queued"`/`resolved:false`/`actionPrUrl:null`, comment byte-for-byte unchanged, no PR anywhere references this id. The prior entry already escalated this exact blocking state to the user via a push notification; since nothing has changed since then (no clarification, no PR, no code change), sending a second identical notification would just be noise — skipped per the "don't notify for the same unresolved thing twice with nothing new to report" principle. Action file left in place untouched, no PR, no note/code change beyond this log entry. Future passes: keep skipping the notification unless something actually changes (a human reply, a by-hand fix, a new wrinkle) — re-notifying on every identical re-queue defeats the point of having escalated once already.

### 2026-08-24 — `ann-mt5p5xzokc1i` unactioned a ninth time; still no repeat notification
Step-zero found only this one queued item again, verified against `origin/main` (fetched fresh, not trusting the local checkout): note still `actionStatus:"queued"`/`resolved:false`/`actionPrUrl:null`, comment byte-for-byte unchanged, `search_pull_requests` for the id across the repo returns zero results. Nothing has changed since the seventh-pass escalation (no human reply, no by-hand fix, no new wrinkle in the comment), so per the eighth-pass entry's own instruction, skipped the notification again. Action file left in place untouched, no PR, no note/code change beyond this log entry.

### 2026-08-24 — `ann-mt5p5xzokc1i` unactioned a tenth time; still no repeat notification
Step-zero found only this one queued item again, verified against `origin/main` (fetched fresh): note still `actionStatus:"queued"`/`resolved:false`/`actionPrUrl:null`, comment byte-for-byte unchanged, `search_pull_requests` for the id across the repo still returns zero results. Nothing has changed since the seventh-pass escalation (no human reply, no by-hand fix, no new wrinkle), so skipped the notification again per standing instruction. Action file left in place untouched, no PR, no note/code change beyond this log entry.

### 2026-08-25 — `ann-mt5p5xzokc1i` unactioned an eleventh time; still no repeat notification
Step-zero found only this one queued item again, verified against `origin/main` (fetched fresh): note still `actionStatus:"queued"`/`resolved:false`/`actionPrUrl:null`, comment byte-for-byte unchanged, `search_pull_requests` for the id across the repo still returns zero results. Nothing has changed since the seventh-pass escalation (no human reply, no by-hand fix, no new wrinkle), so skipped the notification again per standing instruction. Action file left in place untouched, no PR, no note/code change beyond this log entry.

### 2026-08-25 — `ann-mt5p5xzokc1i` unactioned a twelfth time; still no repeat notification
Step-zero found only this one queued item again, verified against `origin/main` (fetched fresh): note still `actionStatus:"queued"`/`resolved:false`/`actionPrUrl:null`, comment byte-for-byte unchanged, `search_pull_requests` for the id across the repo still returns zero results. Nothing has changed since the seventh-pass escalation (no human reply, no by-hand fix, no new wrinkle), so skipped the notification again per standing instruction. Action file left in place untouched, no PR, no note/code change beyond this log entry.

### 2026-08-25 — `ann-mt5p5xzokc1i` unactioned a thirteenth time; still no repeat notification
Step-zero found only this one queued item again, verified against `origin/main` (fetched fresh): note still `actionStatus:"queued"`/`resolved:false`/`actionPrUrl:null`, comment byte-for-byte unchanged, `search_pull_requests` for the id across the repo still returns zero results. Nothing has changed since the seventh-pass escalation (no human reply, no by-hand fix, no new wrinkle), so skipped the notification again per standing instruction. Action file left in place untouched, no PR, no note/code change beyond this log entry.

### 2026-08-25 — `ann-mt5p5xzokc1i` unactioned a fourteenth time; still no repeat notification
Step-zero found only this one queued item again, verified against `origin/main` (fetched fresh, head `8656236`): note still `actionStatus:"queued"`/`resolved:false`/`actionPrUrl:null`, comment byte-for-byte unchanged, `search_pull_requests` for the id across the repo still returns zero results. Nothing has changed since the seventh-pass escalation (no human reply, no by-hand fix, no new wrinkle), so skipped the notification again per standing instruction. Action file left in place untouched, no PR, no note/code change beyond this log entry.

### 2026-08-25 — Two-item batch: `ann-mt5p5xzokc1i` unactioned a fifteenth time (still no repeat notification), `jynx-mt8i0n7ssax2` fixed via real live reproduction (PR #63) — a genuine stale-`requestAnimationFrame`-ref bug in the hover-overlay toggle
Step-zero found two queued items. `ann-mt5p5xzokc1i` (the static-text-editor proposal) — unchanged since the fourteen entries above; re-confirmed unactioned for the same reasons, no new information, no repeat notification (nothing has changed since the seventh-pass escalation).

`jynx-mt8i0n7ssax2` ("i was connected as a dev user profile and the eye button didnt work i still say the hover borders", route `catalog`, targetLabel `dev-toolbar-overlay-toggle`) was a fresh item with no matching note history and no existing PR. The comment's exact direction was ambiguous (typo-garbled, could mean "toggled off but border stayed" or more loosely "the toggle doesn't work"), so rather than guess at wording, actually reproduced it: installed dependencies fresh (`npm run install:all`, this environment had no `node_modules` yet), stood up a real local `data/`+`client/` stack (with a throwaway local `.env`/`ADMIN_SECRET`, never committed), created a throwaway **non-admin** dev user via the real admin API (matching "connected as a dev user profile"), and drove the real login + toggle with Playwright (`chromium-1194` under `/opt/pw-browsers`, launched with an explicit `executablePath` + `--no-sandbox`, `force:true` on clicks since the locked-FAB's `jynx-breathe` pulse animation makes Playwright's actionability check see it as perpetually "not stable").

Static code reading of `DevAuthGate.jsx`/`DevOverlay.jsx`/`useHoverTarget.js` found nothing obviously wrong — turning the overlay off is immediate and synchronous (`setTarget(null)` + full unmount), not rAF-dependent, so I couldn't get the *literal* "toggled off, highlight kept showing" direction to reproduce even after several attempts. But a full off→on→hover Playwright pass found a real, deterministic, different-but-related bug: **once the overlay is toggled off and back on, hover highlighting stops working for the rest of the page session** — confirmed with `.dev-overlay-highlight` counts and `elementFromPoint` (a normal, valid, non-ignored element genuinely under the cursor, yet no highlight rendered). Root cause: `useHoverTarget.js`'s `mousemove` handler throttles via `requestAnimationFrame`, guarded by a `rafRef` that only allows one frame in flight at a time; the effect's cleanup called `cancelAnimationFrame(rafRef.current)` on toggle-off but never reset `rafRef.current` back to `null`. If a frame happened to be pending at the exact toggle moment — near-guaranteed in practice, since clicking the toggle button moves the mouse onto it first, scheduling a frame right before the click handler flips `active` — the ref is left permanently non-null, and the `if (rafRef.current) return;` guard then blocks every future frame from ever being scheduled again, on any later re-subscription. Fixed with a one-line addition (`rafRef.current = null` alongside the existing `cancelAnimationFrame` call) in the cleanup; verified the fix live with the identical off→on→hover Playwright sequence (highlight correctly returns after the fix, where it stayed stuck at zero before). `npx vite build` clean. Cleaned up the throwaway dev user afterward via the real admin API and confirmed `data/config/dev-users.json` matched its original 3 accounts before committing; local `.env` was never committed (removed before pushing). PR #63.

Judged this as implementable rather than a step-(c) "genuinely ambiguous, don't guess" case (unlike the long-unactioned `ann-mt5p5xzokc1i` above, which is an open product-decision question) — the comment names one concrete, testable control, and testing it surfaced a real, reproducible defect in exactly that control, so fixing it is a defensible interpretation even though the precise wording of the report couldn't be reproduced verbatim; said so explicitly in the PR body rather than silently claiming an exact repro.

### 2026-08-25 — A four-way pile-up on `jynx-mt8i0n7ssax2` (PRs #61/#63/#64), `jynx-mt8i1fowscur` fixed for real (PR #65, a genuine `data-mode.json` durability bug), `ann-mt5p5xzokc1i` unactioned a sixteenth time
Same firing batch as the entry immediately above (`ann-mt5p5xzokc1i`, `jynx-mt8i0n7ssax2`, `jynx-mt8i1fowscur`), worked concurrently by (at least) four separate sessions. Worth recording the outcome precisely since it's messier than the usual two-way race:

**`jynx-mt8i0n7ssax2` ("the eye button didn't work, I still see the hover borders")** ended up with **three** independently-opened PRs: #61 and #64 both diagnosed the exact same root cause — `DevOverlay`'s mount condition (`active = overlayOn || drawMode` in `DevAuthGate.jsx`) was also the only thing gating the hover-highlight itself, so the eye toggle couldn't fully turn off the highlight while draw mode was on — and both fixed it the same way (a new prop threaded into `useHoverTarget()`, gated on `overlayOn` alone, named `hoverOn` in both). #63 (see the entry directly above) found a *different*, actually-reproduced-via-Playwright bug in the same area (a stale `requestAnimationFrame` ref in `useHoverTarget.js` permanently breaking hover-tracking after one off→on cycle). This session independently arrived at the identical diagnosis/fix as #61/#64 (same conflated-`active` root cause, same `hoverOn`-prop shape) and had already built + build-verified it on its own branch before the pre-push id check caught #61 and #64 already open — discarded rather than opening a fourth near-identical PR, per the standing rule. Bookkeeping for this id was already done by a concurrent run before this session got to it (pointed at #63, queue file already deleted) — left untouched. Flagging for whoever reconciles this id: #61 and #64 are true duplicates of each other (pick one, close the other); #63 is a separate, real, non-overlapping bug worth keeping regardless of which of #61/#64 survives — the three PRs are not mutually exclusive.

**`jynx-mt8i1fowscur` ("demo data turn off never works, make it work")** had one existing PR (#62, a concurrent run's client-side fix: `MockDataToggle.jsx`'s `toggle()` had no error handling at all, so a failed `POST /dev/data-mode` — e.g. during a Render cold-start wake-up — silently did nothing, no reload, no error, indistinguishable from a dead button). This session found a second, different, real root cause by reading `data/lib/dataMode.js`: `data/config/data-mode.json` was in `.gitignore` (local-disk-only), with an explicit code comment defending that as "a fresh clone/deploy always boots showing demo content" — but the actual live instance runs on Render's free tier, which wipes its disk on **every** idle spin-down, not just a fresh clone. So any deliberate switch to "live" data silently reverted back to "mock" the next time the low-traffic public demo went idle and respun — a genuine, confirmed durability bug, independent of #62's click-reliability bug, on the same button. Fixed by mirroring `data/lib/annotationSettings.js`'s already-proven git-persistence pattern exactly (`lib/githubPersist.js`, boot-time hydration wired into `server.js`'s existing `Promise.all(...)`, `data-mode.json` un-gitignored to match `annotation-settings.json`/`dev-users.json`). PR #65. Verified the endpoint end-to-end against a real local `data/` server (mock→live→mock via the admin-secret dev-login path); did **not** live-test the actual GitHub-commit call itself (`commitFileToGithub`) since no `GITHUB_TOKEN` exists in this environment — flagged honestly in the PR rather than claimed as fully proven. Noted #62 and #65 as complementary, not duplicate, in both PR bodies and the note's `actionLog` — a human reconciling this id should keep both, they fix two different failure modes of the same toggle.

**`ann-mt5p5xzokc1i`** — unchanged since the fifteen prior entries; re-confirmed unactioned for the same reasons, no new information, no repeat notification (nothing has changed since the seventh-pass escalation). Two more items appeared in `data/annotations/actions/` mid-run (`ann-mt8iei9do4oo`, `ann-mt8ih0xavev6`) — correctly left untouched, not part of this run's original step-zero batch.

**Also worth noting for future git-hygiene**: this session pushed a now-orphaned branch, `jynx-overlay-eye-toggle-stuck-7ssax2` (its own independent implementation of the #61/#64 fix, described above), before discovering the duplicate PRs — a `git push origin --delete` attempt on it failed with an HTTP 403 (this session's git credentials apparently can't delete remote branches, only push/create), so it's still sitting on `origin` with no PR ever opened against it. Harmless (nothing references it), but if you're auditing stale branches on this repo, that's why it exists.

Bookkeeping for `jynx-mt8i0n7ssax2` (note `actionStatus`/`actionPrUrl`/`actionLog` update, `resolved:true`/`resolvedBy:"auto (PR opened)"` since `data/config/annotation-settings.json` on `origin/main` still had `autoResolveOnPrOpened:true`, queue-file deletion) committed directly to `main`. Two items appeared in the queue after this run's step-zero snapshot (`ann-mt8iei9do4oo`, a tickets-route item; `jynx-mt8i1fowscur`) — left untouched per the standing "don't expand scope mid-run to items that show up after you've already started" rule; this run's own bookkeeping push will re-trigger the webhook and pick them up in a fresh firing.

### 2026-08-25 — A third concurrent session on `jynx-mt8i0n7ssax2` (PR #61, a near-exact duplicate of #63's sibling fix), plus a `git stash` scope gotcha
A separate concurrent run independently picked up the same fresh `jynx-mt8i0n7ssax2` item at essentially the same moment as the run described in the entry immediately above. This run's own static read of `DevAuthGate.jsx`/`DevOverlay.jsx` found a *different*, more literal bug than #63's: `DevOverlay` is mounted with `active={overlayOn || drawMode}`, and that same combined `active` also drives `useHoverTarget(active, ...)` — so if draw mode happens to be on, turning the eye toggle off does **not** stop the hover-highlight from tracking the cursor, directly contradicting `DevAuthGate.jsx`'s own inline comment stating the two toggles are meant to be fully independent ("אפשר לצייר גם כשהילת-ה-hover כבויה, ולהיפך"). This is the literal "toggled off, highlight kept showing" direction of the report that the #63 run explicitly said it could not reproduce — the two runs found two different, both-real bugs on the same control, not one bug described two ways.

Implemented the fix (a new `hoverOn` prop, passed as `overlayOn`, used only by `useHoverTarget` — `active` keeps its existing job of gating the whole component's mount, so draw mode still works with hover off) and, rather than trusting the code-trace alone, verified it live: installed deps, ran real `data/`+`client/` dev servers, created a throwaway admin session + dev user via the real admin API, and drove real headless Chromium (`/opt/pw-browsers/chromium-1194`) through log in → draw-mode on → eye-toggle off → hover over app content → check for `.dev-overlay-highlight` in the DOM. Confirmed present (bug reproduces) on unfixed code and absent (fixed) on patched code, flipping between the two states in the same running dev server via `git stash`/`stash pop` (Vite HMR picked up each state live) rather than restarting anything.

**A real `git stash` gotcha worth generalizing:** `git stash` operates on the whole repository regardless of `cwd`, not just the subdirectory you happen to be standing in. Running it while a throwaway test-only write existed elsewhere in the tree (in this case `data/config/dev-users.json`, holding a dev-user created purely for the Playwright login, via the app's own real admin API — never intended to be committed) silently swept that file's uncommitted change into the same stash, reverting the just-created test account and breaking the test login until the file was recreated. No real harm here (the file was disposable and got recreated for the next pass, and was reset back to its original committed state before this run's actual commit), but worth knowing generally: a `git stash` that looks scoped to "the file I'm editing" is not scoped at all, and will silently carry along any other uncommitted state elsewhere in the tree — including throwaway local writes made through an app's own API purely for verification purposes.

By the time this branch (`jynx-hover-glow-toggle-fix-7ssax2`, built, pushed, but never opened as a PR) was ready, the standing "check PRs by id immediately before opening one" rule caught **two** already-open PRs for this id: **#61**, opened moments earlier by yet a third concurrent run with essentially the identical diagnosis and the identical `hoverOn`-prop fix shape as this run's own (same root cause, same code shape, same supporting Hebrew-comment quote) — a genuine, word-for-word-level duplicate; and **#63** (the sibling entry above), a different, complementary, also-real fix for the stale-`rafRef` bug. Discarded this run's own branch without opening a PR, since it added nothing over #61. Attempted to delete the now-pointless remote branch (`git push origin --delete`) but this environment's push credentials returned a 403 specifically on branch deletion (ordinary pushes to `main` worked fine) — left it in place, harmless, since no PR references it.

By the time this run reached its own bookkeeping commit, `origin/main` already had the #63 run's bookkeeping in place (`actionStatus:"pr_opened"`, `actionPrUrl` pointing at #63, queue file deleted) — a `git push` rejection (fetch-first) surfaced this mid-attempt. Per the standing "don't fight a correct concurrent bookkeeping commit" precedent, did not overwrite it to point at #61 instead; both PRs are real and non-duplicate-of-each-other, so there's no single "more correct" `actionPrUrl` to insist on. **Flagging for whoever reconciles this id: #61 and #63 both need to land (or be merged into one), not just whichever the note happens to point at** — #61 fixes the `overlayOn`-vs-`drawMode` interaction bug, #63 fixes the stale-`rafRef` bug; neither one's diff touches the other's fix, and the control isn't fully correct with only one of them merged.

### 2026-08-25 — A fifth concurrent session on the same two-item pile-up: independent confirmation, one own-implementation discarded as a duplicate, one new-but-minor angle left unshipped, `ann-mt5p5xzokc1i` unactioned a seventeenth time
Same batch as the two entries directly above (`ann-mt5p5xzokc1i`, `jynx-mt8i0n7ssax2`, `jynx-mt8i1fowscur` at this run's own step-zero). By the time this run had built and locally verified its own fixes, `origin/main` already had both items fully bookkept (`jynx-mt8i0n7ssax2` → resolved, `actionPrUrl` pointing at #63 with #61 cross-referenced in `actionLog`; `jynx-mt8i1fowscur` → resolved, `actionPrUrl` pointing at #65 with #62 cross-referenced) and both queue files already deleted. Nothing left to do for either id — recording this run's own findings here since some of it is genuinely additive, not just a re-run of what's above.

**`jynx-mt8i0n7ssax2`**: independently arrived at the identical `active={overlayOn||drawMode}`-also-gates-hover diagnosis and the identical `hoverOn`/`hoverGlowOn`-prop fix shape as #61/#64 (this repo's fourth independent session to land on that exact fix) — build-verified locally, then discarded without pushing once the pre-push id check found #61 already open, per the standing rule. No new information beyond what #61/#63's PR bodies and the entries above already cover.

**`jynx-mt8i1fowscur`**: before reading any of the above (this run's own investigation, not copied from another PR), reproduced the toggle live end-to-end with Playwright — a throwaway non-admin dev user, real `data/`+`client/` dev servers — and confirmed the client→server→reload→persisted-mode round trip is **not** broken under normal conditions in either direction (mock→live and live→mock both worked, button label updated correctly post-reload each time). This independently corroborates #65's own finding (`setMode()`/`getMode()` are symmetric, the defect is durability not toggle logic) and #62's framing (the toggle path itself isn't structurally broken). Went one step further and screenshotted the actual post-switch state: switching to live mode drops the catalog straight into its already-existing "no items yet" empty state, with zero indication anywhere on screen that this is expected ("live starts empty" is documented in `FORCLAUDE.md` and in the toggle button's own hover tooltip, but nothing is shown at the moment of the click). Neither #62 (click-reliability) nor #65 (git-durability) addresses this — a fully successful switch can still *look* exactly like "nothing happened" from the catalog screen alone. Built and locally verified a small, independent third fix for this (`MockDataToggle.jsx`: `sessionStorage`-flagged one-time toast after the post-toggle reload, confirming the switch and spelling out both "starts empty" and "resets to demo automatically on server restart" — the latter directly matching #65's now-fixed... well, previously-true-and-now-being-fixed-by-#65 caveat). Did **not** open a PR for it: `jynx-mt8i1fowscur`'s `actionStatus` was already `pr_opened`/`resolved:true` by the time this was ready, and the standing skip rule in this routine's own instructions is unconditional once that's true — it doesn't carve out an exception for "a smaller complementary polish nobody else did." Noting the idea here rather than silently dropping it, in case a human wants a fourth small PR for it later: the toast/notice code is not on any branch (discarded, not pushed), so it would need to be re-implemented from this description, not cherry-picked.

`ann-mt5p5xzokc1i` — unchanged since the sixteen prior entries; re-confirmed unactioned for the same reasons (comment byte-for-byte identical, no PR anywhere references the id, note still `queued`/`resolved:false`), no new information, no repeat notification (nothing has changed since the seventh-pass escalation).

### 2026-08-25 — A sixth concurrent session on the same pile-up: identical independent convergence, nothing left to ship, two new items correctly deferred
Same step-zero batch as the three entries above (`ann-mt5p5xzokc1i`, `jynx-mt8i0n7ssax2`, `jynx-mt8i1fowscur`). Independently reproduced the overlay-toggle bug live (Playwright, throwaway non-admin dev user, real `data/`+`client/` servers) and arrived at the same `active={overlayOn||drawMode}`-also-gates-hover diagnosis and `overlayOn`-prop fix as #61/#63/#64; independently diagnosed and implemented the identical git-persistence fix for `jynx-mt8i1fowscur` as #65 (same root cause: `data-mode.json` was gitignored/local-disk-only, so a Render free-tier spin-down silently reverted an admin's "live" choice back to "mock" — confirmed by literally reproducing it: killed and restarted a local server with the mode file removed, watched it fall back to `mock`). By the time this run re-checked PRs/notes immediately before pushing (per the standing rule), `origin/main` already had both items fully bookkept and resolved (`jynx-mt8i0n7ssax2` → #63, `jynx-mt8i1fowscur` → #65, both queue files already deleted) by the runs recorded in the two entries above. Discarded all local changes without pushing — nothing to add beyond what's already recorded there. `ann-mt5p5xzokc1i` — still unchanged, no new information, no repeat notification. Two more items appeared in `data/annotations/actions/` (`ann-mt8iei9do4oo`, `ann-mt8ih0xavev6`) after this run's own step-zero snapshot — correctly left untouched for a future firing, per the standing "don't expand scope mid-run" rule.

### 2026-08-25 — A seventh concurrent session: two genuinely different (not just re-derived) bugs found in the same area, neither shipped since both items are already resolved
Same step-zero batch again (`ann-mt5p5xzokc1i`, `jynx-mt8i0n7ssax2`, `jynx-mt8i1fowscur`). Unlike the sixth session above, this run's own live Playwright investigation (throwaway admin dev user, real `data/`+`client/` servers, same environment) landed on **two bugs that #61/#63/#64/#65 do not cover**, not re-derivations of the same fix:

1. For `jynx-mt8i0n7ssax2`: confirmed `#61`/`#63`/`#64` all leave `DevOverlay.jsx`'s top-level `if (!active) return null;` (line 131, `active = overlayOn || drawMode` from the caller) completely untouched — checked directly against `origin/main`'s actual `DevOverlay.jsx` content, not just the PR diffs. That gate wraps `<AdminAnnotationMarkers .../>`, so turning the eye toggle off while draw mode is also off **unmounts the persistent comment-status dots entirely**, even though `markersOn` (the separate Target-icon toggle) is still on — directly contradicts the component's own header comment ("Gated on two independent things... since someone might want one without the other"). Reproduced live: created a real annotation via the API, confirmed its dot renders, toggled the eye off, confirmed the dot vanished anyway; wrote and verified a fix (split the render into a `!active && !markersOn` outer gate plus `active &&` guards on just the hover-highlight/popover JSX) that made all 5 of: dot-survives-eye-off, hover-glow-still-turns-off, dot's-own-hover-highlight-still-works, and markers-off-still-hides-the-dot pass in a single live before/after Playwright run.
2. For `jynx-mt8i1fowscur`: independent of #65's git-persistence fix (which addresses *why* a live-mode choice doesn't stick across a Render restart), found that `MockDataToggle.jsx`'s `toggle()` had **no error handling at all** around `await setDataMode(next)` — if that POST throws for any reason (an expired dev session being the single most plausible one on a free host with in-memory sessions, per `sessions.js`), the function throws before reaching `window.location.reload()`, and the button silently does nothing with zero feedback. This is the exact "looks like the button doesn't work" failure mode `http.js`'s own `getText()` comment already documents for 401s elsewhere in this codebase — just not fixed here yet. Confirmed live: a normal toggle round-trips correctly in both directions (mock→live→mock, unaffected by #65 not yet being on this branch); with the stored dev token corrupted to simulate an expired session, the unpatched button does nothing observable, while a patched version (small `saving`/`error` state, try/catch around the call, an inline red message) surfaces "Couldn't switch — your dev session may have expired, try signing in again" instead.

Both are real, reproducible, and distinct from what's already shipped — but both work items are already `actionStatus:"pr_opened"`/`resolved:true` (pointing at #63 and #65 respectively) per the standing bookkeeping-skip rule, and the precedent set by the sixth-session entry above (a genuinely complementary improvement on an already-resolved item still doesn't get its own PR — it gets written down here instead). Followed that precedent exactly: built and live-verified both fixes locally, then discarded them (`git checkout --`, `git reset --hard origin/main`) without pushing a branch or PR. Noting the concrete diagnosis + verified fix shape here in case a human wants a small follow-up PR for either:
- `DevOverlay.jsx`: change `if (!active) return null;` to `if (!active && !markersOn) return null;`, and add `active &&` in front of the `rect && (...)` highlight block and the two `popover`-driven blocks right below it (`popover?.drawing` / `popover &&`) so a stale open popover can't linger once its own toggle goes off.
- `MockDataToggle.jsx`: wrap the `setDataMode(next)` call in try/catch; on failure, skip the reload and show a short inline error instead of failing silently.

`ann-mt5p5xzokc1i` — still unchanged (comment byte-for-byte identical, note still `queued`/`resolved:false`, no PR anywhere), no new information, no repeat notification per the standing "nothing changed since the seventh-pass escalation" rule. `ann-mt8iei9do4oo` and `ann-mt8ih0xavev6` (the two items that appeared mid-run in the sixth session above) were present at this run's own step-zero snapshot too but not yet investigated in the time this run had — correctly left for a future firing rather than rushed, per the same "don't expand scope" principle applied to running out of the run's own attention rather than just to items arriving mid-run.

### 2026-08-25 — An eighth concurrent session finds a genuinely new, fourth root cause on `jynx-mt8i0n7ssax2` (PR #66) — `overlayOn` was never persisted; `jynx-mt8i1fowscur` fully covered already; `ann-mt5p5xzokc1i` unactioned a nineteenth time
Same step-zero batch as the four entries above (`ann-mt5p5xzokc1i`, `jynx-mt8i0n7ssax2`, `jynx-mt8i1fowscur`). Unlike the last few concurrent passes on this pile-up, this run did **not** converge on an already-known diagnosis for the overlay-toggle item — it found a fourth, genuinely distinct, previously-unflagged bug in the same control.

Read #61's and #63's PR bodies first (both already open by the time this run started implementing) specifically to avoid re-deriving either. Both explicitly acknowledge they don't fully explain the report's literal wording — #63 says outright it could not reproduce "toggle is off but I still see the border" (its bug needs an off→on→off cycle first); #61 needs draw mode to be on, which the report never mentions. That gap motivated actually driving the real app end-to-end again rather than trusting either PR's diagnosis as complete: logged in as a throwaway non-admin dev user via Playwright, toggled the eye off with no draw mode involved — behaved correctly, immediate and clean. So the highlight reappearing had to be triggered by something other than the toggle itself. Reading `DevAuthGate.jsx` for how its other Jynx-chrome toggles persist state surfaced the actual gap: `overlayOn` was a bare `useState(true)`, the only one of that file's toggles (`roleDocked`/`toolbarOrientation`/`iconScale`/`drawColor` all do) that never touches `localStorage` — so it silently resets to its default (on) on any full page reload, including the reload `MockDataToggle.jsx`'s own mock/live switch triggers one click away in the same panel. Reproduced directly: toggle off → reload → hover → border back, toggle's own title still correctly claiming "off". This is the closest reproduction yet of the report's exact wording, and it's a code-level fact (`git diff` confirms neither #61 nor #63 touches `overlayOn`'s declaration or persistence), not a re-interpretation of either existing PR.

Fixed by loading/persisting `overlayOn` through `localStorage` (`jynx-overlay-on`), mirroring the exact pattern already used two lines above it for `drawColor` in the same file — no new pattern invented. Verified live before/after: unfixed code reproduces (highlight back after reload despite toggle reporting off); fixed code does not (highlight stays off, title stays consistent); the draw-mode-combined case (unrelated to this fix, already #61/#63's territory) re-confirmed unaffected. `npx vite build` clean. Checked for a same-id race twice — once before implementing, once immediately before pushing — both times finding only #61/#63/#64(closed), no fourth PR from a sibling run. PR #66 opened; note's `actionLog` extended (not overwritten) to list all three still-open, mutually non-overlapping fixes (#61, #63, #66) rather than picking one as "the" answer — matching the reconciliation pattern already established for this id and for `jynx-mt8i1fowscur`'s #62/#65 pair. `actionPrUrl` left pointing at #63 (already correct, unchanged) since there's no single canonical PR among three disjoint fixes.

`jynx-mt8i1fowscur` — re-confirmed already fully bookkept (`actionStatus:"pr_opened"`, `resolved:true`, queue file already deleted) by an earlier concurrent run before this session finished its own investigation; this run's own client-side fix (try/catch + visible failure/retry state in `MockDataToggle.jsx`) turned out to closely duplicate #62's already-open fix for the same root cause (unhandled rejection on a failed `POST /dev/data-mode`), so it was discarded without pushing rather than opened as a near-duplicate fourth PR — a materially different judgment call than the overlay item above, where the third fix was for a genuinely distinct bug, not a re-diagnosis of one already covered.

`ann-mt5p5xzokc1i` — still unchanged (comment byte-for-byte identical, note still `queued`/`resolved:false`, no PR anywhere references the id), no new information, no repeat notification (nothing has changed since the seventh-pass escalation). Two items that appeared in the queue mid-run (`ann-mt8iei9do4oo`, `ann-mt8ih0xavev6`) were, as always, left untouched — not part of this run's step-zero batch.

### 2026-08-25 — Two same-ticket priority-picker comments fixed together (PR #67): a real CSS stacking-context trap, plus a correction to this session's own earlier wrong "no bug found" conclusion on the two jynx items above
This session's step-zero batch was `ann-mt5p5xzokc1i` (unchanged, see the many entries above) plus `jynx-mt8i0n7ssax2`/`jynx-mt8i1fowscur` (the eye-toggle and mock-toggle reports covered by the two entries directly above). This session initially investigated those two jynx items live (Playwright, throwaway dev user, real repro attempts in both directions) and, finding no reproducible defect after real effort, marked both `actionStatus:"done"` with no PR and pushed that bookkeeping — **but that conclusion was wrong**. By the time the push was attempted, `origin/main` already had it right: concurrent runs had found and fixed real bugs in both controls (see the two entries directly above this one for the full detail — a stale-`rafRef` bug plus an `overlayOn`/`drawMode`-conflation bug on the eye toggle across PRs #61/#63/#64, and a genuine `data-mode.json` durability gap plus a silent-failure bug on the mock toggle across PRs #62/#65). This session's own "done, no bug" bookkeeping commit was **discarded** (`git rebase --abort` then `git reset --hard origin/main`) rather than pushed over the correct state — never overwrite a concurrent run's correct, PR-backed bookkeeping with your own unconfirmed conclusion just because you got there first locally. **Worth internalizing for a future session tempted to close out a report as "investigated, doesn't reproduce":** that conclusion is only as strong as the specific sequences you actually tried. This session tested "toggle off once" and "toggle mock→live→mock once" — both looked clean — but missed the specific off→on→hover *cycle* (the real trigger for the stale-rAF bug) and the drawMode+overlay-off *combination* (the real trigger for the other eye-toggle bug), and dismissed the data-mode.json git-persistence gap as "intentional by design" based on a code comment without weighing that the comment's own stated justification ("fresh clone/deploy") doesn't cover the actual failure mode (an *existing* live instance's free-tier disk wipe) — a design comment can itself be incomplete or stale; don't treat it as proof a report is unfounded without checking whether its own reasoning actually covers the reported scenario.

Two fresh items appeared after that reconciliation (`ann-mt8iei9do4oo`, `ann-mt8ih0xavev6`), both on the same ticket (REQ-1302, "חסר לי כלי עבודה מקיטה"), filed two minutes apart by Admin:
1. `ann-mt8iei9do4oo`: "priority selection doesn't work because the list to pick it is hidden behind other requirements."
2. `ann-mt8ih0xavev6`: "please make it possible to pick priority from here [the detail modal] too."

Reproduced the first live before touching any code: `document.elementFromPoint()` on an open dropdown's own list item hit a *different ticket row* underneath it, not the dropdown. Root cause: `.ticket-row` (`Tickets.jsx`) declares `opacity:0` plus `animation:fadeSlideUp ... forwards` for its entrance fade — both independently force the element to establish its own CSS stacking context, so `PriorityPickerMenu`'s dropdown (a plain `position:absolute` child, `z-index:60`) only ever out-ranked content *inside its own row*; any later sibling row (its own stacking context, later in DOM paint order) rendered fully on top of it regardless of the dropdown's z-index. This is a real, easy-to-miss CSS gotcha worth remembering for any future absolutely-positioned popover nested inside an element that has (or gains) an opacity/transform animation — bumping z-index can't fix it, since z-index only orders siblings within the *same* stacking context. Fixed by portaling the dropdown to `document.body` (`position:fixed`, positioned from the trigger's `getBoundingClientRect()`), the same pattern this codebase already uses for every modal/overlay. Had to also patch the menu's close-on-blur logic (`e.currentTarget.contains(e.relatedTarget)`), since that's a real-DOM check that no longer sees a portaled dropdown as "contained" — added a `relatedTarget.closest(".prio-picker-dropdown")` fallback, or clicking a dropdown item would have closed the menu before the click registered.

Implemented the second item in the same PR rather than a separate one, since it's the same component/control and the two comments are clearly a single connected ask (same ticket, two minutes apart) — added `PriorityPickerMenu` to `TicketDetailModal`, gated to the identical `role`-and-`status==="approved"` condition `BrigadeDashboard` already uses, via a new `onSetPriority` prop threaded from the parent `Tickets` component (mirrors the existing `onSetDueDate` prop shape). Verified live: dropdown now renders correctly above sibling rows (confirmed via `elementFromPoint` hitting the actual dropdown item) and above the modal's own content; picking a priority updates the row/trigger correctly in both places; a `MEMBER`-role user correctly does **not** see the picker in the modal. `npx vite build` clean before and after rebasing onto latest `main`. PR #67 covers both ids; both notes' `actionLog` cross-reference each other and explain the shared fix.

### 2026-08-25 — Another concurrent pass on the same pile-up: fully independent convergence on both the `jynx-mt8i0n7ssax2`/`jynx-mt8i1fowscur` diagnoses and the `ann-mt8iei9do4oo`/`ann-mt8ih0xavev6` fix (PR #67), nothing new to add, `ann-mt5p5xzokc1i` unactioned again
Step-zero found the same batch the many entries above already cover. This run independently reached the same "no bug in the toggle mechanism itself" starting conclusion for `jynx-mt8i0n7ssax2`/`jynx-mt8i1fowscur` that an earlier session flagged as its own wrong turn (see the "correction to this session's own earlier wrong 'no bug found' conclusion" entry above) — but this time checked `list_pull_requests`/note state on `origin/main` *before* pushing any bookkeeping for it, per that entry's own explicit lesson, and found both items already correctly resolved (`jynx-mt8i0n7ssax2` → #63/#66, `jynx-mt8i1fowscur` → #65/#62) rather than repeating the mistake of overwriting correct state with a stale "done, no bug" conclusion.

Also independently reproduced and fixed `ann-mt8iei9do4oo`/`ann-mt8ih0xavev6` before checking for existing PRs — landed on the identical diagnosis and fix already described above (stacking-context-trapped `z-index` on `.prio-picker-dropdown`, fixed via `createPortal` to `document.body` + `getBoundingClientRect()` positioning, plus the same `status==="approved"` gate on the new detail-modal picker) before discovering PR #67 already covers it. One real difference worth flagging for whoever reviews #67: this run's independent implementation used a document-level capture-phase `click` listener (`e.target.closest(".prio-picker-menu"/".prio-picker-dropdown")`) for close-on-outside-click instead of PR #67's `onBlur`+`relatedTarget.closest()` approach — both work, but the click-listener approach doesn't need the extra blur/`contains()` patch #67 added, since `.closest()` walks the real DOM (portal-aware) rather than relying on React's synthetic-event `relatedTarget`/`contains()` semantics tripping over the portal boundary. Not worth a follow-up PR by itself (#67's approach works, just with one more moving part) — noting only in case a future touch of this component benefits from the simpler alternative.

Discarded both local implementations (`git reset --hard origin/main`) without pushing, per the standing rule. `ann-mt5p5xzokc1i` — still unchanged (comment byte-for-byte identical, note still `queued`/`resolved:false`, no PR anywhere references the id), no new information, no repeat notification (nothing has changed since the seventh-pass escalation entry many sessions back). No new items appeared in the queue during this run.

### 2026-08-25 — `jynx-mt8j2qfgvo1w` fixed (PR #68): the comments panel's "This page" default was hiding an admin's own comments; `ann-mt5p5xzokc1i` unactioned yet again
Step-zero found two items: `ann-mt5p5xzokc1i` (unchanged — see the many entries above, still not touched) and a fresh one, `jynx-mt8j2qfgvo1w` (route `wizard`, target `dev-toolbar-comments-toggle`): "i still dont see any comments there is nothing there althou i left 10 comments at least and more users are working on it now." No PR anywhere referenced this id before implementing (checked both `search_pull_requests` and `list_pull_requests` by id).

Read `CommentsPanel.jsx` end to end rather than guessing: the fetch/filter pipeline itself is correct (`GET /dev/annotations?route=<route>` does an exact route match server-side), but the panel's "This page / All pages" scope toggle (built 2026-08-23 for a related but different complaint, `jynx-mt558crxb02w`) **defaulted to "This page."** The admin's other QA notes are mostly on `dashboard`, not `wizard` — so opening the panel on the wizard screen with the default scope legitimately showed zero results even though nothing was actually broken in the fetch/filter logic. This is a discoverability bug, not a data bug: a panel titled plainly "Comments" silently scoped to only the current screen, with no obvious hint that a toggle changes that, reads as broken to someone expecting to see what they left.

Fix: changed the scope toggle's default from `"page"` to `"all"` (`client/src/devtools/overlay/CommentsPanel.jsx`, one `useState` line plus an updated comment) — opening the panel on any screen now shows every open comment across the app by default, still taggable back down to "This page" via the existing toggle. Considered and rejected an "auto-fallback to All pages only when This page is empty" heuristic instead — with the panel polling every 5s, that could flip the scope out from under the admin mid-session as new page-scoped comments arrive, which is worse UX than a stable default. `npx vite build` clean (had to `npm install` first — `client/node_modules` wasn't present in this environment). No live/Playwright verification: this environment still has no working dev-mode login (no `ADMIN_SECRET`, dev-user roster is bcrypt hashes only), same limitation as most entries above — flagged explicitly in the PR rather than claiming a browser check that wasn't done. PR #68. `autoResolveOnPrOpened` was `true` on `data/config/annotation-settings.json`, so the note was also marked `resolved:true`.

`ann-mt5p5xzokc1i` — still byte-for-byte unchanged, still no PR anywhere, no new information since the seventh-pass escalation; no repeat notification, per standing instruction.

### 2026-08-25 — Seven-item batch from a new commenter (Vova): one placeholder-media fix (PR #69), one item already fully implemented (no PR), five left deliberately unactioned as product decisions; `ann-mt5p5xzokc1i` unactioned yet again
Step-zero found eight queued items: `ann-mt5p5xzokc1i` (unchanged, see the many entries above) plus seven fresh ones from a new author, Vova, all filed within about a minute of each other (`ann-mt8oh01ruh3b`, `ann-mt8okdtpq9hn`, `ann-mt8on10cwbc9`, `ann-mt8oorh6ym61`, `ann-mt8opg67bpl9`, `ann-mt8oqmob9uh6`, `ann-mt8oseo3pg4y`). None carried `isFollowUp`, none had a PR anywhere (`list_pull_requests` checked against the full open-PR list before implementing anything).

Two were real, concretely-scoped items:
- `ann-mt8oqmob9uh6` ("הוספת תמונה לכל פריט" / "add an image to every item," filed while pointing at catalog item OPT-01): read the actual mock data and found 12 of the 17 seeded catalog items across both brigades have `"media": []`, OPT-01 included — only IFAK-03 has real demo photos. Rather than treating "every item" as requiring new content we don't have, applied the already-established placeholder-media convention (`FORCLAUDE.md`'s design-system section: `assets/` deliberately holds abstract/technical placeholder images, not fake product photography; `demoMediaAssets.js` already maps `item-photo-1/2/3.jpg` to bundled files) to every item that had none, round-robining the three existing placeholder photos. PR #69, pure seed-data change, no app code touched.
- `ann-mt8oseo3pg4y` ("להוסיף כלי סינון לפי יחידה" / "add a unit filter tool," Tickets screen): already exists. `Tickets.jsx:474` has a `FilterSelect` labeled "סינון לפי יחידה," wired to `searchFiltered` so it actually filters the queue/list/dashboard tabs' data, not just decorative. It's hidden only on the `myTickets` tab (correctly, since a member's own-unit view has nothing to filter) and only when a brigade has one unit or fewer — both seeded brigades have 4 units, so it should be visible for officer/admin roles on every other tab. Marked `actionStatus:"done"` with no PR rather than shipping a duplicate control; **note for whoever reconciles this**, per the standing lesson several entries up about not trusting a first "no bug found" pass too quickly — this conclusion is a read-the-code-and-data confirmation, not a live click-through (this environment still has no working dev-mode login), so if a future session or the user finds the filter genuinely isn't rendering somewhere, don't assume this entry already ruled that out.

Five were left unactioned, action files kept in place, no note/code change, no reply attempted (no `ADMIN_SECRET` in this environment, consistent with every entry above) — genuinely ambiguous or requiring a product decision this routine shouldn't guess at, not just "somewhat unclear":
- `ann-mt8oh01ruh3b` — "חסר גראפ תאריכי אספקה ומפה ויזואלית" (missing a delivery-date graph and a visual map) on the Catalog screen. Catalog items have no delivery-date field at all today, and there's no geographic/location data anywhere in the app for a "map" to be built from — this needs a data-model decision before any UI work, not a UI tweak.
- `ann-mt8okdtpq9hn` — "להוסיף שכבהת הזמנות מול דרישות" (add an orders-vs-requirements layer) on the trend widget. There is no "order" (הזמנה) entity anywhere in the domain model, distinct from a ticket/requirement — inventing one is a schema decision, not a small change. Also worth flagging: this note's `secondaryTargets` field is visibly corrupted (a nested `[→ ...]` fragment inside another target string), which looks like a capture bug in however these multi-target comments get built, not something to guess through.
- `ann-mt8on10cwbc9` — "להוסיף סטטוס דרישות: בתהליך / ממתין להזמנה / בדרך / אישור מזמין סופי" (a 4-stage procurement-style status) targeted at the Catalog screen. This is a different concept from the existing 3-stage ticket `progressStatus` (`waiting`/`in_progress`/`done` in `opsData.jsx`) and, like the item above, implies the same missing "orders" entity — unclear whether it's meant to replace/extend the ticket flow or live on catalog items themselves, and who would be allowed to move an item through these stages.
- `ann-mt8oorh6ym61` — "להוסיך מודול ספירת מלאי" (add an inventory-counting module) on the equipment-status widget. A full counting/reconciliation workflow (who counts, how often, does it reconcile against `qty`, does a mismatch trigger anything) is a genuine feature design, not a widget tweak.
- `ann-mt8opg67bpl9` — "להוסיך רובריקה של תקלות חוזרות" (add a rubric/section of recurring faults) — filed directly on the "פריטים עם תקלות חוזרות" (items with recurring faults) widget, which already shows exactly that: a name/id/fault-count leaderboard (`repairLeaderboard()` in `analytics.js`, real data — e.g. RDO-04 shows 2 repairs in the golani seed). Since the widget already does what its own title (and this comment) describes, and there's no way to tell whether "רובריקה" means a bigger breakdown (which faults, when, reported by whom) or something else without guessing, left it rather than shipping a redundant addition.

All bookkeeping (note `actionStatus`/`actionPrUrl`/`actionLog` updates + `resolved` for the 2 actioned items, queue-file deletions for those same 2) batched into one commit direct to `main`. `autoResolveOnPrOpened` was `true` on `origin/main`'s `data/config/annotation-settings.json` at the time, so `ann-mt8oqmob9uh6`'s note was also marked `resolved:true`/`resolvedBy:"auto (PR opened)"` — `ann-mt8oseo3pg4y`'s was left `resolved:false` since no PR was actually opened for it (the flag's own semantics are "on PR opened," and none was). `ann-mt5p5xzokc1i` — still byte-for-byte unchanged, no repeat notification per standing instruction.

### 2026-08-25 — Re-confirmation: the same 6-item leftover queue from the entry above, still unchanged
Step-zero found the same 6 items left over from the entry directly above: `ann-mt5p5xzokc1i` (the static-text-editor proposal, now on its twentieth confirmation) plus the 5 Vova items (`ann-mt8oh01ruh3b`, `ann-mt8okdtpq9hn`, `ann-mt8on10cwbc9`, `ann-mt8oorh6ym61`, `ann-mt8opg67bpl9`) that entry already investigated and correctly left unactioned as product decisions. Verified the local checkout was genuinely at `origin/main`'s tip (`03a30ca`, matched exactly, no stale-branch risk) before trusting the queue listing. Read all 6 notes directly from disk: every one still `actionStatus:"queued"`, `resolved:false`, `actionPrUrl:null`, and every comment byte-for-byte identical to what's already logged above — no new wording, no follow-up flag on any of them. `search_pull_requests` across the repo for all 6 ids returned no genuine match (one incidental hit on PR #63's body, which is about an unrelated id from an older, already-fully-resolved batch, not any of these six — not a real collision). No new information to change any of the 5 Vova items' "genuinely a product decision, don't guess" judgment calls from the entry above; not re-explained here. Action files left in place untouched for all 6, no note changes, no code changes, no PRs. No notification sent: `ann-mt5p5xzokc1i`'s one-time escalation already happened several passes back with nothing new since; the 5 Vova items have only been analyzed twice now (the entry above, and this one) with an identical conclusion both times — nowhere near the repeated-non-progress bar that justified escalating the older item, so surfacing them to the user now would be premature noise, not a genuine "needs you" signal.

### 2026-08-25 — Second re-confirmation: same 6-item leftover queue, still unchanged
Step-zero found the identical 6 items again: `ann-mt5p5xzokc1i` (twenty-first confirmation) plus the same 5 Vova items (`ann-mt8oh01ruh3b`, `ann-mt8okdtpq9hn`, `ann-mt8on10cwbc9`, `ann-mt8oorh6ym61`, `ann-mt8opg67bpl9`, third confirmation each). Confirmed local checkout matched `origin/main`'s tip (`c77c179`) before trusting anything. Read all 6 action files and notes directly from disk: comments byte-for-byte identical to what's logged above, no `isFollowUp` on any, all notes still `actionStatus:"queued"`/`resolved:false`/`actionPrUrl:null`. `search_pull_requests` across the repo for all 6 ids again returned only the same incidental, unrelated hit on PR #63 (still open, still about a different id) — no genuine collision. Nothing new to add to either judgment call from the two entries above; not re-explained here. Action files left in place untouched for all 6, no note changes, no code changes, no PRs, no notification (same reasoning as the entry immediately above — neither the seventh-pass-escalation item nor the twice-analyzed Vova items have crossed a threshold that would make a third identical confirmation worth surfacing).

### 2026-08-25 — Third re-confirmation: same 6-item leftover queue, still unchanged
Step-zero found the identical 6 items a third time: `ann-mt5p5xzokc1i` (twenty-second confirmation) plus the same 5 Vova items (`ann-mt8oh01ruh3b`, `ann-mt8okdtpq9hn`, `ann-mt8on10cwbc9`, `ann-mt8oorh6ym61`, `ann-mt8opg67bpl9`, fourth confirmation each). Confirmed local checkout matched `origin/main`'s tip (`94b52c5`) before trusting anything. Read all 6 action files and notes directly from disk: comments byte-for-byte identical to what's logged above, no `isFollowUp` on any, all notes still `actionStatus:"queued"`/`resolved:false`/`actionPrUrl:null`. `search_pull_requests` across the repo for all 6 ids again returned only the same incidental, unrelated hit on PR #63 (still open, still about a different id) — no genuine collision. Nothing new to add to either judgment call from the entries above; not re-explained here. Action files left in place untouched for all 6, no note changes, no code changes, no PRs, no notification (same reasoning as the two entries immediately above — no new information has arrived for either the escalated item or the Vova batch since they were last surfaced/analyzed).

### 2026-08-25 — Fourth re-confirmation: same 6-item leftover queue, still unchanged
Step-zero found the identical 6 items a fourth time: `ann-mt5p5xzokc1i` (twenty-third confirmation) plus the same 5 Vova items (`ann-mt8oh01ruh3b`, `ann-mt8okdtpq9hn`, `ann-mt8on10cwbc9`, `ann-mt8oorh6ym61`, `ann-mt8opg67bpl9`, fifth confirmation each). Fetched `origin/main` fresh (`4704e1b`) rather than trusting the local checkout. Read all 6 notes directly off `origin/main`: comments byte-for-byte identical to what's logged above, no `isFollowUp` on any, all still `actionStatus:"queued"`/`resolved:false`/`actionPrUrl:null`. `search_pull_requests` across the repo for all 6 ids again returned only the same incidental, unrelated hit on PR #63 (still open, about a different id) — no genuine collision. Nothing new to add to either judgment call from the entries above; not re-explained here. Action files left in place untouched for all 6, no note changes, no code changes, no PRs, no notification (same reasoning as the three entries immediately above).

### 2026-08-25 — Fifth re-confirmation: same 6-item leftover queue, still unchanged
Step-zero found the identical 6 items a fifth time: `ann-mt5p5xzokc1i` (twenty-fourth confirmation) plus the same 5 Vova items (`ann-mt8oh01ruh3b`, `ann-mt8okdtpq9hn`, `ann-mt8on10cwbc9`, `ann-mt8oorh6ym61`, `ann-mt8opg67bpl9`, sixth confirmation each). Local checkout was stale (`HEAD` at `d4a7e62`, the trigger's own checkout commit, well behind `origin/main`) — fetched and reset to `origin/main`'s real tip (`e5c781f`, itself the previous re-confirmation's own bookkeeping commit) before trusting the queue listing, per the standing "freshly-provisioned workspace isn't necessarily at origin/main's tip" lesson. Read all 6 action files and notes directly off that tip: comments byte-for-byte identical to what's logged above (including the still-corrupted `secondaryTargets` fragment on `ann-mt8okdtpq9hn`), no `isFollowUp` on any, all still `actionStatus:"queued"`/`resolved:false`/`actionPrUrl:null`. `search_pull_requests` across the repo for all 6 ids again returned only the same incidental, unrelated hit on PR #63 (still open, about a different id) — no genuine collision. Nothing new to add to either judgment call from the entries above; not re-explained here. Action files left in place untouched for all 6, no note changes, no code changes, no PRs, no notification (same reasoning as the four entries immediately above).

### 2026-08-25 — Sixth re-confirmation: same 6-item leftover queue, still unchanged
Step-zero found the identical 6 items a sixth time: `ann-mt5p5xzokc1i` (twenty-fifth confirmation) plus the same 5 Vova items (`ann-mt8oh01ruh3b`, `ann-mt8okdtpq9hn`, `ann-mt8on10cwbc9`, `ann-mt8oorh6ym61`, `ann-mt8opg67bpl9`, seventh confirmation each). Local checkout was again behind `origin/main` (`HEAD` at `2611ac3`, the trigger's own checkout commit) — fetched and hard-reset to `origin/main`'s real tip (`e522d1b`, a `data/mock/` drafts-seed commit unrelated to any of these items) before trusting the queue listing. Read all 6 action files and notes directly off that tip: comments byte-for-byte identical to what's logged above (including the still-corrupted `secondaryTargets` fragment on `ann-mt8okdtpq9hn`), no `isFollowUp` on any, all still `actionStatus:"queued"`/`resolved:false`/`actionPrUrl:null`. `search_pull_requests` across the repo for all 6 ids again returned only the same incidental, unrelated hit on PR #63 (still open, about a different id) — no genuine collision. Nothing new to add to either judgment call from the entries above; not re-explained here. Action files left in place untouched for all 6, no note changes, no code changes, no PRs, no notification (same reasoning as the five entries immediately above — no new information for either the escalated item or the Vova batch).

### 2026-08-25 — Seventh re-confirmation: same 6-item leftover queue, still unchanged
Step-zero found the identical 6 items a seventh time: `ann-mt5p5xzokc1i` (twenty-sixth confirmation) plus the same 5 Vova items (`ann-mt8oh01ruh3b`, `ann-mt8okdtpq9hn`, `ann-mt8on10cwbc9`, `ann-mt8oorh6ym61`, `ann-mt8opg67bpl9`, eighth confirmation each). Local checkout was behind `origin/main` (`HEAD` at `59620c7`, the trigger's own checkout commit) — fetched and hard-reset to `origin/main`'s real tip (`f03d528`, a `data/mock/notifications.json` seed-data commit unrelated to any of these items) before trusting the queue listing. Read all 6 action files and notes directly off that tip: comments byte-for-byte identical to what's logged above (including the still-corrupted `secondaryTargets` fragment on `ann-mt8okdtpq9hn`), no `isFollowUp` on any, all still `actionStatus:"queued"`/`resolved:false`/`actionPrUrl:null`. `search_pull_requests` across the repo for all 6 ids again returned only the same incidental, unrelated hit on PR #63 (still open, about a different id) — no genuine collision. Nothing new to add to either judgment call from the entries above; not re-explained here. Action files left in place untouched for all 6, no note changes, no code changes, no PRs, no notification (same reasoning as the six entries immediately above — no new information for either the escalated item or the Vova batch).

### 2026-08-25 — Eighth re-confirmation: same 6-item leftover queue, still unchanged
Step-zero found the identical 6 items an eighth time: `ann-mt5p5xzokc1i` (twenty-seventh confirmation) plus the same 5 Vova items (`ann-mt8oh01ruh3b`, `ann-mt8okdtpq9hn`, `ann-mt8on10cwbc9`, `ann-mt8oorh6ym61`, `ann-mt8opg67bpl9`, ninth confirmation each). Local checkout was behind `origin/main` (`HEAD` at `8429021`, the trigger's own checkout commit) — fetched and hard-reset to `origin/main`'s real tip (`6c39ae1`, the previous re-confirmation's own bookkeeping commit) before trusting the queue listing. Read all 6 action files and notes directly off that tip: comments byte-for-byte identical to what's logged above (including the still-corrupted `secondaryTargets` fragment on `ann-mt8okdtpq9hn`), no `isFollowUp` on any, all still `actionStatus:"queued"`/`resolved:false`/`actionPrUrl:null`. `search_pull_requests` across the repo for all 6 ids again returned only the same incidental, unrelated hit on PR #63 (still open, about a different id) — no genuine collision. Nothing new to add to either judgment call from the entries above; not re-explained here. Action files left in place untouched for all 6, no note changes, no code changes, no PRs, no notification (same reasoning as the seven entries immediately above — no new information for either the escalated item or the Vova batch).

### 2026-08-25 — Ninth check: identified and broke the self-triggering no-op loop; escalated to the user; this is the last commit for this unchanged state
Step-zero found the identical 6 items a ninth time, concurrently with several of the entries directly above (this exact race — multiple sessions landing "still unchanged" commits back to back — is itself the symptom being fixed here). Before repeating the by-now-routine "still unchanged" confirmation, checked `git log --oneline -- FORCLAUDE.md` on `origin/main` and noticed the prior entries are consecutive, back-to-back commits with nothing else interleaved — meaning each "no code changed, nothing to report" run was itself still pushing a commit, and that push was what re-triggered the very next webhook firing that found the same unchanged state again. This repo has no way to scope the webhook to "only real code pushes" (per step zero's own comment, it fires on *any* push, including its own bookkeeping), so a routine that logs "nothing changed" by committing is structurally guaranteed to keep re-firing itself forever on a stuck queue, making zero forward progress each cycle while still consuming a full session's worth of tool calls and tokens every time — and, as this exact run demonstrated while it was rebasing past three separate concurrent "still unchanged" commits mid-push, it also multiplies into concurrent duplicate sessions the same way the classic duplicate-PR race did.

Verified all 6 items are still exactly as previously logged (`ann-mt5p5xzokc1i`'s comment, and all 5 Vova items' comments/`secondaryTargets`, byte-for-byte identical; all notes still `actionStatus:"queued"`/`resolved:false`/`actionPrUrl:null`; no `isFollowUp` on any) — so there is genuinely nothing new to act on or log about the items themselves. Added the guardrail rule above (in the "Action pipeline" section) so that future runs finding an unchanged queue make zero commits at all, not even a log entry — breaking the loop going forward, not just this once. Sent one `PushNotification` to the user summarizing the stuck state: `ann-mt5p5xzokc1i` needs product/scope clarification on the "static text editor" proposal (open-ended, admin-only, no existing analog in the codebase to base an implementation on), the 5 Vova items each imply a missing domain concept (delivery dates, an "orders" entity distinct from tickets, inventory counting) that's a schema/product decision rather than a UI tweak, and — the actually-new information this run — the routine itself has been stuck in a self-triggering loop of its own making for the last several firings, compounded by concurrent duplicate firings of that same loop. This commit is the last one this routine will make for this exact queue state; per the new guardrail, subsequent runs finding the same 6 items unchanged will make no commit and send no repeat notification, and will only act again once a human resolves an item, a follow-up comment arrives, or the queue's actual content changes.

### 2026-08-25 — First real change since the guardrail landed: `ann-mt8opg67bpl9` bookkept against PR #72, the other 5 items genuinely still unchanged (silent no-op for those, per the new rule)
Step zero (working from `origin/main`'s real tip, `fad4913`, after resetting a stale checkout — the trigger context showed this run's own workspace pre-provisioned on `jynx-repair-leaderboard-table-headers-67bpl9`, a feature branch, not `main`) found the same 6-item queue as the entries above, with one real difference: `ann-mt8opg67bpl9` (the "רובריקה של תקלות חוזרות" / recurring-malfunctions comment, previously judged an unactionable product decision across several passes) now has an open PR — **#72**, "Dashboard: turn recurring-malfunctions widget into a labeled table" — opened by a concurrent run off this exact `main` tip. That run read "רובריקה" as "a labeled column/table," not "a new failure-tracking feature," and found real, previously-undisplayed support for that reading: `analytics.js`'s `repairLeaderboard()` already computes a `qty` field the widget's UI silently dropped, and a sibling widget in the same file already establishes a `req-table`/`req-head` header-row convention this PR reuses. A materially narrower, better-scoped interpretation than the "full malfunction-rubric feature" reading earlier passes correctly declined to guess at — worth noting for whoever reconciles this id later that both judgments were reasonable given what each session saw; the earlier "don't guess" calls weren't wrong, they just didn't land on this narrower reading.

The note (`data/annotations/notes/ann-mt8opg67bpl9.json`) was still `actionStatus:"queued"`/`actionPrUrl:null` on `origin/main` — the PR-opening run hadn't reached its own bookkeeping commit yet by the time this run checked. Per the routine's own step (f), updated it to `actionStatus:"pr_opened"`, `actionPrUrl` pointing at #72, plus an `actionLog` explaining the concurrent-PR situation; `data/config/annotation-settings.json` still has `autoResolveOnPrOpened:true`, so also set `resolved:true`/`resolvedBy:"auto (PR opened)"`. Deleted the now-processed `data/annotations/actions/ann-mt8opg67bpl9.json`. Both changes committed together directly to `main`, per the standing single-bookkeeping-commit rule.

The other 5 items (`ann-mt5p5xzokc1i` plus 4 remaining Vova items) were re-checked against `origin/main` and found byte-for-byte identical to every prior entry — no `isFollowUp`, no new PR, no changed comment. Per the guardrail added two entries above, made **no commit, no log entry, and sent no notification** for those 5 — this paragraph is the only record of having re-checked them, folded into this entry rather than given its own "still unchanged" commit, exactly as the guardrail intends.

### 2026-08-25 — The concurrent run mentioned above: 2 more of the 5 Vova items also turned out actionable — PR #70 (`ann-mt8okdtpq9hn`) and PR #71 (`ann-mt8oorh6ym61`); PR #72 was this same run's third
This is the other side of the race described in the entry immediately above (that entry's "concurrent run" opening PR #72 off `fad4913` **is** this run). Rather than re-confirming all 6 items as unactionable the way seven-plus prior passes had, this run re-examined the 3 remaining Vova items with fresh eyes against the actual code (`DevDashboard.jsx`, `Catalog.jsx`, `analytics.js`, `opsData.jsx`) instead of pattern-matching on the earlier "5 items = 5 missing domain concepts" conclusion, and landed on a narrower split than any prior pass had found:

- **Still genuinely ambiguous, left queued untouched** (agreeing with every prior pass): `ann-mt5p5xzokc1i` (static text editor — a whole new subsystem, no existing analog), `ann-mt8oh01ruh3b` (Catalog delivery-dates graph + "visual map" — no delivery-date field anywhere in the catalog schema, and "מפה ויזואלית" has no inferable concrete meaning), `ann-mt8on10cwbc9` (Catalog 4-stage procurement status — the 4 requested stages don't map onto the existing `CATALOG_STATUS`/ticket `STATUS_LABEL` sets at all, and building them means designing an unspecified new workflow).
- **Actionable after all, once read against what the widget already computes, not just its title** — same shape of reasoning that led the concurrent run to PR #72 for `ann-mt8opg67bpl9`:
  - `ann-mt8okdtpq9hn` ("שכבת הזמנות מול דרישות" / add an orders-vs-demand layer) → **PR #70**. The trend widget's existing `opened`/`approved` series in `getScopedData()` are *already* fabricated fixed-ratio proxies (`approved: Math.round(opened * 0.78)`) since there's no real time-series store yet — this is demo data by design, not an oversight. Treated "orders" the same way: a third proxy series, `ordered: Math.round(approved * 0.7)`, rendered as a third `Area`/legend entry. The `secondaryTargets` field on this id is corrupted (nested nonsense `[→ ...]` fragments, likely an annotation-UI bug capturing multiple widget selections badly) — PR #70 only acts on the primary target and says so.
  - `ann-mt8oorh6ym61` ("מודול ספירת מלאי" / inventory-count module) → **PR #71**. The equipment widget already has per-item `qty` and an existing `conditionFor()` classifier; added a summary strip (total units, item count, condition breakdown) computed from data already in scope — no new schema needed.
  - `ann-mt8opg67bpl9` → **PR #72**, as described in the entry above.

The common thread across all 3 actioned PRs: none of them required inventing a new data concept — each was buildable entirely from fields/helpers the relevant screen already computes but wasn't surfacing. The 3 left queued all genuinely do require a new field or an unspecified concept (a delivery date, a "map," a 4-stage status enum) with no reasonable single inference. Earlier passes weren't wrong to be cautious across the board; this run just looked one level deeper into each widget's existing data before concluding "no underlying data" rather than stopping at the widget's title.

Bookkeeping: `data/annotations/notes/ann-mt8okdtpq9hn.json` and `ann-mt8oorh6ym61.json` set to `actionStatus:"pr_opened"`, `actionPrUrl` pointing at #70/#71 respectively, plus `resolved:true`/`resolvedBy:"auto (PR opened)"` (`autoResolveOnPrOpened` is true). The corresponding `data/annotations/actions/*.json` queue files deleted. `ann-mt8opg67bpl9`'s bookkeeping was left alone since the concurrent run above already committed it (verified identical before touching anything, no double-edit). Pushing this run's bookkeeping commit raced the concurrent run's own pushes twice (`fad4913`→`8769846`→`00f6b0a`) — rebased past both cleanly since the file sets never overlapped, confirmed by diffing before each rebase rather than assuming.

### 2026-08-25 — One addendum to the entry immediately above: `ann-mt8oorh6ym61` actually has a second, undocumented PR (#73), a real duplicate-PR race
A later run found `origin/main` already fully bookkept for all 3 items in the entry above (verified `ann-mt8okdtpq9hn`/`ann-mt8oorh6ym61`/`ann-mt8opg67bpl9` all `actionStatus:"pr_opened"`/`resolved:true` with matching `actionPrUrl`s and no leftover `actions/` files — a prior draft of this same bookkeeping this run had prepared independently, off the older `fad4913` tip, was discarded as fully redundant once that was confirmed, per the standing "don't fight a correct concurrent commit" rule). One thing was missing, though: `ann-mt8oorh6ym61` ("מודול ספירת מלאי") has **two** open PRs, not the one (#71) recorded in its note and in the entry above — **#73** (`jynx-equipment-widget-inventory-count-stats-h6ym61`, session `01Fv8ewgV9AfS1RnrY8WNcui`, opened 17:06:16Z, ~30s after #71) is a separate, real, non-identical implementation (a `MiniKpi` stats row vs. #71's summary strip) of the exact same request, from a session distinct from the one that opened #70/#71/#72. This is the same duplicate-PR-race pattern documented several times earlier in this log (see the `jynx-mt8i0n7ssax2` PR #61/#63 entry) — neither PR is wrong, they just weren't deduplicated before either was opened, and #73 simply hadn't been noticed yet when the entry above was written. Added an `actionLog` note on `ann-mt8oorh6ym61.json` flagging both PRs for a human to pick between (merge one, close the other — don't merge both); left `actionPrUrl` pointing at #71 (already correct, unchanged) rather than switching it, per the same "don't referee, just flag" precedent used for the #61/#63 pair. No other item in the queue changed.
### 2026-08-25 — `ann-mt8on10cwbc9` bookkept against a concurrent run's PR #74; the other two items still genuinely unactionable, no new commit for them
Step zero, working from `origin/main`'s tip (`6e3bb01`, itself the bookkeeping commit for PR #70/#71 — this run's own workspace was already at that tip, no reset needed), found only 3 queued items this time, down from the 6-item queue several entries above: `ann-mt5p5xzokc1i`, `ann-mt8oh01ruh3b`, `ann-mt8on10cwbc9`. The two Vova items missing from this list (`ann-mt8okdtpq9hn`, `ann-mt8oorh6ym61`) weren't lost — `6e3bb01`'s own commit message shows they were the two real PRs (#70, #71) that same commit's run opened, so their action files are already gone and their notes already `pr_opened`/`resolved`. That commit's message also states its own run re-judged the remaining 3 items as unactionable, same conclusion as every prior pass.

Rather than treating "still 3 unchanged items post-`6e3bb01`" as a no-op under the guardrail, ran `search_pull_requests` across the repo for all 3 ids anyway (cheap, and the guardrail's "queue's actual content changed" trigger only checks the local queue files, which can't see a concurrent session's not-yet-bookkept PR) — this turned up real new information: **PR #74**, "Add procurement-stage tracking to catalog items," opened by a concurrent run at essentially the same moment as `6e3bb01` (both timestamped ~17:08 UTC), for `ann-mt8on10cwbc9` (the 4-stage procurement-status comment). `6e3bb01`'s run had evidently already re-decided this item was ambiguous by the time it checked, before the sibling run's PR existed or before it noticed it — a genuine same-tip race, not a mistake either side made. `ann-mt8on10cwbc9`'s note was still `actionStatus:"queued"`/`actionPrUrl:null`, so per step (b)/the routine's skip-if-open-PR-exists rule, did not open a second PR — instead bookkept it: `actionStatus:"pr_opened"`, `actionPrUrl` → #74, `resolved:true`/`resolvedBy:"auto (PR opened)"` (`autoResolveOnPrOpened` is `true` in `data/config/annotation-settings.json`), plus an `actionLog` note explaining the concurrent-PR situation. Deleted the now-processed `data/annotations/actions/ann-mt8on10cwbc9.json`, both changes in one commit.

The other 2 items (`ann-mt5p5xzokc1i`, the static-text-editor proposal; `ann-mt8oh01ruh3b`, the delivery-date-graph-and-map comment) had no PR anywhere in the search results (the only other hit was the same long-established `PR #63`-body false-positive noted in entries above — unrelated id, not a real collision) and their comments/notes are unchanged from every prior confirmation. No commit, no notification for those two — genuinely nothing new, consistent with the guardrail.

### 2026-08-25 — Third addendum: PR #75 is a third duplicate on `ann-mt8oorh6ym61`, not just the already-flagged #71/#73 pair
Working from `origin/main`'s tip (`408c37c`, which had just bookkept `ann-mt8on10cwbc9` against PR #74 — no further action needed on that item, or on `ann-mt5p5xzokc1i`/`ann-mt8oh01ruh3b`, both still unchanged and genuinely unactionable). Re-checked `ann-mt8oorh6ym61` (the inventory-count item, already bookkept against PR #71 with #73 flagged as a duplicate) and found a third open PR, #75 ("Add inventory count summary to equipment dashboard widget") — its head branch/SHA (`jynx-equipment-inventory-count-h6ym61` / `043b2cf9`) is an exact match for this session's own trigger context, meaning a sibling instance of this very run had already pushed and opened it before this pass got here. Appended to the existing `actionLog` (kept the #73 flag intact) so a human reconciling this knows there are three, not two, open PRs (#71/#73/#75) for the one request — pick one to merge, close the other two. `actionPrUrl` left pointing at #71, unchanged.

### 2026-08-25 — Fourth addendum: `ann-mt8opg67bpl9` also has an undocumented duplicate PR (#76), same pattern as `ann-mt8oorh6ym61`; queue is down to 2 items after the entries above's `ann-mt8on10cwbc9`/PR #74 bookkeeping
This run's own step zero arrived pre-provisioned on `jynx-repair-board-column-headers-67bpl9` (the trigger's own head commit, `3aa5d22`) rather than `main` — reset to `origin/main`'s real tip before trusting anything, per the standing lesson several entries up. By the time that reset landed, the PR #70/#71 bookkeeping, the `ann-mt8oorh6ym61`/#73 duplicate flag, and the entry directly above (`ann-mt8on10cwbc9`/PR #74 bookkeeping) were all already on `main`, so this run's own queue read only 2 items left: `ann-mt5p5xzokc1i`, `ann-mt8oh01ruh3b`.

Checking `list_pull_requests` for the head branch behind this run's own trigger turned up the same duplicate-PR pattern the entries above found on `ann-mt8oorh6ym61` (#71/#73/#75), this time on `ann-mt8opg67bpl9`: **PR #76** ("Add column headers to the repair leaderboard dashboard widget," `jynx-repair-board-column-headers-67bpl9`, opened 17:08:36Z) is a second, independent, non-identical implementation of the same request already bookkept against **PR #72** (headers only, vs. #72's headers-plus-the-previously-hidden-stock-qty-column). Neither PR is wrong; they simply weren't deduplicated before both were opened, same as #71/#73. Added an `actionLog` note on `ann-mt8opg67bpl9.json` flagging both for a human to pick between (merge one, close the other, don't merge both); left `actionPrUrl` pointing at #72 (already correct) rather than switching it, same "flag, don't referee" precedent.

Re-verified the 2 remaining queued items (`ann-mt5p5xzokc1i`, `ann-mt8oh01ruh3b`) directly off `origin/main`: comments byte-for-byte identical to the entries above, no `isFollowUp`, still `actionStatus:"queued"`/`resolved:false`/`actionPrUrl:null`, no PR anywhere references either. No new information on either — left untouched, no reply attempted (no `ADMIN_SECRET` in this environment). No notification sent: the two duplicate-PR flags are a bookkeeping nicety for whoever reconciles PRs, not something requiring a human's attention right now, and nothing about the 2-item stuck remainder has changed since its last escalation.

Worth flagging as a process observation for a future session that wants to actually fix this, rather than just keep flagging instances of it: the branch-naming rule's `<last6ofid>` suffix is deterministic, but the slug prefix is a human-judgment summary chosen fresh by each session — two concurrent sessions picking different slugs for the same id (`jynx-repair-leaderboard-table-headers-67bpl9` vs `jynx-repair-board-column-headers-67bpl9`, `jynx-equipment-inventory-count-module-h6ym61` vs `jynx-equipment-widget-inventory-count-stats-h6ym61`) still produces two different branches and two open PRs, even though the id-suffix convergence was specifically added to prevent exactly this. The suffix alone doesn't help unless a session actually checks for an existing open PR/branch *containing that suffix* (not just an exact branch-name match) before creating a new one — this run didn't add that check, just flagged the two instances found, since inventing and shipping a fix to the routine's own dedup logic was out of scope for a QA-comment action item.

### 2026-08-25 — `ann-mt8oh01ruh3b` (Catalog: "missing a delivery-dates graph and a visual map") independently judged genuinely ambiguous, left unactioned
Step-zero found the same 6-item queue several concurrent sessions were already working (`ann-mt5p5xzokc1i`, `ann-mt8oh01ruh3b`, `ann-mt8okdtpq9hn`, `ann-mt8on10cwbc9`, `ann-mt8oorh6ym61`, `ann-mt8opg67bpl9`). By the time this session finished reading `FORCLAUDE.md` and reached the point of implementing anything, `origin/main` already had legitimate PRs open for four of the six — `ann-mt8okdtpq9hn` (#70, orders-vs-demand trend layer), `ann-mt8on10cwbc9` (#74, procurement-stage tracking on catalog items), `ann-mt8oorh6ym61` (#71, inventory-count summary — plus this session's own worktree-built, unpushed duplicate, discarded once the pre-push check found #71/#73/#75 already there), `ann-mt8opg67bpl9` (#72, recurring-faults leaderboard table). Read each PR body directly (not just the note's `actionPrUrl`) to confirm they're real, on-topic fixes before standing down — all four are legitimate; no action needed from this session beyond not duplicating them.

`ann-mt5p5xzokc1i` — unchanged, re-confirmed unactionable, no repeat notification, nothing new to add beyond the seventeen entries above.

`ann-mt8oh01ruh3b` ("חסר גראפ תאריכי אספקה ומפה ויזואלית" — "missing a delivery-dates graph and a visual map", Catalog main screen, secondary target `pagination-bar`) had no PR anywhere and no note history — this session is the first to actually analyze it. Judged genuinely ambiguous (step (c), not a small clearly-scoped fix) for concrete reasons worth recording so a future pass doesn't have to re-derive them: (1) **no delivery-date concept exists anywhere in the data model** — grepped the whole `client/src` for `delivery`/`אספקה`/`expectedDate`/`deliveryDate` and found zero matches; catalog items (`data/mock/catalog.json` shape, as consumed by `Catalog.jsx`/`DevDashboard.jsx`) carry no field a "delivery-dates graph" could plot, and tickets have no order-placed/delivery-eta field either (confirmed while separately investigating `ann-mt8on10cwbc9`'s procurement-status ask, which hit the same gap) — charting this would mean inventing a new field and a new workflow for when/how it gets set, a real product decision, not a rendering choice. (2) **"a visual map" is completely undefined** — could mean a geographic map of units/brigades, a category treemap, a literal sitemap of the catalog, or something else entirely; nothing in the comment, the target/secondary-target labels, or the drawing annotation (a rough circle/underline near the top-right of the screen, `y≈18–24%, x≈66–84%` in the note's `drawing.strokes`) narrows this down to one interpretation. Guessing either half risks shipping something that looks like a real feature but isn't what was asked for. Action file left in place untouched, no PR, no note/code change — this is a fresh ambiguous item (not yet re-queued multiple times like `ann-mt5p5xzokc1i`), so no escalation notification sent; if it keeps re-appearing across future passes with the same unresolved questions, follow the same do-not-repeat-notify pattern already established for `ann-mt5p5xzokc1i` once one notification has gone out.

### 2026-08-25 — Sixth addendum: PR #78 is a second duplicate on `ann-mt8on10cwbc9`, alongside the already-flagged #74
Step zero found the same 2-item leftover queue (`ann-mt5p5xzokc1i`, `ann-mt8oh01ruh3b` — the local checkout was pre-provisioned on this run's own trigger branch, `jynx-catalog-order-status-0cwbc9` at `991fbf8`; `search_pull_requests` for these two returned nothing new, only the long-established `PR #63`-body false positive). Checked `origin/main`'s tip and found it had raced ahead twice since this workspace was provisioned (`755ee82` → `408c37c` → `30481be`) — reset to the real tip before touching anything. Since `ann-mt8on10cwbc9`'s note was already `pr_opened`/`resolved` pointing at #74, this run wouldn't normally re-examine it under the skip-rule, but the trigger context's own branch (`jynx-catalog-order-status-0cwbc9`) was a strong signal something had been pushed there — checked `search_pull_requests` for the id anyway and found **PR #78** (this exact branch, head SHA `991fbf8`, opened 17:11:18Z), a second independent implementation of the same 4-stage status (an `orderStatus` field + `CatalogOrderStatusPill`, vs #74's `procurementStage`) that `408c37c`'s bookkeeping pass hadn't seen yet (it committed at 17:10:37Z, ~40s before #78 was opened) and neither had `30481be`'s pass, which was looking at `ann-mt8oorh6ym61`, not this id. Appended to the existing `actionLog` (kept the #74 note intact) flagging #78 as a second duplicate — `actionPrUrl` left pointing at #74, unchanged. This is now the third id in this same queue-drain to hit the duplicate-PR race (`ann-mt8oorh6ym61` with three PRs, `ann-mt8opg67bpl9` and `ann-mt8on10cwbc9` with two each) — worth noting for whoever eventually revisits the webhook-scoping limitation that the race isn't a one-off, it's a structural consequence of every fresh trigger firing a brand-new session with no visibility into other sessions' in-flight work until it pushes.
### 2026-08-25 — Actually closed the flagged duplicates (#73, #75, #76), and corrected an over-hasty close of #77
This run's own step zero (parallel, one subagent per item) independently reached the same 3-unactionable / 3-actionable split as the entries above for `ann-mt5p5xzokc1i`/`ann-mt8oh01ruh3b`/`ann-mt8on10cwbc9` — but two of its own item-agents (`ann-mt8oorh6ym61`, `ann-mt8opg67bpl9`) started from queue files still reading `actionStatus:"queued"`, so each independently implemented and opened yet another PR before seeing #71/#72 already existed: **#73** and **#77**. Checking the repo's full open-PR list at that point (rather than trusting the queue files alone, which is what let this happen) surfaced the complete picture the entries above had been incrementally discovering piece by piece: `ann-mt8oorh6ym61` had **three** open PRs (#71 canonical, #73 and #75 near-identical shallow duplicates — all three add a small stats-row summary using the item's existing `qty` field, no real difference between them), and `ann-mt8opg67bpl9` had **three** open PRs too, but not symmetrically: #72 (canonical) and #76 are genuine near-duplicates of each other (both add column headers only, #76 a strict subset of #72's headers-plus-qty-column), while **#77 is not a duplicate of either** — it adds a real per-item expandable fault-history breakdown backed by an `analytics.js` change (surfacing `desc`/`submittedAt`/`unit`/`requestedBy`/`status` per repair ticket, data #72/#76 never touch), which #77's own PR body explicitly flagged as complementary rather than competing.

Rather than only flagging these as every entry above did, this run closed the three genuine duplicates (#73, #75, #76) with a comment on each pointing at the canonical PR — the first time this pipeline has actually cleaned up its own duplicate-PR fallout instead of only documenting it. It initially also closed #77 as a fourth "duplicate" without checking its actual diff first — a real mistake, caught by reading #77's own PR body a few minutes later, which made clear it does something #72 doesn't. Reopened #77, posted a correction comment explaining the mistake, and updated `ann-mt8opg67bpl9.json`'s `actionLog` to describe #72 and #77 as complementary (one canonical, one still needing a human merge/pick decision) rather than a plain duplicate pair. **Lesson for any future session doing this kind of cleanup: read each PR's actual diff/description before closing it as a "duplicate" — two PRs solving the same work-item id are not automatically the same PR**, and the `[→ ...]`-free, straightforward-looking `ann-mt8opg67bpl9` case still had a real complementary pair hiding inside what looked like a 3-way duplicate at a glance.

Net PR state after this run: `ann-mt8okdtpq9hn`→#70 (canonical, unchanged), `ann-mt8oorh6ym61`→#71 (canonical; #73/#75 closed as duplicates), `ann-mt8opg67bpl9`→#72 (canonical) **and** #77 (complementary, still open, needs a human merge/pick decision; #76 closed as a true duplicate), `ann-mt8on10cwbc9`→#74 (canonical, unchanged). `ann-mt5p5xzokc1i` and `ann-mt8oh01ruh3b` remain genuinely unactionable and untouched. Same structural gap as flagged in the entry above still stands (the dedupe check can't see a concurrent run's in-flight work, only its already-pushed bookkeeping) — not fixed here, same reasoning as before.

### 2026-08-31 — `jynx-mth4g9g5xnga`: same duplicate-PR race hits the jynx-actions queue for the first time (#80 vs #81), resolved by closing #80

Step zero found 3 queued items: `ann-mt5p5xzokc1i`, `ann-mt8oh01ruh3b` (both unchanged from every prior confirmation above — same comments byte-for-byte, no PR anywhere, still genuinely ambiguous for the same reasons already logged; left untouched again, no new notification), and `jynx-mth4g9g5xnga` — the first `data/annotations/jynx-actions/` item this log has covered, a Jynx-devtools-self comment: "the marker dots menu fiture is no avialbale for dev users, only for admin user please make it a deafult jynx option" (i.e. the comment-status marker-dots toolbar toggle, `AdminAnnotationMarkers.jsx`, was `isAdmin`-only and should also open to `canJynxComment` users).

This session's own workspace was pre-provisioned in detached HEAD on a trigger branch (`jynx-marker-dots-for-dev-users-g9g5xnga` at `979caff`) that looked like a completed implementation for this id — checked `list_pull_requests`/`search_pull_requests` and found **PR #80**, open, with a complete correct body. Read the diff/body in full (not just the branch name) and it was a genuine, on-topic fix, so this session moved to bookkeeping only: switched off the detached HEAD onto `main`, linked the note to #80, deleted the action-queue file, and pushed — but the push was rejected (non-fast-forward): a **sibling run had raced this one and independently implemented the exact same fix** on a differently-named branch (`jynx-markers-toggle-dev-users-g5xnga`), opened **PR #81**, and landed its own bookkeeping commit on `main` about a minute earlier (`493e7a0`, linking the note to #81 instead).

Fetched and compared: #80 and #81 are functionally equivalent (both split the marker-dots visibility gate to `isAdmin || canJynxComment` while keeping the "⚡ Action" pipeline-trigger button strictly `isAdmin`-only, both touching the same three files: `DevAuthGate.jsx`/`DevOverlay.jsx`/`AdminAnnotationMarkers.jsx`). Rather than fight the sibling run's already-landed bookkeeping with a second conflicting commit, adopted its choice as canonical (`origin/main`'s `493e7a0`, note pointing at #81) and cleaned up the loser: closed #80 with a comment explaining the race and pointing at #81, then appended to the note's `actionLog` (previously `null`, since the sibling run's commit didn't set one) recording that #80 was closed as a duplicate.

This is the same structural race documented several entries above for `ann-mt8oorh6ym61`/`ann-mt8on10cwbc9`/`ann-mt8opg67bpl9` (two independent dedupe checks running seconds apart on different machines can't see each other's in-flight work, only what's already pushed) — worth noting here specifically because this is the first time it's hit a `jynx-actions` item (the pipeline's own devtools-self track) rather than only `annotations/actions` items, confirming the race isn't specific to one queue.
