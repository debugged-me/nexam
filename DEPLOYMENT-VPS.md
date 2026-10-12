# Nexam — VPS Deployment Guide

Production runs on a single Linux VPS (Ubuntu 24.04 LTS). One Node process
serves the compiled React build (`web/dist`) and `/api/*`, and runs the
background job worker in-process — **one systemd unit covers everything**.

Unlike the old cPanel host, a VPS has a real toolchain, so the two features
that were broken there come back with **zero code changes**:

- `hnswlib-node` compiles natively → RAG retrieval, embeddings, similarity
- Chrome installs normally → Puppeteer PDF/OMR generation

See `DEPLOYMENT.md` for the legacy cPanel environment (kept until the
migration is complete).

## Server requirements

| Resource | Minimum | Comfortable |
|---|---|---|
| RAM | 2 GB (+1 GB swap) | 4 GB |
| Disk | 25 GB | 40 GB |
| OS | Ubuntu 24.04 LTS | — |
| Node | 22 LTS | — |

RAM headroom matters: MySQL + Node + Chrome (Puppeteer) peak together
during PDF export. On a 2 GB box, add swap (below) before anything else.

## Provision once

```bash
# ── System ─────────────────────────────────────────────
apt update && apt upgrade -y
apt install -y build-essential nginx mysql-server certbot python3-certbot-nginx \
               ufw rsync curl git

# build-essential is what compiles hnswlib-node — do not skip it.

# ── Swap (only on ≤2 GB RAM) ───────────────────────────
fallocate -l 2G /swapfile && chmod 600 /swapfile
mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab

# ── Node.js 22 ─────────────────────────────────────────
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs

# ── Google Chrome (Puppeteer PDF/OMR rendering) ────────
# Installing the .deb pulls every shared library Chrome needs and lands at
# /usr/bin/google-chrome — browserLauncher.js auto-detects that path.
curl -fsSL -o /tmp/chrome.deb https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
apt install -y /tmp/chrome.deb && rm /tmp/chrome.deb

# ── Firewall ───────────────────────────────────────────
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable

# ── App user + layout ──────────────────────────────────
useradd --system --shell /usr/sbin/nologin --home /srv/nexam nexam
mkdir -p /srv/nexam/app
chown -R nexam:nexam /srv/nexam

# ── MySQL ──────────────────────────────────────────────
mysql -e "CREATE DATABASE nexam CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
          CREATE USER 'nexam'@'localhost' IDENTIFIED BY '<strong-db-password>';
          GRANT ALL PRIVILEGES ON nexam.* TO 'nexam'@'localhost';
          FLUSH PRIVILEGES;"
# MySQL stays bound to 127.0.0.1 (Ubuntu default) — it is never exposed.
```

### Data-at-rest requirement (hard gate)

`env.js` **refuses to boot in production** unless
`DATA_AT_REST_CONFIRMED=true`, and setting it asserts the database and
storage volumes are encrypted (AGENTS.md security rules). Two honest ways
to satisfy it:

1. **Provider disk encryption** — most cloud VPS providers encrypt
   block storage at rest by default. Confirm in your provider's docs,
   then set the flag.
2. **LUKS volume** — if the provider doesn't encrypt, create a
   LUKS-encrypted volume for `/srv/nexam` and the MySQL datadir, or
   reinstall with full-disk encryption.

Do not set `DATA_AT_REST_CONFIRMED=true` without one of these — it is a
compliance assertion, not a toggle.

## App layout on the server

```
/srv/nexam/app/
├── api/                  # Express API — WorkingDirectory for systemd
│   ├── .env              # production secrets — never commit, never rsync over
│   ├── src/
│   ├── upload/           # stateful: avatars + encrypted materials
│   └── storage/          # stateful: vectors/ + exams/ PDFs
└── web/
    └── dist/             # compiled React build (WEB_DIST_DIR default
                          #   ../../web/dist resolves relative to api/src)
```

`upload/` and `storage/` resolve from `process.cwd()`, so the systemd
unit's `WorkingDirectory` must stay `/srv/nexam/app/api`. These two dirs
plus `.env` and the database **are** the application state — back them up.

## Deploy the code

From your local repo:

```bash
# 1. Build the frontend locally (kind to small VPS RAM)
cd web && npm run build

# 2. Sync code — NEVER sync node_modules, .env, or stateful dirs.
#    macOS/Linux native binaries are not portable; npm ci rebuilds them.
rsync -avz --delete \
  --exclude node_modules --exclude .env \
  --exclude upload --exclude storage --exclude '*.log' \
  api/ user@vps:/srv/nexam/app/api/

rsync -avz --delete web/dist/ user@vps:/srv/nexam/app/web/dist/
```

On the server:

```bash
cd /srv/nexam/app/api
sudo -u nexam npm ci --legacy-peer-deps   # compiles hnswlib-node here
chown -R nexam:nexam /srv/nexam/app
```

`pdf-parse`'s `@napi-rs/canvas` and `hnswlib-node` fetch/compile the correct
Linux binaries automatically — the cPanel manual-binary workaround is gone.

## Production `.env` (`/srv/nexam/app/api/.env`, mode 600, owner nexam)

