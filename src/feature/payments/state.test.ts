import { describe, expect, it } from "vitest"
import {
  decidePaymentOutcome,
  lastFourFromMaskedNumber,
  sanitizeProviderPayment,
} from "./state"

const payment = (status: string, extra: Record<string, unknown> = {}) => ({
  status,
  amount: 2500,
  ...extra,
})

describe("payment outcome state machine", () => {
  it("marks an unpaid order as paid once", () => {
    const decision = decidePaymentOutcome(payment("paid"), {
      orderIsPaid: false,
    })

    expect(decision).toEqual({
      status: "paid",
      orderOutcome: "mark_paid",
      isFinal: true,
    })
  })

  it("never fulfils an order twice", () => {
    const decision = decidePaymentOutcome(payment("paid"), {
      orderIsPaid: true,
    })

    expect(decision.orderOutcome).toBe("none")
    expect(decision.status).toBe("paid")
  })

  it("treats captured as paid", () => {
    expect(
      decidePaymentOutcome(payment("captured"), { orderIsPaid: false })
    ).toMatchObject({ status: "paid", orderOutcome: "mark_paid" })
  })

  it("keeps authorized payments non-final and non-paid", () => {
    expect(
      decidePaymentOutcome(payment("authorized"), { orderIsPaid: false })
    ).toEqual({ status: "authorized", orderOutcome: "none", isFinal: false })
  })

  it("treats initiated and verified as processing, never paid", () => {
    for (const status of ["initiated", "verified"]) {
      expect(
        decidePaymentOutcome(payment(status), { orderIsPaid: false })
      ).toEqual({ status: "processing", orderOutcome: "none", isFinal: false })
    }
  })

  it("treats failed, expired, voided and refunded as final", () => {
    expect(
      decidePaymentOutcome(payment("failed"), { orderIsPaid: false })
    ).toEqual({ status: "failed", orderOutcome: "none", isFinal: true })

    expect(
      decidePaymentOutcome(payment("expired"), { orderIsPaid: false })
    ).toEqual({ status: "expired", orderOutcome: "none", isFinal: true })

    expect(
      decidePaymentOutcome(payment("voided"), { orderIsPaid: true })
    ).toEqual({ status: "voided", orderOutcome: "mark_voided", isFinal: true })
  })

  it("only marks an order refunded on a full refund", () => {
    expect(
      decidePaymentOutcome(payment("refunded", { refunded: 1000 }), {
        orderIsPaid: true,
      })
    ).toEqual({ status: "refunded", orderOutcome: "none", isFinal: true })

    expect(
      decidePaymentOutcome(payment("refunded", { refunded: 2500 }), {
        orderIsPaid: true,
      })
    ).toEqual({
      status: "refunded",
      orderOutcome: "mark_refunded",
      isFinal: true,
    })
  })

  it("treats unknown statuses as non-paid and non-final", () => {
    expect(
      decidePaymentOutcome(payment("something_new"), { orderIsPaid: false })
    ).toEqual({ status: "processing", orderOutcome: "none", isFinal: false })
  })
})

describe("provider payment sanitisation", () => {
  it("extracts only the last four digits of a masked card number", () => {
    expect(lastFourFromMaskedNumber("411111******1111")).toBe("1111")
    expect(lastFourFromMaskedNumber("**** **** **** 4242")).toBe("4242")
    expect(lastFourFromMaskedNumber("123")).toBeNull()
    expect(lastFourFromMaskedNumber(undefined)).toBeNull()
  })

  it("keeps only safe display fields and truncates failure messages", () => {
    const sanitized = sanitizeProviderPayment({
      status: "failed",
      source: {
        type: "creditcard",
        company: "visa",
        number: "411111******1111",
        message: "x".repeat(900),
      },
    })

    expect(sanitized).toEqual({
      providerStatus: "failed",
      method: "creditcard",
      network: "visa",
      lastFour: "1111",
      failureMessage: "x".repeat(500),
    })
  })

  it("returns nulls when the source is missing", () => {
    expect(sanitizeProviderPayment({ status: "paid" })).toEqual({
      providerStatus: "paid",
      method: null,
      network: null,
      lastFour: null,
      failureMessage: null,
    })
  })
})
