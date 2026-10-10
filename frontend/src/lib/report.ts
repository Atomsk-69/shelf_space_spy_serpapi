import type { Report } from "../types";

const FALLBACK_REASONS: Record<string, string> = {
  no_api_key: "No AI key is configured, so the deterministic template was used.",
  sdk_not_installed: "The AI library is not installed, so the template was used.",
  llm_error: "The AI service failed, so the template was used.",
  unsupported_claims: "The AI draft contained numbers, dates or claims that are not in the data, so the template was used instead.",
};

/** Short label for the brief's origin. */
export function sourceLabel(report: Report): string | null {
  if (report.source === "llm") return "AI narrated from computed numbers";
  if (report.source === "template") return "Template brief (no AI)";
  return null;
}

/** Why a template was used instead of the AI, or null for AI briefs and unknown reasons. */
export function fallbackExplanation(report: Report): string | null {
  if (report.source !== "template") return null;
  const reason = report.diagnostics?.fallback_reason;
  return reason ? (FALLBACK_REASONS[reason] ?? "The AI narration was not used.") : null;
}
