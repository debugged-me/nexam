export function parseScope(value) {
  if (typeof value !== 'string') return value || null;
  try { return JSON.parse(value); } catch { return null; }
}

export function timeFrameLabel(scope) {
  if (!scope) return 'No schedule stated';
  return [scope.label, scope.weekStart ? `Weeks ${scope.weekStart}–${scope.weekEnd}` : 'Weeks not specified'].filter(Boolean).join(' · ');
}

