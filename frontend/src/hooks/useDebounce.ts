import { useState, useEffect } from "react";

/**
 * Hook untuk melakukan debounce pada sebuah nilai state.
 * @param value Nilai yang ingin di-debounce (misalnya query pencarian)
 * @param delay Waktu tunda dalam milidetik (default 500ms = 0.5 detik)
 * @returns Nilai yang telah di-debounce
 */
export function useDebounce<T>(value: T, delay = 500): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

