import type { ReactNode } from "react";

export function Panel({
  label,
  title,
  actions,
  className = "",
  children,
  id,
}: {
  label: string;
  title: ReactNode;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
  id?: string;
}) {
  const headingId = id ? `${id}-title` : undefined;
  return (
    <section className={`panel ${className}`.trim()} aria-labelledby={headingId} id={id}>
      <header className="panel-head">
        <div>
          <p className="card-label">{label}</p>
          <h3 id={headingId}>{title}</h3>
        </div>
        {actions && <div className="panel-actions">{actions}</div>}
      </header>
      {children}
    </section>
  );
}
