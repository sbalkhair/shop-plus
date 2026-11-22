import { describe, expect, it } from "vitest"
import {
  isOrderAssignedToDeliveryPartner,
  resolveTrackingAccess,
} from "./access"

const OWNER_ID = "customer-1"

describe("resolveTrackingAccess", () => {
  it("allows the order owner to read tracking and see the code", () => {
    expect(
      resolveTrackingAccess(OWNER_ID, { id: OWNER_ID, isAdmin: false })
    ).toEqual({ allowed: true, revealCode: true })
  })

  it("denies another customer even when they know the order id", () => {
    expect(
      resolveTrackingAccess(OWNER_ID, { id: "customer-2", isAdmin: false })
    ).toEqual({ allowed: false, revealCode: false })
  })

  it("lets an admin read any order but never reveal its code", () => {
    expect(
      resolveTrackingAccess(OWNER_ID, { id: "admin-1", isAdmin: true })
    ).toEqual({ allowed: true, revealCode: false })
  })

  it("reveals the code to an admin viewing their own order", () => {
    expect(
      resolveTrackingAccess(OWNER_ID, { id: OWNER_ID, isAdmin: true })
    ).toEqual({ allowed: true, revealCode: true })
  })
})

describe("isOrderAssignedToDeliveryPartner", () => {
  it("allows the assigned driver only", () => {
    expect(isOrderAssignedToDeliveryPartner("partner-1", "partner-1")).toBe(
      true
    )
  })

  it("denies another driver and unassigned orders", () => {
    expect(isOrderAssignedToDeliveryPartner("partner-1", "partner-2")).toBe(
      false
    )
    expect(isOrderAssignedToDeliveryPartner(null, "partner-1")).toBe(false)
  })
})
