import type { Order, Payment, PrismaClient } from "@/generated/prisma/client"

/**
 * Minimal in-memory Prisma stand-in for payment tests.
 *
 * It only implements the methods used by the payment service and apply logic.
 * Transactions are serialized through a promise queue, which mirrors the
 * effect of the serializable transaction used in production: concurrent
 * callbacks cannot both observe an unpaid order.
 */

const cloneMap = <T>(source: Map<string, T>): Map<string, T> =>
  new Map(
    [...source.entries()].map(([key, value]) => [key, structuredClone(value)])
  )

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null

const notFilter = (value: unknown): { not?: unknown } | null =>
  isRecord(value) && "not" in value ? value : null

const matchesPaymentWhere = (
  payment: Payment,
  where: Record<string, unknown>
): boolean => {
  if (typeof where.id === "string" && payment.id !== where.id) {
    return false
  }

  const idFilter = notFilter(where.id)

  if (
    idFilter &&
    typeof idFilter.not === "string" &&
    payment.id === idFilter.not
  ) {
    return false
  }

  if (
    typeof where.activeOrderId === "string" &&
    payment.activeOrderId !== where.activeOrderId
  ) {
    return false
  }

  if (typeof where.orderId === "string" && payment.orderId !== where.orderId) {
    return false
  }

  if (typeof where.status === "string" && payment.status !== where.status) {
    return false
  }

  const paymentIdFilter = notFilter(where.moyasarPaymentId)

  if (paymentIdFilter && paymentIdFilter.not === null) {
    return payment.moyasarPaymentId !== null
  }

  if (Array.isArray(where.OR)) {
    return where.OR.some(
      (condition) =>
        isRecord(condition) && matchesPaymentWhere(payment, condition)
    )
  }

  return true
}

export const buildOrder = (overrides: Partial<Order> = {}): Order => {
  const now = new Date()
  const defaults: Order = {
    id: globalThis.crypto.randomUUID(),
    userId: "user_1",
    items: [],
    shippingAddress: {},
    paymentMethod: "card",
    subtotal: 0,
    deliveryFee: 0,
    tax: 0,
    total: 0,
    status: "Pending Payment",
    statusHistory: [],
    deliveryPartnerId: null,
    liveLocation: null,
    isPaid: false,
    paidAt: null,
    createdAt: now,
    updatedAt: now,
  }

  return { ...defaults, ...overrides }
}

export const buildPayment = (overrides: Partial<Payment> = {}): Payment => {
  const now = new Date()
  const defaults: Payment = {
    id: globalThis.crypto.randomUUID(),
    orderId: "",
    activeOrderId: null,
    provider: "moyasar",
    moyasarIntentId: null,
    moyasarPaymentId: null,
    amount: 0,
    currency: "SAR",
    status: "intent_created",
    providerStatus: null,
    method: null,
    network: null,
    lastFour: null,
    failureCode: null,
    failureMessage: null,
    metadata: null,
    intentExpiresAt: null,
    paidAt: null,
    refundedAt: null,
    voidedAt: null,
    createdAt: now,
    updatedAt: now,
  }

  return { ...defaults, ...overrides }
}

interface FakeDbSeed {
  orders?: Order[]
  payments?: Payment[]
}

export interface FakeDb {
  db: PrismaClient
  orders: Map<string, Order>
  payments: Map<string, Payment>
}

export const createFakeDb = (seed: FakeDbSeed = {}): FakeDb => {
  const orders = new Map(
    (seed.orders ?? []).map((order) => [order.id, structuredClone(order)])
  )
  const payments = new Map(
    (seed.payments ?? []).map((payment) => [
      payment.id,
      structuredClone(payment),
    ])
  )

  const findPayment = (where: Record<string, unknown>): Payment | null => {
    if (typeof where.id === "string") {
      return payments.get(where.id) ?? null
    }

    if (typeof where.activeOrderId === "string") {
      return (
        [...payments.values()].find(
          (payment) => payment.activeOrderId === where.activeOrderId
        ) ?? null
      )
    }

    return null
  }

  const updateOrder = (
    where: { id: string },
    data: Record<string, unknown>
  ): Order => {
    const order = orders.get(where.id)

    if (!order) {
      throw new Error("Order not found.")
    }

    const updated = {
      ...order,
      ...data,
      updatedAt: new Date(),
    }

    orders.set(updated.id, updated)
    return updated
  }

  const updatePayment = (
    where: { id: string },
    data: Record<string, unknown>
  ): Payment => {
    const payment = payments.get(where.id)

    if (!payment) {
      throw new Error("Payment not found.")
    }

    const updated = {
      ...payment,
      ...data,
      updatedAt: new Date(),
    }

    payments.set(updated.id, updated)
    return updated
  }

  let transactionQueue: Promise<void> = Promise.resolve()

  const client = {
    order: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        orders.get(where.id) ?? null,
      update: async ({
        where,
        data,
      }: {
        where: { id: string }
        data: Record<string, unknown>
      }) => updateOrder(where, data),
    },
    payment: {
      findUnique: async ({ where }: { where: Record<string, unknown> }) =>
        findPayment(where),
      findFirst: async ({
        where,
      }: {
        where: Record<string, unknown>
        orderBy?: unknown
        select?: unknown
      }) => {
        const matches = [...payments.values()].filter((payment) =>
          matchesPaymentWhere(payment, where)
        )

        return matches[0] ?? null
      },
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const now = new Date()
        const payment: Payment = {
          id: String(data.id),
          orderId: String(data.orderId),
          activeOrderId: (data.activeOrderId as string | null) ?? null,
          provider: "moyasar",
          moyasarIntentId: null,
          moyasarPaymentId: null,
          amount: Number(data.amount),
          currency: String(data.currency ?? "SAR"),
          status: String(data.status ?? "creating"),
          providerStatus: null,
          method: null,
          network: null,
          lastFour: null,
          failureCode: null,
          failureMessage: null,
          metadata: null,
          intentExpiresAt: null,
          paidAt: null,
          refundedAt: null,
          voidedAt: null,
          createdAt: now,
          updatedAt: now,
        }

        payments.set(payment.id, payment)
        return payment
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: string }
        data: Record<string, unknown>
      }) => updatePayment(where, data),
    },
    $executeRaw: async () => 1,
    $transaction: async <T>(fn: (tx: unknown) => Promise<T>): Promise<T> => {
      let release: () => void = () => undefined
      const previous = transactionQueue

      transactionQueue = new Promise<void>((resolve) => {
        release = resolve
      })

      await previous

      const snapshotOrders = cloneMap(orders)
      const snapshotPayments = cloneMap(payments)

      try {
        return await fn(client)
      } catch (error) {
        orders.clear()
        payments.clear()

        for (const [key, value] of snapshotOrders) {
          orders.set(key, value)
        }

        for (const [key, value] of snapshotPayments) {
          payments.set(key, value)
        }

        throw error
      } finally {
        release()
      }
    },
  }

  return { db: client as unknown as PrismaClient, orders, payments }
}
