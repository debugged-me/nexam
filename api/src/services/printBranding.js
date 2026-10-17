import path from 'path';
import { readProtectedFile } from './storageCrypto.js';

const IMAGE_MIME = Object.freeze({
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
});

async function protectedImageDataUri(filePath) {
  if (!filePath) return null;
  const mime = IMAGE_MIME[path.extname(filePath).toLowerCase()];
  if (!mime) return null;

  try {
    const image = await readProtectedFile(filePath);
    return `data:${mime};base64,${image.toString('base64')}`;
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

/** Load only the authenticated owner's private print branding. */
export async function loadPrintBranding(db, userId) {
  const [rows] = await db.query(
    `SELECT letterhead_path, letterhead_foot_path FROM users WHERE id = :userId LIMIT 1`,
    { userId }
  );
  const user = rows[0] || {};
  const [letterhead, footer] = await Promise.all([
    protectedImageDataUri(user.letterhead_path),
    protectedImageDataUri(user.letterhead_foot_path),
  ]);
  return { letterhead, footer };
}

export default { loadPrintBranding };
