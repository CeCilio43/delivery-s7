import { useEffect, useRef } from 'react';

// Order pages get status changes pushed over the notification websocket, so
// polling is only a fallback: rarely while the socket is up (in case a push
// was missed), often while it's down.
export const ORDER_POLL_INTERVAL_MS = { connected: 15000, disconnected: 2000 };

/**
 * Calls `callback` every `intervalMs` while `active` is true. Used to watch
 * orders whose payment is still being settled over the event bus.
 */
export function usePolling(callback: () => void, active: boolean, intervalMs = 2000): void {
  const callbackRef = useRef(callback);
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => callbackRef.current(), intervalMs);
    return () => clearInterval(timer);
  }, [active, intervalMs]);
}
