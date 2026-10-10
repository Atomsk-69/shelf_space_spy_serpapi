import type { ScanJob } from "../types";

const FAILURE_HINTS: Record<string, string> = {
  budget: "The daily credit budget resets at midnight UTC. Cached data is still available.",
  too_soon: "Wait a little, or run the scan again with force from the API if you really need fresh data now.",
  in_progress: "Another scan for this market is already running.",
  quota: "Your SerpAPI plan has no searches left, or the key was rejected.",
  rate_limited: "SerpAPI is rate limiting requests. Try again in a few minutes.",
  serpapi: "SerpAPI had a problem. Nothing was saved; try again shortly.",
  timeout: "Anything already saved is kept.",
  interrupted: "The server restarted while the scan was running. Run it again.",
};

export function failureHint(job: ScanJob): string | null {
  return job.error_code ? (FAILURE_HINTS[job.error_code] ?? null) : null;
}

/** 0-100 for the progress bar; indeterminate (null) until the job knows its size. */
export function progressPercent(job: ScanJob): number | null {
  if (job.status === "succeeded") return 100;
  if (!job.progress_total) return null;
  return Math.min(100, Math.round((job.progress_done / job.progress_total) * 100));
}

const TERMINAL_VISIBLE_MS = 5 * 60 * 1000;

/** A finished job is announced for a few minutes (and until dismissed); an old one is just history. */
export function shouldAnnounce(job: ScanJob | null | undefined, dismissedId: number | null, now = Date.now()): boolean {
  if (!job || job.id === dismissedId) return false;
  if (job.status === "queued" || job.status === "running") return true;
  const finished = job.finished_at ? new Date(job.finished_at).getTime() : 0;
  return finished > 0 && now - finished < TERMINAL_VISIBLE_MS;
}
