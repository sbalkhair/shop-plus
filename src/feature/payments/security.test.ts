import { describe, expect, it } from "vitest"
import { secretMatches } from "./security"

describe("webhook secret comparison", () => {
  const secret = "a".repeat(64)

  it("accepts an exact secret match", () => {
    expect(secretMatches(secret, secret)).toBe(true)
  })

  it("rejects wrong secrets without leaking length", () => {
    expect(secretMatches("b".repeat(64), secret)).toBe(false)
    expect(secretMatches("a", secret)).toBe(false)
    expect(secretMatches(`${secret}extra`, secret)).toBe(false)
  })

  it("rejects empty, missing, and non-string values", () => {
    expect(secretMatches("", secret)).toBe(false)
    expect(secretMatches(undefined, secret)).toBe(false)
    expect(secretMatches(null, secret)).toBe(false)
    expect(secretMatches(123, secret)).toBe(false)
    expect(secretMatches(secret, "")).toBe(false)
  })
})
