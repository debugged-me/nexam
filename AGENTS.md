# Nexam project guidelines

## Active architecture

Nexam uses React (`web/`), Node.js/Express (`api/`), MySQL, and Flutter
(`mobile/`). Do not add PHP or CodeIgniter routes, views, sessions, or assets.
The Node API is the single backend for both clients.

## Scope contracts

- Users are faculty/instructors only. Protected API calls reject every other role.
- User-owned subjects, drafts, TOS records, materials, exams, and results must
  always be scoped by the authenticated instructor ID.
- Approved questions form an institution-wide read-only bank. Reuse copies an
  item into the receiving instructor's private draft queue for similarity review
  and explicit approval.
- Question statuses are exactly `draft | active | rejected`; rejection is soft.
- Objective types are exactly `mcq | true_false | matching | identification`.
  The UI labels `identification` as “Fill in the blank.”
- Only finalized TOS blueprints may drive question generation or exam assembly.
- Exam assembly must exactly satisfy the finalized topic-by-Bloom matrix.
- Generated output is exactly Set A and Set B, with answer keys, TOS reports,
  QR-linked OMR sheets, GIFT, and Canvas/QTI XML.
- Every AI draft must cite an exact evidence span found in its retrieved chunks.
  Missing or stale grounding fails closed and blocks approval.
- The institution similarity index contains approved questions only. Material
  retrieval indices remain private and subject-scoped.

## OMR contracts

Canonical answers:

- `mcq`: one option letter, such as `B`
- `true_false`: `T | F`
- `matching`: comma-joined letters in premise order, such as `B,A,D,C`
- `identification`: `CORRECT | INCORRECT` after instructor review

QR payload: `{ v, examId, setId, set, count, types[] }`.

## Security

- Use parameterized MySQL queries and enforce ownership on every private ID.
- Do not return passwords, hashes, OTPs, provider keys, or grounding material
  belonging to another instructor.
- Production must use HTTPS, a rotated JWT secret, TLS to remote MySQL, and
  encrypted database/filesystem volumes.
- Uploaded course files and student PII use `storageCrypto.js`; never bypass it.
- Keep `api/upload/` and `api/storage/` outside Express static routes.
- Validate file MIME types, rename uploads, cap size, and block SSRF for URLs.
- Tokens are stored in Flutter secure storage. Never put secrets in Vite env vars.

## UI

- Use Lucide icons only.
- Use the local Google Sans and Inter files in `web/public/fonts/`.
- Keep page CSS in `web/src/styles/`; avoid executable inline scripts/styles.
- All pages must work at 380px, 768px, and 1024px+ with 44px mobile targets.

## Verification

```bash
cd api && npm test
for f in $(find src scripts -name "*.js"); do node --check "$f"; done
cd web && npm run build && npm run lint
cd mobile && flutter test && flutter analyze
```
