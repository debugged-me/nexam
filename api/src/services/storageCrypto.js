import crypto from 'crypto';
import fs from 'fs/promises';
import env from '../config/env.js';

const FILE_MAGIC = Buffer.from('NEXAMENC1');
const TEXT_PREFIX = 'nexam:v1:';
const IV_BYTES = 12;
const TAG_BYTES = 16;

function encryptionKey(required = false) {
  const configured = String(env.dataEncryption.key || '').trim();
  if (!configured) {
    if (required) throw new Error('DATA_ENCRYPTION_KEY is required to read protected data.');
    return null;
  }

  let key;
  if (/^[0-9a-f]{64}$/i.test(configured)) key = Buffer.from(configured, 'hex');
  else key = Buffer.from(configured, 'base64');
  if (key.length !== 32) {
    throw new Error('DATA_ENCRYPTION_KEY must decode to exactly 32 bytes.');
  }
  return key;
}

function encryptBuffer(value, key) {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(value), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]);
}

function decryptBuffer(value, key) {
  if (value.length < IV_BYTES + TAG_BYTES) throw new Error('Encrypted payload is truncated.');
  const iv = value.subarray(0, IV_BYTES);
  const tag = value.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const ciphertext = value.subarray(IV_BYTES + TAG_BYTES);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

export function protectText(value) {
  if (value == null || value === '') return value;
  const text = String(value);
  if (text.startsWith(TEXT_PREFIX)) return text;
  const key = encryptionKey(true);
  return `${TEXT_PREFIX}${encryptBuffer(Buffer.from(text, 'utf8'), key).toString('base64')}`;
}

export function unprotectText(value) {
  if (value == null || value === '') return value;
  const text = String(value);
  if (!text.startsWith(TEXT_PREFIX)) return text; // legacy plaintext, migrated separately
  const key = encryptionKey(true);
  return decryptBuffer(Buffer.from(text.slice(TEXT_PREFIX.length), 'base64'), key).toString('utf8');
}

export function blindIndex(value) {
  if (value == null || String(value).trim() === '') return null;
  const key = encryptionKey(true);
  const normalized = String(value).normalize('NFKC').trim().toLowerCase();
  return crypto.createHmac('sha256', key).update(normalized).digest('hex');
}

export async function readProtectedFile(filePath) {
  const value = await fs.readFile(filePath);
  if (!value.subarray(0, FILE_MAGIC.length).equals(FILE_MAGIC)) return value;
  return decryptBuffer(value.subarray(FILE_MAGIC.length), encryptionKey(true));
}

export async function encryptFileAtRest(filePath) {
  const key = encryptionKey(env.isProd);
  if (!key) return false;
  const value = await fs.readFile(filePath);
  if (value.subarray(0, FILE_MAGIC.length).equals(FILE_MAGIC)) return false;

  const temporaryPath = `${filePath}.encrypting`;
  await fs.writeFile(temporaryPath, Buffer.concat([FILE_MAGIC, encryptBuffer(value, key)]), { mode: 0o600 });
  await fs.rename(temporaryPath, filePath);
  return true;
}

export function isProtectedText(value) {
  return typeof value === 'string' && value.startsWith(TEXT_PREFIX);
}

export default {
  protectText,
  unprotectText,
  blindIndex,
  readProtectedFile,
  encryptFileAtRest,
  isProtectedText,
};
