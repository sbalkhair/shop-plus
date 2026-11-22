import { authorizationMiddleware } from "@/feature/auth/middleware"
import { mapDeliveryPartner } from "@/feature/delivery-partners/map"
import type { Prisma } from "@/generated/prisma/client"
import { prisma } from "@/lib/db"
import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { resolveTrackingAccess } from "../access"
import { parseStatusHistory } from "../history"
import {
  assignDeliveryPartnerSchema,
  cancelOrderSchema,
  getOrderTrackingSchema,
  regenerateDeliveryOtpSchema,
  statusHistorySchema,
} from "../schema"
import { canAdminCancelOrder, isTerminalOrderStatus } from "../status"
import type { OrderLiveLocation, OrderTracking } from "../types"
import {
  invalidateDeliveryVerification,
  issueDeliveryVerification,
  toDeliveryVerificationView,
} from "../verification/service"
import { orderInclude, toOrderSummary } from "./orders"

const trackingInclude = {
  ...orderInclude,
  deliveryPartner: true,
  deliveryVerification: true,
} satisfies Prisma.OrderInclude

type TrackingOrder = Prisma.OrderGetPayload<{ include: typeof trackingInclude }>

const liveLocationSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  updatedAt: z.string().optional(),
})

const parseLiveLocation = (value: unknown): OrderLiveLocation | null => {
  const parsed = liveLocationSchema.safeParse(value)

  return parsed.success ? parsed.data : null
}

const toOrderTracking = (
  order: TrackingOrder,
  { revealCode }: { revealCode: boolean }
): OrderTracking => ({
  order: toOrderSummary(order),
  statusHistory: parseStatusHistory(order.statusHistory, order),
  deliveryPartner: order.deliveryPartner
    ? mapDeliveryPartner(order.deliveryPartner)
    : null,
  deliveryVerification: toDeliveryVerificationView(order.deliveryVerification, {
    revealCode,
  }),
  liveLocation: parseLiveLocation(order.liveLocation),
})

/**
 * Returns `null` instead of leaking whether an order exists when the caller is
 * not its owner (admins can read every order).
 *
 * The verification code itself is only revealed to the order owner, never to
 * admins viewing someone else's order.
 */
export const getOrderTracking = createServerFn({ method: "GET" })
  .middleware([authorizationMiddleware({ permissions: ["orders:read"] })])
  .validator((data: unknown) => getOrderTrackingSchema.parse(data))
  .handler(async ({ data, context }): Promise<OrderTracking | null> => {
    const order = await prisma.order.findUnique({
      where: { id: data.orderId },
      include: trackingInclude,
    })

    if (!order) {
      return null
    }

    const access = resolveTrackingAccess(order.userId, context.user)

    if (!access.allowed) {
      return null
    }

    return toOrderTracking(order, { revealCode: access.revealCode })
  })

const deliveryLockKey = (orderId: string) => `delivery:${orderId}`

/**
 * Admin-only assignment. This is deliberately separate from any status change:
 * admins decide who delivers an order, while the assigned driver decides when
 * delivery starts and, with the customer's code, when it completes.
 */
export const assignDeliveryPartner = createServerFn({ method: "POST" })
  .middleware([authorizationMiddleware({ permissions: ["orders:update"] })])
  .validator((data: unknown) => assignDeliveryPartnerSchema.parse(data))
  .handler(
    async ({
      data,
    }): Promise<{ orderId: string; deliveryPartnerId: string | null }> => {
      return prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${deliveryLockKey(data.orderId)}))`

        const order = await tx.order.findUnique({
          where: { id: data.orderId },
          select: { id: true, status: true, deliveryPartnerId: true },
        })

        if (!order) {
          throw new Error("Order not found.")
        }

        if (isTerminalOrderStatus(order.status)) {
          throw new Error(
            `The delivery person cannot be changed for an order that is already "${order.status}".`
          )
        }

        if (order.status === "Out for Delivery" && !data.deliveryPartnerId) {
          throw new Error(
            "An out-for-delivery order must keep an assigned delivery person."
          )
        }

        if (data.deliveryPartnerId) {
          const partner = await tx.deliveryPartner.findUnique({
            where: { id: data.deliveryPartnerId },
            select: { isActive: true },
          })

          if (!partner) {
            throw new Error("Delivery partner not found.")
          }

          if (!partner.isActive) {
            throw new Error("This delivery partner is inactive.")
          }
        }

        if (order.deliveryPartnerId === data.deliveryPartnerId) {
          return {
            orderId: order.id,
            deliveryPartnerId: order.deliveryPartnerId,
          }
        }

        await tx.order.update({
          where: { id: order.id },
          data: { deliveryPartnerId: data.deliveryPartnerId },
        })

        return {
          orderId: order.id,
          deliveryPartnerId: data.deliveryPartnerId,
        }
      })
    }
  )

/**
 * Admin-only cancellation. The permission matrix allows admins to move an
 * order to `Canceled`, and nothing else.
 */
export const cancelOrder = createServerFn({ method: "POST" })
  .middleware([authorizationMiddleware({ permissions: ["orders:update"] })])
  .validator((data: unknown) => cancelOrderSchema.parse(data))
  .handler(
    async ({ data }): Promise<{ orderId: string; status: "Canceled" }> => {
      return prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${deliveryLockKey(data.orderId)}))`

        const order = await tx.order.findUnique({
          where: { id: data.orderId },
          select: { id: true, status: true, statusHistory: true },
        })

        if (!order) {
          throw new Error("Order not found.")
        }

        if (!canAdminCancelOrder(order.status)) {
          throw new Error(
            `An order that is "${order.status}" can no longer be canceled.`
          )
        }

        const history = statusHistorySchema.safeParse(order.statusHistory)
        const currentHistory = history.success ? history.data : []
        const note = data.note?.trim()

        const updated = await tx.order.updateMany({
          where: { id: order.id, status: order.status },
          data: {
            status: "Canceled",
            statusHistory: [
              ...currentHistory,
              {
                status: "Canceled",
                timestamp: new Date().toISOString(),
                note: note || "Order canceled by admin",
              },
            ],
          },
        })

        if (updated.count !== 1) {
          throw new Error(
            "This order changed while it was being canceled. Refresh and try again."
          )
        }

        if (order.status === "Out for Delivery") {
          // A canceled order must not keep a usable delivery code.
          await invalidateDeliveryVerification(tx, order.id)
        }

        return { orderId: order.id, status: "Canceled" as const }
      })
    }
  )

/**
 * Issues a new code for an out-for-delivery order. Used when the customer's
 * code expired or was locked after too many attempts. The code is never
 * returned by this endpoint.
 */
export const regenerateDeliveryOtp = createServerFn({ method: "POST" })
  .middleware([authorizationMiddleware({ permissions: ["orders:update"] })])
  .validator((data: unknown) => regenerateDeliveryOtpSchema.parse(data))
  .handler(
    async ({ data }): Promise<{ orderId: string; expiresAt: string }> => {
      return prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${deliveryLockKey(data.orderId)}))`

        const order = await tx.order.findUnique({
          where: { id: data.orderId },
          select: { id: true, status: true },
        })

        if (!order) {
          throw new Error("Order not found.")
        }

        if (order.status !== "Out for Delivery") {
          throw new Error(
            "A delivery verification code can only be generated while the order is out for delivery."
          )
        }

        const verification = await issueDeliveryVerification(tx, order.id)

        return {
          orderId: order.id,
          expiresAt: verification.expiresAt.toISOString(),
        }
      })
    }
  )
