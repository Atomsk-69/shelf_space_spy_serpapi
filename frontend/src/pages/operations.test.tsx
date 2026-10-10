import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as hooks from "../api/hooks";
import { ScanProgress } from "../components/dashboard/ScanProgress";
import type { AlertRule, AlertRow, ScanJob } from "../types";
import AlertsPage from "./sections/AlertsPage";
import ReplayPage from "./sections/ReplayPage";

vi.mock("../api/hooks");

const market = { id: 1, name: "Test Market", country: "US", category: "Widgets", brand_name: null, keywords: ["widget"], competitors: [] };
const query = <T,>(data: T | undefined, extra: object = {}) => ({
  data,
  error: null,
  isFetching: false,
  refetch: vi.fn(),
  isError: false,
  ...extra,
});
const idle = { mutate: vi.fn(), isPending: false, isError: false };

function renderAt(path: string, element: React.ReactNode, route: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={route} element={element} />
      </Routes>
    </MemoryRouter>,
  );
}

const baseJob: ScanJob = {
  id: 1,
  market_id: 1,
  status: "running",
  force: false,
  refresh: false,
  progress_done: 2,
  progress_total: 4,
  message: 'Searched Google Shopping for "widget"',
  error: null,
  error_code: null,
  result: null,
  created_at: "2026-10-10T10:00:00+00:00",
  started_at: null,
  finished_at: null,
};

