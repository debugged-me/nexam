/**
 * AvatarPickerModal — choose, preview, and sanitize a profile photo.
 *
 * The modal owns the whole flow: a drop zone / browse button picks the file,
 * the image is then decoded and re-encoded through a canvas (center-cropped
 * square, downscaled to 512px PNG). The canvas output is pure pixel data: no
 * EXIF or other metadata, no appended payloads, no HTML/SVG polyglot tricks.
 * What the user sees in the preview is exactly what gets uploaded — nothing
 * else can ride along inside the file. The API independently sniffs the
 * magic bytes too, so non-web clients can't skip this.
 */
import { useRef, useState } from 'react';
import { Camera, ImagePlus, RefreshCw } from 'lucide-react';
import Modal from './Modal.jsx';
import { useToast } from './Toast.jsx';
import api, { ApiError } from '../lib/api.js';

const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const MAX_INPUT_BYTES = 25 * 1024 * 1024;
const MAX_INPUT_DIM = 8192; // decompression-bomb guard: canvas alloc is w*h*4
const OUT_SIZE = 512;

async function sanitize(file) {
  if (!ACCEPTED.includes(file.type)) {
    throw new Error('Use a PNG, JPG, WebP, or GIF image.');
  }
  if (file.size > MAX_INPUT_BYTES) throw new Error('Image is too large (25 MB max).');

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('That file is not a valid image.'));
      el.src = url;
    });
    const { naturalWidth: w, naturalHeight: h } = img;
    if (!w || !h || w > MAX_INPUT_DIM || h > MAX_INPUT_DIM) {
      throw new Error('Image dimensions are not supported.');
    }

    const side = Math.min(w, h);
    const sx = Math.round((w - side) / 2);
    const sy = Math.round((h - side) / 2);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = OUT_SIZE;
    canvas.getContext('2d').drawImage(img, sx, sy, side, side, 0, 0, OUT_SIZE, OUT_SIZE);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('Could not process that image.');
    return { blob, previewUrl: canvas.toDataURL('image/png') };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function AvatarPickerModal({ onClose, onUploaded }) {
  const toast = useToast();
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [ready, setReady] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false); // sanitizing or uploading
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  async function pickFile(next) {
    if (!next || busy) return;
    setFile(next);
    setReady(null);
    setError('');
    setBusy(true);
    try {
      setReady(await sanitize(next));
    } catch (e) {
      setError(e.message || 'Could not read that image.');
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setFile(null);
    setReady(null);
    setError('');
  }

  async function confirm() {
    if (!ready || uploading) return;
    setUploading(true);
    try {
      const clean = new File([ready.blob], 'avatar.png', { type: 'image/png' });
      const result = await api.uploadFile('/auth/avatar', clean);
      toast.success('Profile photo updated.');
      onUploaded?.(result);
      onClose?.();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Photo upload failed.');
      setUploading(false);
    }
  }

  return (
    <Modal
      open
      size="sm"
      title="Change profile photo"
      subtitle="Preview it first — it will be cropped to a square."
      onClose={() => { if (!uploading) onClose?.(); }}
      footer={
        <>
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={uploading}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={confirm}
            disabled={!ready || uploading}
          >
            {uploading && <span className="btn-spinner" aria-hidden="true" />}
            <Camera size={15} /> {uploading ? 'Saving…' : 'Use this photo'}
          </button>
        </>
      }
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(',')}
        hidden
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; pickFile(f); }}
      />

      {!file ? (
        <button
          type="button"
          className={`avatar-picker-drop${dragOver ? ' is-over' : ''}`}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            pickFile(e.dataTransfer?.files?.[0]);
          }}
        >
          <ImagePlus size={26} aria-hidden="true" />
          <strong>Drop an image here, or browse</strong>
          <small>PNG, JPG, WebP, or GIF — up to 25 MB.</small>
        </button>
      ) : error ? (
        <>
          <div className="modal-warn">{error}</div>
          <button type="button" className="btn btn-outline" onClick={reset}>
            <RefreshCw size={15} /> Choose a different image
          </button>
        </>
      ) : !ready ? (
        <div className="avatar-picker-loading">
          <span className="btn-spinner" aria-hidden="true" /> Preparing preview…
        </div>
      ) : (
        <div className="avatar-picker-body">
          <img className="avatar-picker-preview" src={ready.previewUrl} alt="Profile photo preview" />
          <div className="avatar-picker-meta">
            <strong>{file.name}</strong>
          </div>
          <button type="button" className="btn btn-outline btn-sm" onClick={reset} disabled={uploading}>
            <RefreshCw size={14} /> Choose another
          </button>
        </div>
      )}
    </Modal>
  );
}
