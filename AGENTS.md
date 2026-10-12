# Nexam project guidelines

## Active architecture

Nexam uses React (`web/`), Node.js/Express (`api/`), MySQL, and Flutter
(`mobile/`). Do not add PHP or CodeIgniter routes, views, sessions, or assets.
The Node API is the single backend for both clients.

## Roles and scope contracts

Three roles exist: `instructor | admin | superadmin`.

- `instructor` — the faculty workspace. Protected app data (subjects, drafts,
  TOS records, materials, exams, results) is scoped by authenticated
  instructor ID on every private call.
- `admin` — a scoped management console at `/admin` (Dashboard + Users only).
  May approve/reject/provision **instructors only**. `manageableRoles()` in
  `api/src/routes/admin.js` filters every managed-user query; out-of-scope
  targets return 404, not 403.
- `superadmin` — the full console: users (instructors + admins), settings,
  audit trail, login logs, reCAPTCHA and AI credential config. Cannot manage
  itself through managed-user actions.
- Console endpoints sit behind `requireAdminConsole` (JWT + live DB check for
  `admin|superadmin` + `status='active'`); `requireSuperadmin` layers on top
  for settings/logs. User-management actions are audit-logged.
- `/account` and `/appearance` are shared (`RequireAnyAuth`) — all roles get
  self-service profile, password change, photo, and theme.

Other contracts:

- Approved questions form an institution-wide read-only bank. Reuse copies an
  item into the receiving instructor's private draft queue for similarity
  review and explicit approval.
- Question statuses are exactly `draft | active | rejected`; rejection is soft.
- Objective types are exactly `mcq | true_false | matching | identification`.
  The UI labels `identification` as "Fill in the blank."
- Only finalized TOS blueprints may drive question generation or exam assembly.
- Exam assembly must exactly satisfy the finalized topic-by-Bloom matrix.
- Generated output is exactly Set A and Set B, with answer keys, TOS reports,
  QR-linked OMR sheets, GIFT, and Canvas/QTI XML.
- Every AI draft must cite an exact evidence span found in its retrieved
  chunks. Missing or stale grounding fails closed and blocks approval.
- The institution similarity index contains approved questions only. Material
  retrieval indices remain private and subject-scoped.

## User records

- Names are stored in `first_name | middle_name | last_name | name_ext` plus a
  denormalized `full_name`. Always update `full_name` via `composeFullName()`
  in `api/src/routes/auth.js` — rebuilding it from only first+last silently
  drops middle names and extensions (this bug already shipped once).
- Admin edit accepts all name parts; each defaults to the current value when
  absent so partial updates never clobber.

## OMR contracts

Canonical answers:

- `mcq`: one option letter, such as `B`
- `true_false`: `T | F`
- `matching`: comma-joined letters in premise order, such as `B,A,D,C`
- `identification`: `CORRECT | INCORRECT` after instructor review

QR payload: `{ v, examId, setId, set, count, types[] }`.

## Security

- Use parameterized MySQL queries and enforce ownership on every private ID.
- Do not return passwords, hashes, OTPs, reset tokens, provider keys, or
  grounding material belonging to another instructor.
- `Authorization: Bearer` is the normal credential. `?token=` query auth is
  accepted **only** on `GET`/`HEAD` requests to file-serving paths
  (`/download`, `/export`, `/avatar`) — see `extractToken()` in
  `api/src/middleware/auth.js`. Query tokens never authenticate data or
  mutation endpoints.
- Password reset links: tokens are stored SHA-256-hashed in
  `password_reset_tokens`, single-use, 30-minute expiry, and voided if the
  email fails to send. Admin "Send reset link" issues `/reset?key=` links;
  the Reset page renders a password-only form in that mode.
- Admin/superadmin user provisioning (`POST /api/admin/users`): the server
  generates the password (`crypto.randomBytes`), emails it via the branded
  credentials template, and never returns it. Client-supplied `password`
  fields are ignored.
- reCAPTCHA v2 is required on registration only; login uses escalating
  throttle and forgot-password uses a cooldown. Keys live in the DB, set from
  the superadmin console.
- Production must use HTTPS, a rotated JWT secret, TLS to remote MySQL, and
  encrypted database/filesystem volumes.
- Uploaded course files and student PII use `storageCrypto.js`; never bypass
  it.
- Keep `api/upload/` and `api/storage/` outside Express static routes.
- Validate file MIME types, rename uploads, cap size, and block SSRF for URLs.
- Tokens are stored in Flutter secure storage. Never put secrets in Vite env
  vars.

## Schema

