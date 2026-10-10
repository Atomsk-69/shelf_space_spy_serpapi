import { failureHint, progressPercent } from "../../lib/scanJob";
import { formatInt } from "../../lib/format";
import type { ScanJob } from "../../types";

const plural = (count: number, one: string, many = `${one}s`) => `${formatInt(count)} ${count === 1 ? one : many}`;

/** Live progress of a background scan, and its outcome once finished. */
export function ScanProgress({ job, onDismiss }: { job: ScanJob; onDismiss: () => void }) {
  const percent = progressPercent(job);

  if (job.status === "queued" || job.status === "running") {
    return (
      <section className="notice notice-info scan-progress" role="status" aria-live="polite">
        <div className="scan-progress-head">
          <strong>Scanning…</strong>
          <span>{job.message ?? "Working"}</span>
        </div>
        <div
          className="progress-track"
          role="progressbar"
          aria-label="Scan progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent ?? undefined}
        >
          <span
            className={percent === null ? "progress-fill is-indeterminate" : "progress-fill"}
            style={percent === null ? undefined : { width: `${percent}%` }}
          />
        </div>
        <p className="field-hint">
          Step {Math.min(job.progress_done + 1, Math.max(job.progress_total, 1))} of {Math.max(job.progress_total, 1)}. You can leave this
          page; the scan keeps running.
        </p>
      </section>
    );
  }

  if (job.status === "failed") {
    const hint = failureHint(job);
    return (
      <p className="notice error" role="alert">
        <strong>Scan failed.</strong> {job.error ?? "Something went wrong."} {hint}
        <button type="button" className="text-button" onClick={onDismiss}>
          Dismiss
        </button>
      </p>
    );
  }

  const result = job.result;
  return (
    <p className="notice success" role="status">
      <strong>Scan complete.</strong> {result?.message}{" "}
      {result
        ? `${plural(result.products_observed ?? 0, "product")} observed, ${plural(result.events ?? 0, "change")} detected, ${plural(result.opportunities ?? 0, "opportunity", "opportunities")} scored.`
        : null}
      {result && (result.alerts_created ?? 0) > 0 && <> {plural(result.alerts_created ?? 0, "new alert")}.</>}
      {result?.warnings?.length ? <> {result.warnings.join(" ")}</> : null}
      <button type="button" className="text-button" onClick={onDismiss}>
        Dismiss
      </button>
    </p>
  );
}
