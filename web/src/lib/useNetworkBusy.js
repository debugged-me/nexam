/**
 * useNetworkBusy — true while API requests are in flight, debounced so quick
 * responses never flash an indicator and slow ones don't flicker off/on.
 */
import { useEffect, useState, useSyncExternalStore } from 'react';
import { getActivity, subscribeActivity } from './api.js';

export default function useNetworkBusy({ delay = 180, linger = 320 } = {}) {
  const active = useSyncExternalStore(subscribeActivity, getActivity) > 0;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(active), active ? delay : linger);
    return () => clearTimeout(timer);
  }, [active, delay, linger]);

  return visible;
}
