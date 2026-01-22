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
      bg: "bg-blue-900/20",
      border: "border-blue-800/50",
      text: "text-blue-400",
      icon: "text-blue-500",
    },
    light: {
      bg: "bg-blue-50",
      border: "border-blue-200",
      text: "text-blue-600",
      icon: "text-blue-500",
    },
  },
  green: {
    dark: {
      bg: "bg-emerald-900/20",
      border: "border-emerald-800/50",
      text: "text-emerald-400",
      icon: "text-emerald-500",
    },
    light: {
      bg: "bg-emerald-50",
      border: "border-emerald-200",
      text: "text-emerald-600",
      icon: "text-emerald-500",
    },
  },
  amber: {
    dark: {
      bg: "bg-amber-900/20",
      border: "border-amber-800/50",
      text: "text-amber-400",
      icon: "text-amber-500",
    },
    light: {
      bg: "bg-amber-50",
      border: "border-amber-200",
      text: "text-amber-600",
      icon: "text-amber-500",
    },
  },
  gray: {
    dark: {
      bg: "bg-gray-800/50",
      border: "border-gray-700",
      text: "text-gray-300",
      icon: "text-gray-500",
    },
    light: {
      bg: "bg-gray-50",
      border: "border-gray-200",
      text: "text-gray-700",
      icon: "text-gray-500",
    },
  },
  purple: {
    dark: {
      bg: "bg-purple-900/20",
      border: "border-purple-800/50",
      text: "text-purple-400",
      icon: "text-purple-500",
    },
    light: {
      bg: "bg-purple-50",
      border: "border-purple-200",
      text: "text-purple-600",
      icon: "text-purple-500",
    },
  },
  red: {
    dark: {
      bg: "bg-red-900/20",
      border: "border-red-800/50",
      text: "text-red-400",
      icon: "text-red-500",
    },
    light: {
      bg: "bg-red-50",
      border: "border-red-200",
      text: "text-red-600",
      icon: "text-red-500",
    },
  },
};

export function StatCard({ value, label, icon, color, isDark, trend }: StatCardProps) {
  const theme = isDark ? "dark" : "light";
  const classes = colorClasses[color][theme];

  return (
    <div
      className={`
        relative overflow-hidden rounded-2xl border p-4 transition-all duration-300
        hover:scale-[1.02] hover:shadow-lg
        ${classes.bg} ${classes.border}
        ${isDark ? "hover:shadow-black/20" : "hover:shadow-gray-200"}
      `}
    >
      {/* Background decoration */}
      <div className="absolute -right-4 -top-4 opacity-10">
        <FontAwesomeIcon icon={icon} className={`text-6xl ${classes.icon}`} />
      </div>

      <div className="relative flex items-start justify-between">
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
        <div className={`rounded-xl p-3 ${isDark ? "bg-white/5" : "bg-white"}`}>
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
        rounded-2xl border p-4
        ${isDark ? "border-gray-700 bg-[#0f1116]" : "border-gray-200 bg-white"}
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
