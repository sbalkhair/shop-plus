import { authorizationMiddleware } from "@/feature/auth/middleware"
import type { Prisma } from "@/generated/prisma/client"
import { prisma } from "@/lib/db"
import { createServerFn } from "@tanstack/react-start"
import { isOrderAssignedToDeliveryPartner } from "../access"
import { parseStatusHistory } from "../history"
import {
  getOrderTrackingSchema,
  startDeliverySchema,
  statusHistorySchema,
  verifyDeliveryOtpSchema,
} from "../schema"
import { canDriverStartDelivery } from "../status"
import type { DriverOrderTracking } from "../types"
import { getDeliveryOtpEnv } from "../verification/env"
import { consumeRateLimit } from "../verification/rate-limit"
import {
  DELIVERY_OTP_RATE_LIMIT,
  issueDeliveryVerification,
  toDeliveryVerificationView,
} from "../verification/service"
import { verifyDeliveryInTransaction } from "../verification/verify"
import { orderInclude, toOrderSummary } from "./orders"

const assignedOrderInclude = {
  ...orderInclude,
  deliveryVerification: true,
} satisfies Prisma.OrderInclude

/**
 * Drivers are linked to their partner row through `DeliveryPartner.userId`,
 * which is unique. An account without a row simply sees no deliveries.
 *
 * `@/lib/db` stays a dynamic import here, unlike the handlers below: this is a
 * plain exported helper rather than a server-function handler, so the Start
 * compiler cannot reliably remove it from client-reachable modules. Keeping
 * the import inside the function prevents Prisma from entering that graph.
 */
export const findDriverPartner = async (userId: string) => {
  const { prisma: db } = await import("@/lib/db")

  return db.deliveryPartner.findUnique({
    where: { userId },
    select: { id: true, isActive: true, name: true },
  })
}

/**
 * Driver-safe view of one assigned order. It never includes the verification
 * code, its hash, or its ciphertext.
 *
 * Returns `null` when the order is not assigned to this driver so the driver
 * cannot probe other orders.
 */
export const getAssignedOrder = createServerFn({ method: "GET" })
  .middleware([
    authorizationMiddleware({ permissions: ["delivery:read-assigned"] }),
  ])
  .validator((data: unknown) => getOrderTrackingSchema.parse(data))
  .handler(async ({ data, context }): Promise<DriverOrderTracking | null> => {
    const partner = await findDriverPartner(context.user.id)

    if (!partner || !partner.isActive) {
      return null
    }

    const order = await prisma.order.findUnique({
      where: { id: data.orderId },
      include: assignedOrderInclude,
    })

    if (
      !order ||
      !isOrderAssignedToDeliveryPartner(order.deliveryPartnerId, partner.id)
    ) {
      return null
    }

    const verification = toDeliveryVerificationView(
      order.deliveryVerification,
      { revealCode: false }
    )

    return {
      order: toOrderSummary(order),
      statusHistory: parseStatusHistory(order.statusHistory, order),
      deliveryVerification: verification,
      canStartDelivery:
        Boolean(partner.isActive) && canDriverStartDelivery(order.status),
      canVerify:
        Boolean(partner.isActive) &&
        order.status === "Out for Delivery" &&
        verification?.status === "awaiting",
    }
  })

/**
 * Assigned-driver-only start of delivery. The order must currently be in a
 * pre-delivery state, must still belong to this driver, and the driver account
 * must be active. Starting delivery also issues the customer's verification
 * code atomically so an order can never be out for delivery without a code.
 */
export const startDelivery = createServerFn({ method: "POST" })
  .middleware([authorizationMiddleware({ permissions: ["delivery:start"] })])
  .validator((data: unknown) => startDeliverySchema.parse(data))
  .handler(
    async ({
      data,
      context,
    }): Promise<{ orderId: string; status: "Out for Delivery" }> => {
      const partner = await findDriverPartner(context.user.id)

      if (!partner) {
        throw new Error(
          "No delivery partner profile is linked to this account."
        )
      }

      if (!partner.isActive) {
        throw new Error("This delivery partner account is inactive.")
      }

      return prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`delivery:${data.orderId}`}))`

        const order = await tx.order.findUnique({
          where: { id: data.orderId },
          select: {
            id: true,
            status: true,
            deliveryPartnerId: true,
            statusHistory: true,
          },
        })

        if (!order) {
          throw new Error("Order not found.")
        }

        if (
          !isOrderAssignedToDeliveryPartner(order.deliveryPartnerId, partner.id)
        ) {
          throw new Error("You are not assigned to this delivery.")
        }

        if (!canDriverStartDelivery(order.status)) {
          throw new Error(
            order.status === "Out for Delivery"
              ? "This order is already out for delivery."
              : `This order cannot start delivery from "${order.status}".`
          )
        }

        const history = statusHistorySchema.safeParse(order.statusHistory)
        const currentHistory = history.success ? history.data : []
        const note = data.note?.trim()

        const updated = await tx.order.updateMany({
          where: {
            id: order.id,
            status: order.status,
            deliveryPartnerId: partner.id,
          },
          data: {
            status: "Out for Delivery",
            statusHistory: [
              ...currentHistory,
              {
                status: "Out for Delivery",
                timestamp: new Date().toISOString(),
                note: note || "Delivery started by the assigned driver",
              },
            ],
          },
        })

        if (updated.count !== 1) {
          throw new Error(
            "This order changed while starting delivery. Refresh and try again."
          )
        }

        await issueDeliveryVerification(tx, order.id)

        return { orderId: order.id, status: "Out for Delivery" as const }
      })
    }
  )

/**
 * Confirms a hand-off with the customer's six-digit code and transitions the
 * order to `Delivered`.
 *
 * Only an active, assigned driver can call this. The transaction core handles
 * concurrency, replay protection, attempts, and the order transition; see
 * `verifyDeliveryInTransaction`.
 */
export const verifyDeliveryOtp = createServerFn({ method: "POST" })
  .middleware([authorizationMiddleware({ permissions: ["delivery:verify"] })])
  .validator((data: unknown) => verifyDeliveryOtpSchema.parse(data))
  .handler(
    async ({
      data,
      context,
    }): Promise<{
      orderId: string
      status: "Delivered"
      verifiedAt: string
    }> => {
      const env = getDeliveryOtpEnv()
      const partner = await findDriverPartner(context.user.id)

      if (!partner) {
        throw new Error(
          "No delivery partner profile is linked to this account."
        )
      }

      if (!partner.isActive) {
        throw new Error("This delivery partner account is inactive.")
      }

      const rateLimit = consumeRateLimit(
        `delivery-verify:${partner.id}:${data.orderId}`,
        DELIVERY_OTP_RATE_LIMIT
      )

      if (!rateLimit.allowed) {
        throw new Error(
          `Too many verification attempts. Try again in ${Math.ceil(
            rateLimit.retryAfterMs / 1_000
          )} seconds.`
        )
      }

      const outcome = await prisma.$transaction((tx) =>
        verifyDeliveryInTransaction(tx, {
          orderId: data.orderId,
          code: data.code,
          driverPartnerId: partner.id,
          maxAttempts: env.DELIVERY_OTP_MAX_ATTEMPTS,
        })
      )

      if (!outcome.ok) {
        throw new Error(outcome.message)
      }

      return {
        orderId: data.orderId,
        status: "Delivered",
        verifiedAt: outcome.verifiedAt.toISOString(),
      }
    }
  )
