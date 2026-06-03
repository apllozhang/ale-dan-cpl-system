import { useRef } from "react";

/**
 * usePersistFn instead of useCallback to reduce cognitive load
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function usePersistFn<T extends (...args: any[]) => any>(fn: T) {
  const fnRef = useRef<T>(fn);
  fnRef.current = fn;

  const persistFn = useRef<T>(null);
  if (!persistFn.current) {
    persistFn.current = ((...args: Parameters<T>) => fnRef.current!(...args)) as T;
  }

  return persistFn.current!;
}
