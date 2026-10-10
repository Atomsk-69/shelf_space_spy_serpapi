import type { ReactNode } from "react";

import { humanize } from "../../lib/format";

export type Tone = "neutral" | "good" | "warn" | "bad" | "info";

/** Small status pill. Meaning is carried by the icon and text, never by color alone. */
export function Badge({ tone = "neutral", icon, title, children }: { tone?: Tone; icon?: string; title?: string; children: ReactNode }) {
  return (
    <span className={`ui-badge tone-${tone}`} title={title}>
      {icon && (
        <span aria-hidden="true" className="ui-badge-icon">
          {icon}
        </span>
      )}
      {children}
    </span>
  );
}

const SEVERITY: Record<string, { tone: Tone; icon: string }> = {
  high: { tone: "bad", icon: "▲" },
  medium: { tone: "warn", icon: "◆" },
  low: { tone: "neutral", icon: "●" },
};

/** How big the change is. Separate from confidence. */
export function SeverityBadge({ level }: { level: string }) {
  const known = SEVERITY[level.toLowerCase()] ?? SEVERITY.low;
  return (
    <Badge tone={known.tone} icon={known.icon} title="Severity: how large the change is">
      {humanize(level)} severity
    </Badge>
  );
}

const CONFIDENCE: Record<string, { tone: Tone; icon: string; hint: string }> = {
  high: { tone: "good", icon: "✓", hint: "The data supports this well." },
  medium: { tone: "info", icon: "~", hint: "Reasonable support; some history is limited." },
  low: { tone: "warn", icon: "?", hint: "Weak support. Treat it as a hint, not a finding." },
};

/** How much to trust a result. Separate from severity and from any score. */
export function ConfidenceBadge({ level }: { level: string | null | undefined }) {
  const known = CONFIDENCE[(level ?? "").toLowerCase()];
  if (!known) return <Badge title="Confidence was not recorded">Confidence unknown</Badge>;
  return (
    <Badge tone={known.tone} icon={known.icon} title={`Confidence: ${known.hint}`}>
      {humanize(level)} confidence
    </Badge>
  );
}

export const InferredBadge = () => (
  <Badge tone="warn" icon="?" title="This brand was guessed from the product title and is not confirmed.">
    Inferred brand
  </Badge>
);

export const UnstableBadge = ({ overlap }: { overlap?: number | null }) => (
  <Badge
    tone="warn"
    icon="≈"
    title="The products on this probe's shelf change a lot between scans, so rank and new-product signals are likely noise."
  >
    Unstable shelf{overlap != null ? ` (${Math.round(overlap * 100)}% overlap)` : ""}
  </Badge>
);

export const LowVolumeBadge = () => (
  <Badge tone="warn" icon="↓" title="Search interest is very low, so relative changes are unreliable.">
    Low volume
  </Badge>
);

export const HistoryBadge = ({ scans }: { scans: number }) => (
  <Badge tone="info" icon="…" title="Change detection and stability need several scans to compare.">
    {scans <= 1 ? "Not enough history yet" : `${scans} scans of history`}
  </Badge>
);
