# Nexam

Nexam is a faculty-only assessment platform for syllabus-driven TOS creation,
RAG-grounded objective-question drafting, institution-wide duplicate checking,
print/LMS exam output, and mobile OMR grading.

## Architecture

- `web/` - React 19 instructor web application
- `api/` - Express 5 API, AI worker, LangChain/HNSWLib RAG pipeline, PDF/LMS output
- `mobile/` - Flutter instructor application for QR/OMR scanning
- MySQL - relational application data
- Google Gemini - primary generation and embedding provider
- Groq, then Ollama Cloud - generation fallbacks
- Transformers.js/MiniLM - local embedding fallback for retrieval and similarity

CodeIgniter and PHP are not part of the application architecture. In
production, Express can serve the compiled React application as well as `/api`.

## First-time setup

Requirements: Node.js 20+, MySQL/MariaDB, and Flutter for mobile development.

```bash
cd api
cp .env.example .env
npm install
npm run security:generate-key

# Create an empty `nexam` database, then bootstrap it once:
mysql -u root nexam < schema.sql

cd ../web
npm install

cd ../mobile
flutter pub get
```

Do not import `api/schema.sql` over an existing database: it intentionally
recreates tables. Existing installations use the numbered SQL files in
`api/migrations/`.

## Development

Run the API and React development server together (Ctrl+C stops both):

```bash
npm run dev
```

Or run them in separate terminals:

```bash
npm run dev:api
npm run dev:web
```

- React: `http://localhost:5173`
- API: `http://localhost:3000/api`
- Health check: `http://localhost:3000/api/health`

The Flutter app accepts the API base URL on its login screen. Physical devices
must use the development computer's LAN address rather than `localhost`.

### Ollama Cloud fallback

In **Superadmin → Settings → Ollama Cloud**, enter an Ollama API key and a
cloud API model available under your account allowance, then **Save settings**
and **Test connection**. The test checks JSON and exact source evidence using
invented material; it consumes a small amount of allowance and saves no questions.
Keys are masked on read and are never returned to instructor clients.

Alternatively, set `OLLAMA_API_KEY` and `OLLAMA_MODEL` in the API environment.
Database settings take precedence. Calls go directly to `https://ollama.com/api/chat`;
no local Ollama app, model download, or laptop connection is required. Gemini →
Groq → Ollama Cloud is used for quota, network, and service failures. Invalid
credentials or malformed requests still report errors for an administrator to fix.
If no provider is available, the job retains its existing saved drafts for a retry.

The free cloud allowance is limited. Keep billing/auto-reload disabled in Ollama
if you want free-only usage; Nexam does not change your billing settings. Cloud
responses still pass the normal answer/evidence checks and instructor review.

## Production

```bash
npm run build
npm start
```

Set `NODE_ENV=production`, `SERVE_WEB=true`, `TRUST_PROXY=true`, and keep
`ENFORCE_HTTPS=true`. Production startup refuses insecure secrets or an
unconfirmed at-rest encryption deployment. Configure:

- a rotated `JWT_SECRET`;
- the backed-up `DATA_ENCRYPTION_KEY`;
- HTTPS at the reverse proxy;
- encrypted database and filesystem volumes with `DATA_AT_REST_CONFIRMED=true`;
- `DB_SSL_CA_FILE` when MySQL is reached over a network;
- production CORS origins, SMTP credentials, and AI provider keys.

Uploaded materials are AES-256-GCM protected by the application. Student names
and numbers are field-encrypted with keyed hashes for lookup. The database and
vector/PDF storage still require encrypted production volumes.

## Verification

```bash
npm test
cd mobile && flutter test && flutter analyze
```

The research requirements are preserved under `docs/research/`.
