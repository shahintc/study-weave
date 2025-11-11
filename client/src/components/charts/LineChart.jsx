import React from "react";

const FALLBACK_MESSAGE = "Waiting for trend data";

export function LineChart({
  data = [],
  xKey = "date",
  yKey = "value",
  height = 180,
  strokeWidth = 2,
  colorClass = "text-primary",
}) {
  if (!Array.isArray(data) || data.length === 0) {
    return (
      <div className="flex h-[180px] items-center justify-center text-sm text-muted-foreground">
        {FALLBACK_MESSAGE}
      </div>
    );
  }

  const width = 360;
  const padding = 24;
  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;
  const maxValue = Math.max(...data.map((item) => Number(item[yKey]) || 0), 1);

  const points = data
    .map((item, index) => {
      const value = Number(item[yKey]) || 0;
      const x =
        data.length === 1
          ? innerWidth / 2
          : (index / (data.length - 1)) * innerWidth;
      const y = innerHeight - (value / maxValue) * innerHeight;
      return `${x + padding},${y + padding}`;
    })
    .join(" ");

  const labelStyle = { fontSize: 10, fill: "hsl(var(--muted-foreground))" };

  return (
    <svg
      role="img"
      aria-label="Line chart"
      className={colorClass}
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      preserveAspectRatio="xMidYMid meet"
    >
      <polyline
        data-testid="chart-line"
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
      {data.map((item, index) => {
        const value = Number(item[yKey]) || 0;
        const x =
          data.length === 1
            ? innerWidth / 2
            : (index / (data.length - 1)) * innerWidth;
        const y = innerHeight - (value / maxValue) * innerHeight;
        return (
          <g key={`${item[xKey] ?? index}`}>
            <circle
              cx={x + padding}
              cy={y + padding}
              r={3}
              className="fill-background stroke-current"
              strokeWidth="2"
            />
            <text
              style={labelStyle}
              x={x + padding}
              y={height - 4}
              textAnchor="middle"
            >
              {item[xKey]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export default LineChart;
