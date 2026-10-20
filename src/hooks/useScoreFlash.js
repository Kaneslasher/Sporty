import { useEffect, useRef, useState } from 'react';

/**
 * Returns true for a short moment after a value changes (never on first render),
 * so a score can highlight when it updates during polling.
 */
export function useScoreFlash(value, durationMs = 1400) {
  const previousRef = useRef(value);
  const [flashing, setFlashing] = useState(false);

  useEffect(() => {
    if (previousRef.current === value) return undefined;
    previousRef.current = value;
    setFlashing(true);
    const timer = setTimeout(() => setFlashing(false), durationMs);
    return () => clearTimeout(timer);
  }, [value, durationMs]);

  return flashing;
}
