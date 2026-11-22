import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { statusTone } from "@/feature/orders/status"
import { formatOrderDate, type OrderListItem } from "@/feature/orders/types"
import {
  isOrderSort,
  ORDER_SORT_OPTIONS,
  type OrderSort,
} from "@/feature/orders/list"
import { formatPrice } from "@/lib/pricing"
import { Link } from "@tanstack/react-router"
import { cn } from "cn"
import {
  CalendarDaysIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PackageIcon,
  SearchIcon,
  StoreIcon,
  TruckIcon,
  UserRoundIcon,
} from "lucide-react"
import { useEffect, useRef, useState } from "react"

export interface OrderListTab {
  value: string
  label: string
  count: number
}

interface OrderListRowProps {
  order: OrderListItem
  showDeliveryPartner?: boolean
  detailsTo: "/admin/orders/$orderId" | "/delivery/$orderId"
}

function OrderListRow({
  order,
  showDeliveryPartner = false,
  detailsTo,
}: OrderListRowProps) {
  return (
    <Link
      to={detailsTo}
      params={{ orderId: order.id }}
      search={true}
      className="group flex flex-col gap-3 rounded-xl border bg-white px-4 py-3 transition-colors hover:border-orange-300 hover:bg-orange-50/30 sm:flex-row sm:items-center"
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">#{order.orderNumber}</span>
          <Badge className={statusTone(order.status)}>{order.status}</Badge>
        </div>

        <p className="mt-1 flex items-center gap-1.5 truncate text-sm font-medium">
          <UserRoundIcon className="size-3.5 shrink-0 text-muted-foreground" />
          {order.customerName ?? "Unknown customer"}
        </p>

        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <CalendarDaysIcon className="size-3.5" />
            {formatOrderDate(order.createdAt)}
          </span>
          <span className="flex items-center gap-1">
            <PackageIcon className="size-3.5" />
            {order.itemCount} item{order.itemCount === 1 ? "" : "s"}
          </span>
          {showDeliveryPartner && (
            <span
              className={cn(
                "flex items-center gap-1",
                !order.deliveryPartnerName && "font-medium text-amber-700"
              )}
            >
              <TruckIcon className="size-3.5" />
              {order.deliveryPartnerName ?? "Unassigned"}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end sm:gap-1">
        <p className="text-sm font-semibold">{formatPrice(order.total)}</p>
        <span className="text-xs font-medium text-orange-600 group-hover:underline">
          View details
        </span>
      </div>
    </Link>
  )
}

interface OrderListToolbarProps {
  search: string
  onSearchChange: (value: string) => void
  sort: OrderSort
  onSortChange: (value: OrderSort) => void
}

function OrderListToolbar({
  search,
  onSearchChange,
  sort,
  onSortChange,
}: OrderListToolbarProps) {
  const [value, setValue] = useState(search)
  const onSearchChangeRef = useRef(onSearchChange)

  useEffect(() => {
    onSearchChangeRef.current = onSearchChange
  }, [onSearchChange])

  useEffect(() => {
    setValue(search)
  }, [search])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (value.trim() !== search.trim()) {
        onSearchChangeRef.current(value.trim())
      }
    }, 300)

    return () => window.clearTimeout(timer)
  }, [value, search])

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Search order number, customer name, email, or phone"
          aria-label="Search orders"
          className="pl-9"
        />
      </div>

      <Select
        value={sort}
        onValueChange={(nextValue) => {
          if (isOrderSort(nextValue)) {
            onSortChange(nextValue)
          }
        }}
      >
        <SelectTrigger className="w-full sm:w-56" aria-label="Sort orders">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ORDER_SORT_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

interface OrderListProps {
  orders: OrderListItem[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  tabs: OrderListTab[]
  activeTab: string
  onTabChange: (value: string) => void
  search: string
  onSearchChange: (value: string) => void
  sort: OrderSort
  onSortChange: (value: OrderSort) => void
  onPageChange: (page: number) => void
  showDeliveryPartner?: boolean
  detailsTo: "/admin/orders/$orderId" | "/delivery/$orderId"
  emptyTitle: string
  emptyDescription: string
}

export function OrderList({
  orders,
  total,
  page,
  pageSize,
  totalPages,
  tabs,
  activeTab,
  onTabChange,
  search,
  onSearchChange,
  sort,
  onSortChange,
  onPageChange,
  showDeliveryPartner = false,
  detailsTo,
  emptyTitle,
  emptyDescription,
}: OrderListProps) {
  const firstResult = total === 0 ? 0 : (page - 1) * pageSize + 1
  const lastResult = Math.min(page * pageSize, total)

  return (
    <div className="mt-6 space-y-4">
      <div
        role="tablist"
        aria-label="Filter orders"
        className="flex gap-1 overflow-x-auto rounded-xl border bg-white p-1"
      >
        {tabs.map((tab) => {
          const active = activeTab === tab.value

          return (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onTabChange(tab.value)}
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
                  active
                    ? "bg-white/20 text-white"
                    : "bg-zinc-100 text-zinc-500"
                )}
              >
                {tab.count}
              </span>
            </button>
          )
        })}
      </div>

      <OrderListToolbar
        search={search}
        onSearchChange={onSearchChange}
        sort={sort}
        onSortChange={onSortChange}
      />

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <p>
          {total === 0
            ? "No matching orders"
            : `Showing ${firstResult}–${lastResult} of ${total} order${total === 1 ? "" : "s"}`}
        </p>
        {search && (
          <p className="flex items-center gap-1">
            <SearchIcon className="size-3.5" />
            Search: “{search}”
          </p>
        )}
      </div>

      {orders.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-white p-10 text-center">
          <PackageIcon className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium">{emptyTitle}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {emptyDescription}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {orders.map((order) => (
            <OrderListRow
              key={order.id}
              order={order}
              showDeliveryPartner={showDeliveryPartner}
              detailsTo={detailsTo}
            />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-3 border-t pt-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeftIcon />
            Previous
          </Button>

          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </p>

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            Next
            <ChevronRightIcon />
          </Button>
        </div>
      )}

      <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
        <StoreIcon className="size-3.5" />
        Use tabs, search, and sorting to work through large order queues.
      </p>
    </div>
  )
}
