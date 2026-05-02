import { useCallback, useState } from "react";

export function useAction<Args extends unknown[], R>(fn: (...args: Args) => Promise<R>) {
  const [isSubmitting, setSubmitting] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const run = useCallback(
    async (...args: Args): Promise<R> => {
      setSubmitting(true);
      setError(null);
      try {
        return await fn(...args);
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        setError(err);
        throw err;
      } finally {
        setSubmitting(false);
      }
    },
    [fn],
  );
  return { run, isSubmitting, error };
}
