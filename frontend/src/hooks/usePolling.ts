import { useEffect, useRef } from "react";

/** Runs `callback` immediately, then every `intervalMs`, until unmount. */
export function usePolling(callback: () => void, intervalMs: number) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    callbackRef.current();
    const id = setInterval(() => callbackRef.current(), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
}
