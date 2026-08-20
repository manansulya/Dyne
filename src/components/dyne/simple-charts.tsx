"use client";

import { useMemo } from "react";

interface BarChartProps {
  data: Array<{ date: string; count: number }>;
  color?: string;
  height?: number;
}

export function SimpleBarChart({
  data,
  color = "#0d9488",
  height = 200,
}: BarChartProps) {
  const max = Math.max(1, ...data.map((d) => d.count));
  // Render 14 bars max — show last 14
  const width = 100; // percentage width
  const barWidth = width / data.length;
  const chartHeight = height - 40; // leave room for axis labels

  return (
    <div className="w-full" style={{ height }}>
      <div className="flex items-end justify-between gap-1" style={{ height: chartHeight }}>
        {data.map((d, i) => {
          const h = max > 0 ? (d.count / max) * 100 : 0;
          return (
            <div
              key={i}
              className="flex-1 flex flex-col items-center justify-end h-full relative group"
            >
              {d.count > 0 && (
                <div
                  className="absolute -top-5 opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-medium bg-popover border rounded px-1 py-0.5 z-10"
                  style={{ color: "var(--foreground)" }}
                >
                  {d.count}
                </div>
              )}
              <div
                className="w-full rounded-t"
                style={{
                  height: `${h}%`,
                  backgroundColor: color,
                  minHeight: d.count > 0 ? "2px" : "0",
                  opacity: d.count > 0 ? 1 : 0.15,
                }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex justify-between mt-1 text-[9px] text-muted-foreground">
        <span>{data[0]?.date}</span>
        <span>{data[Math.floor(data.length / 2)]?.date}</span>
        <span>{data[data.length - 1]?.date}</span>
      </div>
    </div>
  );
}

interface LineChartProps {
  data: Array<{ date: string; minutes: number }>;
  color?: string;
  height?: number;
}

export function SimpleLineChart({
  data,
  color = "#0d9488",
  height = 200,
}: LineChartProps) {
  const max = Math.max(1, ...data.map((d) => d.minutes));
  const chartHeight = height - 40;
  const width = 300;
  const heightInner = chartHeight;
  const points = useMemo(() => {
    return data.map((d, i) => {
      const x = (i / Math.max(1, data.length - 1)) * width;
      const y = heightInner - (d.minutes / max) * heightInner;
      return { x, y, value: d.minutes, date: d.date };
    });
  }, [data, max, width, heightInner]);

  const path = useMemo(() => {
    if (points.length === 0) return "";
    return points
      .map((p, i) => (i === 0 ? `M ${p.x},${p.y}` : `L ${p.x},${p.y}`))
      .join(" ");
  }, [points]);

  const areaPath = useMemo(() => {
    if (points.length === 0) return "";
    const start = `M 0,${heightInner}`;
    const line = points
      .map((p) => `L ${p.x},${p.y}`)
      .join(" ");
    const end = `L ${width},${heightInner} Z`;
    return `${start} ${line} ${end}`;
  }, [points, heightInner]);

  return (
    <div className="w-full" style={{ height }}>
      <svg
        viewBox={`0 0 ${width} ${heightInner}`}
        preserveAspectRatio="none"
        style={{ width: "100%", height: chartHeight }}
      >
        <defs>
          <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#lineGrad)" />
        <path d={path} fill="none" stroke={color} strokeWidth={2} />
        {points.map((p, i) =>
          p.value > 0 ? (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={2.5}
              fill={color}
            />
          ) : null
        )}
      </svg>
      <div className="flex justify-between mt-1 text-[9px] text-muted-foreground">
        <span>{data[0]?.date}</span>
        <span>{data[Math.floor(data.length / 2)]?.date}</span>
        <span>{data[data.length - 1]?.date}</span>
      </div>
    </div>
  );
}

interface DonutChartProps {
  data: Array<{ name: string; value: number; color: string }>;
  height?: number;
}

export function SimpleDonutChart({ data, height = 200 }: DonutChartProps) {
  const total = data.reduce((acc, d) => acc + d.value, 0);
  const size = 160;
  const radius = 60;
  const innerRadius = 38;
  const cx = size / 2;
  const cy = size / 2;

  const segments = useMemo(() => {
    if (total === 0) return [];
    let startAngle = -Math.PI / 2;
    const segs = [];
    for (const d of data) {
      if (d.value === 0) continue;
      const angle = (d.value / total) * Math.PI * 2;
      const endAngle = startAngle + angle;
      const x1 = cx + radius * Math.cos(startAngle);
      const y1 = cy + radius * Math.sin(startAngle);
      const x2 = cx + radius * Math.cos(endAngle);
      const y2 = cy + radius * Math.sin(endAngle);
      const x3 = cx + innerRadius * Math.cos(endAngle);
      const y3 = cy + innerRadius * Math.sin(endAngle);
      const x4 = cx + innerRadius * Math.cos(startAngle);
      const y4 = cy + innerRadius * Math.sin(startAngle);
      const largeArc = angle > Math.PI ? 1 : 0;
      const path = `M ${x1},${y1} A ${radius},${radius} 0 ${largeArc} 1 ${x2},${y2} L ${x3},${y3} A ${innerRadius},${innerRadius} 0 ${largeArc} 0 ${x4},${y4} Z`;
      segs.push({ ...d, path });
      startAngle = endAngle;
    }
    return segs;
  }, [data, total]);

  return (
    <div className="flex items-center gap-4" style={{ height }}>
      <svg viewBox={`0 0 ${size} ${size}`} style={{ height, width: height }}>
        {total === 0 ? (
          <circle
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke="var(--muted)"
            strokeWidth={radius - innerRadius}
            opacity={0.3}
          />
        ) : (
          segments.map((s, i) => (
            <path key={i} d={s.path} fill={s.color} />
          ))
        )}
        {total === 0 ? null : (
          <text
            x={cx}
            y={cy}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="11"
            fontWeight="600"
            fill="var(--foreground)"
          >
            {total}
          </text>
        )}
      </svg>
      <div className="flex-1 space-y-1.5">
        {data.map((d) => (
          <div key={d.name} className="flex items-center gap-2 text-xs">
            <div
              className="h-2.5 w-2.5 rounded-sm shrink-0"
              style={{ backgroundColor: d.color }}
            />
            <span className="font-medium">{d.name}</span>
            <span className="text-muted-foreground ml-auto">{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
