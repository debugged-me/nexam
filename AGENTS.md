# nexam — Project Guidelines

## Node.js API (`api/`)

A standalone Node.js (Express 5) backend lives in `api/`. It shares the same
`nexam` MySQL database as the CodeIgniter PHP app, and is designed to serve
both the web frontend and a future Flutter mobile app (OMR scanning).

### Running the API

```bash
cd api
cp .env.example .env          # first-time setup — edit secrets for production
npm install
npm run dev                   # nodemon, auto-restarts on changes
# or: npm start               # plain node, no watch
```

Server listens on `http://localhost:3000` (configurable via `PORT` in `.env`).

### Structure

```
api/
├── .env.example          # copy to .env, fill in secrets
├── package.json
└── src/
    ├── server.js         # entry point — helmet, cors, json, routes, error handlers
    ├── config/
    │   ├── env.js        # loads + validates env vars
    │   └── db.js         # mysql2 connection pool (shared nexam DB)
    ├── middleware/
    │   ├── auth.js       # JWT requireAuth + requireRole
    │   └── errorHandler.js  # 404 + central error handler
    └── routes/
        ├── index.js      # route aggregator — add new route groups here
        ├── health.js     # GET /api/health (liveness probe)
        └── auth.js       # POST /api/auth/login, GET /api/auth/me
```

### Conventions

- **ES modules** (`"type": "module"` in package.json) — use `import`/`export`.
- **Shared DB** — the Node API reads/writes the same `nexam` database as PHP.
  Always scope queries by `user_id` (same IDOR rules as the PHP app).
- **Auth** — JWT issued by `POST /api/auth/login`. Both the PHP web app and the
  Flutter app send it as `Authorization: Bearer <token>`.
- **CORS** — allowed origins are in `.env` (`ALLOWED_ORIGINS`). Add Flutter /
  Capacitor origins there.
- **Adding a route group** — create `src/routes/<name>.js`, then mount it in
  `src/routes/index.js`:
  ```js
  import subjectsRouter from './subjects.js';
  router.use('/subjects', subjectsRouter);
  ```
- **Security** — the same security checklist (auth, IDOR, input validation,
  no secrets in responses) applies to every Node route. Use parameterized
  queries via the `mysql2` named placeholders (`:name`), never string-concat.

## Icons

