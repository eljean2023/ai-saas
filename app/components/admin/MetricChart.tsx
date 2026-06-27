"use client";

import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn, formatNumber } from "@/lib/utils";

export interface DataPoint {
  label: string;
  value: number;
}

type ChartColor = "teal" | "emerald" | "amber" | "red";

interface MetricChartProps {
  title: string;
  data: DataPoint[];
  valueFormatter?: (value: number) => string;
  trend?: "up" | "down" | "neutral";
  trendLabel?: string;
  color?: ChartColor;
  className?: string;
}

const colorMap: Record<ChartColor, { bar: string; barHover: string }> = {
  teal: { bar: "#0d9488", barHover: "#0f766e" },
  emerald: { bar: "#10b981", barHover: "#059669" },
  amber: { bar: "#f59e0b", barHover: "#d97706" },
  red: { bar: "#ef4444", barHover: "#dc2626" },
};

const trendConfig = {
  up: { icon: TrendingUp, className: "text-emerald-600" },
  down: { icon: TrendingDown, className: "text-red-500" },
  neutral: { icon: Minus, className: "text-gray-400" },
};

const CHART_HEIGHT = 72;
const BAR_WIDTH = 20;
const BAR_GAP = 6;
const LABEL_HEIGHT = 18;

export function MetricChart({
  title,
  data,
  valueFormatter = (v) => formatNumber(v),
  trend,
  trendLabel,
  color = "teal",
  className,
}: MetricChartProps) {
  const maxValue = Math.max(...data.map((d) => d.value), 1);
  const chartWidth = data.length * (BAR_WIDTH + BAR_GAP) - BAR_GAP;
  const colors = colorMap[color];
  const TrendIcon = trend ? trendConfig[trend].icon : null;
  const trendClass = trend ? trendConfig[trend].className : "";

  return (
    <div
      className={cn(
        "rounded-xl border border-gray-200 bg-white p-5 shadow-sm",
        className
      )}
    >
      <div className="mb-4 flex items-start justify-between">
        <p className="text-sm font-semibold text-gray-700">{title}</p>
        {trend && trendLabel && TrendIcon && (
          <div className={cn("flex items-center gap-1 text-xs font-medium", trendClass)}>
            <TrendIcon className="h-3.5 w-3.5" />
            <span>{trendLabel}</span>
          </div>
        )}
      </div>

      {data.length === 0 ? (
        <div className="flex h-24 items-center justify-center text-xs text-gray-400">
          No data available
        </div>
      ) : (
        <svg
          width="100%"
          viewBox={`0 0 ${chartWidth} ${CHART_HEIGHT + LABEL_HEIGHT}`}
          preserveAspectRatio="xMidYMid meet"
          className="overflow-visible"
          role="img"
          aria-label={title}
        >
          {data.map((point, i) => {
            const barHeight = Math.max(
              (point.value / maxValue) * CHART_HEIGHT,
              2
            );
            const x = i * (BAR_WIDTH + BAR_GAP);
            const y = CHART_HEIGHT - barHeight;

            return (
              <g key={`${point.label}-${i}`}>
                <rect
                  x={x}
                  y={y}
                  width={BAR_WIDTH}
                  height={barHeight}
                  rx={3}
                  fill={colors.bar}
                  className="transition-all duration-200 hover:opacity-80"
                >
                  <title>{`${point.label}: ${valueFormatter(point.value)}`}</title>
                </rect>
                <text
                  x={x + BAR_WIDTH / 2}
                  y={CHART_HEIGHT + LABEL_HEIGHT - 2}
                  textAnchor="middle"
                  fontSize={9}
                  fill="#9ca3af"
                >
                  {point.label}
                </text>
              </g>
            );
          })}
        </svg>
      )}

      {data.length > 0 && (
        <div className="mt-2 flex items-center justify-between text-xs text-gray-400">
          <span>{valueFormatter(Math.min(...data.map((d) => d.value)))}</span>
          <span>{valueFormatter(Math.max(...data.map((d) => d.value)))}</span>
        </div>
      )}
    </div>
  );
}
