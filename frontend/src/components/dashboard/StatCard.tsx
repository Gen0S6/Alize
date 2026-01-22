"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { IconDefinition } from "@fortawesome/fontawesome-svg-core";

interface StatCardProps {
  value: number | string;
  label: string;
  icon: IconDefinition;
  color: "blue" | "green" | "amber" | "gray" | "purple" | "red";
  isDark: boolean;
  trend?: {
    value: number;
    isPositive: boolean;
  };
}

const colorClasses = {
  blue: {
    dark: {
      text: "text-blue-400",
      icon: "text-blue-500",
    },
    light: {
      text: "text-blue-600",
      icon: "text-blue-500",
    },
  },
  green: {
    dark: {
      text: "text-emerald-400",
      icon: "text-emerald-500",
    },
    light: {
      text: "text-emerald-600",
      icon: "text-emerald-500",
    },
  },
  amber: {
    dark: {
      text: "text-amber-400",
      icon: "text-amber-500",
    },
    light: {
      text: "text-amber-600",
      icon: "text-amber-500",
    },
  },
  gray: {
    dark: {
      text: "text-gray-300",
      icon: "text-gray-500",
    },
    light: {
      text: "text-gray-700",
      icon: "text-gray-500",
    },
  },
  purple: {
    dark: {
      text: "text-purple-400",
      icon: "text-purple-500",
    },
    light: {
      text: "text-purple-600",
      icon: "text-purple-500",
    },
  },
  red: {
    dark: {
      text: "text-red-400",
      icon: "text-red-500",
    },
    light: {
      text: "text-red-600",
      icon: "text-red-500",
    },
  },
};

export function StatCard({ value, label, icon, color, isDark, trend }: StatCardProps) {
  const theme = isDark ? "dark" : "light";
  const classes = colorClasses[color][theme];
  const cardBase = isDark ? "bg-[#111827] border-slate-800" : "bg-white border-slate-200";
  const iconBase = isDark ? "bg-slate-800" : "bg-slate-100";

  return (
    <div
      className={`
        rounded-xl border p-4 transition-colors duration-200
        ${cardBase}
      `}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className={`text-3xl font-bold ${classes.text}`}>
            {value}
          </div>
          <div className={`mt-1 text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
            {label}
          </div>
          {trend && (
            <div className={`mt-2 text-xs font-medium ${trend.isPositive ? "text-emerald-500" : "text-red-500"}`}>
              {trend.isPositive ? "+" : "-"}{Math.abs(trend.value)}% cette semaine
            </div>
          )}
        </div>
        <div className={`rounded-lg p-3 ${iconBase}`}>
          <FontAwesomeIcon icon={icon} className={`text-xl ${classes.icon}`} />
        </div>
      </div>
    </div>
  );
}

export function StatCardSkeleton({ isDark }: { isDark: boolean }) {
  return (
    <div
      className={`
        rounded-xl border p-4
        ${isDark ? "border-slate-800 bg-[#111827]" : "border-slate-200 bg-white"}
      `}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className={`h-8 w-16 rounded animate-pulse ${isDark ? "bg-gray-700" : "bg-gray-200"}`} />
          <div className={`h-4 w-24 rounded animate-pulse ${isDark ? "bg-gray-700" : "bg-gray-200"}`} />
        </div>
        <div className={`h-12 w-12 rounded-xl animate-pulse ${isDark ? "bg-gray-700" : "bg-gray-200"}`} />
      </div>
    </div>
  );
}