**Always use [Lucide](https://lucide.dev/icons/) icons only.** Do not use any other icon set (Material Icons, Font Awesome, AI-generated SVGs, emoji-as-icons, etc.).

Usage via CDN:
```html
<script src="https://unpkg.com/lucide@latest"></script>
<i data-lucide="icon-name"></i>
<script>lucide.createIcons();</script>
```

Do not reference any other icon library in code, comments, or documentation.

## Fonts

**Use Google Sans + Inter from the local assets folder.** Do not load fonts from Google Fonts CDN — they are already in `assets/fonts/`.

- **Google Sans** (`--font-display`): headings, titles, buttons, labels, badges
- **Inter** (`--font-body`): body text, paragraphs, inputs, general content

Always load `fonts.css` FIRST before other CSS files so the `--font-display` and `--font-body` variables are available:
```html
<link href="<?php echo base_url('assets/css/fonts.css'); ?>" rel="stylesheet">
```

Font files:
- `assets/fonts/Google_Sans/static/` — Regular, Medium, SemiBold, Bold (+ italics)
- `assets/fonts/Inter/static/` — Regular, Medium, SemiBold, Bold (+ italics)

## CSS

**CSS must be in separate files under `assets/css/`, not embedded in `<style>` tags inside views.** This keeps styles shared and easy to modify across pages.

- Page-specific CSS: `assets/css/<page-name>.css` (e.g. `auth.css`, `dashboard.css`)
- Shared component CSS: `assets/css/app.css` (already exists)
- Only use inline `<style>` when a style is truly one-off and cannot be reused
- Link CSS files via `base_url('assets/css/...')` in views

### Standard CSS includes for every page

Every page should include these shared CSS files (in order):
1. `fonts.css` — font declarations + variables (MUST be first)
2. `toast.css` — toast notification styles
3. `modal.css` — modal/confirm dialog styles
4. `<page-name>.css` — page-specific styles

## JavaScript

**JS must be in separate files under `assets/js/`, not embedded in `<script>` tags inside views.**

- Page-specific JS: `assets/js/<page-name>.js` (e.g. `auth.js`)
- Link JS files via `base_url('assets/js/...')` in views
- **Exception — server-to-client data:** `<script type="application/json" data-...>` blocks that pass server data to client-side JS are permitted. They contain no executable code, use `JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT` flags to prevent `</script>` breakout, and are read by the page JS via `JSON.parse(el.textContent)`. This is the standard pattern for seeding DataTables grid configs, dashboard chart series, and similar server-derived data.

### Standard JS includes for every page

Every page should include these shared JS files:
1. `toast.js` — `NexamToast` notification system
2. `modal.js` — `NexamModal` dialog system
3. `<page-name>.js` — page-specific JS

## Reusable Components

### Toast Notifications (`NexamToast`)

Use for transient feedback (auto-dismisses). Types: `success`, `error`, `warning`, `info`, `delete`.

```js
NexamToast.success("Subject saved successfully!");
NexamToast.error("Failed to save. Please try again.");
NexamToast.warning("Please fill in all required fields.");
NexamToast.info("Loading data...");
NexamToast.delete("Subject has been removed.");
NexamToast.show("Custom Title", "Message here", "info", 5000); // custom duration (0 = sticky)
```

### Modal Dialogs (`NexamModal`)

Use for confirmations, alerts, and custom dialogs. Types: `default`, `danger`, `delete`, `success`, `warning`, `info`.

```js
// Delete confirmation
NexamModal.deleteConfirm("Delete subject?", "This action cannot be undone.", function () {
    // user confirmed — do the delete
});

// Custom confirm
NexamModal.confirm("Publish exam?", "Once published, it cannot be edited.", "warning", function () {
    // user confirmed
});

// Alert
NexamModal.alert("Saved!", "Your changes have been saved.", "success");

// Fully custom modal
NexamModal.open({
    title: "Custom Dialog",
    subtitle: "Optional subtitle",
    body: "<p>HTML content is allowed</p>",
    type: "info",
    buttons: [
        { text: "Cancel", style: "cancel", dismiss: true },
        { text: "Save", style: "primary", icon: "save", onClick: function () { /* save logic */ } }
    ]
});
```

## Data grid (list pages)

Subjects, Questions, Blueprints and Exams all render through one grid system:
`assets/css/datatables.css` + `assets/js/datatables.js`, wrapped by
`partials/grid_open.php` / `partials/grid_close.php`.

DataTables runs **headless** (`dom: 't'`). It owns sorting, paging and
filtering; every visible control — toolbar, facets, selection bar, view menu,
footer, pagination — is ours, so the chrome matches the rest of the app.

### Rules that must not be broken

- **Every column carries a percentage width, and they sum to 100** (`.wp-*`
  classes). `table-layout: fixed` spreads leftover width *equally* across all
  columns, so a mix of px widths and one auto column fattens the 40px checkbox
  exactly as much as the title. Adding a column means re-balancing the set.
- **Do not re-add the DataTables Responsive extension.** It measures columns by
  cloning the table into a 1px box, which cannot produce sane numbers against
  `table-layout: fixed` — it dropped every data column at 1440px. Narrow
  screens scroll the grid sideways instead; the user hides columns through the
  View menu.
- **A cell a facet filters on needs `data-filter="<exact token>"`.** DataTables
  filters on the cell's text content, which includes the markup's whitespace,
  so an anchored `^Draft$` match fails without it. Keep the token equal to the
  visible text so global search still works.
- **A cell sorted on something other than its text needs `data-order`** (Bloom
  sorts by level, status by state, dates by ISO string).
- `.dataset-scroll` must stay `position: relative`. The `.sr-only` labels inside
  the table are absolutely positioned; without a positioned scroll container
  they resolve against `.dataset`, escape the horizontal clip, and drag the
  whole document sideways.
- The sticky header is released in full at the scroll breakpoint, for **every**
  header state DataTables applies (`sorting`, `sorting_asc`, `sorting_desc`,
  and the three `*_disabled` variants) — a sticky header inside a horizontally
  scrolling container escapes that container's clip.
- DataTables' own stylesheet targets sortable headers as
  `table.dataTable thead>tr>th.sorting`. Any header rule that must win has to
  match that specificity, not just `table.grid thead th`.

### Colour discipline

Colour marks **state that needs a decision**, never taxonomy:

- Status is a dot plus a label (`.g-state.is-live` / `.is-draft`), not a pill.
- Bloom is *ordinal*, so it gets a sequential ramp of one hue (`.g-bloom`
  `data-level="1..6"`), never six unrelated colours.
- Type, format, subject and counts are plain text in `--ink-2`.
- The row title is `--ink`, not blue; the underline on hover carries the
  affordance.

### Bulk actions

Selection posts `ids[]` to `<controller>/bulk-delete`. Every `delete_many()`
re-derives ownership from the database and silently skips ids the user does not
own, so a forged id in the request body is a no-op. Keep that pattern.

## Responsive Design

**All pages must be responsive and work on any screen size.** When building new features, follow these rules:

- Use mobile-first breakpoints (`@media (min-width: ...)`) or sensible max-width breakpoints
- Test at minimum: mobile (380px), tablet (768px), desktop (1024px+)
- Use relative units (rem, %, vw/vh) over fixed px where possible
- Use CSS Grid / Flexbox for layouts — never tables for layout
- Ensure tap targets are at least 44x44px on mobile
- The auth pages (`auth.css`) are the reference implementation — follow that pattern

## Code Style

- Follow existing CodeIgniter 3 conventions in the codebase
- Use `site_url()` for controller routes, `base_url()` for asset paths
- Never commit `.DS_Store` files (already in `.gitignore`)

## Security

**Security must be considered for every feature built.** This project is being created fresh, so security practices must be applied from the start and maintained as the codebase grows. Always look for potential risks when writing or reviewing code.

### Authentication & Authorization

- **Email verification required** — users cannot log in until `email_verified = 1`. Enforce this in every login path.
- **Session checks** — every controller method that is not public (login, register, forgot, reset, verify) must check `$this->session->userdata('logged_in')` and redirect to login if absent.
- **Role-based access** — check `$this->session->userdata('role')` before allowing admin-only actions. Never trust client-side role checks.
- **Session regeneration** — regenerate the session ID after login (`$this->session->sess_regenerate(true)`) to prevent session fixation.

### IDOR (Insecure Direct Object Reference)

- **Never trust user-supplied IDs** — always verify that the authenticated user owns or has access to the requested resource before returning or modifying it.
- **Example**: if editing subject ID 5, verify `subject.user_id == session.user_id` before allowing the edit. Never just load by ID without an ownership check.
- **Use ownership scoping in queries** — always add `WHERE user_id = ?` (or equivalent) to queries that fetch user-specific data.

### CSRF (Cross-Site Request Forgery)

- **CSRF protection is ENABLED** in `config.php` (`csrf_protection = TRUE`).
- **Every form must include the CSRF token**:
  ```html
  <input type="hidden" name="<?php echo $this->security->get_csrf_token_name(); ?>" value="<?php echo $this->security->get_csrf_hash(); ?>">
  ```
- For AJAX POST requests, include the CSRF token in the request headers or body. Read it from the cookie `nexam_csrf_cookie`.
- Token regenerates on every submission (`csrf_regenerate = TRUE`).

### SQL Injection

- **Always use CodeIgniter's Query Builder** (`$this->db->where()`, `$this->db->get()`, etc.) — it parameterizes queries automatically.
- **Never concatenate user input into raw SQL**. If raw SQL is unavoidable, use `$this->db->query()` with `?` placeholders and pass values as an array:
  ```php
  $this->db->query("SELECT * FROM users WHERE id = ?", [$user_id]);
  ```
- **Always use `$this->input->post('field', true)`** — the `true` flag enables XSS filtering on input.

### XSS (Cross-Site Scripting)

- **Always escape output** with `htmlspecialchars()` when printing user data in views:
  ```php
  echo htmlspecialchars($user->full_name);
  ```
- **Never trust `$_POST` / `$_GET` directly** — use `$this->input->post()` / `$this->input->get()` with XSS filtering.
- Content stored in the DB must be escaped on output, not input (double-encoding corrupts data).

### Direct URL Access

- **Every controller method must assume it can be called directly via URL**. Never rely on the UI hiding a link.
- **Protect methods by checking auth at the top**:
  ```php
  if (!$this->session->userdata('logged_in')) {
      redirect('login');
  }
  ```
- **Protect AJAX endpoints** — return 403 JSON, not a redirect, if accessed without auth:
  ```php
  if (!$this->session->userdata('logged_in')) {
      $this->output->set_status_header(403)->set_content_type('application/json')
          ->set_output(json_encode(['error' => 'Unauthorized']));
      return;
  }
  ```

### Rate Limiting & DDoS Protection

- **Login attempts** — track failed login attempts per IP/email. After 5 failures, lock out for 15 minutes. Store attempts in a `login_attempts` table or session.
- **OTP requests** — limit OTP generation to 1 per 60 seconds per user. Track last OTP time in the `otp_codes` table.
- **API endpoints** — if building AJAX endpoints, add rate limiting (max N requests per minute per session/IP).
- **Password reset** — limit reset requests to prevent email bombing (max 3 per hour per email).

### Input Validation

- **Always validate input** using CodeIgniter's Form Validation library:
  ```php
  $this->form_validation->set_rules('email', 'Email', 'required|trim|valid_email|max_length[255]');
  ```
- **Set max lengths** on all text inputs to match DB column sizes.
- **Whitelist allowed values** for enums (e.g., role, status) — never accept arbitrary strings.

### File Upload Security (when applicable)

- **Validate file types** by MIME, not just extension.
- **Rename uploaded files** — never keep the original filename.
- **Store uploads outside the web root** or in a protected directory.
- **Limit file size** to a reasonable maximum.

### Data Exposure

- **Never expose passwords, hashes, or tokens in responses** — strip sensitive fields before returning JSON or passing to views.
- **Never log secrets** — do not write passwords, OTP codes, or session data to log files.
- **Use `password_hash()` / `password_verify()`** — never roll your own hashing.

### Security Checklist (run for every new feature)

- [ ] Auth check at the top of every protected method
- [ ] Ownership check before accessing/modifying any resource by ID
- [ ] CSRF token in every form
- [ ] Input validated with Form Validation library
- [ ] Output escaped with `htmlspecialchars()`
- [ ] No raw SQL with concatenated user input
- [ ] Rate limiting on sensitive endpoints (login, OTP, reset)
- [ ] No sensitive data in responses or logs
- [ ] AJAX endpoints return 403 JSON when unauthorized
