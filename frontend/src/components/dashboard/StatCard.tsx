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
  const iconColors: Record<string, string> = {
    blue: "text-blue-600",
    green: "text-green-600",
    amber: "text-amber-600",
    gray: "text-gray-500",
    purple: "text-purple-600",
    red: "text-red-600",
  };

  return (
    <div
      className={`rounded-lg border p-4 ${
        isDark ? "border-gray-800 bg-[#0a0b0f]" : "border-gray-200 bg-white"
      }`}
    >
      <div className="flex items-center justify-between">
        <div>
          <div className={`text-2xl font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>
            {value}
          </div>
          <div className={`mt-1 text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
            {label}
          </div>
        </div>
        <div className={`${iconColors[color]}`}>
          <FontAwesomeIcon icon={icon} className="text-xl" />
        </div>
      </div>
    </div>
  );
}

export function StatCardSkeleton({ isDark }: { isDark: boolean }) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        isDark ? "border-gray-800 bg-[#0a0b0f]" : "border-gray-200 bg-white"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className={`h-7 w-12 rounded animate-pulse ${isDark ? "bg-gray-800" : "bg-gray-200"}`} />
          <div className={`h-4 w-20 rounded animate-pulse ${isDark ? "bg-gray-800" : "bg-gray-200"}`} />
        </div>
        <div className={`h-8 w-8 rounded animate-pulse ${isDark ? "bg-gray-800" : "bg-gray-200"}`} />
      </div>
    </div>
  );
}
