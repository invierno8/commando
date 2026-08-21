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
    screen, unresolved-only) the QA annotation queue. This Markdown export
    is meant to become an actual Claude to-do list — see the user's original
    framing of this feature in the architecture plan.
  - Verified end-to-end with a real headless-browser (Playwright) smoke
    pass, not just a build check — see "Testing / verification workflow"
    below for a real gotcha found doing that.

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
  `DevAuthGate.jsx` (entry point), `DevFab.jsx` (the moved role/brigade
  picker), `MockDataToggle.jsx`, `DevAdminPanel.jsx` (admin-secret-gated
  modal, composes `DevAdminUsersScreen.jsx` + `DevAnnotationsScreen.jsx` as
  tabs), `overlay/DevOverlay.jsx` + `overlay/useHoverTarget.js` +
  `overlay/AnnotationPopover.jsx` (hover-highlight + Ctrl/Cmd+click
  annotate). See "Dev-mode / QA feedback overlay" above for the full
  picture.
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
