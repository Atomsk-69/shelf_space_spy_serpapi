/**
 * Lines that mention demo data or credits are never shown. New text no longer contains them, but briefs and
 * opportunity notes saved earlier still do. They are hidden here, at display time, so stored data stays untouched.
 */
const HIDDEN = /\b(demo|credits?)\b/i;

export const isVisibleLine = (line: string) => !HIDDEN.test(line);

export const visibleLines = (lines: string[]): string[] => lines.filter(isVisibleLine);

export const scrubText = (text: string): string => text.split(/\r?\n/).filter(isVisibleLine).join("\n");
