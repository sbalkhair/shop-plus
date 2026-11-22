import { describe, expect, it } from "vitest"
import {
  PERMISSIONS,
  ROLE_PERMISSIONS,
  hasPermission,
  hasPermissions,
} from "./permissions"
import { toAuthUser } from "./roles"

const customer = toAuthUser({
  id: "customer-1",
  name: "Customer",
  email: "customer@example.com",
})

const admin = toAuthUser({
  id: "admin-1",
  name: "Admin",
  email: "admin@example.com",
  isAdmin: true,
})

const driver = toAuthUser({
  id: "driver-1",
  name: "Driver",
  email: "driver@example.com",
  isDriver: true,
})

describe("permission policy", () => {
  it("keeps the permission catalog and role mappings in sync", () => {
    for (const permissions of Object.values(ROLE_PERMISSIONS)) {
      for (const permission of permissions) {
        expect(PERMISSIONS).toContain(permission)
      }
    }
  })

  it("grants order creation to customers", () => {
    expect(hasPermission(customer, "orders:create")).toBe(true)
    expect(hasPermissions(customer, ["orders:create"])).toBe(true)
  })

  it("grants order creation to admins", () => {
    expect(hasPermission(admin, "orders:create")).toBe(true)
  })

  it("grants payment creation to customers and admins", () => {
    expect(hasPermission(customer, "payments:create")).toBe(true)
    expect(hasPermission(admin, "payments:create")).toBe(true)
  })

  it("lets customers read their own orders", () => {
    expect(hasPermission(customer, "orders:read")).toBe(true)
    expect(hasPermission(admin, "orders:read")).toBe(true)
  })

  it("restricts reading every customer's orders to admins", () => {
    expect(hasPermission(admin, "orders:read-all")).toBe(true)
    expect(hasPermission(customer, "orders:read-all")).toBe(false)
  })

  it("restricts order tracking updates to admins", () => {
    expect(hasPermission(admin, "orders:update")).toBe(true)
    expect(hasPermission(customer, "orders:update")).toBe(false)
  })

  it("grants address management to customers only", () => {
    expect(hasPermission(customer, "addresses:read")).toBe(true)
    expect(hasPermission(customer, "addresses:manage")).toBe(true)

    expect(hasPermission(admin, "addresses:read")).toBe(false)
    expect(hasPermission(admin, "addresses:manage")).toBe(false)
    expect(hasPermission(driver, "addresses:read")).toBe(false)
    expect(hasPermission(driver, "addresses:manage")).toBe(false)
  })

  it("restricts delivery partner management to admins", () => {
    expect(hasPermission(admin, "delivery-partners:read")).toBe(true)
    expect(hasPermission(admin, "delivery-partners:manage")).toBe(true)

    expect(hasPermission(customer, "delivery-partners:read")).toBe(false)
    expect(hasPermission(customer, "delivery-partners:manage")).toBe(false)
    expect(hasPermission(driver, "delivery-partners:read")).toBe(false)
    expect(hasPermission(driver, "delivery-partners:manage")).toBe(false)
  })

  it("grants assigned-delivery access, starting, and verification only to drivers", () => {
    expect(hasPermission(driver, "delivery:read-assigned")).toBe(true)
    expect(hasPermission(driver, "delivery:start")).toBe(true)
    expect(hasPermission(driver, "delivery:verify")).toBe(true)

    expect(hasPermission(customer, "delivery:read-assigned")).toBe(false)
    expect(hasPermission(customer, "delivery:start")).toBe(false)
    expect(hasPermission(customer, "delivery:verify")).toBe(false)

    // Admins can manage orders but must never bypass the driver workflow or
    // the customer's code.
    expect(hasPermission(admin, "delivery:read-assigned")).toBe(false)
    expect(hasPermission(admin, "delivery:start")).toBe(false)
    expect(hasPermission(admin, "delivery:verify")).toBe(false)
  })

  it("does not grant drivers customer or admin order permissions", () => {
    expect(hasPermission(driver, "orders:create")).toBe(false)
    expect(hasPermission(driver, "orders:read")).toBe(false)
    expect(hasPermission(driver, "orders:read-all")).toBe(false)
    expect(hasPermission(driver, "orders:update")).toBe(false)
  })

  it("restricts product creation to admins", () => {
    expect(hasPermission(admin, "products:create")).toBe(true)
    expect(hasPermission(customer, "products:create")).toBe(false)
    expect(hasPermissions(customer, ["products:create"])).toBe(false)
  })

  it("restricts product updates and deletes to admins", () => {
    expect(hasPermission(admin, "products:update")).toBe(true)
    expect(hasPermission(admin, "products:delete")).toBe(true)
    expect(hasPermission(customer, "products:update")).toBe(false)
    expect(hasPermission(customer, "products:delete")).toBe(false)
    expect(
      hasPermissions(customer, ["products:update", "products:delete"])
    ).toBe(false)
  })

  it("restricts category management to admins", () => {
    expect(hasPermission(admin, "categories:create")).toBe(true)
    expect(hasPermission(admin, "categories:update")).toBe(true)
    expect(hasPermission(admin, "categories:delete")).toBe(true)

    expect(hasPermission(customer, "categories:create")).toBe(false)
    expect(hasPermission(customer, "categories:update")).toBe(false)
    expect(hasPermission(customer, "categories:delete")).toBe(false)
  })

  it("requires every requested permission", () => {
    expect(hasPermissions(customer, [])).toBe(true)
  })
})
