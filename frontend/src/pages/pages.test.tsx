import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as hooks from "../api/hooks";
import { event, report } from "../test/fixtures";
import type { EventsPage } from "../types";
import BriefPage from "./sections/BriefPage";
import ChangesPage from "./sections/ChangesPage";

vi.mock("../api/hooks");

const market = { id: 1, name: "Test Market", country: "US", category: "Widgets", brand_name: null, keywords: ["widget"], competitors: [] };

// A minimal stand-in for a TanStack query result; the components only read these fields.
const query = <T,>(data: T | undefined, extra: object = {}) => ({
  data,
  error: null,
  isFetching: false,
  refetch: vi.fn(),
  isError: false,
  ...extra,
});

function renderAt(path: string, element: React.ReactNode, route: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={route} element={element} />
      </Routes>
    </MemoryRouter>,
  );
}

const page = (overrides: Partial<EventsPage> = {}): EventsPage => ({
  items: [],
  total: 0,
  limit: 25,
  offset: 0,
  hidden_low_confidence: 0,
  include_low_confidence: false,
  ...overrides,
});

beforeEach(() => {
  vi.mocked(hooks.useMarket).mockReturnValue(query(market) as never);
});

describe("ChangesPage", () => {
  it("explains hidden low-confidence events and lets the user include them", async () => {
    const useEvents = vi.mocked(hooks.useEvents).mockReturnValue(query(page({ hidden_low_confidence: 3 })) as never);
    renderAt("/markets/1/changes", <ChangesPage />, "/markets/:id/changes");

    expect(screen.getByText(/3 low-confidence events are hidden/)).toBeInTheDocument();
    expect(useEvents).toHaveBeenLastCalledWith(1, { types: [], includeLow: false, limit: 200, offset: 0 });

    await userEvent.click(screen.getByRole("checkbox", { name: /include low confidence/i }));
    expect(useEvents).toHaveBeenLastCalledWith(1, { types: [], includeLow: true, limit: 200, offset: 0 });
  });

  it("groups events by day and opens the evidence drawer with the confidence explanation", async () => {
    const lowered = event({
      id: 7,
      type: "RANK_GAIN",
      severity: "high",
      confidence: "low",
      summary: "Acme Widget climbed from position 12 to 2.",
      evidence: {
        probe_stability: 0.1,
        confidence_lowered_from: "medium",
        confidence_note: "Lowered: this probe's shelf changes a lot between scans.",
        positions_moved: 10,
      },
    });
    vi.mocked(hooks.useEvents).mockReturnValue(query(page({ items: [event(), lowered], total: 2 })) as never);
    renderAt("/markets/1/changes", <ChangesPage />, "/markets/:id/changes");

    expect(screen.getAllByRole("region").length).toBeGreaterThan(0); // one section per day
    await userEvent.click(screen.getByRole("button", { name: /Acme Widget climbed/ }));
    const drawer = screen.getByRole("dialog", { name: "Rank gain" });
    expect(drawer).toHaveTextContent(/Lowered from medium/);
    expect(drawer).toHaveTextContent(/Shelf overlap between scans for this probe: 10%/);
    expect(drawer).toHaveTextContent(/Unstable shelf/);
    expect(drawer).toHaveTextContent(/Positions moved/);
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("filters the loaded events by severity and by confidence", async () => {
    const items = [
      event({ id: 1, severity: "high", confidence: "high", summary: "Big trusted move." }),
      event({ id: 2, severity: "low", confidence: "medium", summary: "Small medium move." }),
    ];
    vi.mocked(hooks.useEvents).mockReturnValue(query(page({ items, total: 2 })) as never);
    renderAt("/markets/1/changes", <ChangesPage />, "/markets/:id/changes");

    await userEvent.selectOptions(screen.getByLabelText("Severity"), "high");
    expect(screen.getByText("Big trusted move.")).toBeInTheDocument();
    expect(screen.queryByText("Small medium move.")).not.toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText("Severity"), "");
    await userEvent.selectOptions(screen.getByLabelText("Confidence"), "medium");
    expect(screen.getByText("Small medium move.")).toBeInTheDocument();
    expect(screen.queryByText("Big trusted move.")).not.toBeInTheDocument();
  });

  it("filters by event type through the API", async () => {
    const useEvents = vi.mocked(hooks.useEvents).mockReturnValue(query(page({ items: [event()], total: 1 })) as never);
    renderAt("/markets/1/changes", <ChangesPage />, "/markets/:id/changes");
    await userEvent.click(screen.getByRole("button", { name: "Product removed" }));
    expect(useEvents).toHaveBeenLastCalledWith(1, { types: ["REMOVED_PRODUCT"], includeLow: false, limit: 200, offset: 0 });
  });

  it("shows an error with retry instead of an empty page", async () => {
    const refetch = vi.fn();
    vi.mocked(hooks.useEvents).mockReturnValue(query(undefined, { error: new Error("boom"), refetch }) as never);
    renderAt("/markets/1/changes", <ChangesPage />, "/markets/:id/changes");
    expect(screen.getByRole("alert")).toHaveTextContent(/couldn't load changes/i);
    await userEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(refetch).toHaveBeenCalled();
  });

  it("shows a not-found state for an invalid market id", () => {
    vi.mocked(hooks.useEvents).mockReturnValue(query(undefined) as never);
    renderAt("/markets/abc/changes", <ChangesPage />, "/markets/:id/changes");
    expect(screen.getByText("Market not found")).toBeInTheDocument();
  });
});

describe("BriefPage", () => {
  const TEMPLATE = [
    "Weekly brief: Test Market",
    "",
    "5 products observed.",
    "",
    "What changed",
    "- A price fell.",
    "",
    "Opportunities",
    "- widget: Attractive (71/100).",
    "",
    "Watch-outs",
    "- Sampled shelf is not market share.",
  ].join("\n");

  function mockBrief(latest: ReturnType<typeof report> | null, history = [] as ReturnType<typeof report>[]) {
    vi.mocked(hooks.useLatestReport).mockReturnValue(query(latest) as never);
    vi.mocked(hooks.useGenerateWeeklyReport).mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false } as never);
    vi.mocked(hooks.useReports).mockReturnValue(query({ items: history }) as never);
    vi.mocked(hooks.useOpportunities).mockReturnValue(query({ has_data: false, scan: null, trends_scan: null, items: [] }) as never);
    vi.mocked(hooks.useEvents).mockReturnValue(query(page()) as never);
  }

  it("puts opportunities and watch-outs up front and keeps the rest as detail", () => {
    mockBrief(report({ content: TEMPLATE, source: "template", diagnostics: { fallback_reason: "no_api_key" } }));
    renderAt("/markets/1/brief", <BriefPage />, "/markets/:id/brief");
    expect(screen.getByText("Weekly brief: Test Market")).toBeInTheDocument();
    const act = screen.getByText("Opportunities and watch-outs").closest("section") as HTMLElement;
    expect(act).toHaveTextContent(/widget: Attractive/);
    expect(act).toHaveTextContent(/not market share/);
    expect(act).not.toHaveTextContent(/A price fell/);
    expect(screen.getByText(/A price fell/)).toBeInTheDocument();
  });

  it("says why a template was used and lists rejected claims, without any demo wording", () => {
    mockBrief(
      report({
        content: TEMPLATE,
        source: "template",
        diagnostics: { fallback_reason: "unsupported_claims", rejected_claims: ["October 9"], data_includes_demo: true },
      }),
    );
    renderAt("/markets/1/brief", <BriefPage />, "/markets/:id/brief");
    expect(screen.getByText(/Template brief/)).toBeInTheDocument();
    expect(screen.queryByText(/demo/i)).not.toBeInTheDocument();
    expect(screen.getByRole("note")).toHaveTextContent(/not in the data.*Rejected: October 9/);
  });

  it("labels an AI brief and shows no fallback notice", () => {
    mockBrief(report({ content: TEMPLATE, source: "llm", diagnostics: { model: "claude-sonnet-5-5" } }));
    renderAt("/markets/1/brief", <BriefPage />, "/markets/:id/brief");
    expect(screen.getByText(/AI narrated from computed numbers/)).toBeInTheDocument();
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
  });

  it("shows an empty state with no brief and lists earlier briefs but not the current one", () => {
    mockBrief(null);
    const { unmount } = renderAt("/markets/1/brief", <BriefPage />, "/markets/:id/brief");
    expect(screen.getByText("No brief yet")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generate weekly brief" })).toBeInTheDocument();
    unmount();

    mockBrief(report({ id: 2, content: TEMPLATE }), [
      report({ id: 2 }),
      report({ id: 1, source: "template", diagnostics: { fallback_reason: "no_api_key" } }),
    ]);
    renderAt("/markets/1/brief", <BriefPage />, "/markets/:id/brief");
    expect(screen.getAllByText(/No AI key is configured/).length).toBeGreaterThan(0);
  });
});
