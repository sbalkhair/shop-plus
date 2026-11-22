import { describe, expect, it } from "vitest"
import {
  evaluatePaymentEligibility,
  isTerminalAttemptStatus,
  resolveActiveAttemptState,
} from "./eligibility"

const order = (
  overrides: Partial<{
    paymentMethod: string
    isPaid: boolean | null
    status: string
  }> = {}
) => ({
  paymentMethod: "card",
  isPaid: false,
  status: "Pending Payment",
  ...overrides,
})

describe("order payment eligibility", () => {
  it("allows an unpaid card order that is pending payment", () => {
    expect(evaluatePaymentEligibility(order())).toEqual({ payable: true })
  })

  it("rejects cash orders so they can never be charged by card", () => {
    expect(
      evaluatePaymentEligibility(
        order({ paymentMethod: "cash", status: "Placed" })
      )
    ).toMatchObject({
      payable: false,
      reason: "not_card",
      state: "unavailable",
    })
  })

  it("treats a paid order as paid instead of payable", () => {
    expect(
      evaluatePaymentEligibility(order({ isPaid: true, status: "Placed" }))
    ).toMatchObject({ payable: false, reason: "already_paid", state: "paid" })
  })

  it("rejects every terminal order status", () => {
    for (const status of ["Canceled", "Refunded", "Voided", "Delivered"]) {
      expect(evaluatePaymentEligibility(order({ status }))).toMatchObject({
        payable: false,
        state: "unavailable",
      })
    }
  })

  it("rejects an unpaid card order that is no longer pending", () => {
    expect(
      evaluatePaymentEligibility(order({ status: "Processing" }))
    ).toMatchObject({
      payable: false,
      reason: "not_pending",
      state: "unavailable",
    })
  })
})

describe("active attempt session state", () => {
  it("maps no attempt and terminal attempts to payable", () => {
    expect(resolveActiveAttemptState(null)).toBe("payable")

    for (const status of ["failed", "canceled", "expired", "superseded"]) {
      expect(isTerminalAttemptStatus(status)).toBe(true)
      expect(resolveActiveAttemptState({ status })).toBe("payable")
    }
  })

  it("keeps an intent-created attempt resumable", () => {
    expect(resolveActiveAttemptState({ status: "intent_created" })).toBe(
      "payable"
    )
  })

  it("never offers a new charge for processing or authorized attempts", () => {
    expect(resolveActiveAttemptState({ status: "processing" })).toBe(
      "processing"
    )
    expect(resolveActiveAttemptState({ status: "authorized" })).toBe(
      "authorized"
    )
    expect(resolveActiveAttemptState({ status: "paid" })).toBe("paid")
  })
})
