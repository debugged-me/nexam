/**
 * youtube.js — YouTube Data API v3 metadata (server-side).
 *
 * Official API covers what the youtube-transcript scraper cannot: video
 * title/description/channel, real "not found/private" errors, and caption
 * availability. The key lives in the `youtube_api_key` setting (env
 * YOUTUBE_API_KEY fallback) — it is server-only, never sent to the browser.
 * When unconfigured, every helper degrades to null so callers fall back to
 * the previous scraping-only behavior.
 */
import { getSetting } from './settings.js';
import env from '../config/env.js';

const API_BASE = 'https://www.googleapis.com/youtube/v3/videos';

/** Pull the 11-char video ID out of any common YouTube URL shape. */
export function youtubeVideoId(url) {
  const match = String(url || '').match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([\w-]{11})/
  );
  return match ? match[1] : null;
}

async function apiKey() {
  const key = String(await getSetting('youtube_api_key', env.youtube.apiKey) || '').trim();
  return key || null;
}

/** ISO-8601 duration (PT12M34S) → seconds. */
function parseDuration(iso) {
  const m = String(iso || '').match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return null;
  return (Number(m[1] || 0) * 3600) + (Number(m[2] || 0) * 60) + Number(m[3] || 0);
}

/**
 * Fetch video metadata. Returns null when no API key is configured.
 * Throws Error('youtube_unavailable') when the key is set but the API
 * rejects it, and Error('youtube_not_found') for deleted/private videos —
 * callers decide how to surface them.
 */
export async function fetchVideoInfo(videoId) {
  const key = await apiKey();
  if (!key) return null;

  const url = `${API_BASE}?part=snippet,contentDetails&id=${encodeURIComponent(videoId)}&key=${key}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`youtube_unavailable: ${res.status}`);

  const data = await res.json();
  const item = data.items?.[0];
  if (!item) throw new Error('youtube_not_found');

  return {
    id: item.id,
    title: item.snippet?.title || '',
    channelTitle: item.snippet?.channelTitle || '',
    description: item.snippet?.description || '',
    publishedAt: item.snippet?.publishedAt || null,
    durationSec: parseDuration(item.contentDetails?.duration),
    // contentDetails.caption is 'true' when manual or auto captions exist.
    hasCaptions: item.contentDetails?.caption === 'true',
  };
}
