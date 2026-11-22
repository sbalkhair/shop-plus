import type { Prisma } from "@/generated/prisma/client"
import { parsePage } from "@/lib/parse-number"
import { orderItemsSchema } from "./schema"
import { formatOrderNumber, type OrderListItem } from "./types"

/**
 * Order-list rules shared by the server queries, the route search validators,
 * and the list UIs. The defaults are intentionally operational:
 *
 * - Admin: unassigned active orders, then assigned orders waiting for delivery,
 *   then orders already out for delivery. Oldest first inside every group.
 * - Driver: orders that still need delivery started, then orders out for
 *   delivery. Delivered and canceled orders only appear under "All".
 */
export const ACTIVE_ORDER_STATUSES = [
  "Pending Payment",
  "Placed",
  "Processing",
  "Out for Delivery",
] as const

const ADMIN_WAITING_STATUSES = [
  "Pending Payment",
  "Placed",
  "Processing",
] as const

export const DRIVER_READY_ORDER_STATUSES = ["Placed", "Processing"] as const

export const DRIVER_ACTIVE_ORDER_STATUSES = [
  "Placed",
  "Processing",
  "Out for Delivery",
] as const

export const ORDER_LIST_PAGE_SIZE = 20
export const ORDER_LIST_MAX_PAGE_SIZE = 50

export const ORDER_SORT_OPTIONS = [
  { value: "priority", label: "Operational priority" },
  { value: "oldest", label: "Oldest first" },
  { value: "newest", label: "Newest first" },
] as const

export type OrderSort = (typeof ORDER_SORT_OPTIONS)[number]["value"]

export const isOrderSort = (value: unknown): value is OrderSort =>
  ORDER_SORT_OPTIONS.some((option) => option.value === value)

/** Normalizes an untrusted route `page` param before it reaches the server. */
export const parseOrderListPage = (value: unknown): number | undefined =>
  parsePage(value)

export const ADMIN_ORDER_TABS = [
  "active",
  "pending",
  "assigned",
  "all",
] as const

export type AdminOrderTab = (typeof ADMIN_ORDER_TABS)[number]

export const isAdminOrderTab = (value: unknown): value is AdminOrderTab =>
  ADMIN_ORDER_TABS.some((tab) => tab === value)

export const DELIVERY_ORDER_TABS = ["active", "ready", "out", "all"] as const

export type DeliveryOrderTab = (typeof DELIVERY_ORDER_TABS)[number]

export const isDeliveryOrderTab = (value: unknown): value is DeliveryOrderTab =>
  DELIVERY_ORDER_TABS.some((tab) => tab === value)

export type AdminOrderGroupKey = "pending" | "assigned" | "out" | "inactive"

export type DeliveryOrderGroupKey = "ready" | "out" | "other"

export interface OrderListGroup<TKey extends string> {
  key: TKey
  where: Prisma.OrderWhereInput
}

/**
 * Tab-to-priority-group mapping. The array order is the order in which the
 * groups are paginated, so it is also the default sort order.
 */
export const ADMIN_ORDER_TAB_GROUPS: Record<
  AdminOrderTab,
  readonly AdminOrderGroupKey[]
> = {
  active: ["pending", "assigned", "out"],
  pending: ["pending"],
  assigned: ["assigned", "out"],
  all: ["pending", "assigned", "out", "inactive"],
}

export const DELIVERY_ORDER_TAB_GROUPS: Record<
  DeliveryOrderTab,
  readonly DeliveryOrderGroupKey[]
> = {
  active: ["ready", "out"],
  ready: ["ready"],
  out: ["out"],
  all: ["ready", "out", "other"],
}

/**
 * Matches an order number by id prefix (order numbers are the first eight
 * characters of the id) and the customer fields an operator might search for.
 */
