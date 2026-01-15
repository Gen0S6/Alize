"use client";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-gray-200 dark:bg-gray-700 rounded ${className}`}
    />
  );
}

export function CardSkeleton() {
  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
      <div className="flex justify-between items-start">
        <div className="space-y-2 flex-1">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
        <Skeleton className="h-8 w-20 rounded-full" />
      </div>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  );
}

export function TableRowSkeleton() {
  return (
    <tr className="border-b dark:border-gray-800">
      <td className="py-3 pr-4"><Skeleton className="h-4 w-32" /></td>
      <td className="py-3 pr-4"><Skeleton className="h-4 w-24" /></td>
      <td className="py-3 pr-4"><Skeleton className="h-4 w-20" /></td>
      <td className="py-3 pr-4"><Skeleton className="h-4 w-16" /></td>
      <td className="py-3 pr-4"><Skeleton className="h-4 w-12" /></td>
      <td className="py-3 pr-4"><Skeleton className="h-4 w-14" /></td>
      <td className="py-3 pr-4 text-center"><Skeleton className="h-8 w-8 rounded-full mx-auto" /></td>
    </tr>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* AI Assistant Card Skeleton */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
          <div className="space-y-2">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-64" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-10 w-32 rounded-xl" />
            <Skeleton className="h-10 w-28 rounded-xl" />
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-3 space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <div className="flex flex-wrap gap-1 mt-2">
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
          </div>
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-3 space-y-2">
            <Skeleton className="h-3 w-32" />
            <div className="flex flex-wrap gap-1 mt-2">
              <Skeleton className="h-6 w-16 rounded-full" />
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-6 w-14 rounded-full" />
              <Skeleton className="h-6 w-18 rounded-full" />
            </div>
          </div>
        </div>
      </div>

      {/* Matches Table Skeleton */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-col gap-3 mb-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="md:col-span-2">
              <Skeleton className="h-3 w-16 mb-1" />
              <Skeleton className="h-10 w-full rounded-xl" />
            </div>
            <div>
              <Skeleton className="h-3 w-16 mb-1" />
              <Skeleton className="h-10 w-full rounded-xl" />
            </div>
            <div>
              <Skeleton className="h-3 w-12 mb-1" />
              <Skeleton className="h-10 w-full rounded-xl" />
            </div>
          </div>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b dark:border-gray-700">
              <th className="py-2 pr-4 text-left"><Skeleton className="h-4 w-12" /></th>
              <th className="py-2 pr-4 text-left"><Skeleton className="h-4 w-20" /></th>
              <th className="py-2 pr-4 text-left"><Skeleton className="h-4 w-24" /></th>
              <th className="py-2 pr-4 text-left"><Skeleton className="h-4 w-14" /></th>
              <th className="py-2 pr-4 text-left"><Skeleton className="h-4 w-16" /></th>
              <th className="py-2 pr-4 text-left"><Skeleton className="h-4 w-10" /></th>
              <th className="py-2 pr-4 text-center"><Skeleton className="h-4 w-16 mx-auto" /></th>
            </tr>
          </thead>
          <tbody>
            {[...Array(5)].map((_, i) => (
              <TableRowSkeleton key={i} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