`api/src/config/schema.js` (`ensureSchema`) creates missing tables and
columns at boot and converges types safely. Add new tables/columns there so
existing installs upgrade automatically — don't rely on a fresh
`schema.sql` import. Tables added this way include `password_reset_tokens`,
`audit_log`, `login_logs`, captcha/AI settings, and `users.theme`.

## Email

- All transactional mail uses the branded templates in
  `api/src/services/emailService.js` (OTP, verify, reset, credentials).
- The inline logo works because `LOGO_ATTACHMENT` sets
  `contentDisposition: 'inline'` + `contentType: 'image/png'`. A plain
  attachment renders as nothing in Gmail — do not regress this.
- Links inside emails are built from `env.webUrl`.

## UI

- Use Lucide icons only.
- Use the local font files in `web/public/fonts/` (duo — Sora display +
  SF Pro body — is the default; Sora, SF Pro, Google Sans, Inter, and
  Geist + Geist Mono are selectable via the Appearance typeface picker).
- Keep page CSS in `web/src/styles/`; avoid executable inline scripts/styles.
- Each page owns its content layout and a dedicated stylesheet wrapped in
  `@scope (.page--<name>)`. Import it from the page, not `App.jsx`. Global
  shared styles live in `app.css` (tokens/controls/shell) and `board.css`
  (list headers, dataset toolbars, `table.grid`, `.wp-*` width ladder).
- All pages must work at 380px, 768px, and 1024px+ with 44px mobile targets.

### Portal + @scope rule (important)

`Modal` renders via `createPortal` to `document.body` — outside the
`.page--<name>` DOM subtree — which would orphan every `@scope`d rule.
`AppShell` publishes the scope class through `PageScopeContext`
(`shellMeta.js`) and `Modal` applies it to its overlay so scoped styles keep
matching. Any new portaled component (pickers, sheets, menus) must consume
`PageScopeContext` the same way or its page-scoped styles silently stop
applying. `ContextMenu` uses only global classes, so it is exempt.

### Table convention (`table.grid`)

Shared table state lives in `components/DataTable.jsx`: `useGridTable`
wraps TanStack Table (sorting/filtering state, clamped page math, sort
helpers) and `DsPager`/`DatasetFoot` render the standard pager and footer.
New tables should use them rather than hand-rolling `setPage`/`slice`/sort
comparators; pass `resetKey` (a serialized filter value) to return to page
1 when page-owned filters change, and `paginate: false` for grouped boards
that render every row.

`board.css` is the shared grid system. Its rules are deliberate:

- `table-layout: fixed` distributes surplus width across **every** column.
  The only safe column-sizing pattern is the `.wp-*` percent ladder
  (`.wp-4` … `.wp-36`) summing to exactly 100. Never mix px columns with an
  auto column — the surplus fattens every fixed column and overflows.
- `table.grid` gets `min-width` (per-page, ~880px) only inside a
  `max-width` media query so narrow screens scroll horizontally in
  `.dataset-scroll`.
- `.dataset-scroll` needs `overflow-x: auto` for the scroll case; once any
  overflow is non-visible it becomes the sticky-header scrollport, so the
  header must stick with `top: 0` (an offset like `--topbar-height` pushes
  the header down over the first row and hides it).
- Row actions use a single `⋮` (`Ellipsis`) trigger plus row right-click —
  both call `openMenu(e, items)` from `useContextMenu()` in
  `components/ContextMenu.jsx` (portal-rendered, position-clamped).
  `useCopyText()` from the same file provides copy-with-toast.
- Destructive and consequential actions go through `useConfirm()`
  (`components/ConfirmDialog.jsx`) — icon tile + tone, never `confirm()`.

### Elevation + surfaces

One hierarchy everywhere: canvas → `--shadow-md` on raised surfaces (cards,
panels, table containers, list boards) → `--shadow-card-hover` on hover.
Nested cards inside an already-raised surface use `--shadow-sm`. List rows,
chips, inputs, buttons, and dashed `.empty-state` stay flat. KPI cards get a
`-50` color wash matching their icon family with a `-100` family border; the
icon tile flips to a `--surface` chip on tinted cards. All of it reads from
tokens, so dark mode stays uniform.

### Theme

`lib/theme.js` persists `light | dark | system` per user (server `users.theme`
for signed-in users, localStorage for guests) and applies
`[data-theme="dark"]` token overrides in `tokens.css`. User dropdown has the
Sun/Moon/Monitor segmented toggle plus an Appearance page link.

## Verification

```bash
cd api && npm test
for f in $(find src scripts -name "*.js"); do node --check "$f"; done
cd web && npm run build && npm run lint
cd mobile && flutter test && flutter analyze
```
