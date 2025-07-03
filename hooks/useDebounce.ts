import { useEffect, useMemo, useRef } from 'react';

type Callback = (...args: any[]) => void;

/**
 * A custom hook to debounce a function.
 * This ensures the function is not called too frequently.
 *
 * @param callback The function to debounce.
 * @param delay The delay in milliseconds.
 * @returns A memoized, debounced version of the callback.
 */
export function useDebounce<T extends Callback>(callback: T, delay: number): T {
  const callbackRef = useRef(callback);
  const timeoutRef = useRef<NodeJS.Timeout>();

  // Always keep the latest callback in a ref
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Create the debounced function
  const debouncedCallback = useMemo(() => {
    const func = (...args: any[]) => {
      // Clear the previous timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      // Set a new timeout
      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args);
      }, delay);
    };
    return func;
  }, [delay]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return debouncedCallback as T;
}