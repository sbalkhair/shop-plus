import type { Prisma } from "@/generated/prisma/client"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { encryptDeliveryOtp, hashDeliveryOtp } from "./crypto"
import { resetDeliveryOtpEnvForTests } from "./env"
import { verifyDeliveryInTransaction } from "./verify"

const SECRET = "a".repeat(64)
const NOW = new Date("2026-11-09T12:00:00.000Z")
const CORRECT_CODE = "004271"
const ORDER_ID = "order-1"
const PARTNER_ID = "partner-1"

interface FakeVerification {
  codeHash: string
  codeEncrypted: string
  expiresAt: Date
  verifiedAt: Date | null
  attempts: number
  lastAttemptAt: Date | null
  verifiedByDeliveryPartnerId: string | null
}

interface FakeOrder {
  id: string
  status: string
  deliveryPartnerId: string | null
  paymentMethod: string
  isPaid: boolean
  paidAt: Date | null
  statusHistory: unknown[]
}

interface FakeHooks {
  beforeClaim?: () => void
  beforeOrderUpdate?: () => void
}

const createFakeTransaction = ({
  order = {
    id: ORDER_ID,
    status: "Out for Delivery",
    deliveryPartnerId: PARTNER_ID,
    paymentMethod: "card",
    isPaid: true,
    paidAt: null,
    statusHistory: [
      {
        status: "Out for Delivery",
        timestamp: new Date(NOW.getTime() - 60_000).toISOString(),
        note: "On the way",
      },
    ],
  },
  verification = {
    codeHash: hashDeliveryOtp(CORRECT_CODE),
    codeEncrypted: encryptDeliveryOtp(CORRECT_CODE),
    expiresAt: new Date(NOW.getTime() + 60_000),
    verifiedAt: null,
    attempts: 0,
    lastAttemptAt: null,
    verifiedByDeliveryPartnerId: null,
  },
  hooks = {},
}: {
  order?: FakeOrder | null
  verification?: FakeVerification | null
  hooks?: FakeHooks
} = {}) => {
  const state = { order, verification }
  const lockQueries: unknown[][] = []

  const tx = {
    $executeRaw: (strings: TemplateStringsArray, ...values: unknown[]) => {
      lockQueries.push([strings.join("?"), ...values])
      return Promise.resolve(0)
    },
    order: {
      findUnique: () =>
        Promise.resolve(
          state.order
            ? {
                ...state.order,
                deliveryVerification: state.verification,
              }
            : null
        ),
      updateMany: ({
        where,
        data,
      }: {
        where: { id: string; status: string }
        data: Partial<FakeOrder>
      }) => {
        hooks.beforeOrderUpdate?.()

        if (!state.order || state.order.status !== where.status) {
          return Promise.resolve({ count: 0 })
        }

        Object.assign(state.order, data)

        return Promise.resolve({ count: 1 })
      },
    },
    deliveryVerification: {
      update: ({
        data,
      }: {
        data: {
          attempts?: { increment: number }
          lastAttemptAt?: Date
        }
      }) => {
        const current = state.verification

        if (!current) {
          throw new Error("Fake verification row is missing.")
        }

        current.attempts += data.attempts?.increment ?? 0
        current.lastAttemptAt = data.lastAttemptAt ?? null

        return Promise.resolve({ attempts: current.attempts })
      },
      updateMany: ({
        where,
        data,
      }: {
        where: {
          verifiedAt: null
          expiresAt: { gt: Date }
          attempts: { lt: number }
        }
        data: Partial<FakeVerification>
      }) => {
        if (data.verifiedAt) {
          hooks.beforeClaim?.()
        }

        const current = state.verification

        if (!current) {
          return Promise.resolve({ count: 0 })
        }

        if (current.verifiedAt !== null) {
          return Promise.resolve({ count: 0 })
        }

        if (current.expiresAt.getTime() <= where.expiresAt.gt.getTime()) {
          return Promise.resolve({ count: 0 })
        }

        if (current.attempts >= where.attempts.lt) {
          return Promise.resolve({ count: 0 })
        }

        Object.assign(current, data)

        return Promise.resolve({ count: 1 })
      },
    },
  }

  return {
    state,
    lockQueries,
    tx: tx as unknown as Prisma.TransactionClient,
  }
}

const run = (
  tx: Prisma.TransactionClient,
  { code = CORRECT_CODE, orderId = ORDER_ID, driverPartnerId = PARTNER_ID } = {}
) =>
  verifyDeliveryInTransaction(tx, {
    orderId,
    code,
    driverPartnerId,
    now: NOW,
    maxAttempts: 5,
  })

