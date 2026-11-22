import { describe, expect, it } from "vitest"
import { PaymentVerificationError, applyVerifiedPayment } from "./apply"
import { buildPaymentReference } from "./reference"
import type { MoyasarPayment } from "./moyasar"
import { buildOrder, buildPayment, createFakeDb } from "./test-support/fake-db"

const orderId = "11111111-1111-4111-8111-111111111111"
const paymentId = "22222222-2222-4222-8222-222222222222"
const userId = "user_1"

const providerPayment = (
  overrides: Partial<MoyasarPayment> = {}
): MoyasarPayment => ({
  id: "pay_abc123",
  status: "paid",
  amount: 2500,
  currency: "SAR",
  description: buildPaymentReference({ orderId, paymentId }),
  source: {
    type: "creditcard",
    company: "visa",
    number: "411111******1111",
  },
  ...overrides,
})

const seed = (
  options: {
    order?: Parameters<typeof buildOrder>[0]
    payment?: Parameters<typeof buildPayment>[0]
  } = {}
) => {
  const db = createFakeDb({
    orders: [
      buildOrder({
        id: orderId,
        userId,
        total: 25,
        subtotal: 25,
        ...options.order,
      }),
    ],
    payments: [
      buildPayment({
        id: paymentId,
        orderId,
        amount: 2500,
        activeOrderId: orderId,
        ...options.payment,
      }),
    ],
  })

  return db
}

const expectVerificationError = async (
  promise: Promise<unknown>,
  code: string
) => {
  await expect(promise).rejects.toBeInstanceOf(PaymentVerificationError)
  await expect(promise).rejects.toMatchObject({ code })
}

