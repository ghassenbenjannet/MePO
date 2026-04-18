import { useEffect, useRef, useState } from "react";

/** Debounce a value — avoids hammering the API on every keystroke */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/** Listen for a keyboard shortcut globally */
export function useKeyDown(
  key: string,
  handler: (e: KeyboardEvent) => void,
  opts: { meta?: boolean; ctrl?: boolean; shift?: boolean; enabled?: boolean } = {},
) {
  const { meta = false, ctrl = false, shift = false, enabled = true } = opts;
  const ref = useRef(handler);
  ref.current = handler;

  useEffect(() => {
    if (!enabled) return;
    function listener(e: KeyboardEvent) {
      if (meta && !e.metaKey) return;
      if (ctrl && !e.ctrlKey) return;
      if (shift && !e.shiftKey) return;
      if (e.key === key) ref.current(e);
    }
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [key, meta, ctrl, shift, enabled]);
}

/** Track whether an element is mounted */
export function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  return mounted;
}

/** Click outside a ref — close dropdowns, menus, etc. */
export function useClickOutside(
  ref: React.RefObject<HTMLElement | null>,
  handler: () => void,
  enabled = true,
) {
  useEffect(() => {
    if (!enabled) return;
    function listener(e: MouseEvent) {
      if (!ref.current || ref.current.contains(e.target as Node)) return;
      handler();
    }
    document.addEventListener("mousedown", listener);
    return () => document.removeEventListener("mousedown", listener);
  }, [ref, handler, enabled]);
}

/** Previous value of a ref — useful for detecting document switches */
export function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T | undefined>(undefined);
  useEffect(() => { ref.current = value; });
  return ref.current;
}
