import { useCallback, useState } from "react";
import { ERRORS } from "../feedback/errors";

/* XA-04: this exact line was written out byte-identically in ten files and
   inlined at ~25 more sites. It belongs next to the hook whose contract it
   implements: a handler may throw anything, and what the reader is shown is
   the message the server actually sent, falling back to catalog copy only
   when the throw carried none. */
export const why = (e: unknown, fallback: string) =>
  (e instanceof Error && e.message ? e.message : fallback);

/* The one way a control performs a page action (pages/types.ts, CONVENTIONS §8).
 *
 * A page is given its `actions` by whoever renders it, and that slot is
 * OPTIONAL: the design canvas has no server behind it. So every control keeps
 * the local state that already makes it visibly respond, and this hook decides
 * whether that local echo is the whole story or the tail of a real write:
 *
 *   - no handler  → run the echo immediately. Exactly today's behaviour.
 *   - a handler   → await it, then echo, so the UI only claims the change once
 *                   the server has accepted it. If it throws, nothing is echoed
 *                   and `failed` carries the message the server actually sent,
 *                   which the control renders through the same surface a failed
 *                   read uses.
 *
 * `busy` is for disabling the control that fired, so a slow write cannot be
 * double-submitted. */
export function useWrite() {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  /** Returns whether the write succeeded, for callers that close a form on
      success and keep it open (with the message) on failure. */
  const run = useCallback(async (
    call: (() => unknown | Promise<unknown>) | undefined,
    echo?: () => void,
  ): Promise<boolean> => {
    /* ACT-15: this branch used to `return` before clearing `failed`, so a
       banner from an earlier attempt outlived a subsequent successful local
       echo and the control reported a failure it had just recovered from. */
    setFailed(null);
    if (!call) { echo?.(); return true; }
    setBusy(true);
    try {
      await call();
      echo?.();
      return true;
    } catch (e) {
      // ACT-14: the fallback is catalog copy (§8), not a second wording of it.
      setFailed(why(e, ERRORS["generic.saveFailed"].body));
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  /** Same contract, for a write whose RESULT the control has to show (a
      one-time secret, a test report). Resolves to the value on success and to
      undefined on failure, with `failed` set. */
  const runFor = useCallback(async <T,>(
    call: (() => T | Promise<T>) | undefined,
  ): Promise<T | undefined> => {
    /* ACT-15: `run` has this branch and `runFor` did not, so the same optional
       `actions` slot that `run` tolerates made `runFor` throw on the canvas. */
    setFailed(null);
    if (!call) return undefined;
    setBusy(true);
    try {
      return await call();
    } catch (e) {
      setFailed(why(e, ERRORS["generic.saveFailed"].body));
      return undefined;
    } finally {
      setBusy(false);
    }
  }, []);

  return { busy, failed, setFailed, run, runFor };
}