describe("ScanProgress", () => {
  it("shows a determinate progress bar with the current step while running", () => {
    render(<ScanProgress job={baseJob} onDismiss={() => {}} />);
    const bar = screen.getByRole("progressbar", { name: "Scan progress" });
    expect(bar).toHaveAttribute("aria-valuenow", "50");
    expect(screen.getByText(/Searched Google Shopping/)).toBeInTheDocument();
    expect(screen.getByText(/You can leave this page/)).toBeInTheDocument();
  });

  it("explains a failure with the reason and a hint, and can be dismissed", async () => {
    const onDismiss = vi.fn();
    render(
      <ScanProgress
        job={{ ...baseJob, status: "failed", error: "The daily scan limit was reached.", error_code: "budget" }}
        onDismiss={onDismiss}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(/daily scan limit was reached.*midnight UTC/);
    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(onDismiss).toHaveBeenCalled();
  });

  it("summarizes a finished scan including new alerts", () => {
    const result = {
      message: "Live scan completed.",
      products_observed: 40,
      events: 3,
      opportunities: 2,
      alerts_created: 1,
      warnings: [],
    } as unknown as ScanJob["result"];
    render(<ScanProgress job={{ ...baseJob, status: "succeeded", result }} onDismiss={() => {}} />);
    expect(screen.getByRole("status")).toHaveTextContent(/40 products observed, 3 changes detected, 2 opportunities scored.*1 new alert/);
  });
});

describe("AlertsPage", () => {
  const alert: AlertRow = {
    id: 5,
    rule_id: 1,
    rule_name: "Competitor price cuts",
    scan_id: 3,
    event_type: "PRICE_DECREASE",
    severity: "high",
    confidence: "medium",
    title: "Rival Widget dropped 30%.",
    detail: "Same product at the same retailer.",
    brand: "Rival",
    keyword: "widget",
    created_at: "2026-10-10T10:00:00+00:00",
    read_at: null,
  };
  const rule: AlertRule = {
    id: 1,
    key: "competitor_price_cuts",
    name: "Competitor price cuts",
    event_types: ["PRICE_DECREASE"],
    min_severity: "medium",
    min_confidence: "medium",
    scope: "competitors",
    enabled: true,
  };

  beforeEach(() => {
    vi.mocked(hooks.useMarket).mockReturnValue(query(market) as never);
  });

  it("lists alerts with confidence, marks them read and edits a rule", async () => {
    const markRead = vi.fn();
    const updateRule = vi.fn();
    vi.mocked(hooks.useAlerts).mockReturnValue(query({ items: [alert], total: 1, unread: 1, limit: 20, offset: 0 }) as never);
    vi.mocked(hooks.useAlertRules).mockReturnValue(query([rule]) as never);
    vi.mocked(hooks.useMarkAlertsRead).mockReturnValue({ ...idle, mutate: markRead } as never);
    vi.mocked(hooks.useUpdateAlertRule).mockReturnValue({ ...idle, mutate: updateRule } as never);
    renderAt("/markets/1/alerts", <AlertsPage />, "/markets/:id/alerts");

    expect(screen.getByText("Rival Widget dropped 30%.")).toBeInTheDocument();
    expect(screen.getByText(/Medium confidence/)).toBeInTheDocument();
    expect(screen.getByText("Same product at the same retailer.")).toBeInTheDocument(); // caveat shown because not high confidence

    await userEvent.click(screen.getByRole("button", { name: "Mark read" }));
    expect(markRead).toHaveBeenCalledWith([5]);
    await userEvent.click(screen.getByRole("button", { name: "Mark all read" }));
    expect(markRead).toHaveBeenLastCalledWith(undefined);

    await userEvent.click(screen.getByRole("checkbox", { name: /Competitor price cuts/ }));
    expect(updateRule).toHaveBeenCalledWith({ ruleId: 1, body: { enabled: false } });
    await userEvent.selectOptions(screen.getByLabelText(/Minimum confidence/), "high");
    expect(updateRule).toHaveBeenLastCalledWith({ ruleId: 1, body: { min_confidence: "high" } });
  });

  it("shows an empty state when nothing has alerted", () => {
    vi.mocked(hooks.useAlerts).mockReturnValue(query({ items: [], total: 0, unread: 0, limit: 20, offset: 0 }) as never);
    vi.mocked(hooks.useAlertRules).mockReturnValue(query([]) as never);
    vi.mocked(hooks.useMarkAlertsRead).mockReturnValue(idle as never);
    vi.mocked(hooks.useUpdateAlertRule).mockReturnValue(idle as never);
    renderAt("/markets/1/alerts", <AlertsPage />, "/markets/:id/alerts");
    expect(screen.getByText("No alerts")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mark all read" })).toBeDisabled();
  });
});

describe("ReplayPage", () => {
  const scans = [
    { id: 11, scanned_at: "2026-10-01T10:00:00+00:00", is_demo: false, products: 30, events: 0 },
    { id: 12, scanned_at: "2026-10-05T10:00:00+00:00", is_demo: true, products: 31, events: 2 },
    { id: 13, scanned_at: "2026-10-09T10:00:00+00:00", is_demo: false, products: 33, events: 1 },
  ];
  const empty = (extra = {}) =>
    query({ has_data: false, scan: null, items: [], overall: [], total: 0, hidden_low_confidence: 0, ...extra });

  beforeEach(() => {
    vi.mocked(hooks.useMarket).mockReturnValue(query(market) as never);
    vi.mocked(hooks.useShelf).mockReturnValue(empty() as never);
    vi.mocked(hooks.usePricing).mockReturnValue(empty() as never);
    vi.mocked(hooks.useOpportunities).mockReturnValue(empty() as never);
    vi.mocked(hooks.useEvents).mockReturnValue(empty() as never);
  });

  it("starts at the latest scan and loads every section for the chosen scan id", async () => {
    vi.mocked(hooks.useReplay).mockReturnValue(query({ scans }) as never);
    renderAt("/markets/1/replay", <ReplayPage />, "/markets/:id/replay");

    expect(screen.getByText(/Scan 3 of 3/)).toBeInTheDocument();
    expect(hooks.useShelf).toHaveBeenLastCalledWith(1, 13);

    await userEvent.click(screen.getByRole("button", { name: "Previous" }));
    expect(screen.getByText(/Scan 2 of 3/)).toBeInTheDocument();
    expect(screen.queryByText(/demo/i)).not.toBeInTheDocument();
    expect(hooks.useShelf).toHaveBeenLastCalledWith(1, 12);
    expect(hooks.useEvents).toHaveBeenLastCalledWith(1, { types: [], includeLow: false, limit: 25, offset: 0, scanId: 12 });
  });

  it("disables stepping at the ends and shows an empty state with no scans", async () => {
    vi.mocked(hooks.useReplay).mockReturnValue(query({ scans }) as never);
    const { unmount } = renderAt("/markets/1/replay", <ReplayPage />, "/markets/:id/replay");
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Previous" }));
    await userEvent.click(screen.getByRole("button", { name: "Previous" }));
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    unmount();

    vi.mocked(hooks.useReplay).mockReturnValue(query({ scans: [] }) as never);
    renderAt("/markets/1/replay", <ReplayPage />, "/markets/:id/replay");
    expect(screen.getByText("No scans to replay")).toBeInTheDocument();
  });
});
