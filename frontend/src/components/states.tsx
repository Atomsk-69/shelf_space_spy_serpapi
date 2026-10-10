import type { ReactNode } from "react";

import { errorMessage } from "../api/errors";

export function Skeleton({ rows = 3, height }: { rows?: number; height?: number }) {
  if (height) return <div className="skeleton skeleton-block" style={{ height }} aria-hidden="true" />;
  return (
    <div className="skeleton-stack" aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => <div key={index} className="skeleton skeleton-line" style={{ width: `${92 - index * 13}%` }} />)}
    </div>
  );
}

export function Loading({ label = "Loading…", rows, height }: { label?: string; rows?: number; height?: number }) {
  return (
    <div role="status" className="loading-state">
      <span className="visually-hidden">{label}</span>
      <Skeleton rows={rows} height={height} />
    </div>
  );
}

export function ErrorState({ error, onRetry, title = "Couldn't load this" }: { error: unknown; onRetry?: () => void; title?: string }) {
  return (
    <div role="alert" className="state-box state-error">
      <p className="state-title"><span aria-hidden="true">!</span> {title}</p>
      <p className="state-hint">{errorMessage(error)}</p>
      {onRetry && <button type="button" className="button-secondary button-small" onClick={onRetry}>Try again</button>}
    </div>
  );
}

export function EmptyState({ title, hint, action }: { title: string; hint?: ReactNode; action?: ReactNode }) {
  return (
    <div className="state-box state-empty">
      <p className="state-title">{title}</p>
      {hint && <p className="state-hint">{hint}</p>}
      {action}
    </div>
  );
}

type QueryLike<T> = { data: T | undefined; error: unknown; isFetching: boolean; refetch: () => unknown };

/**
 * Renders the loading / error / empty / ready states of one query for one panel.
 * On refetch the previous render stays visible (dimmed) instead of flashing a skeleton.
 */
export function QueryBody<T>({
  query,
  children,
  isEmpty,
  empty,
  loading,
  errorTitle,
}: {
  query: QueryLike<T>;
  children: (data: T) => ReactNode;
  isEmpty?: (data: T) => boolean;
  empty?: ReactNode;
  loading?: ReactNode;
  errorTitle?: string;
}) {
  const retry = () => void query.refetch();
  if (query.data === undefined) {
    if (query.error) return <ErrorState error={query.error} onRetry={retry} title={errorTitle} />;
    return <>{loading ?? <Loading />}</>;
  }
  return (
    <div className={query.isFetching ? "query-body is-refreshing" : "query-body"} aria-busy={query.isFetching}>
      {query.error != null && (
        <p className="inline-warning" role="status">
          Couldn't refresh: {errorMessage(query.error)} <button type="button" className="text-button" onClick={retry}>Retry</button>
        </p>
      )}
      {isEmpty?.(query.data) ? empty : children(query.data)}
    </div>
  );
}
