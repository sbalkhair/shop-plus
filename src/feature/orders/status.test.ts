import { describe, expect, it } from "vitest"
import {
  canAdminCancelOrder,
  canDriverStartDelivery,
  isOrderStatus,
  isTerminalOrderStatus,
} from "./status"

describe("order status lifecycle", () => {
  it("validates known statuses only", () => {
    expect(isOrderStatus("Delivered")).toBe(true)
    expect(isOrderStatus("Out for Delivery")).toBe(true)
    expect(isOrderStatus("Completed")).toBe(false)
    expect(isOrderStatus(null)).toBe(false)
  })

  it("lets admins cancel only non-terminal orders", () => {
    expect(canAdminCancelOrder("Pending Payment")).toBe(true)
    expect(canAdminCancelOrder("Placed")).toBe(true)
    expect(canAdminCancelOrder("Processing")).toBe(true)
    expect(canAdminCancelOrder("Out for Delivery")).toBe(true)

    expect(canAdminCancelOrder("Delivered")).toBe(false)
    expect(canAdminCancelOrder("Canceled")).toBe(false)
    expect(canAdminCancelOrder("Refunded")).toBe(false)
    expect(canAdminCancelOrder("Voided")).toBe(false)
    expect(canAdminCancelOrder("Unknown")).toBe(false)
  })

  it("lets the assigned driver start delivery only before it is out", () => {
    expect(canDriverStartDelivery("Placed")).toBe(true)
    expect(canDriverStartDelivery("Processing")).toBe(true)

    expect(canDriverStartDelivery("Pending Payment")).toBe(false)
    expect(canDriverStartDelivery("Out for Delivery")).toBe(false)
    expect(canDriverStartDelivery("Delivered")).toBe(false)
    expect(canDriverStartDelivery("Canceled")).toBe(false)
    expect(canDriverStartDelivery("Unknown")).toBe(false)
  })

  it("never allows an admin or driver to set Delivered directly", () => {
    expect(canAdminCancelOrder("Delivered")).toBe(false)
    expect(canDriverStartDelivery("Delivered")).toBe(false)
  })

  it("treats delivered and other final states as terminal", () => {
    expect(isTerminalOrderStatus("Delivered")).toBe(true)
    expect(isTerminalOrderStatus("Canceled")).toBe(true)
    expect(isTerminalOrderStatus("Refunded")).toBe(true)
    expect(isTerminalOrderStatus("Voided")).toBe(true)
    expect(isTerminalOrderStatus("Out for Delivery")).toBe(false)
    expect(isTerminalOrderStatus("Unknown")).toBe(false)
  })
})
