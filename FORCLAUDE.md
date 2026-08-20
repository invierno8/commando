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

**HANGAR (האנגר)** — a Vite + React prototype for a military brigade
equipment-catalog and requisition-ticket system. Hebrew RTL throughout
(`dir="rtl"`, `<html lang="he" dir="rtl">`). It's explicitly framed as
**כלל-זרועי** (all-corps/multi-branch) — a system-admin level exists above
brigade level, and multiple brigades run fully isolated from each other.
This is a **local prototype with no real backend** — every data store is an
in-memory JS module simulating async latency, deployed static to GitHub
Pages (`vite.config.js` sets `base:"/commando/"`, via
`.github/workflows/deploy.yml`). Repo folder name is `commando` (unrelated
to the product name — an earlier product name, "אמל״ח־נט"/amalach-net, was
rebranded to HANGAR; the generic Hebrew word "אמל״ח" itself, meaning
materiel/equipment, is a normal domain word left alone everywhere, e.g.
"קטלוג אמל״ח" = equipment catalog).

**Remote:** `https://github.com/joshuael120/commando.git` (origin) — already
configured, so `git push`/`git pull`/`git clone` work normally and this is
how work travels between machines.

**Language policy:** work in **English and Hebrew only** (no Spanish — an
earlier contributor mixed in Spanish; the user asked for that to stop). Talk
to the user in English about code/tooling; it's natural to switch to Hebrew
discussing the product/domain since the UI and data are Hebrew-first.

## Quick orientation for a cold start

1. Read `TODO.md` — deferred work, don't rebuild it prematurely.
2. Read this file's "Chronological log" bottom-up (newest first) for the
   most recent state of things — the log is append-only, so the tail is the
   freshest picture.
3. `src/roles.js` is the one source of truth for the four structural roles
   (`STRUCTURAL_ROLES`: `member` / `unit_officer` / `brigade_officer` /
   `system_admin`). There's no real login yet — `App.jsx` owns a dev-only
   floating role/brigade/identity switcher (`.dev-fab` bottom-right) that
   simulates whoever is "logged in." Every screen receives `role` as a prop
   and branches its UI/data scope off it.
4. Every operational data store (`brigadeStore.js`, `teamStore.js`,
   `blockStore.js`, `notificationStore.js`, `adminStore.js`,
   `draftStore.js`, `userPrefsStore.js`) is a "LEGO block": plain in-memory
   state behind `async function fetchX()`/`saveX()` wrappers with a small
   simulated latency, so every consuming screen already awaits a promise and
   renders a loading state — swapping the body for a real API call later is
   meant to be a contained change that touches no screen. **Follow this
   pattern for any new data need** rather than inventing a different shape.
5. To run/verify: `npm install`, `npm run dev` (Vite), open
   `http://localhost:5173/commando/` (port may shift if occupied — pass
   `--port` to `npx vite` if you need a specific one, e.g. when a previous
   session's dev server is still bound). Node/npm are expected to already be
   installed on the dev machine (if not: `winget install --id
   OpenJS.NodeJS.LTS`, then open a fresh shell for PATH).

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
- **RTL bidi reversal bites plain number/ratio strings.** A string like
  `"1 / 4"` or a Recharts numeric axis label renders visually reversed
  unless the containing element (or a wrapping `<div dir="ltr">`) is
  explicitly LTR — this has bitten a gallery counter and a Recharts vertical
  category axis before.
- **Identity is simulated via `App.jsx`'s dev-fab panel, not real
  auth, and it is intentionally being kept that way for now.** `persona`
  (for `MEMBER` role: random rank/name/personal-number/unit, re-rolled on
  role/brigade switch) and `userId` (a free-typed personal number, used for
  every officer role's identity, and optionally overridable for `MEMBER`
  too) are the two identity primitives every "per-person" feature is keyed
  off (dashboard layout, drafts, favorites, team-lead detection, block
  status). See the "Explicitly deferred" section below and `TODO.md` — real
  SSO-based identity/enrollment is planned but not started.
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
- **Per-user dashboard layout** (`userPrefsStore.js`) — keyed by personal
  number (`userId`), explicitly **not** by device, because military users
  sign in from many different machines and a device-bound key would strand
  personalization on one computer.

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

- Dev server: `npx vite --port <N>` (background), then drive it with small
  ad-hoc Playwright Node scripts — there's no test framework installed,
  this is a prototype. Playwright's Chromium may need
  `npx playwright install chromium --with-deps` on a fresh machine.
- **Run Node scripts through the PowerShell tool, not Bash** — Bash in this
  environment doesn't have `node` on PATH; PowerShell does (or needs
  `$env:Path += ";C:\Program Files\nodejs"` prepended once per session).
