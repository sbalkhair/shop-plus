import { describe, expect, it } from "vitest"
import {
  ACTIVE_ORDER_STATUSES,
  ADMIN_ORDER_TAB_GROUPS,
  DELIVERY_ORDER_TAB_GROUPS,
  buildOrderSearchWhere,
  getAdminOrderGroups,
  getDeliveryOrderGroups,
  orderListOrderBy,
  planOrderListPage,
  toAdminOrderCounts,
  toDeliveryOrderCounts,
  toOrderListItem,
  type OrderListRow,
} from "./list"

const groupKeys = (groups: readonly { key: string }[]) =>
  groups.map((group) => group.key)

describe("admin order list groups", () => {
  it("orders unassigned orders before assigned and out-for-delivery orders", () => {
    expect(groupKeys(getAdminOrderGroups())).toEqual([
      "pending",
      "assigned",
      "out",
      "inactive",
    ])
    expect(ADMIN_ORDER_TAB_GROUPS.active).toEqual([
      "pending",
      "assigned",
      "out",
    ])
  })

  it("keeps delivered and canceled orders out of the default active view", () => {
    expect(ADMIN_ORDER_TAB_GROUPS.active).not.toContain("inactive")
    expect(ADMIN_ORDER_TAB_GROUPS.all).toContain("inactive")

    const inactive = getAdminOrderGroups().find(
      (group) => group.key === "inactive"
    )

    expect(inactive?.where).toMatchObject({
      status: { notIn: [...ACTIVE_ORDER_STATUSES] },
    })
  })

  it("shows pending, assigned, and out orders in the expected tabs", () => {
    expect(ADMIN_ORDER_TAB_GROUPS.pending).toEqual(["pending"])
    expect(ADMIN_ORDER_TAB_GROUPS.assigned).toEqual(["assigned", "out"])
    expect(ADMIN_ORDER_TAB_GROUPS.all).toEqual([
      "pending",
      "assigned",
      "out",
      "inactive",
    ])
  })

  it("splits unassigned and assigned active orders without overlap", () => {
    const [pending, assigned, out] = getAdminOrderGroups()

    expect(pending.where).toMatchObject({
      status: { in: ["Pending Payment", "Placed", "Processing"] },
      deliveryPartnerId: null,
    })
    expect(assigned.where).toMatchObject({ deliveryPartnerId: { not: null } })
    expect(assigned.where).not.toMatchObject({
      status: { in: expect.arrayContaining(["Out for Delivery"]) },
    })
    expect(out.where).toMatchObject({ status: "Out for Delivery" })
  })

  it("keeps an out-for-delivery order in one group even without a partner", () => {
    const [pending, , out] = getAdminOrderGroups()

    // Partners are removed with `onDelete: SetNull`, so an out-for-delivery
    // order can lose its partner. It must still count once, under "out".
    expect(pending.where).not.toMatchObject({
      status: { in: expect.arrayContaining(["Out for Delivery"]) },
    })
    expect(out.where).toMatchObject({ status: "Out for Delivery" })
  })
})

describe("delivery order list groups", () => {
  it("orders ready orders before out-for-delivery orders", () => {
    const groups = getDeliveryOrderGroups("partner-1")

    expect(groupKeys(groups)).toEqual(["ready", "out", "other"])
    expect(DELIVERY_ORDER_TAB_GROUPS.active).toEqual(["ready", "out"])
  })

  it("keeps completed orders out of the default active view", () => {
    expect(DELIVERY_ORDER_TAB_GROUPS.active).not.toContain("other")
    expect(DELIVERY_ORDER_TAB_GROUPS.all).toEqual(["ready", "out", "other"])
  })

  it("always scopes every group to the authenticated partner", () => {
    for (const group of getDeliveryOrderGroups("partner-1")) {
      expect(JSON.stringify(group.where)).toContain("partner-1")
    }
  })
})

