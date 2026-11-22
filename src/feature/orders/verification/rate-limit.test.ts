import { beforeEach, describe, expect, it } from "vitest"
import { consumeRateLimit, resetRateLimitsForTests } from "./rate-limit"

beforeEach(() => {
  resetRateLimitsForTests()
})

describe("verification rate limiting", () => {
  const options = { limit: 3, windowMs: 1_000 }

  it("allows requests up to the limit", () => {
    expect(consumeRateLimit("driver:order", options, 0).allowed).toBe(true)
    expect(consumeRateLimit("driver:order", options, 100).allowed).toBe(true)
    expect(consumeRateLimit("driver:order", options, 200).allowed).toBe(true)
  })

  it("blocks a burst and reports when to retry", () => {
    consumeRateLimit("driver:order", options, 0)
    consumeRateLimit("driver:order", options, 100)
    consumeRateLimit("driver:order", options, 200)

    const blocked = consumeRateLimit("driver:order", options, 300)

    expect(blocked.allowed).toBe(false)
    expect(blocked.retryAfterMs).toBe(700)
  })

  it("releases the slot once the window passes", () => {
    consumeRateLimit("driver:order", options, 0)
    consumeRateLimit("driver:order", options, 100)
    consumeRateLimit("driver:order", options, 200)

    expect(consumeRateLimit("driver:order", options, 1_001).allowed).toBe(true)
  })

  it("keeps separate buckets per key", () => {
    consumeRateLimit("driver:one", options, 0)
    consumeRateLimit("driver:one", options, 0)
    consumeRateLimit("driver:one", options, 0)

    expect(consumeRateLimit("driver:one", options, 0).allowed).toBe(false)
    expect(consumeRateLimit("driver:two", options, 0).allowed).toBe(true)
  })
})
