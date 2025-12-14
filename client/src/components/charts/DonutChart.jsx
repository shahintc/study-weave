import React, { useMemo } from "react";

const TRACK_COLOR = "#e5e7eb";

const clampNumber = (value) => {
  const numeric = Number(value);
  if (Number.isNaN(numeric) || numeric < 0) {
    return 0;
  }
  return numeric;
};

export default function DonutChart({
  segments = [],
  size = 180,
  thickness = 28,
  centerLabel,
  centerSubtext,
  emptyLabel = "No data",
}) {
  const sanitizedSegments = useMemo(
    () =>
      segments.map((segment) => ({
        ...segment,
        value: clampNumber(segment.value),
        color: segment.color || TRACK_COLOR,
      })),
    [segments],
  );

  const totalValue = useMemo(
    () => sanitizedSegments.reduce((sum, segment) => sum + segment.value, 0),
    [sanitizedSegments],
  );

  const gradientStyle = useMemo(() => {
    if (totalValue <= 0) {
      return `conic-gradient(${TRACK_COLOR} 0deg 360deg)`;
    }
    let cursor = 0;
    const stops = sanitizedSegments.map((segment) => {
      const sweep = (segment.value / totalValue) * 360;
      const start = cursor;
      const end = cursor + sweep;
      cursor = end;
      return `${segment.color} ${start}deg ${end}deg`;
    });
    return `conic-gradient(${stops.join(", ")})`;
  }, [sanitizedSegments, totalValue]);

  const legendSegments = sanitizedSegments.filter((segment) => segment.label);

  return (
    <div className="flex flex-col gap-4">
      <div
        className="relative mx-auto flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        <div
          className="h-full w-full rounded-full"
          style={{ background: gradientStyle }}
        />
        <div
          className="absolute flex flex-col items-center justify-center rounded-full bg-background px-3 text-center"
          style={{
            top: thickness,
            left: thickness,
            right: thickness,
            bottom: thickness,
          }}
        >
          {centerLabel ? (
            <>
              <span className="text-2xl font-semibold leading-none">
                {centerLabel}
              </span>
              {centerSubtext ? (
                <span className="text-xs text-muted-foreground">
                  {centerSubtext}
                </span>
              ) : null}
            </>
          ) : (
            <span className="text-xs text-muted-foreground">{emptyLabel}</span>
          )}
        </div>
      </div>

      <div className="space-y-2 text-sm">
        {legendSegments.length === 0 ? (
          <p className="text-muted-foreground">{emptyLabel}</p>
        ) : (
          legendSegments.map((segment) => {
            const percentage =
              totalValue > 0 ? Math.round((segment.value / totalValue) * 100) : 0;
            return (
              <div
                key={segment.label}
                className="flex items-center justify-between rounded-md border px-2 py-1"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: segment.color }}
                  />
                  <span>{segment.label}</span>
                </div>
                <span className="font-semibold">
                  {segment.value}
                  <span className="ml-1 text-xs text-muted-foreground">
                    ({percentage}%)
                  </span>
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
