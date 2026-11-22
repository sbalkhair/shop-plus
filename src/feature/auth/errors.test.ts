import { describe, expect, it } from "vitest"
import { ForbiddenError, UnauthorizedError } from "./errors"

describe("auth errors", () => {
  it("exposes HTTP 401 for unauthenticated requests", () => {
    const error = new UnauthorizedError()

    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe("UnauthorizedError")
    expect(error.status).toBe(401)
    expect(error.message).toBe("Unauthorized: please sign in to continue.")
  })

  it("exposes HTTP 403 for forbidden requests", () => {
    const error = new ForbiddenError()

    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe("ForbiddenError")
    expect(error.status).toBe(403)
    expect(error.message).toBe(
      "Forbidden: you do not have access to this resource."
    )
  })

  it("allows custom messages while preserving the status", () => {
    expect(new UnauthorizedError("Sign in first").message).toBe("Sign in first")
    expect(new ForbiddenError("Admins only").status).toBe(403)
  })
})
