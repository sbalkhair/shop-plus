import { describe, expect, it } from "vitest"
import { MAX_PAGE, parseNumber, parsePage } from "./parse-number"

describe("parseNumber", () => {
  it("parses finite numbers and numeric strings", () => {
    expect(parseNumber(3)).toBe(3)
    expect(parseNumber("3.5")).toBe(3.5)
  })

  it("rejects empty, non-numeric, and non-finite values", () => {
    expect(parseNumber("")).toBeUndefined()
    expect(parseNumber("abc")).toBeUndefined()
    expect(parseNumber(Number.POSITIVE_INFINITY)).toBeUndefined()
    expect(parseNumber(null)).toBeUndefined()
  })
})

describe("parsePage", () => {
  it("drops missing and non-numeric pages so the server default applies", () => {
    expect(parsePage(undefined)).toBeUndefined()
    expect(parsePage("abc")).toBeUndefined()
  })

  it("drops zero and negative pages", () => {
    expect(parsePage(0)).toBeUndefined()
    expect(parsePage("0")).toBeUndefined()
    expect(parsePage(-2)).toBeUndefined()
  })

  it("floors fractional pages", () => {
    expect(parsePage(1.5)).toBe(1)
    expect(parsePage("2.9")).toBe(2)
  })

  it("caps pages at the server limit", () => {
    expect(parsePage(MAX_PAGE + 1)).toBe(MAX_PAGE)
    expect(parsePage("999999999")).toBe(MAX_PAGE)
  })
})
