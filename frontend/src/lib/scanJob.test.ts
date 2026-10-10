import { describe, expect, it } from "vitest";

import type { ScanJob } from "../types";
import { failureHint, progressPercent, shouldAnnounce } from "./scanJob";

const job = (overrides: Partial<ScanJob> = {}): ScanJob => ({
  id: 1,
  market_id: 1,
  status: "running",
  force: false,
  refresh: false,
  progress_done: 1,
  progress_total: 4,
  message: null,
  error: null,
  error_code: null,
  result: null,
  created_at: "2026-10-10T10:00:00+00:00",
  started_at: null,
  finished_at: null,
  ...overrides,
});

describe("progressPercent", () => {
  it("is a share of the steps, indeterminate before the size is known, and 100 on success", () => {
    expect(progressPercent(job())).toBe(25);
    expect(progressPercent(job({ progress_total: 0 }))).toBeNull();
    expect(progressPercent(job({ status: "succeeded", progress_done: 0 }))).toBe(100);
    expect(progressPercent(job({ progress_done: 9 }))).toBe(100);
  });
});

describe("shouldAnnounce", () => {
  const now = new Date("2026-10-10T10:10:00+00:00").getTime();
  it("always shows an active job", () => {
    expect(shouldAnnounce(job({ status: "queued" }), null, now)).toBe(true);
    expect(shouldAnnounce(job({ status: "running" }), null, now)).toBe(true);
  });
  it("shows a finished job for five minutes unless dismissed", () => {
    const recent = job({ status: "succeeded", finished_at: "2026-10-10T10:07:00+00:00" });
    const old = job({ status: "failed", finished_at: "2026-10-10T09:00:00+00:00" });
    expect(shouldAnnounce(recent, null, now)).toBe(true);
    expect(shouldAnnounce(recent, 1, now)).toBe(false);
    expect(shouldAnnounce(old, null, now)).toBe(false);
    expect(shouldAnnounce(null, null, now)).toBe(false);
  });
});

describe("failureHint", () => {
  it("explains known failure codes and stays silent for unknown ones", () => {
    expect(failureHint(job({ status: "failed", error_code: "budget" }))).toMatch(/midnight UTC/);
    expect(failureHint(job({ status: "failed", error_code: "quota" }))).toMatch(/no searches left/);
    expect(failureHint(job({ status: "failed", error_code: "not_configured" }))).toBeNull(); // the server message already says it
    expect(failureHint(job({ status: "failed", error_code: "something_new" }))).toBeNull();
    expect(failureHint(job({ status: "failed", error_code: null }))).toBeNull();
  });
});
