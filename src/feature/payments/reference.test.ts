import { describe, expect, it } from "vitest"
import { buildPaymentReference, parsePaymentReference } from "./reference"

const orderId = "0f8e4c1a-8f2b-4c3d-9e4f-123456789abc"
const paymentId = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d"

describe("payment reference", () => {
  it("round-trips a built reference", () => {
    const reference = buildPaymentReference({ orderId, paymentId })

    expect(reference).toBe(`shop-plus:order:${orderId}:payment:${paymentId}`)
    expect(parsePaymentReference(reference)).toEqual({ orderId, paymentId })
  })

  it("trims surrounding whitespace and accepts uppercase UUIDs", () => {
    const reference = `  shop-plus:order:${orderId.toUpperCase()}:payment:${paymentId.toUpperCase()}  `

    expect(parsePaymentReference(reference)).toEqual({
      orderId: orderId.toUpperCase(),
      paymentId: paymentId.toUpperCase(),
    })
  })

  it("rejects unrelated or malformed descriptions", () => {
    expect(parsePaymentReference(null)).toBeNull()
    expect(parsePaymentReference(undefined)).toBeNull()
    expect(parsePaymentReference("")).toBeNull()
    expect(parsePaymentReference("payment for your order")).toBeNull()
    expect(
      parsePaymentReference(
        `shop-plus:order:${orderId}:payment:${paymentId}:extra`
      )
    ).toBeNull()
    expect(
      parsePaymentReference(`other:order:${orderId}:payment:${paymentId}`)
    ).toBeNull()
  })

  it("rejects references with non-UUID identifiers", () => {
    expect(parsePaymentReference("shop-plus:order:123:payment:456")).toBeNull()
    expect(
      parsePaymentReference(`shop-plus:order:${orderId}:payment:not-a-uuid`)
    ).toBeNull()
  })
})