- The dev-fab role/brigade/identity switcher requires clicking `.dev-fab`
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
  `App.jsx`, `Tickets.jsx`, or `Catalog.jsx`: `npx vite build` (catches
  syntax errors fast) → targeted Playwright check of the new behavior → a
  full sweep across all 4 roles × both real brigades × every visible nav
  view, checking for zero console/page errors.

## File map (`src/`)

- `App.jsx` — shell: sidebar, topbar, notification bell, dev-fab identity
  switcher, sidebar identity stack, `NAV` registry (role-gated), the
  block-gate full-screen check.
- `roles.js` — `STRUCTURAL_ROLES`, `ROLE_LABELS`, `ROLE_ORDER`. Single
  source of truth.
- `brigadesData.js` — system-admin-level brigade registry seed
  (`seedBrigades`) + `seedSystemAdmins` (with `isSuperAdmin`).
- `brigadeStore.js` — per-brigade operational dataset (catalog, tickets,
  roster, dashboard stats) + `saveBrigadeSetup` write-back from the wizard.
- `teamStore.js` — team/sub-team hierarchy, org-change requests,
  membership lookups, `restoreTeam`.
- `blockStore.js` — the blocklist.
- `notificationStore.js` — the personal notification feed.
- `adminStore.js` — pending-deletion approval queue + the audit log
  (with snapshot/restore support).
- `draftStore.js` — per-person, per-form-kind draft auto-save.
- `userPrefsStore.js` — per-person dashboard-layout persistence.
- `Catalog.jsx` / `ProductDossier.jsx` / `PhotoTile.jsx` /
  `MediaGallery.jsx` / `MediaEditor.jsx` — catalog browsing + item detail +
  media gallery/editor.
- `Tickets.jsx` — requisition/repair/idea ticket lifecycle, all roles.
- `PermissionsDashboard.jsx` — roster/org-tree/teams/blocking, the largest
  and most actively-changing screen. Exports `RANK_OPTIONS` (reused by
  `SystemAdmin.jsx`).
- `SystemAdmin.jsx` — brigade provisioning, system-admin management,
  category management, audit log.
- `BrigadeSetupWizard.jsx` — brigade-officer-only setup/edit flow, exports
  `MissionBar` (rendered persistently in `App.jsx`).
- `DevDashboard.jsx` — role-scoped widget dashboard (drag-to-reorder,
  hide/show, per-user persisted layout).
- `theme.js` — `THEME_CSS` (shared tokens + primitives), theme
  read/persist helpers.
- `analytics.js` — timestamp parsing + duration/response-time helpers.
- `search.js` — `matchesSearch`, the one shared search-matching function.
- `opsData.jsx` — brigade-agnostic helpers (`StatusPill`, `PriorityDot`,
  `randomMemberPersona`, `DEFAULT_CATEGORIES`).
- `SearchBar.jsx` / `FilterSelect.jsx` / `Pagination.jsx` — shared
  list-control primitives, used everywhere a list/grid exists.
- `ScopePicker.jsx` — the shared unit-scope dropdown.
- `UnitEmblem.jsx` / `LogoUpload.jsx` — shared logo/emblem rendering +
  upload.
- `ThemeToggle.jsx`, `Loading.jsx`, `CountUp.jsx` — small shared widgets.
- `assets/` — placeholder demo media (abstract/technical, not fake product
  photography — a deliberate design choice, see the chronological log).

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
