# Google Cloud integrations — feature checklist

Candidate Google Cloud Console services for Nexam, mapped to the existing
system. Check items off as they ship. Effort = rough relative size
(S < M < L), not an estimate in hours.

## Already in use (baseline)

| Service | Where | Notes |
| ------- | ----- | ----- |
| Gemini API (AI Studio keys) | `api/src/services/aiProvider.js`, `aiConfig.js` | Generation, review, blind solves, 3072-dim embeddings |
| reCAPTCHA v2 | `api/src/services/captcha.js` | Registration only; keys in DB, set from superadmin console |
| YouTube transcripts | `api/src/services/extractors.js` | Via unofficial `youtube-transcript` package (scraping) |

## User-facing features

- [x] **Google Sign-In (OAuth 2.0)** — effort: S — **live** (consent screen published, code-exchange flow, tested end-to-end)
  - API: `POST /api/auth/google` verifies the ID token
    (`google-auth-library`, all configured client IDs as audiences), applies
    the standard status checks, and auto-provisions instructors —
    `active` on `auto_approve_domains`, `pending` otherwise.
    `GET /api/auth/google-client` exposes the web client ID (public).
  - Web: `components/GoogleSignInButton.jsx` on `LoginPage` (hidden when
    unconfigured). Mobile: `google_sign_in` v7 in `login_screen.dart`,
    `loginWithGoogle` in `auth_api.dart`/`auth_controller.dart`.
  - Superadmin console → Settings → "Google sign-in": `google_client_id`
    (web, public — clears to disable) + `google_client_ids` (extra mobile
    audiences). Env fallbacks: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_IDS`.
  - **Still to do (console/native, needs you):**
    1. GCP project → OAuth consent screen (External, scopes
       `openid email profile`).
    2. Create a **Web** client ID (JS origin = web URL) → paste into the
       superadmin settings field.
    3. Android: create an **Android** client ID (needs the app's SHA-1
       signing cert); iOS: an **iOS** client ID (bundle ID). With
       `serverClientId` = web ID the ID tokens already carry the web
       audience, so extras are only needed if you change that setup.
    4. Add the GCP project number as `GOOGLE_CLIENT_ID`-linked web config
       for web builds of Flutter if you ever ship Flutter web.

- [x] **Google Drive import for materials** — effort: M — **live** (picker + per-user connected account, `drive.file` — tested end-to-end)
  - Web: `components/DriveImportButton.jsx` on the Materials upload dialog —
    token client (`drive.file`, non-sensitive — picker grants per-file
    access, no verification needed) → Google Picker (multi-select, filtered
    to pdf/docx/pptx/txt/md + Google Docs/Sheets/Slides) → downloads blobs
    (`files.get?alt=media`; Google-native via `files.export` → PDF) → hands
    `File[]` to the existing upload queue. No new upload code.
  - API: `GET /api/materials/drive-config` (authed) →
    `{ enabled, clientId, apiKey, appId, boundEmail }` — `boundEmail` is the
    user's connected Drive account (`users.google_drive_email`, bound via
    Account → Google Drive card; import enforces it: wrong-account tokens
    are revoked).
  - Settings: `google_picker_api_key`, `google_app_id` (project number),
    both editable in the superadmin Google card. Env fallbacks:
    `GOOGLE_PICKER_API_KEY`, `GOOGLE_APP_ID`.
  - **Still to do (console, needs you):**
    1. APIs & Services → enable **Google Picker API** + **Google Drive API**.
    2. Credentials → **API key**, restrict it to Picker + Drive APIs
       (and localhost/prod referrers) → paste into settings.
    3. Project number (Dashboard → Project info) → "GCP project number"
       field.
    4. Google Auth Platform → Data Access → add scope
       `.../auth/drive.file` (**non-sensitive** — no unverified-app screen,
       no user cap, no verification required. Deliberately chosen over
       `drive.readonly`, which is sensitive and would need it).

- [ ] **Google Classroom integration** — effort: L
  - Sync course rosters → `students` table (`findOrCreateStudent` already
    absorbs external identities); push exam results back as grades on
    Classroom coursework.
  - Console: Classroom API + OAuth scopes + Google app verification.
  - Highest institutional-adoption value; most compliance overhead.

- [ ] **YouTube Data API v3** — effort: S
  - Replace/augment `youtube-transcript` with the official API: reliable
    captions, video title/description (auto-name materials), and chapters
    (map to TOS topics).
  - Console: enable YouTube Data API v3 + one API key. Keep
    `youtube-transcript` as fallback for caption-less videos.

- [ ] **Google Sheets export** — effort: M
  - Export exam results, item analysis, and scan archives to a shared Sheet
    for deans/registrars. Sits beside `api/src/services/lmsExport.js`.
  - Console: Sheets API + Drive scope (to create the file).
  - Needs the same OAuth plumbing as Drive/Classroom — do together.

- [ ] **Google Forms API (quiz export)** — effort: M
  - Export assembled Set A/B exams as Google Forms quizzes for online
    delivery, next to GIFT / Canvas QTI in `lmsExport.js`.
  - Console: Forms API. Only MCQ/TF/identification map cleanly — matching
    needs a fallback representation.

## Infrastructure

- [ ] **Cloud Storage (GCS) for files** — effort: M
  - Move `api/upload/` + `api/storage/` (materials, generated exam PDFs,
    OMR sheets) off the VPS disk. Keep `storageCrypto.js` envelope
    encryption — store ciphertext in the bucket.
  - Console: bucket + service account JSON. Package: `@google-cloud/storage`.
  - Plan migration of existing files + signed-URL downloads to replace
    `?token=` file serving where sensible.

- [ ] **Vertex AI (Gemini under GCP project)** — effort: M
  - Same Gemini models, billed under a GCP project: higher quotas,
    provisioned throughput, project-level logging.
  - Wire in as another provider in `aiProvider.js` (LangChain supports
    `langchain-google-vertexai`); keep AI-Studio keys and Groq as fallbacks.
  - Console: enable Vertex AI + service account.

- [ ] **Document AI / Vision OCR for scanned sheets** — effort: L
  - Read handwritten student name/ID and identification answers from scan
    photos; today identification is bubbled CORRECT/INCORRECT for manual
    grading — OCR could pre-fill the written response for review.
  - Console: Vision API (cheaper) or Document AI (better handwriting).
    Mobile already has the image; add an API call + review UI field.
  - Privacy note: sends student PII images to Google — check school policy.

- [ ] **Firebase Cloud Messaging (push notifications)** — effort: M
  - Notify the Flutter app: generation job done, scan sync status,
    approval-queue alerts for admins.
  - Console: Firebase project → FCM. Packages: `firebase_messaging`
    (Flutter), `firebase-admin` or FCM HTTP v1 (API).

- [ ] **reCAPTCHA Enterprise** — effort: S
  - Upgrade v2 → score-based, extend to login (currently registration-only
    per `captcha.js`). Console: reCAPTCHA Enterprise key + site key swap.

## Brainstorm / parking lot

Ideas not yet sized — add candidates here:

- Gmail API (send mail through the school's Workspace domain instead of
  SMTP/nodemailer).
- BigQuery export for institution-wide item analysis across terms.
- Google Docs export (TOS reports / answer keys as Docs instead of PDF).
- Cloud TTS for accessibility (read questions aloud).
- Google Forms roster import alternative to Classroom for non-Classroom
  schools.
- Workspace domain-restricted sharing for generated Sheets.

## Easiest first (suggested order)

1. YouTube Data API v3 — one API key, no OAuth, replaces brittle scraping.
2. Google Sign-In — no sensitive scopes, immediate UX win.
3. reCAPTCHA Enterprise — config-level change.
4. Google Drive import — unlocks the OAuth plumbing that Sheets, Forms,
   and Classroom then reuse.
5. Cloud Storage — pure backend, no user-facing surface.
6. FCM — independent of the OAuth work; parallel-track.
7. Vertex AI — provider entry + service account.
8. Sheets / Forms export — builds on Drive OAuth.
9. Document AI OCR — needs privacy review + review-UI work.
10. Google Classroom — most verification overhead, do last but highest value.
