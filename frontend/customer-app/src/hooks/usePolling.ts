import { useEffect, useRef } from 'react';

/**
 * Calls `callback` every `intervalMs` while `active` is true. Used to watch
 * orders whose payment is still being settled over the event bus; a
 * per-user websocket push would replace this.
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
