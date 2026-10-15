/**
 * DriveImportButton — "Import from Google Drive" for the materials uploader.
 *
 * Flow (all client-side; the server only hands out public config):
 *   1. GET /api/materials/drive-config → { enabled, clientId, apiKey, appId, boundEmail }
 *   2. GIS token client (scope drive.file) → short-lived access token;
 *      boundEmail is enforced — a token for another account is revoked
 *      and the user is sent to Account settings to rebind.
 *   3. Google Picker filtered to the types the material pipeline accepts
 *      (pdf/docx/pptx/txt/md + Google Docs/Sheets/Slides)
 *   4. Picked docs are fetched with the access token — regular files via
 *      files.get?alt=media, Google-native docs via files.export → PDF —
 *      then handed to onFiles as File objects for the normal upload queue.
 *
 * drive.file is non-sensitive: per-file access granted by the picker itself —
 * no verification, no unverified-app screen, no user cap.
 */
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import api from '../lib/api.js';
import { loadGsi, requestDriveToken, fetchDriveUser, revokeToken } from '../lib/googleDrive.js';
import { useToast } from './Toast.jsx';
const MAX_BYTES = 50 * 1024 * 1024; // matches the server upload cap

// MIME types the material pipeline can extract + Google-native types we
// export to PDF.
const ACCEPTED_MIMES = [
  'application/pdf',
  'text/plain',
  'text/markdown',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.google-apps.document',
  'application/vnd.google-apps.presentation',
  'application/vnd.google-apps.spreadsheet',
].join(',');

// Google-native docs aren't downloadable — they must be exported to a real
// MIME. PDF keeps the layout and extracts well.
const EXPORT_MIME = 'application/pdf';

let gapiLoader = null;
function loadPicker() {
  if (!gapiLoader) {
    gapiLoader = new Promise((resolve, reject) => {
      if (window.google?.picker) return resolve();
      const s = document.createElement('script');
      s.src = 'https://apis.google.com/js/api.js';
      s.async = true;
      s.defer = true;
      s.onload = () => window.gapi.load('picker', () => resolve());
      s.onerror = () => reject(new Error('Google Picker failed to load'));
      document.head.appendChild(s);
    });
  }
  return gapiLoader;
}

/** Download one picked Drive file as a File (exporting Google-native docs). */
async function fetchDriveFile(doc, token) {
  const isGoogleNative = doc.mimeType?.startsWith('application/vnd.google-apps.');
  const url = isGoogleNative
    ? `https://www.googleapis.com/drive/v3/files/${doc.id}/export?mimeType=${encodeURIComponent(EXPORT_MIME)}`
    : `https://www.googleapis.com/drive/v3/files/${doc.id}?alt=media&supportsAllDrives=true`;

  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Could not download ${doc.name} (${res.status}).`);

  const blob = await res.blob();
  if (blob.size > MAX_BYTES) throw new Error(`${doc.name} is over the 50 MB limit.`);

  const name = isGoogleNative
    ? `${String(doc.name || 'document').replace(/\.[^.]+$/, '')}.pdf`
    : doc.name;
  return new File([blob], name, { type: isGoogleNative ? EXPORT_MIME : (doc.mimeType || blob.type) });
}

export default function DriveImportButton({ onFiles, disabled = false }) {
  const toast = useToast();
  const [config, setConfig] = useState(null); // null = still loading / disabled
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    api.get('/materials/drive-config')
      .then((d) => { if (live && d?.enabled) setConfig(d); })
      .catch(() => {});
    return () => { live = false; };
  }, []);

  async function openPicker() {
    setBusy(true);
    try {
      await Promise.all([loadGsi(), loadPicker()]);

      const token = await requestDriveToken(config.clientId, { hint: config.boundEmail });

      // Enforce the connected account: if the token belongs to a different
      // Google account, revoke it and point the user at Account settings.
      if (config.boundEmail) {
        const driveUser = await fetchDriveUser(token);
        if (driveUser.emailAddress?.toLowerCase() !== config.boundEmail.toLowerCase()) {
          revokeToken(token);
          toast.error(`Drive import is connected to ${config.boundEmail} — update it in Account settings to use another account.`);
          return;
        }
      }

      const view = new window.google.picker.DocsView(window.google.picker.ViewId.DOCS)
        .setMimeTypes(ACCEPTED_MIMES)
        .setIncludeFolders(true)
        .setOwnedByMe(true)
        .setSelectFolderEnabled(false);

      const picker = new window.google.picker.PickerBuilder()
        .setOAuthToken(token)
        .setDeveloperKey(config.apiKey)
        .setAppId(config.appId)
        .addView(view)
        .enableFeature(window.google.picker.Feature.MULTISELECT_ENABLED)
        .setTitle('Import course materials')
        .setCallback(async (data) => {
          if (data.action !== window.google.picker.Action.PICKED) return;
          try {
            const files = await Promise.all((data.docs || []).map((d) => fetchDriveFile(d, token)));
            if (files.length) onFiles(files);
          } catch (err) {
            toast.error(err?.message || 'Could not download from Drive.');
          }
        })
        .build();
      // Google's default dialog is small; give it most of the viewport.
      picker.setSize?.(Math.min(1080, Math.round(window.innerWidth * 0.9)),
                       Math.min(680, Math.round(window.innerHeight * 0.85)));
      picker.setVisible(true);
    } catch {
      // Popup closed or consent denied — no toast, the user can retry.
    } finally {
      setBusy(false);
    }
  }

  if (!config) return null;

  return (
    <div className="mat-drive-row">
      <span className="mat-drive-or">or</span>
      <button type="button" className="btn btn-outline mat-drive-btn" onClick={openPicker} disabled={disabled || busy}>
        {busy ? <Loader2 size={15} className="mat-spin" /> : (
          <svg width="15" height="15" viewBox="0 0 87.3 78" aria-hidden="true" focusable="false">
            <path fill="#0066da" d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" />
            <path fill="#00ac47" d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0-1.2 4.5h27.5z" />
            <path fill="#ea4335" d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.5l5.85 11.5z" />
            <path fill="#00832d" d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.25-4.4-1.25h-18.95c-1.5 0-3.05.45-4.4 1.25z" />
            <path fill="#2684fc" d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.25 4.4 1.25h50.9z" />
            <path fill="#ffba00" d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 15.65 27.15h27.55c0-1.55-.4-3.1-1.2-4.5z" />
          </svg>
        )}
        {busy ? 'Opening Drive…' : 'Import from Google Drive'}
      </button>
    </div>
  );
}