export const buildOrderSearchWhere = (
  search: string
): Prisma.OrderWhereInput => {
  const term = search.trim()

  if (!term) {
    return {}
  }

  const normalizedId = term.replace(/^#/, "").toLowerCase()

  return {
    OR: [
      { id: { startsWith: normalizedId } },
      { user: { name: { contains: term, mode: "insensitive" } } },
      { user: { email: { contains: term, mode: "insensitive" } } },
      { user: { phone: { contains: term } } },
    ],
  }
}

const withSearch = (
  where: Prisma.OrderWhereInput,
  searchWhere: Prisma.OrderWhereInput
): Prisma.OrderWhereInput =>
  Object.keys(searchWhere).length === 0 ? where : { AND: [where, searchWhere] }

export const getAdminOrderGroups = (
  search = ""
): OrderListGroup<AdminOrderGroupKey>[] => {
  const searchWhere = buildOrderSearchWhere(search)
  const activeStatuses = [...ACTIVE_ORDER_STATUSES]

  return [
    {
      key: "pending",
      where: withSearch(
        {
          // Waiting statuses only: an order that already left the store with a
          // driver stays in the "out" group even if its partner row is deleted
          // later (the relation is `onDelete: SetNull`).
          status: { in: [...ADMIN_WAITING_STATUSES] },
          deliveryPartnerId: null,
        },
        searchWhere
      ),
    },
    {
      key: "assigned",
      where: withSearch(
        {
          status: { in: [...ADMIN_WAITING_STATUSES] },
          deliveryPartnerId: { not: null },
        },
        searchWhere
      ),
    },
    {
      key: "out",
      where: withSearch({ status: "Out for Delivery" }, searchWhere),
    },
    {
      key: "inactive",
      where: withSearch({ status: { notIn: activeStatuses } }, searchWhere),
    },
  ]
}

export const getDeliveryOrderGroups = (
  partnerId: string,
  search = ""
): OrderListGroup<DeliveryOrderGroupKey>[] => {
  const searchWhere = buildOrderSearchWhere(search)

  return [
    {
      key: "ready",
      where: withSearch(
        {
          deliveryPartnerId: partnerId,
          status: { in: [...DRIVER_READY_ORDER_STATUSES] },
        },
        searchWhere
      ),
    },
    {
      key: "out",
      where: withSearch(
        {
          deliveryPartnerId: partnerId,
          status: "Out for Delivery",
        },
        searchWhere
      ),
    },
    {
      key: "other",
      where: withSearch(
        {
          deliveryPartnerId: partnerId,
          status: { notIn: [...DRIVER_ACTIVE_ORDER_STATUSES] },
        },
        searchWhere
      ),
    },
  ]
}

export interface AdminOrderCountsByGroup {
  pending: number
  assigned: number
  out: number
  inactive: number
}

export interface DeliveryOrderCountsByGroup {
  ready: number
  out: number
  other: number
}

export const toAdminOrderCounts = ({
  pending,
  assigned,
  out,
  inactive,
}: AdminOrderCountsByGroup) => ({
  active: pending + assigned + out,
  pending,
  assigned: assigned + out,
  all: pending + assigned + out + inactive,
})

export const toDeliveryOrderCounts = ({
  ready,
  out,
  other,
}: DeliveryOrderCountsByGroup) => ({
  active: ready + out,
  ready,
  out,
  all: ready + out + other,
})

export interface OrderListPageRange {
  groupIndex: number
  skip: number
  take: number
}

export interface OrderListPagePlan {
  total: number
  page: number
  totalPages: number
  offset: number
  ranges: OrderListPageRange[]
}

/**
 * Plans a page across ordered priority groups. Only the groups that intersect
 * the requested page are fetched, which keeps page loads O(pageSize) instead
 * of loading every order.
 */
export const planOrderListPage = (
  counts: readonly number[],
  requestedPage: number,
  requestedPageSize: number
): OrderListPagePlan => {
  const pageSize = Math.max(1, Math.floor(requestedPageSize))
  const total = counts.reduce((sum, count) => sum + count, 0)
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const page = Math.min(Math.max(1, Math.floor(requestedPage) || 1), totalPages)
  const offset = (page - 1) * pageSize
  const ranges: OrderListPageRange[] = []

  let groupStart = 0

  counts.forEach((count, groupIndex) => {
    const groupEnd = groupStart + count
    const from = Math.max(offset, groupStart)
    const to = Math.min(offset + pageSize, groupEnd)

    if (from < to) {
      ranges.push({
        groupIndex,
        skip: from - groupStart,
        take: to - from,
      })
    }

    groupStart = groupEnd
  })

  return { total, page, totalPages, offset, ranges }
}

export const orderListOrderBy = (
  sort: OrderSort
): Prisma.OrderOrderByWithRelationInput[] =>
  sort === "newest"
    ? [{ createdAt: "desc" }, { id: "desc" }]
    : [{ createdAt: "asc" }, { id: "asc" }]

/**
 * The list query only selects what the compact row renders. In particular it
 * never selects `shippingAddress`, `deliveryVerification`, or any item fields
 * beyond the stored line array needed to count quantities.
 */
export const orderListSelect = {
  id: true,
  status: true,
  total: true,
  createdAt: true,
  items: true,
  user: {
    select: { name: true },
  },
  deliveryPartner: {
    select: { name: true },
  },
} satisfies Prisma.OrderSelect

export type OrderListRow = Prisma.OrderGetPayload<{
  select: typeof orderListSelect
}>

export const toOrderListItem = (order: OrderListRow): OrderListItem => {
  const parsedItems = orderItemsSchema.safeParse(order.items)

  return {
    id: order.id,
    orderNumber: formatOrderNumber(order.id),
    customerName: order.user.name,
    createdAt: order.createdAt.toISOString(),
    total: order.total,
    itemCount: parsedItems.success
      ? parsedItems.data.reduce((count, item) => count + item.quantity, 0)
      : 0,
    status: order.status,
    deliveryPartnerName: order.deliveryPartner?.name ?? null,
  }
}
