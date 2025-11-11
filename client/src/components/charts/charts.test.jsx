import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import BarChart from "./BarChart";
import LineChart from "./LineChart";

describe("BarChart", () => {
  it("renders a bar for each data point", () => {
    const data = [
      { name: "Artifact A", value: 4.1 },
      { name: "Artifact B", value: 3.8 },
      { name: "Artifact C", value: 4.5 },
    ];

    render(<BarChart data={data} xKey="name" yKey="value" />);
    const bars = screen.getAllByTestId("bar-segment");
    expect(bars).toHaveLength(data.length);
  });

  it("shows a fallback message when there is no data", () => {
    render(<BarChart data={[]} />);
    expect(screen.getByText(/No datapoints yet/i)).toBeInTheDocument();
  });
});

describe("LineChart", () => {
  it("renders a path when data is provided", () => {
    const data = [
      { date: "2025-02-01", value: 40 },
      { date: "2025-02-02", value: 55 },
      { date: "2025-02-03", value: 65 },
    ];

    render(<LineChart data={data} xKey="date" yKey="value" />);
    expect(screen.getByTestId("chart-line")).toBeInTheDocument();
  });

  it("shows a fallback message without datapoints", () => {
    render(<LineChart data={[]} />);
    expect(screen.getByText(/Waiting for trend data/i)).toBeInTheDocument();
  });
});
