import { useEffect, useRef, useState } from "react";

import { isJobActive, useCredits, useLatestScanJob, useRefreshAfterScan, useStartScanJob } from "../api/hooks";

/** Everything the shell needs to run and show a background scan for one market. */
export function useScanController(marketId: number) {
  const job = useLatestScanJob(marketId);
  const start = useStartScanJob(marketId);
  const credits = useCredits();
  const refreshAfterScan = useRefreshAfterScan(marketId);
  const [dismissedJob, setDismissedJob] = useState<number | null>(null);
  const active = isJobActive(job.data);
  const wasActive = useRef(false);

  // When a running scan finishes, every page that depends on it refetches.
  useEffect(() => {
    if (wasActive.current && !active) refreshAfterScan();
    wasActive.current = active;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  return {
    job: job.data ?? null,
    active,
    busy: active || start.isPending,
    credits: credits.data,
    startError: start.isError ? start.error : null,
    clearStartError: () => start.reset(),
    dismissedJob,
    dismiss: () => setDismissedJob(job.data?.id ?? null),
    run: () => {
      setDismissedJob(null);
      start.mutate({});
    },
  };
}

export type ScanController = ReturnType<typeof useScanController>;
