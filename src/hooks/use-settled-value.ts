import { useCallback, useEffect, useState } from "react";

/** How long typing or sliding pauses before a settled value is sent. */
const SETTLE_MS = 300;

/**
 * A value the Visitor edits locally and that is sent (to the URL, say) once
 * they pause. It follows `urlValue` when something else changes it (Clear
 * filters, a link), but not while the URL is only catching up with what was
 * sent. `reset` sets it without sending it.
 */
export function useSettledValue<T>(
  urlValue: T,
  send: (value: T) => void,
  normalise: (value: T) => T,
): [T, (value: T) => void, (value: T) => void] {
  const [value, setValue] = useState(urlValue);
  const [sent, setSent] = useState(urlValue);
  const [seen, setSeen] = useState(urlValue);
  if (!Object.is(seen, urlValue)) {
    setSeen(urlValue);
    if (!Object.is(urlValue, sent)) {
      setValue(urlValue);
      setSent(urlValue);
    }
  }

  useEffect(() => {
    const next = normalise(value);
    if (Object.is(next, sent)) return;
    const timer = setTimeout(() => {
      setSent(next);
      send(next);
    }, SETTLE_MS);
    return () => clearTimeout(timer);
  }, [value, sent, send, normalise]);

  const reset = useCallback((next: T) => {
    setValue(next);
    setSent(next);
  }, []);
  return [value, setValue, reset];
}