describe("applyVerifiedPayment", () => {
  it("marks an unpaid card order as paid exactly once", async () => {
    const { db, orders, payments } = seed()

    const result = await applyVerifiedPayment(
      { providerPayment: providerPayment(), userId },
      db
    )

    expect(result).toMatchObject({
      paymentId,
      orderId,
      status: "paid",
      orderIsPaid: true,
      orderStatus: "Placed",
      duplicate: false,
    })

    const order = orders.get(orderId)
    const payment = payments.get(paymentId)

    expect(order).toMatchObject({ isPaid: true, status: "Placed" })
    expect(order?.paidAt).toBeInstanceOf(Date)
    expect(order?.statusHistory).toHaveLength(1)
    expect(payment).toMatchObject({
      status: "paid",
      providerStatus: "paid",
      moyasarPaymentId: "pay_abc123",
      activeOrderId: null,
      method: "creditcard",
      network: "visa",
      lastFour: "1111",
    })
  })

  it("never fulfils a canceled order but still records the payment", async () => {
    const { db, orders, payments } = seed({
      order: { status: "Canceled" },
    })

    const result = await applyVerifiedPayment(
      { providerPayment: providerPayment(), userId },
      db
    )

    expect(result).toMatchObject({
      status: "paid",
      orderIsPaid: false,
      orderStatus: "Canceled",
    })
    expect(orders.get(orderId)).toMatchObject({
      isPaid: false,
      status: "Canceled",
    })
    expect(payments.get(paymentId)).toMatchObject({ status: "paid" })
  })

  it("does not mark the order paid for a failed payment", async () => {
    const { db, orders, payments } = seed()

    const result = await applyVerifiedPayment(
      {
        providerPayment: providerPayment({
          status: "failed",
          source: {
            type: "creditcard",
            company: "visa",
            message: "Insufficient funds",
          },
        }),
        userId,
      },
      db
    )

    expect(result).toMatchObject({
      status: "failed",
      orderIsPaid: false,
      orderStatus: "Pending Payment",
    })
    expect(orders.get(orderId)).toMatchObject({
      isPaid: false,
      status: "Pending Payment",
    })
    expect(payments.get(paymentId)).toMatchObject({
      status: "failed",
      failureMessage: "Insufficient funds",
      activeOrderId: null,
    })
  })

  it("treats an initiated payment as processing, not paid", async () => {
    const { db, orders, payments } = seed()

    const result = await applyVerifiedPayment(
      { providerPayment: providerPayment({ status: "initiated" }), userId },
      db
    )

    expect(result).toMatchObject({
      status: "processing",
      orderIsPaid: false,
    })
    expect(orders.get(orderId)).toMatchObject({ isPaid: false })
    expect(payments.get(paymentId)).toMatchObject({
      status: "processing",
      activeOrderId: orderId,
    })
  })

  it("is idempotent for duplicate callbacks", async () => {
    const { db, orders } = seed()
    const payment = providerPayment()

    await applyVerifiedPayment({ providerPayment: payment, userId }, db)
    const paidAt = orders.get(orderId)?.paidAt

    await applyVerifiedPayment({ providerPayment: payment, userId }, db)

    expect(orders.get(orderId)?.statusHistory).toHaveLength(1)
    expect(orders.get(orderId)?.paidAt).toEqual(paidAt)
    expect(orders.get(orderId)).toMatchObject({
      isPaid: true,
      status: "Placed",
    })
  })

  it("serializes concurrent duplicate callbacks so the order is fulfilled once", async () => {
    const { db, orders } = seed()
    const payment = providerPayment()

    const results = await Promise.all([
      applyVerifiedPayment({ providerPayment: payment, userId }, db),
      applyVerifiedPayment({ providerPayment: payment, userId }, db),
    ])

    expect(results.every((result) => result.orderIsPaid)).toBe(true)
    expect(orders.get(orderId)?.statusHistory).toHaveLength(1)
  })

  it("rejects a payment without a shop-plus reference", async () => {
    const { db } = seed()

    await expectVerificationError(
      applyVerifiedPayment(
        {
          providerPayment: providerPayment({ description: "random payment" }),
          userId,
        },
        db
      ),
      "invalid_reference"
    )
  })

  it("rejects an unknown attempt", async () => {
    const { db } = seed()

    await expectVerificationError(
      applyVerifiedPayment(
        {
          providerPayment: providerPayment({
            description: buildPaymentReference({
              orderId,
              paymentId: "99999999-9999-4999-8999-999999999999",
            }),
          }),
          userId,
        },
        db
      ),
      "unknown_payment"
    )
  })

  it("rejects a payment whose reference points at another order", async () => {
    const { db } = seed()

    await expectVerificationError(
      applyVerifiedPayment(
        {
          providerPayment: providerPayment({
            description: buildPaymentReference({
              orderId: "33333333-3333-4333-8333-333333333333",
              paymentId,
            }),
          }),
          userId,
        },
        db
      ),
      "order_mismatch"
    )
  })

  it("rejects an amount that differs from the attempt", async () => {
    const { db } = seed()

    await expectVerificationError(
      applyVerifiedPayment(
        { providerPayment: providerPayment({ amount: 1 }), userId },
        db
      ),
      "amount_mismatch"
    )
  })

  it("rejects an amount that no longer matches the current order total", async () => {
    const { db } = seed({
      order: { total: 30, subtotal: 30 },
    })

    await expectVerificationError(
      applyVerifiedPayment({ providerPayment: providerPayment(), userId }, db),
      "amount_mismatch"
    )
  })

  it("rejects a currency other than SAR", async () => {
    const { db } = seed()

    await expectVerificationError(
      applyVerifiedPayment(
        { providerPayment: providerPayment({ currency: "USD" }), userId },
        db
      ),
      "currency_mismatch"
    )
  })

  it("rejects a payment attempt that belongs to another user", async () => {
    const { db } = seed()

    await expectVerificationError(
      applyVerifiedPayment(
        { providerPayment: providerPayment(), userId: "someone_else" },
        db
      ),
      "forbidden"
    )
  })

  it("rejects a card payment for a cash order", async () => {
    const { db } = seed({
      order: { paymentMethod: "cash", status: "Placed" },
    })

    await expectVerificationError(
      applyVerifiedPayment({ providerPayment: providerPayment(), userId }, db),
      "not_card_order"
    )
  })

  it("refunds a paid order and keeps the transition idempotent", async () => {
    const { db, orders, payments } = seed()
    const paid = providerPayment()

    await applyVerifiedPayment({ providerPayment: paid, userId }, db)

    const refunded = await applyVerifiedPayment(
      {
        providerPayment: providerPayment({
          status: "refunded",
          refunded: 2500,
        }),
        userId,
      },
      db
    )

    expect(refunded).toMatchObject({
      status: "refunded",
      orderIsPaid: false,
      orderStatus: "Refunded",
    })
    expect(orders.get(orderId)).toMatchObject({
      isPaid: false,
      status: "Refunded",
    })
    expect(payments.get(paymentId)).toMatchObject({ status: "refunded" })

    await applyVerifiedPayment(
      {
        providerPayment: providerPayment({
          status: "refunded",
          refunded: 2500,
        }),
        userId,
      },
      db
    )

    expect(orders.get(orderId)?.statusHistory).toHaveLength(2)
  })

  it("voids a paid order", async () => {
    const { db, orders } = seed()

    await applyVerifiedPayment(
      { providerPayment: providerPayment(), userId },
      db
    )

    const result = await applyVerifiedPayment(
      { providerPayment: providerPayment({ status: "voided" }), userId },
      db
    )

    expect(result).toMatchObject({
      status: "voided",
      orderIsPaid: false,
      orderStatus: "Voided",
    })
    expect(orders.get(orderId)).toMatchObject({
      isPaid: false,
      status: "Voided",
    })
  })
})
