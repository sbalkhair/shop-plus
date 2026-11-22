import { cn } from "cn"

export const ALL_ORDER_STATUSES = "all"

interface OrderStatusTabsProps {
  counts: Record<string, number>
  total: number
  value: string
  onChange: (value: string) => void
}

/**
 * Status tabs are derived from server-provided counts so newly introduced order
 * statuses appear automatically and tab totals stay correct across pages.
 */
export function OrderStatusTabs({
  counts,
  total,
  value,
  onChange,
}: OrderStatusTabsProps) {
  const tabs = [
    { value: ALL_ORDER_STATUSES, label: "All", count: total },
    ...Object.entries(counts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([status, count]) => ({ value: status, label: status, count })),
  ]

  return (
    <div
      role="tablist"
      aria-label="Filter orders by status"
      className="mt-6 flex gap-1 overflow-x-auto rounded-xl border bg-white p-1"
    >
      {tabs.map((tab) => {
        const active = value === tab.value

        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.value)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-orange-500 text-white"
                : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
            )}
          >
            {tab.label}
            <span
              className={cn(
                "rounded-full px-1.5 text-xs",
                active ? "bg-white/20 text-white" : "bg-zinc-100 text-zinc-500"
              )}
            >
              {tab.count}
            </span>
          </button>
        )
      })}
    </div>
  )
}
