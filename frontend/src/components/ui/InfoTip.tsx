import { useId, type ReactNode } from "react";

/** A "?" that explains a term on hover, keyboard focus or tap. The text is also exposed to screen readers. */
export function InfoTip({ label, children }: { label: string; children: ReactNode }) {
  const id = useId();
  return (
    <span className="info-tip">
      <button type="button" className="info-tip-button" aria-label={`About ${label}`} aria-describedby={id}>
        ?
      </button>
      <span role="tooltip" id={id} className="info-tip-body">
        {children}
      </span>
    </span>
  );
}
