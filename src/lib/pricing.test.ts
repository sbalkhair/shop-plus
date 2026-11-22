import { describe, expect, it } from "vitest"

import {
  calculateTotals,
  formatCurrency,
  formatPrice,
  roundMoney,
} from "./pricing"

describe("roundMoney", () => {
  it("rounds to two decimal places", () => {
    expect(roundMoney(1.005)).toBe(1.01)
    expect(roundMoney(19.379999999999999)).toBe(19.38)
  })

  it("removes floating point noise from summed prices", () => {
    expect(roundMoney(0.1 + 0.2)).toBe(0.3)
  })
})

describe("calculateTotals", () => {
  it("adds tax and the delivery fee below the free-delivery threshold", () => {
    expect(calculateTotals(10)).toEqual({
      subtotal: 10,
      tax: 1.5,
      deliveryFee: 5,
      total: 16.5,
    })
  })

  it("charges delivery when the subtotal is exactly the threshold", () => {
    expect(calculateTotals(20)).toEqual({
      subtotal: 20,
      tax: 3,
      deliveryFee: 5,
      total: 28,
    })
  })

  it("waives delivery once the subtotal exceeds the threshold", () => {
    expect(calculateTotals(20.01)).toEqual({
      subtotal: 20.01,
      tax: 3,
      deliveryFee: 0,
      total: 23.01,
    })
  })

  it("rounds tax and totals to two decimals", () => {
    expect(calculateTotals(12.5)).toEqual({
      subtotal: 12.5,
      tax: 1.88,
      deliveryFee: 5,
      total: 19.38,
    })
  })

  it("handles an empty cart", () => {
    expect(calculateTotals(0)).toEqual({
      subtotal: 0,
      tax: 0,
      deliveryFee: 5,
      total: 5,
    })
  })
})

describe("money formatting", () => {
  it("formats SAR amounts for display", () => {
    expect(formatPrice(12.3)).toBe("SAR 12.30")
    expect(formatPrice(5)).toBe("SAR 5.00")
  })

  it("supports an explicit currency", () => {
    expect(formatCurrency(12.3, "USD")).toBe("USD 12.30")
  })
})
