/**
 * Print banner hooks — object URLs for the caller's uploaded print letterhead
 * (kind "head") and optional footer banner (kind "foot"), fetched with the
 * auth header and cached per version so a re-upload busts the cache. The
 * fetch runs on mount — even under display:none print blocks — so images
 * are ready before window.print().
 */
import { useEffect, useState } from 'react';
import api from './api.js';

// `${userId}:${kind}:${v}` -> objectURL (or null when missing).
const urlCache = new Map();

const PATHS = { head: '/auth/letterhead', foot: '/auth/letterhead-foot' };

export function usePrintBannerSrc(user, kind = 'head') {
  const has = kind === 'foot' ? user?.has_letterhead_foot : user?.has_letterhead;
  const version = has ? (kind === 'foot' ? user.letterhead_foot_v : user.letterhead_v) || 0 : 0;
  const key = version ? `${user.id}:${kind}:${version}` : null;
  const [resolved, setResolved] = useState({});

  const src = key ? (resolved[key] ?? urlCache.get(key) ?? null) : null;

  useEffect(() => {
    if (!key || resolved[key] !== undefined || urlCache.get(key) !== undefined) return undefined;
    let alive = true;
    api.getBlob(PATHS[kind])
      .then((url) => {
        urlCache.set(key, url);
        if (alive) setResolved((s) => (s[key] !== undefined ? s : { ...s, [key]: url }));
      })
      .catch(() => { if (alive) setResolved((s) => ({ ...s, [key]: null })); });
    return () => { alive = false; };
  }, [key, kind, resolved]);

  return src;
}

export function useLetterheadSrc(user) { return usePrintBannerSrc(user, 'head'); }
export function useLetterheadFootSrc(user) { return usePrintBannerSrc(user, 'foot'); }

export default useLetterheadSrc;