beforeEach(() => {
  process.env.DELIVERY_OTP_SECRET = SECRET
  process.env.DELIVERY_OTP_MAX_ATTEMPTS = "5"
  resetDeliveryOtpEnvForTests()
})

afterEach(() => {
  delete process.env.DELIVERY_OTP_SECRET
  delete process.env.DELIVERY_OTP_MAX_ATTEMPTS
  resetDeliveryOtpEnvForTests()
})

describe("verifyDeliveryInTransaction", () => {
  it("marks the order delivered with the correct code", async () => {
    const { tx, state, lockQueries } = createFakeTransaction()

    const result = await run(tx)

    expect(result).toEqual({ ok: true, verifiedAt: NOW })
    expect(state.order?.status).toBe("Delivered")
    expect(state.verification?.verifiedAt).toEqual(NOW)
    expect(state.verification?.verifiedByDeliveryPartnerId).toBe(PARTNER_ID)
    expect(state.verification?.attempts).toBe(0)
    expect(lockQueries).toHaveLength(1)
    expect(lockQueries[0]).toContain(`delivery:${ORDER_ID}`)
  })

  it("appends a delivery event to the status history", async () => {
    const { tx, state } = createFakeTransaction()

    await run(tx)

    expect(state.order?.statusHistory).toHaveLength(2)
    expect(state.order?.statusHistory[1]).toMatchObject({
      status: "Delivered",
      timestamp: NOW.toISOString(),
    })
  })

  it("records cash collection for an unpaid cash order", async () => {
    const { tx, state } = createFakeTransaction({
      order: {
        id: ORDER_ID,
        status: "Out for Delivery",
        deliveryPartnerId: PARTNER_ID,
        paymentMethod: "cash",
        isPaid: false,
        paidAt: null,
        statusHistory: [],
      },
    })

    await run(tx)

    expect(state.order?.isPaid).toBe(true)
    expect(state.order?.paidAt).toEqual(NOW)
    expect(state.order?.statusHistory[0]).toMatchObject({
      status: "Delivered",
      note: "Delivered and cash collected",
    })
  })

  it("leaves an already-paid card order alone", async () => {
    const { tx, state } = createFakeTransaction()

    await run(tx)

    expect(state.order?.isPaid).toBe(true)
    expect(state.order?.paidAt).toBeNull()
  })

  it("rejects a wrong code and persists the failed attempt", async () => {
    const { tx, state } = createFakeTransaction()

    const result = await run(tx, { code: "999999" })

    expect(result).toEqual({
      ok: false,
      message: "Incorrect delivery verification code. 4 attempts remaining.",
    })
    expect(state.verification?.attempts).toBe(1)
    expect(state.verification?.lastAttemptAt).toEqual(NOW)
    expect(state.order?.status).toBe("Out for Delivery")
    expect(state.verification?.verifiedAt).toBeNull()
  })

  it("uses singular wording for the last remaining attempt", async () => {
    const { tx } = createFakeTransaction({
      verification: {
        codeHash: hashDeliveryOtp(CORRECT_CODE),
        codeEncrypted: encryptDeliveryOtp(CORRECT_CODE),
        expiresAt: new Date(NOW.getTime() + 60_000),
        verifiedAt: null,
        attempts: 3,
        lastAttemptAt: null,
        verifiedByDeliveryPartnerId: null,
      },
    })

    const result = await run(tx, { code: "999999" })

    expect(result).toMatchObject({
      ok: false,
      message: "Incorrect delivery verification code. 1 attempt remaining.",
    })
  })

  it("locks the code after the maximum number of wrong attempts", async () => {
    const { tx, state } = createFakeTransaction({
      verification: {
        codeHash: hashDeliveryOtp(CORRECT_CODE),
        codeEncrypted: encryptDeliveryOtp(CORRECT_CODE),
        expiresAt: new Date(NOW.getTime() + 60_000),
        verifiedAt: null,
        attempts: 4,
        lastAttemptAt: null,
        verifiedByDeliveryPartnerId: null,
      },
    })

    const result = await run(tx, { code: "999999" })

    expect(result).toMatchObject({
      ok: false,
      message:
        "Too many incorrect attempts. Ask the store to issue a new code.",
    })
    expect(state.verification?.attempts).toBe(5)

    const next = await run(tx, { code: CORRECT_CODE })

    expect(next).toMatchObject({
      ok: false,
      message:
        "Too many incorrect attempts. Ask the store to issue a new code.",
    })
    expect(state.order?.status).toBe("Out for Delivery")
  })

  it("rejects an expired code without incrementing attempts", async () => {
    const { tx, state } = createFakeTransaction({
      verification: {
        codeHash: hashDeliveryOtp(CORRECT_CODE),
        codeEncrypted: encryptDeliveryOtp(CORRECT_CODE),
        expiresAt: new Date(NOW.getTime() - 1),
        verifiedAt: null,
        attempts: 0,
        lastAttemptAt: null,
        verifiedByDeliveryPartnerId: null,
      },
    })

    const result = await run(tx)

    expect(result).toMatchObject({
      ok: false,
      message:
        "This delivery verification code has expired. Ask the store to issue a new one.",
    })
    expect(state.verification?.attempts).toBe(0)
    expect(state.order?.status).toBe("Out for Delivery")
  })

  it("rejects reuse of an already verified code", async () => {
    const { tx, state } = createFakeTransaction({
      verification: {
        codeHash: hashDeliveryOtp(CORRECT_CODE),
        codeEncrypted: encryptDeliveryOtp(CORRECT_CODE),
        expiresAt: new Date(NOW.getTime() + 60_000),
        verifiedAt: new Date(NOW.getTime() - 1_000),
        attempts: 0,
        lastAttemptAt: null,
        verifiedByDeliveryPartnerId: PARTNER_ID,
      },
    })

    const result = await run(tx)

    expect(result).toMatchObject({
      ok: false,
      message: "This delivery has already been confirmed.",
    })
    expect(state.order?.status).toBe("Out for Delivery")
  })

  it("rejects a second confirmation once the order is delivered", async () => {
    const { tx } = createFakeTransaction({
      order: {
        id: ORDER_ID,
        status: "Delivered",
        deliveryPartnerId: PARTNER_ID,
        paymentMethod: "card",
        isPaid: true,
        paidAt: null,
        statusHistory: [],
      },
    })

    const result = await run(tx)

    expect(result).toMatchObject({
      ok: false,
      message: "This order has already been delivered.",
    })
  })

  it("rejects a driver who is not assigned to the order", async () => {
    const { tx, state } = createFakeTransaction()

    const result = await run(tx, { driverPartnerId: "someone-else" })

    expect(result).toMatchObject({
      ok: false,
      message: "You are not assigned to this delivery.",
    })
    expect(state.order?.status).toBe("Out for Delivery")
    expect(state.verification?.attempts).toBe(0)
  })

  it("rejects orders that are not out for delivery", async () => {
    const { tx } = createFakeTransaction({
      order: {
        id: ORDER_ID,
        status: "Processing",
        deliveryPartnerId: PARTNER_ID,
        paymentMethod: "card",
        isPaid: true,
        paidAt: null,
        statusHistory: [],
      },
    })

    const result = await run(tx)

    expect(result).toMatchObject({
      ok: false,
      message: "This order is not out for delivery.",
    })
  })

  it("rejects a canceled order even with the correct code", async () => {
    const { tx, state } = createFakeTransaction({
      order: {
        id: ORDER_ID,
        status: "Canceled",
        deliveryPartnerId: PARTNER_ID,
        paymentMethod: "card",
        isPaid: false,
        paidAt: null,
        statusHistory: [],
      },
    })

    const result = await run(tx)

    expect(result).toMatchObject({
      ok: false,
      message: "This order is not out for delivery.",
    })
    expect(state.order?.status).toBe("Canceled")
    expect(state.verification?.verifiedAt).toBeNull()
  })

  it("rejects an order that does not exist", async () => {
    const { tx } = createFakeTransaction({ order: null })

    const result = await run(tx)

    expect(result).toMatchObject({ ok: false, message: "Order not found." })
  })

  it("rejects when no verification code has been issued", async () => {
    const { tx } = createFakeTransaction({ verification: null })

    const result = await run(tx)

    expect(result).toMatchObject({
      ok: false,
      message:
        "No delivery verification code is available for this order. Ask the store to issue a new one.",
    })
  })

  it("fails safely when the code is claimed concurrently", async () => {
    const { tx, state } = createFakeTransaction({
      hooks: {
        beforeClaim: () => {
          // Another transaction verified the code between the read and claim.
          if (state.verification) {
            state.verification.verifiedAt = new Date(NOW.getTime() - 500)
          }
        },
      },
    })

    const result = await run(tx)

    expect(result).toMatchObject({
      ok: false,
      message:
        "This delivery verification code can no longer be used. Ask the store to issue a new one.",
    })
    expect(state.order?.status).toBe("Out for Delivery")
  })

  it("throws so the claim rolls back if the order changed mid-transaction", async () => {
    const { tx, state } = createFakeTransaction({
      hooks: {
        beforeOrderUpdate: () => {
          // Simulate an admin moving the order out of the delivery stage.
          if (state.order) {
            state.order.status = "Canceled"
          }
        },
      },
    })

    await expect(run(tx)).rejects.toThrow(
      "This order changed while verifying the delivery. Refresh and try again."
    )
  })
})
