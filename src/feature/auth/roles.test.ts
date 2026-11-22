import { describe, expect, it } from "vitest"
import { hasRole, isSameAuthUser, toAuthUser } from "./roles"

const sessionUser = {
  id: "user-1",
  name: "Ada Lovelace",
  email: "ada@example.com",
}

describe("toAuthUser", () => {
  it("maps a regular user to the customer role", () => {
    expect(toAuthUser(sessionUser)).toEqual({
      id: "user-1",
      name: "Ada Lovelace",
      email: "ada@example.com",
      phone: null,
      image: null,
      role: "customer",
      isAdmin: false,
      isDriver: false,
    })
  })

  it("maps a driver account to the driver role", () => {
    const user = toAuthUser({ ...sessionUser, isDriver: true })

    expect(user.role).toBe("driver")
    expect(user.isDriver).toBe(true)
    expect(user.isAdmin).toBe(false)
  })

  it("keeps admin as the highest-priority role", () => {
    const user = toAuthUser({
      ...sessionUser,
      isAdmin: true,
      isDriver: true,
    })

    expect(user.role).toBe("admin")
    expect(user.isAdmin).toBe(true)
    expect(user.isDriver).toBe(true)
  })

  it("maps an admin to the admin role", () => {
    const user = toAuthUser({
      ...sessionUser,
      isAdmin: true,
      phone: "+1 555 0100",
      image: "https://example.com/avatar.png",
    })

    expect(user.role).toBe("admin")
    expect(user.isAdmin).toBe(true)
    expect(user.phone).toBe("+1 555 0100")
    expect(user.image).toBe("https://example.com/avatar.png")
  })

  it("treats a null isAdmin flag as a customer", () => {
    expect(toAuthUser({ ...sessionUser, isAdmin: null }).role).toBe("customer")
  })
})

describe("hasRole", () => {
  const customer = toAuthUser(sessionUser)
  const driver = toAuthUser({ ...sessionUser, id: "user-3", isDriver: true })
  const admin = toAuthUser({ ...sessionUser, id: "user-2", isAdmin: true })

  it("matches allowed roles", () => {
    expect(hasRole(customer, ["customer"])).toBe(true)
    expect(hasRole(driver, ["driver"])).toBe(true)
    expect(hasRole(admin, ["admin", "customer"])).toBe(true)
  })

  it("rejects roles that are not allowed", () => {
    expect(hasRole(customer, ["admin"])).toBe(false)
    expect(hasRole(customer, ["driver"])).toBe(false)
    expect(hasRole(driver, ["admin"])).toBe(false)
    expect(hasRole(driver, ["customer"])).toBe(false)
  })
})

describe("isSameAuthUser", () => {
  const user = toAuthUser(sessionUser)

  it("compares users by identity and role, not object identity", () => {
    expect(isSameAuthUser(user, { ...user })).toBe(true)
    expect(isSameAuthUser(null, null)).toBe(true)
  })

  it("detects changes", () => {
    expect(isSameAuthUser(user, null)).toBe(false)
    expect(isSameAuthUser(user, { ...user, role: "admin" })).toBe(false)
    expect(isSameAuthUser(user, { ...user, id: "user-2" })).toBe(false)
  })
})
