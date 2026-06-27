import { LucideIcon, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn, formatNumber } from "@/lib/utils";

type Trend = "up" | "down" | "neutral";

interface StatusCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: Trend;
  trendValue?: string;
  icon?: LucideIcon;
  iconClassName?: string;
  className?: string;
}

const trendConfig: Record<Trend, { icon: LucideIcon; className: string }> = {
  up: { icon: TrendingUp, className: "text-emerald-600" },
  down: { icon: TrendingDown, className: "text-red-500" },
  neutral: { icon: Minus, className: "text-gray-400" },
};

export function StatusCard({
  title,
  value,
  subtitle,
  trend,
  trendValue,
  icon: Icon,
  iconClassName,
  className,
}: StatusCardProps) {
  const TrendIcon = trend ? trendConfig[trend].icon : null;
  const trendClass = trend ? trendConfig[trend].className : "";

  return (
    <div
      className={cn(
        "rounded-xl border border-gray-200 bg-white p-5 shadow-sm",
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
            {title}
          </p>
          <p className="mt-1.5 text-2xl font-bold text-gray-900">
            {typeof value === "number" ? formatNumber(value) : value}
          </p>
          {subtitle && (
            <p className="mt-0.5 text-sm text-gray-500">{subtitle}</p>
          )}
        </div>

        {Icon && (
          <div
            className={cn(
              "rounded-lg p-2.5",
              iconClassName ?? "bg-teal-50 text-teal-600"
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>

      {trend && trendValue && TrendIcon && (
        <div className={cn("mt-3 flex items-center gap-1 text-xs font-medium", trendClass)}>
          <TrendIcon className="h-3.5 w-3.5" />
          <span>{trendValue}</span>
        </div>
      )}
    </div>
  );
}
