import { describe, expect, it } from "vitest"
import {
  assertChargeableMinorAmount,
  formatMinorUnits,
  formatMoney,
  fromMinorUnits,
  toMinorUnits,
} from "./money"
import { MIN_PAYMENT_AMOUNT } from "./types"

describe("payment money conversion", () => {
  it("converts major units to integer minor units", () => {
    expect(toMinorUnits(12.34)).toBe(1234)
    expect(toMinorUnits(0.01)).toBe(1)
    expect(toMinorUnits(100)).toBe(10000)
  })

  it("rounds fractional minor units instead of truncating", () => {
    // Floating point can produce values like 1999.9999 for 20.00.
    expect(toMinorUnits(19.999)).toBe(2000)
    expect(toMinorUnits(1.006)).toBe(101)
    expect(toMinorUnits(1.004)).toBe(100)
  })

  it("rejects non-finite amounts", () => {
    expect(() => toMinorUnits(Number.NaN)).toThrow(/non-finite/i)
    expect(() => toMinorUnits(Number.POSITIVE_INFINITY)).toThrow(/non-finite/i)
  })

  it("rejects amounts that are not safe integers after conversion", () => {
    expect(() => toMinorUnits(Number.MAX_SAFE_INTEGER)).toThrow(/too large/i)
  })

  it("converts minor units back to major units", () => {
    expect(fromMinorUnits(1234)).toBe(12.34)
    expect(fromMinorUnits(0)).toBe(0)
  })

  it("formats SAR amounts for display", () => {
    expect(formatMoney(12.3)).toBe("SAR 12.30")
    expect(formatMinorUnits(1234)).toBe("SAR 12.34")
    expect(formatMoney(5, "SAR")).toBe("SAR 5.00")
  })

  it("accepts chargeable amounts at or above the minimum", () => {
    expect(assertChargeableMinorAmount(MIN_PAYMENT_AMOUNT)).toBe(
      MIN_PAYMENT_AMOUNT
    )
    expect(assertChargeableMinorAmount(2500)).toBe(2500)
  })

  it("rejects non-integer, unsafe, and sub-minimum amounts", () => {
    expect(() => assertChargeableMinorAmount(100.5)).toThrow(/minimum/i)
    expect(() => assertChargeableMinorAmount(99)).toThrow(/minimum/i)
    expect(() => assertChargeableMinorAmount(0)).toThrow(/minimum/i)
    expect(() => assertChargeableMinorAmount(-100)).toThrow(/minimum/i)
    expect(() =>
      assertChargeableMinorAmount(Number.MAX_SAFE_INTEGER + 2)
    ).toThrow(/minimum/i)
    expect(() => assertChargeableMinorAmount(Number.NaN)).toThrow(/minimum/i)
  })
})
