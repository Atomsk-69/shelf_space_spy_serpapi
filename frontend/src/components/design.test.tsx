import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { event } from "../test/fixtures";
import type { Opportunity } from "../types";
import { OpportunityCards } from "./dashboard/OpportunityCards";
import { EventTimeline } from "./EventTimeline";
import { ShelfHeatmap } from "./ShelfHeatmap";
import { Badge, ConfidenceBadge, DemoBadge, InferredBadge, SeverityBadge, UnstableBadge } from "./ui/Badge";
import { Drawer } from "./ui/Drawer";
import { InfoTip } from "./ui/InfoTip";
import { buildHeatmap } from "../lib/shelf";

describe("badges", () => {
  it("say what they mean in text, not color alone", () => {
    render(
      <>
        <SeverityBadge level="high" />
        <ConfidenceBadge level="low" />
        <ConfidenceBadge level={undefined} />
        <DemoBadge />
        <InferredBadge />
        <UnstableBadge overlap={0.12} />
        <Badge>Plain</Badge>
      </>,
    );
    for (const text of [
      "High severity",
      "Low confidence",
      "Confidence unknown",
      "Demo data",
      "Inferred brand",
      "Unstable shelf (12% overlap)",
      "Plain",
    ]) {
      expect(screen.getByText(text)).toBeInTheDocument();
    }
  });
});

describe("InfoTip", () => {
  it("exposes its explanation to assistive technology", () => {
    render(<InfoTip label="scores">Scores are 0-100.</InfoTip>);
    const button = screen.getByRole("button", { name: "About scores" });
    expect(button).toHaveAccessibleDescription("Scores are 0-100.");
  });
});

describe("Drawer", () => {
  function Harness({ onClose = () => {} }: { onClose?: () => void }) {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button onClick={() => setOpen(true)}>Open it</button>
        <Drawer
          open={open}
          title="Details"
          onClose={() => {
            setOpen(false);
            onClose();
          }}
        >
          <p>Body</p>
        </Drawer>
      </>
    );
  }

  it("opens as a labelled modal dialog, closes on Escape and returns focus to the opener", async () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    const opener = screen.getByRole("button", { name: "Open it" });
    await userEvent.click(opener);
    const dialog = screen.getByRole("dialog", { name: "Details" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveFocus();
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it("closes from the Close button and the scrim", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: "Open it" }));
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Open it" }));
    await userEvent.click(screen.getByLabelText("Close Details"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("EventTimeline", () => {
  it("shows severity and confidence separately and reports the selected event", async () => {
    const onSelect = vi.fn();
    const chosen = event({ id: 4, severity: "high", confidence: "low", summary: "Rank jumped.", is_demo: true });
    render(<EventTimeline events={[chosen]} country="US" onSelect={onSelect} />);
    expect(screen.getByText("High severity")).toBeInTheDocument();
    expect(screen.getByText("Low confidence")).toBeInTheDocument();
    expect(screen.getByText("Demo data")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Rank jumped/ }));
    expect(onSelect).toHaveBeenCalledWith(chosen);
  });
});

describe("OpportunityCards", () => {
  const item: Opportunity = {
    keyword: "widget",
    score: 71.3,
    label: "Attractive",
    demand_growth: 18,
    supply_growth: -4,
    reasons: ["Search interest up 18%."],
    caveats: ["Thin data."],
    components: { demand: 80, room: 60, incumbent_pressure: 55, price_headroom: 40 },
    confidence: { level: "low", factors: { data_volume: "thin", scan_count: 1, shelf_stability: null } },
  };

  it("keeps score and confidence separate, and opens an evidence drawer with the components", async () => {
    render(<OpportunityCards opportunities={[item]} />);
    expect(screen.getByRole("meter", { name: /Opportunity score for widget/ })).toHaveAttribute("aria-valuenow", "71");
    expect(screen.getByText("Low confidence")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Evidence/ }));
    const drawer = screen.getByRole("dialog", { name: "widget" });
    expect(drawer).toHaveTextContent(/Confidence \(separate from the score\)/);
    expect(drawer).toHaveTextContent(/It never changes the score/);
    expect(drawer).toHaveTextContent(/Not enough history yet/);
    expect(drawer).toHaveTextContent(/Stability could not be measured yet/);
    expect(drawer).toHaveTextContent(/Shelf room/);
    expect(drawer).toHaveTextContent(/Thin data/);
    expect(screen.getByRole("meter", { name: "Shelf room" })).toHaveAttribute("aria-valuenow", "60");
  });
});

describe("ShelfHeatmap", () => {
  it("prints every value, dashes absent cells with an explanation and flags unstable probes", () => {
    const model = buildHeatmap({
      "probe a": [{ brand: "Mine", share_pct: 12.5, listings: 2, is_mine: true }],
      "probe b": [{ brand: "Rival", share_pct: 30, listings: 3, is_mine: false }],
    });
    render(<ShelfHeatmap model={model} stability={{ "probe a": 0.1, "probe b": 0.9 }} />);
    expect(screen.getByRole("table", { name: /visibility share by brand and probe/i })).toBeInTheDocument();
    expect(screen.getByText("12.5%")).toBeInTheDocument();
    expect(screen.getAllByText("—")).toHaveLength(2);
    expect(screen.getAllByText(/Unstable shelf/)).toHaveLength(1);
    expect(screen.getByText(/not that it has 0%/)).toBeInTheDocument();
  });
});
