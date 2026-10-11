/**
 * UserAvatar — renders the user's uploaded profile photo, falling back to
 * initials. The photo is fetched with the auth header (GET /auth/avatar) and
 * cached per `avatar_v`, so a re-upload busts the cache automatically.
 */
import { useEffect, useState } from 'react';
import api from '../lib/api.js';

// `${userId}:${avatar_v}` -> objectURL (or null when the photo is missing).
const urlCache = new Map();

export function initialsFor(name) {
  return (name || 'U')
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export default function UserAvatar({ user, className = 'avatar' }) {
  const version = user?.has_avatar ? user.avatar_v || 0 : 0;
  const key = version ? `${user.id}:${version}` : null;
  const [src, setSrc] = useState(key ? urlCache.get(key) || null : null);

  useEffect(() => {
    if (!key) { setSrc(null); return undefined; }
    const cached = urlCache.get(key);
    if (cached !== undefined) { setSrc(cached); return undefined; }
    let alive = true;
    api.getBlob('/auth/avatar')
      .then((url) => {
        if (!alive) return;
        urlCache.set(key, url);
        setSrc(url);
      })
      .catch(() => { if (alive) setSrc(null); });
    return () => { alive = false; };
  }, [key]);

  if (src) {
    return <img className={className} src={src} alt="" aria-hidden="true" />;
  }
  return <span className={className}>{initialsFor(user?.full_name)}</span>;
}