describe("order search", () => {
  it("searches by order-number prefix and customer details", () => {
    expect(buildOrderSearchWhere("  #AB12  ")).toEqual({
      OR: [
        { id: { startsWith: "ab12" } },
        { user: { name: { contains: "#AB12", mode: "insensitive" } } },
        { user: { email: { contains: "#AB12", mode: "insensitive" } } },
        { user: { phone: { contains: "#AB12" } } },
      ],
    })
  })

  it("does not add a filter for an empty search", () => {
    expect(buildOrderSearchWhere("   ")).toEqual({})
  })
})

describe("order list pagination planning", () => {
  it("slices a page across priority groups", () => {
    expect(planOrderListPage([3, 2, 4], 1, 4)).toEqual({
      total: 9,
      page: 1,
      totalPages: 3,
      offset: 0,
      ranges: [
        { groupIndex: 0, skip: 0, take: 3 },
        { groupIndex: 1, skip: 0, take: 1 },
      ],
    })

    expect(planOrderListPage([3, 2, 4], 2, 4)).toEqual({
      total: 9,
      page: 2,
      totalPages: 3,
      offset: 4,
      ranges: [
        { groupIndex: 1, skip: 1, take: 1 },
        { groupIndex: 2, skip: 0, take: 3 },
      ],
    })
  })

  it("clamps out-of-range pages and handles empty groups", () => {
    expect(planOrderListPage([3, 2, 4], 99, 4).page).toBe(3)
    expect(planOrderListPage([0, 0], 5, 20)).toEqual({
      total: 0,
      page: 1,
      totalPages: 1,
      offset: 0,
      ranges: [],
    })
  })
})

describe("order list counts", () => {
  it("derives admin tab counts from the priority groups", () => {
    expect(
      toAdminOrderCounts({
        pending: 2,
        assigned: 3,
        out: 1,
        inactive: 4,
      })
    ).toEqual({ active: 6, pending: 2, assigned: 4, all: 10 })
  })

  it("derives delivery tab counts from the priority groups", () => {
    expect(toDeliveryOrderCounts({ ready: 2, out: 1, other: 3 })).toEqual({
      active: 3,
      ready: 2,
      out: 1,
      all: 6,
    })
  })
})

describe("order list sorting", () => {
  it("sorts oldest-first by default and supports newest-first", () => {
    expect(orderListOrderBy("priority")).toEqual([
      { createdAt: "asc" },
      { id: "asc" },
    ])
    expect(orderListOrderBy("oldest")).toEqual([
      { createdAt: "asc" },
      { id: "asc" },
    ])
    expect(orderListOrderBy("newest")).toEqual([
      { createdAt: "desc" },
      { id: "desc" },
    ])
  })
})

describe("order list rows", () => {
  it("returns only compact, sanitized fields", () => {
    const row = {
      id: "abcdef12-3456-7890-abcd-ef1234567890",
      status: "Placed",
      total: 42.5,
      createdAt: new Date("2026-01-02T03:04:05.000Z"),
      items: [
        {
          product: "product-1",
          name: "Apple",
          image: "",
          price: 5,
          quantity: 3,
          unit: "kg",
        },
      ],
      user: { name: "Sara" },
      deliveryPartner: { name: "Ali" },
    } as unknown as OrderListRow

    const item = toOrderListItem(row)

    expect(item).toEqual({
      id: "abcdef12-3456-7890-abcd-ef1234567890",
      orderNumber: "ABCDEF12",
      customerName: "Sara",
      createdAt: "2026-01-02T03:04:05.000Z",
      total: 42.5,
      itemCount: 3,
      status: "Placed",
      deliveryPartnerName: "Ali",
    })
    expect(item).not.toHaveProperty("shippingAddress")
    expect(item).not.toHaveProperty("deliveryVerification")
    expect(JSON.stringify(item)).not.toContain("otp")
  })

  it("degrades malformed item JSON to a zero item count", () => {
    const row = {
      id: "abcdef12-3456-7890-abcd-ef1234567890",
      status: "Placed",
      total: 42.5,
      createdAt: new Date("2026-01-02T03:04:05.000Z"),
      items: { unexpected: true },
      user: { name: "Sara" },
      deliveryPartner: null,
    } as unknown as OrderListRow

    expect(toOrderListItem(row).itemCount).toBe(0)
  })
})