```ini
NODE_ENV=production
PORT=3000

DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=nexam
DB_PASSWORD=<strong-db-password>
DB_NAME=nexam

# node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
JWT_SECRET=<rotated-production-secret>
JWT_EXPIRES_IN=7d

# npm run security:generate-key — BACK THIS UP; losing it makes all
# protected uploads and student PII permanently unreadable.
DATA_ENCRYPTION_KEY=<base64-32-byte-key>
DATA_AT_REST_CONFIRMED=true        # only after encrypted volumes (see above)

TRUST_PROXY=true                   # REQUIRED behind nginx — without it
ENFORCE_HTTPS=true                 #   req.secure is false → every request 426
SERVE_WEB=true
WEB_DIST_DIR=../../web/dist

ALLOWED_ORIGINS=https://nexam.mati.gov.ph
WEB_URL=https://nexam.mati.gov.ph

NEXAM_SMTP_HOST=mail.mati.gov.ph
NEXAM_SMTP_PORT=587
NEXAM_SMTP_USER=nexam@mati.gov.ph
NEXAM_SMTP_PASS=<smtp-password>
NEXAM_SMTP_CRYPTO=tls

VECTOR_STORE_DIR=storage/vectors

# AI keys — may also be set later in the superadmin console (settings
# table takes precedence over env).
GEMINI_API_KEY=<key>
GEMINI_MODEL=gemini-3.6-flash
GEMINI_EMBEDDING_MODEL=gemini-embedding-001
GROQ_API_KEY=<key>
GROQ_MODEL=openai/gpt-oss-120b
```

## systemd unit — `/etc/systemd/system/nexam.service`

```ini
[Unit]
Description=Nexam API + web + worker
After=network.target mysql.service
Wants=mysql.service

[Service]
Type=simple
User=nexam
Group=nexam
WorkingDirectory=/srv/nexam/app/api
EnvironmentFile=/srv/nexam/app/api/.env
ExecStart=/usr/bin/node src/server.js
Restart=always
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

```bash
systemctl daemon-reload
systemctl enable --now nexam
journalctl -u nexam -f        # logs
```

The AI job worker starts inside this process (`server.js` →
`worker.start()`) — do **not** create a second unit for it.

## nginx — `/etc/nginx/sites-available/nexam`

```nginx
server {
    listen 80;
    server_name nexam.mati.gov.ph;

    # Materials upload cap is 50 MB — stay just above it.
    client_max_body_size 55m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;   # makes req.secure true
        proxy_read_timeout 120s;                      # PDF/OMR exports can be slow
    }
}
```

```bash
ln -s /etc/nginx/sites-available/nexam /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

# TLS — point the domain's A record at the VPS first
certbot --nginx -d nexam.mati.gov.ph
```

Certbot rewrites the block for 443 + HTTP→HTTPS redirect and auto-renews.

## Migrating from cPanel

1. Export the database on cPanel (phpMyAdmin export or existing
   `nexam-dump.sql`) → `mysql nexam < dump.sql` on the VPS.
2. Copy `api/upload/` and `api/storage/` to the VPS (contains encrypted
   uploads and the vector index — **must come across**, plus
   `DATA_ENCRYPTION_KEY` must be the same key or the data is unreadable).
3. Rotate `JWT_SECRET` on the VPS — invalidates all sessions, which is
   fine during a cutover.
4. Repoint DNS, run certbot, smoke test.
5. Keep the cPanel environment untouched until the VPS is verified —
   see `DEPLOYMENT.md` "Disaster recovery" before removing anything there.

## Publishing an update

```bash
cd web && npm run build                                    # local
rsync -avz --delete --exclude node_modules --exclude .env \
  --exclude upload --exclude storage --exclude '*.log' \
  api/ user@vps:/srv/nexam/app/api/
rsync -avz --delete web/dist/ user@vps:/srv/nexam/app/web/dist/

ssh user@vps 'cd /srv/nexam/app/api && sudo -u nexam npm ci --legacy-peer-deps \
  && systemctl restart nexam'
```

Run `npm ci` even for code-only changes — it is cheap and guarantees the
lockfile and tree never drift. `ensureSchema()` migrates the DB at boot.

## Backups (cron, e.g. nightly)

```bash
mysqldump nexam | gzip > /srv/backups/nexam-$(date +%F).sql.gz
tar -czf /srv/backups/nexam-data-$(date +%F).tar.gz \
  -C /srv/nexam/app/api upload storage
```

Also keep an offline copy of `.env` — specifically `DATA_ENCRYPTION_KEY`
and `JWT_SECRET`. A backup without the encryption key restores nothing.

## Gotchas

- **`TRUST_PROXY=true` is mandatory behind nginx.** Without it
  `req.secure` stays false and `ENFORCE_HTTPS` rejects every request
  with 426. nginx must send `X-Forwarded-Proto` (config above does).
- **Never copy local `node_modules`.** `@napi-rs/canvas`, `hnswlib-node`
  and any `*.node` files are platform-specific — always `npm ci` on the
  server.
- **Worker is in-process.** `systemctl restart nexam` restarts API +
  worker together; `requeueStaleRunning()` recovers interrupted jobs.
- **Boot failure in production usually means env**, not code — check
  `journalctl -u nexam -e` for `Unsafe production configuration`.
- **`?token=` auth only works on file-serving paths** — that's by design,
  not a bug (see AGENTS.md).

## Smoke test after every deploy

1. `https://nexam.mati.gov.ph/api/health` → `{"status":"ok",...}`
2. `https://nexam.mati.gov.ph` → React app loads over HTTPS
3. Log in (exercises DB + bcrypt + JWT)
4. Upload a small material → exercises multer + encryption + embed job
   (hnswlib working)
5. Export a PDF/OMR sheet → exercises Chrome/Puppeteer
6. Approve a question → exercises similarity index write
7. `journalctl -u nexam -n 100` → no worker/schema errors
