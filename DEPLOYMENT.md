# Nexam — Production Deployment Guide

Production runs on cPanel shared hosting (softtechservices.net) with the
CloudLinux Node.js Selector (Passenger), Node.js 22. There is no SSH —
everything goes through cPanel File Manager and the Node.js App UI.

- **Site:** https://nexam.mati.gov.ph
- **API:** https://nexam.mati.gov.ph/api
- **Health check:** https://nexam.mati.gov.ph/api/health

The Node process serves the compiled React build (`web/dist`) as well as
`/api/*` — one app, one Passenger process.

## Server layout

| Path | Purpose |
|---|---|
| `/home/matigov/nexam-app/` | Application root (uploaded zip contents) |
| `/home/matigov/nexam-app/api/` | Express API, entry `src/server.js` |
| `/home/matigov/nexam-app/api/.env` | Production secrets — never commit |
| `/home/matigov/nexam-app/web/dist/` | Compiled React build |
| `/home/matigov/nodevenv/nexam-app/api/22/lib/` | CloudLinux npm prefix — dependencies install here |
| `/home/matigov/nexam-app/api/node_modules` | **Symlink** → the nodevenv lib. Do not replace with a real folder |
| `/home/matigov/nexam-app/api/stderr.log` | Passenger/app errors (append-only — read the tail) |
| `/home/matigov/.npm/_logs/` | npm debug logs when cPanel shows a generic "Error" |

## Publishing an update

1. **Build the frontend** locally:
   ```bash
   cd web && npm run build
   ```
2. **Stage the upload** — copy changed files into `deploy/nexam-app/`
   (mirrors the server layout), or zip the app directly. The staging dir
   is gitignored and may contain `.env` — never commit it.
   - Frontend-only change → upload just `web/dist/`.
   - API change → upload the changed `api/` files.
   - **Dependency change** → also upload `api/package.json` and
     `api/package-lock.json`, and copy both into
     `nodevenv/nexam-app/api/22/lib/` (that prefix is what npm reads).
3. **Upload + extract** via File Manager into `/home/matigov/nexam-app/`.
4. **If dependencies changed:** Setup Node.js App → your app →
   **Run NPM Install**. Watch for failures in `~/.npm/_logs/`.
5. **RESTART** the app, then smoke test (below).

## Gotchas learned the hard way

- **cPanel npm uses `--prefix`** → manifests must live in
  `nodevenv/nexam-app/api/22/lib/`, not just the app dir. An `.npmrc`
  in `nexam-app/api/` does not affect the install.
- **`legacy-peer-deps=true` is required** — set in `api/.npmrc` and in
  `~/.npmrc` (home-level file affects the nodevenv install).
- **`node_modules` is a symlink** to the nodevenv lib dir. If you
  overwrite it with a real uploaded folder the app breaks.
- **Never upload macOS native binaries.** `@napi-rs/canvas` (used by
  `pdf-parse` for `DOMMatrix`) needs the prebuilt package
  `@napi-rs/canvas-linux-x64-gnu@0.1.80` extracted into
  `nodevenv/.../lib/node_modules/@napi-rs/`. The darwin `.node` file
  cannot load on Linux. Same rule applies to any `*.node` file.
- **Puppeteer's postinstall crashes under the host memory cap**
  (WebAssembly OOM during Chrome download). The install was completed
  without it — see Known limitations.

## Known limitations (still pending)

- **`hnswlib-node` is NOT installed** — it needs `gcc`/`make` to compile
  and the shared host lacks a toolchain. RAG retrieval, embeddings, and
  similarity scoring will fail until the host provides a compiler or a
  compatible prebuilt binary is installed. Escalate to hosting support:
  *"Is gcc/make available to the Node.js Selector environment for
  node-gyp builds?"*
- **Puppeteer / Chrome** — Chrome was never downloaded (skipped to get
  npm install through). PDF/OMR generation endpoints will fail until a
  usable Chromium exists — likely a VPS-level requirement if the host
  can't run it.
- Everything else (auth, CRUD, TOS, MySQL) is verified working.

## Secrets rules

- `api/.env` stays on the server only — gitignored.
- `deploy/` staging dir is gitignored (contains a `.env` copy).
- `nexam-dump.sql`, `nexam-*.zip` are gitignored (DB data / artifacts).
- `web/.env` is committed and **must only contain `VITE_*` values that
  are safe to expose publicly**.
- Rotate `JWT_SECRET` and keys per `AGENTS.md` before any real launch.

## Disaster recovery (learned the hard way)

**Never delete the app directory or domain while the Passenger app is
still registered/running.** Correct removal order:

1. Setup Node.js App → **STOP** the app
2. **Remove/unregister** the app entry
3. Then delete `nexam-app/` and `nodevenv/nexam-app/`
4. Then remove the domain if needed

Deleting files first strands the running Passenger processes → the
account saturates its LVE limit (PMEM/NPROC) → `cagefs_enter: Unable to
fork` on cPanel pages and **every site on the account returns 503**.

**If that happens (no shell, cPanel pages can't fork):**

- App registrations live in `~/.cl.selector/node-selector.json` —
  edit it via File Manager to `{}` to unregister stuck apps
- A graceful restart (MultiPHP version toggle) does NOT reap wedged
  Passenger procs; neither does `.lsphp_restart.txt` (PHP only)
- A `pkill -9 -u matigov` cron job can't run when NPROC is fully
  saturated — nothing inside the LVE can fork
- **The fix that works: WHM → Account Functions → Manage Account
  Suspension → Suspend → wait 30s → Unsuspend.** Suspending kills all
  processes under the account. (Requires WHM/reseller access.)

## Smoke test after every deploy

1. `https://nexam.mati.gov.ph/api/health` → `{"status":"ok",...}`
2. `https://nexam.mati.gov.ph` → React app loads
3. Log in with a faculty account (exercises DB + bcrypt + JWT)
4. Browse subjects/drafts/TOS pages (DB reads)
5. If a feature errors, tail `/home/matigov/nexam-app/api/stderr.log`
