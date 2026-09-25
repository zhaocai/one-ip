import { useCallback, useEffect, useRef, useState } from "react";
import type { Evidence } from "./scenario-evidence";
import { measurePlatforms } from "./scenario-probes";
import { accessTargets } from "./scenario-targets";

export function useScenarioAccess(ip: string) {
  const [records, setRecords] = useState<Record<string, Evidence>>({});
  const [busy, setBusy] = useState(true);
  const controller = useRef<AbortController | null>(null);
  const start = useCallback(() => {
    controller.current?.abort();
    const control = new AbortController();
    controller.current = control;
    // Strict Mode's first mount can be cancelled before any network work starts.
    void Promise.resolve().then(async () => {
      if (control.signal.aborted) return;
      setRecords({});
      setBusy(true);
      let pending: Record<string, Evidence> = {};
      let timer: ReturnType<typeof setTimeout> | undefined;
      const flush = () => {
        clearTimeout(timer);
        timer = undefined;
        if (control.signal.aborted || !Object.keys(pending).length) return;
        const updates = pending;
        pending = {};
        setRecords((previous) => ({ ...previous, ...updates }));
      };
      const discard = () => {
        clearTimeout(timer);
        pending = {};
      };
      control.signal.addEventListener("abort", discard, { once: true });
      try {
        await measurePlatforms(
          ip,
          accessTargets,
          control.signal,
          (target, evidence) => {
            if (control.signal.aborted) return;
            pending[target.url] = evidence;
            timer ??= setTimeout(flush, 80);
          },
        );
      } catch {
        flush();
        if (!control.signal.aborted)
          setRecords((previous) =>
            Object.fromEntries(
              Object.entries(previous).map(([key, value]) => [
                key,
                value.state === "running"
                  ? { ...value, state: "unverifiable" }
                  : value,
              ]),
            ),
          );
      } finally {
        flush();
        control.signal.removeEventListener("abort", discard);
        if (controller.current === control && !control.signal.aborted)
          setBusy(false);
      }
    });
  }, [ip]);
  useEffect(() => {
    start();
    const connection = (navigator as Navigator & { connection?: EventTarget })
      .connection;
    window.addEventListener("online", start);
    connection?.addEventListener("change", start);
    return () => {
      controller.current?.abort();
      window.removeEventListener("online", start);
      connection?.removeEventListener("change", start);
    };
  }, [start]);
  const cancel = () => {
    controller.current?.abort();
    setBusy(false);
    setRecords((previous) =>
      Object.fromEntries(
        Object.entries(previous).map(([key, value]) => [
          key,
          value.state === "running" ? { ...value, state: "cancelled" } : value,
        ]),
      ),
    );
  };
  return { records, busy, start, cancel };
}
