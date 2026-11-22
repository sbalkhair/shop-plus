import { describe, expect, it } from "vitest"
import {
  attachPaymentSchema,
  createPaymentIntentSchema,
  getPaymentSessionSchema,
  moyasarWebhookSchema,
  verifyPaymentSchema,
} from "./schema"

const orderId = "0f8e4c1a-8f2b-4c3d-9e4f-123456789abc"
const paymentRef = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d"

describe("payment input schemas", () => {
  it("only accepts UUID order and attempt identifiers", () => {
    expect(getPaymentSessionSchema.safeParse({ orderId }).success).toBe(true)
    expect(getPaymentSessionSchema.safeParse({ orderId: "1" }).success).toBe(
      false
    )

    expect(
      createPaymentIntentSchema.safeParse({ orderId, paymentRef }).success
    ).toBe(true)
    expect(
      createPaymentIntentSchema.safeParse({ orderId, paymentRef: "attempt" })
        .success
    ).toBe(false)
    // given_id must be a UUID v4, so non-v4 attempt ids are rejected.
    expect(
      createPaymentIntentSchema.safeParse({
        orderId,
        paymentRef: "a1b2c3d4-e5f6-1a7b-8c9d-0e1f2a3b4c5d",
      }).success
    ).toBe(false)
  })

  it("never accepts client-supplied amounts or totals", () => {
    const parsed = createPaymentIntentSchema.parse({
      orderId,
      paymentRef,
      amount: 1,
      total: 1,
    })

    expect(parsed).toEqual({ orderId, paymentRef })
  })

  it("validates payment ids", () => {
    expect(
      attachPaymentSchema.safeParse({ orderId, paymentId: "pay_123" }).success
    ).toBe(true)
    expect(
      attachPaymentSchema.safeParse({ orderId, paymentId: "  " }).success
    ).toBe(false)
    expect(verifyPaymentSchema.safeParse({ paymentId: "" }).success).toBe(false)
  })
})

describe("Moyasar webhook schema", () => {
  const payload = {
    id: "event_1",
    type: "payment_paid",
    secret_token: "secret",
    live: false,
    data: { id: "pay_1", status: "paid", amount: 1234, currency: "SAR" },
  }

  it("accepts a minimal sandbox event", () => {
    expect(moyasarWebhookSchema.safeParse(payload).success).toBe(true)
  })

  it("requires a secret token and an event type", () => {
    expect(
      moyasarWebhookSchema.safeParse({ ...payload, secret_token: "" }).success
    ).toBe(false)
    expect(
      moyasarWebhookSchema.safeParse({ ...payload, type: "" }).success
    ).toBe(false)
  })

  it("defaults live to false when omitted", () => {
    const { live: _live, ...withoutLive } = payload

    expect(moyasarWebhookSchema.parse(withoutLive).live).toBe(false)
  })
})
