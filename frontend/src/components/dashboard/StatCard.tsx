"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { IconDefinition } from "@fortawesome/fontawesome-svg-core";

interface StatCardProps {
  value: number | string;
  label: string;
  icon: IconDefinition;
  color: "blue" | "green" | "amber" | "gray" | "purple" | "red";
  isDark: boolean;
}

export function StatCard({ value, label, icon, color, isDark }: StatCardProps) {
  const colorStyles: Record<string, { icon: string; bg: string; border: string }> = {
    blue: {
      icon: "text-sky-500",
      bg: isDark ? "bg-sky-500/10" : "bg-sky-50",
      border: isDark ? "border-sky-500/20" : "border-sky-100",
    },
    green: {
      icon: "text-emerald-500",
      bg: isDark ? "bg-emerald-500/10" : "bg-emerald-50",
      border: isDark ? "border-emerald-500/20" : "border-emerald-100",
    },
    amber: {
      icon: "text-amber-500",
      bg: isDark ? "bg-amber-500/10" : "bg-amber-50",
      border: isDark ? "border-amber-500/20" : "border-amber-100",
    },
    gray: {
      icon: isDark ? "text-gray-400" : "text-gray-500",
      bg: isDark ? "bg-gray-500/10" : "bg-gray-50",
      border: isDark ? "border-gray-500/20" : "border-gray-100",
    },
    purple: {
      icon: "text-purple-500",
      bg: isDark ? "bg-purple-500/10" : "bg-purple-50",
      border: isDark ? "border-purple-500/20" : "border-purple-100",
    },
    red: {
      icon: "text-red-500",
      bg: isDark ? "bg-red-500/10" : "bg-red-50",
      border: isDark ? "border-red-500/20" : "border-red-100",
    },
  };

  const style = colorStyles[color];

  return (
    <div
      className={`relative overflow-hidden rounded-xl border p-4 transition-all duration-200 hover:shadow-md ${
        isDark
          ? "border-gray-800 bg-[#0d1117] hover:border-gray-700"
          : "border-gray-200 bg-white hover:border-gray-300"
      }`}
    >
      {/* Subtle colored accent */}
      <div className={`absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 rounded-full opacity-50 ${style.bg}`} />

      <div className="relative flex items-center justify-between">
        <div>
          <div className={`text-3xl font-bold tracking-tight ${isDark ? "text-white" : "text-gray-900"}`}>
            {value}
          </div>
          <div className={`mt-1 text-sm font-medium ${isDark ? "text-gray-400" : "text-gray-600"}`}>
            {label}
          </div>
        </div>
        <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${style.bg} ${style.border} border`}>
          <FontAwesomeIcon icon={icon} className={`text-xl ${style.icon}`} />
        </div>
      </div>
    </div>
  );
}

export function StatCardSkeleton({ isDark }: { isDark: boolean }) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        isDark ? "border-gray-800 bg-[#0d1117]" : "border-gray-200 bg-white"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className={`h-8 w-16 rounded-lg animate-pulse ${isDark ? "bg-gray-800" : "bg-gray-200"}`} />
          <div className={`h-4 w-24 rounded animate-pulse ${isDark ? "bg-gray-800" : "bg-gray-200"}`} />
        </div>
        <div className={`h-12 w-12 rounded-xl animate-pulse ${isDark ? "bg-gray-800" : "bg-gray-200"}`} />
      </div>
    </div>
  );
}
