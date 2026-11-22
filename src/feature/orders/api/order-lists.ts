import { authorizationMiddleware } from "@/feature/auth/middleware"
import type { Prisma } from "@/generated/prisma/client"
import { prisma } from "@/lib/db"
import { createServerFn } from "@tanstack/react-start"
import {
  ADMIN_ORDER_TAB_GROUPS,
  DELIVERY_ORDER_TAB_GROUPS,
  getAdminOrderGroups,
  getDeliveryOrderGroups,
  orderListOrderBy,
  orderListSelect,
  planOrderListPage,
  toAdminOrderCounts,
  toDeliveryOrderCounts,
  toOrderListItem,
  type OrderListGroup,
  type OrderListRow,
  type OrderSort,
} from "../list"
import { adminOrderListSchema, deliveryOrderListSchema } from "../schema"
import type {
  AdminOrderListResult,
  DeliveryOrderListResult,
  OrderListItem,
} from "../types"
import { findDriverPartner } from "./delivery"

interface OrderListDataSource {
  count: (where: Prisma.OrderWhereInput) => Promise<number>
  findMany: (args: {
    where: Prisma.OrderWhereInput
    orderBy: Prisma.OrderOrderByWithRelationInput[]
    skip: number
    take: number
  }) => Promise<OrderListRow[]>
}

interface ExecuteOrderListArgs<TKey extends string> {
  allGroups: readonly OrderListGroup<TKey>[]
  /** Group keys for the selected tab, in priority order. */
  tabGroupKeys: readonly TKey[]
  query: {
    page: number
    pageSize: number
    sort: OrderSort
  }
  dataSource: OrderListDataSource
}

interface ExecuteOrderListResult<TKey extends string> {
  orders: OrderListItem[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  counts: Record<TKey, number>
}

/**
 * Runs one list request. Counts are collected for every priority group so tab
 * badges stay accurate, but only the groups that intersect the current page
 * are queried for rows.
 */
const executeOrderList = async <TKey extends string>({
  allGroups,
  tabGroupKeys,
  query,
  dataSource,
}: ExecuteOrderListArgs<TKey>): Promise<ExecuteOrderListResult<TKey>> => {
  const groupByKey = new Map(allGroups.map((group) => [group.key, group]))

  const tabGroups = tabGroupKeys.map((key) => {
    const group = groupByKey.get(key)

    if (!group) {
      throw new Error(`Unknown order list group: ${key}`)
    }

    return group
  })

  const groupCounts = await Promise.all(
    allGroups.map((group) => dataSource.count(group.where))
  )

  const counts = Object.fromEntries(
    allGroups.map((group, index) => [group.key, groupCounts[index]])
  ) as Record<TKey, number>

  const plan = planOrderListPage(
    tabGroupKeys.map((key) => counts[key]),
    query.page,
    query.pageSize
  )

  let rows: OrderListRow[]

  if (query.sort === "priority") {
    const groupedRows = await Promise.all(
      plan.ranges.map((range) =>
        dataSource.findMany({
          where: tabGroups[range.groupIndex].where,
          orderBy: orderListOrderBy("oldest"),
          skip: range.skip,
          take: range.take,
        })
      )
    )

    rows = groupedRows.flat()
  } else {
    const where: Prisma.OrderWhereInput =
      tabGroups.length === 1
        ? tabGroups[0].where
        : { OR: tabGroups.map((group) => group.where) }

    rows = await dataSource.findMany({
      where,
      orderBy: orderListOrderBy(query.sort),
      skip: plan.offset,
      take: query.pageSize,
    })
  }

  return {
    orders: rows.map(toOrderListItem),
    total: plan.total,
    page: plan.page,
    pageSize: query.pageSize,
    totalPages: plan.totalPages,
    counts,
  }
}

/** Paginated, filtered, priority-sorted order list for admins. */
export const getAdminOrderList = createServerFn({ method: "GET" })
  .middleware([authorizationMiddleware({ permissions: ["orders:read-all"] })])
  .validator((data: unknown) => adminOrderListSchema.parse(data))
  .handler(async ({ data }): Promise<AdminOrderListResult> => {
    const result = await executeOrderList({
      allGroups: getAdminOrderGroups(data.search),
      tabGroupKeys: ADMIN_ORDER_TAB_GROUPS[data.tab],
      query: data,
      dataSource: {
        count: (where) => prisma.order.count({ where }),
        findMany: (args) =>
          prisma.order.findMany({ ...args, select: orderListSelect }),
      },
    })

    return { ...result, counts: toAdminOrderCounts(result.counts) }
  })

const emptyDeliveryList = (pageSize: number): DeliveryOrderListResult => ({
  orders: [],
  total: 0,
  page: 1,
  pageSize,
  totalPages: 1,
  counts: { active: 0, ready: 0, out: 0, all: 0 },
})

/**
 * Paginated, filtered order list for the signed-in driver. The partner scope
 * is resolved from the authenticated user, never from client input.
 */
export const getDeliveryOrderList = createServerFn({ method: "GET" })
  .middleware([
    authorizationMiddleware({ permissions: ["delivery:read-assigned"] }),
  ])
  .validator((data: unknown) => deliveryOrderListSchema.parse(data))
  .handler(async ({ data, context }): Promise<DeliveryOrderListResult> => {
    const partner = await findDriverPartner(context.user.id)

    if (!partner || !partner.isActive) {
      return emptyDeliveryList(data.pageSize)
    }

    const result = await executeOrderList({
      allGroups: getDeliveryOrderGroups(partner.id, data.search),
      tabGroupKeys: DELIVERY_ORDER_TAB_GROUPS[data.tab],
      query: data,
      dataSource: {
        count: (where) => prisma.order.count({ where }),
        findMany: (args) =>
          prisma.order.findMany({ ...args, select: orderListSelect }),
      },
    })

    return { ...result, counts: toDeliveryOrderCounts(result.counts) }
  })
