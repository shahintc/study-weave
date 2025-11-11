import React from "react";

const FALLBACK_MESSAGE = "No datapoints yet";

/**
 * Minimal SVG-based bar chart to avoid pulling a heavy charting dependency.
 * Accepts arbitrary keys so it can be reused across analytics blocks.
 */
export function BarChart({ data = [], xKey = "label", yKey = "value", height = 180, formatValue }) {
  if (!Array.isArray(data) || data.length === 0) {
    return (
      <div className="flex h-[180px] items-center justify-center text-sm text-muted-foreground">
        {FALLBACK_MESSAGE}
      </div>
    );
  }

  const width = 360;
  const padding = 24;
  const gap = 12;
  const maxValue = Math.max(...data.map((item) => Number(item[yKey]) || 0), 1);
  const innerHeight = height - padding * 2;
  const barWidth = Math.max(12, (width - padding * 2 - gap * (data.length - 1)) / data.length);

  const labelStyle = { fontSize: 10, fill: "hsl(var(--muted-foreground))" };

  return (
    <div className="w-full">
      <svg
        role="img"
        aria-label="Bar chart"
        className="text-primary"
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        preserveAspectRatio="xMidYMid meet"
      >
        <g transform={`translate(${padding}, ${padding})`}>
          {data.map((item, index) => {
            const rawValue = Number(item[yKey]) || 0;
            const barHeight = (rawValue / maxValue) * innerHeight;
            const x = index * (barWidth + gap);
            const y = innerHeight - barHeight;

            return (
              <g key={`${item[xKey] ?? index}`}>
                <rect
                  data-testid="bar-segment"
                  x={x}
                  y={y}
                  width={barWidth}
                  height={barHeight}
                  rx="6"
                  className="fill-primary/70"
                />
                <text
                  style={labelStyle}
                  x={x + barWidth / 2}
                  y={innerHeight + 14}
                  textAnchor="middle"
                >
                  {item[xKey]}
                </text>
                <text
                  style={labelStyle}
                  x={x + barWidth / 2}
                  y={Math.max(10, y - 4)}
                  textAnchor="middle"
                >
                  {formatValue ? formatValue(rawValue, item) : rawValue.toFixed(1)}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}

export default BarChart;
