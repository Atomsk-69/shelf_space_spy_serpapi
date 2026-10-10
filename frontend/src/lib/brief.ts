export type BriefSection = { title: string; bullets: string[]; text: string[] };
export type ParsedBrief = { headline: string; sections: BriefSection[] };

import { isVisibleLine } from "./text";

const KNOWN = new Map([
  ["what changed", "What changed"],
  ["shelf", "Shelf"],
  ["opportunities", "Opportunities"],
  ["watch-outs", "Watch-outs"],
  ["watch outs", "Watch-outs"],
]);

const strip = (line: string) =>
  line
    .replace(/^#{1,6}\s*/, "")
    .replace(/\*\*/g, "")
    .trim();

/**
 * Splits a brief (AI or template) into its headline and the four sections both writers use.
 * Anything unrecognised stays visible: it lands in an "Overview" section rather than being dropped.
 */
export function parseBrief(content: string): ParsedBrief {
  const lines = content
    .split(/\r?\n/)
    .filter(isVisibleLine)
    .map((line) => line.trim());
  const first = lines.findIndex(Boolean);
  if (first === -1) return { headline: "", sections: [] };
  const headline = strip(lines[first]);
  const sections: BriefSection[] = [];
  let current: BriefSection = { title: "Overview", bullets: [], text: [] };
  for (const raw of lines.slice(first + 1)) {
    if (!raw) continue;
    const plain = strip(raw).replace(/:$/, "");
    const known = KNOWN.get(plain.toLowerCase());
    if (known) {
      if (current.bullets.length || current.text.length) sections.push(current);
      current = { title: known, bullets: [], text: [] };
    } else if (/^[-*•]\s+/.test(raw)) current.bullets.push(strip(raw.replace(/^[-*•]\s+/, "")));
    else current.text.push(strip(raw));
  }
  if (current.bullets.length || current.text.length) sections.push(current);
  return { headline, sections };
}

export function findSection(brief: ParsedBrief, title: string): BriefSection | undefined {
  return brief.sections.find((section) => section.title === title);
}
