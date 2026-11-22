import { authorizationMiddleware } from "@/feature/auth/middleware"
import type { Prisma } from "@/generated/prisma/client"
import { prisma } from "@/lib/db"
import { calculateTotals } from "@/lib/pricing"
import { createServerFn } from "@tanstack/react-start"
import {
  createOrderSchema,
  myOrdersQuerySchema,
  orderItemsSchema,
  shippingAddressSchema,
  type OrderItem,
} from "../schema"
import {
  formatOrderNumber,
  type MyOrdersResult,
  type OrderItemView,
  type OrderSummary,
} from "../types"

/**
 * Card orders are not fulfilled until the payment is verified server-side.
 * Cash orders keep the existing behaviour and are placed immediately.
 */
const CARD_PENDING_STATUS = "Pending Payment"
const CASH_PLACED_STATUS = "Placed"

/**
 * How long an unpaid card order can be reused for an identical cart. This
 * prevents double-clicks and quick retries from creating duplicate orders and
 * decrementing stock twice.
 */
const ORDER_REUSE_WINDOW_MS = 30 * 60 * 1000

export interface CreateOrderResult {
  orderId: string
  subtotal: number
  deliveryFee: number
  tax: number
  total: number
  status: string
}

const sameItems = (stored: unknown, current: OrderItem[]): boolean => {
  const parsed = orderItemsSchema.safeParse(stored)

  if (!parsed.success || parsed.data.length !== current.length) {
    return false
  }

  const storedByProduct = new Map(
    parsed.data.map((item) => [item.product, item])
  )

  return current.every((item) => {
    const match = storedByProduct.get(item.product)

    return (
      match !== undefined &&
      match.quantity === item.quantity &&
      Math.abs(match.price - item.price) < 0.005
    )
  })
}

export const createOrder = createServerFn({ method: "POST" })
  .middleware([authorizationMiddleware({ permissions: ["orders:create"] })])
  .validator((data: unknown) => createOrderSchema.parse(data))
  .handler(async ({ data, context }): Promise<CreateOrderResult> => {
    // Merge duplicate cart lines so stock checks and totals stay accurate.
    const quantities = new Map<string, number>()

    for (const item of data.items) {
      quantities.set(
        item.productId,
        (quantities.get(item.productId) ?? 0) + item.quantity
      )
    }

    const products = await prisma.product.findMany({
      where: { id: { in: [...quantities.keys()] } },
    })

    if (products.length !== quantities.size) {
      throw new Error(
        "Some items in your cart are no longer available. Please review your cart."
      )
    }

    const stockByProduct = new Map(
      products.map((product) => [product.id, product.stock ?? 0])
    )

    const orderItems: OrderItem[] = products.map((product) => ({
      product: product.id,
      name: product.name,
      image: product.image,
      price: product.price,
      quantity: quantities.get(product.id) ?? 0,
      unit: product.unit ?? "",
    }))

    const { subtotal, tax, deliveryFee, total } = calculateTotals(
      orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
    )
    const isCard = data.paymentMethod === "card"
    const status = isCard ? CARD_PENDING_STATUS : CASH_PLACED_STATUS

    return prisma.$transaction(async (tx) => {
      // Serializes checkout submissions per user so two concurrent requests
      // cannot both create an order for the same cart.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`checkout:${context.user.id}`}))`

      if (isCard) {
        const candidates = await tx.order.findMany({
          where: {
            userId: context.user.id,
            paymentMethod: "card",
            isPaid: false,
            status: CARD_PENDING_STATUS,
            createdAt: {
              gte: new Date(Date.now() - ORDER_REUSE_WINDOW_MS),
            },
          },
          orderBy: { createdAt: "desc" },
          take: 10,
        })

        const reusable = candidates.find(
          (order) =>
            Math.abs(order.total - total) < 0.005 &&
            sameItems(order.items, orderItems)
        )

        if (reusable) {
          // Keep the latest delivery details without creating a new order or
          // decrementing stock a second time.
          await tx.order.update({
            where: { id: reusable.id },
            data: { shippingAddress: data.shippingAddress },
          })

          return {
            orderId: reusable.id,
            subtotal: reusable.subtotal,
            deliveryFee: reusable.deliveryFee ?? 0,
            tax: reusable.tax ?? 0,
            total: reusable.total,
            status: reusable.status,
          }
        }
      }

      for (const item of orderItems) {
        const stock = stockByProduct.get(item.product) ?? 0

        if (item.quantity > stock) {
          throw new Error(
            stock === 0
              ? `${item.name} is out of stock.`
              : `Only ${stock} × ${item.name} left in stock.`
          )
        }

        const updated = await tx.product.updateMany({
          where: {
            id: item.product,
            stock: { gte: item.quantity },
          },
          data: {
            stock: { decrement: item.quantity },
          },
        })

        if (updated.count === 0) {
          throw new Error(
            `${item.name} is out of stock. Please update your cart.`
          )
        }
      }

      const order = await tx.order.create({
        data: {
          userId: context.user.id,
          items: orderItems,
          shippingAddress: data.shippingAddress,
          paymentMethod: data.paymentMethod,
          subtotal,
          deliveryFee,
          tax,
          total,
          status,
          statusHistory: [
            {
              status,
              timestamp: new Date().toISOString(),
              note: isCard
                ? "Order created, awaiting payment"
                : "Order placed successfully",
            },
          ],
        },
      })

      return {
        orderId: order.id,
        subtotal: order.subtotal,
        deliveryFee: order.deliveryFee ?? 0,
        tax: order.tax ?? 0,
        total: order.total,
        status: order.status,
      }
    })
  })

export const orderInclude = {
  user: {
    select: { id: true, name: true, email: true, phone: true },
  },
} satisfies Prisma.OrderInclude

type OrderWithUser = Prisma.OrderGetPayload<{ include: typeof orderInclude }>

/**
 * JSON columns are validated before they reach the UI. A malformed historical
 * row degrades to an empty item list instead of breaking the whole page.
 */
export const toOrderSummary = (order: OrderWithUser): OrderSummary => {
  const parsedItems = orderItemsSchema.safeParse(order.items)
  const items: OrderItemView[] = parsedItems.success
    ? parsedItems.data.map((item) => ({
        product: item.product,
        name: item.name,
        image: item.image,
        price: item.price,
        quantity: item.quantity,
        unit: item.unit,
      }))
    : []

  const parsedAddress = shippingAddressSchema.safeParse(order.shippingAddress)

  return {
    id: order.id,
    orderNumber: formatOrderNumber(order.id),
    items,
    itemCount: items.reduce((count, item) => count + item.quantity, 0),
    customer: {
      id: order.user.id,
      name: order.user.name,
      email: order.user.email,
      phone: order.user.phone,
    },
    shippingAddress: parsedAddress.success ? parsedAddress.data : null,
    paymentMethod: order.paymentMethod,
    subtotal: order.subtotal,
    deliveryFee: order.deliveryFee ?? 0,
    tax: order.tax ?? 0,
    total: order.total,
    status: order.status,
    isPaid: Boolean(order.isPaid),
    createdAt: order.createdAt.toISOString(),
  }
}

/**
 * Orders belonging to the signed-in customer, newest first.
 *
 * Paging and status filtering are resolved in the database. Tab counts cover
 * every order so they stay accurate independently of the current page.
 */
export const getMyOrders = createServerFn({ method: "GET" })
  .middleware([authorizationMiddleware({ permissions: ["orders:read"] })])
  .validator((data: unknown) => myOrdersQuerySchema.parse(data))
  .handler(async ({ data, context }): Promise<MyOrdersResult> => {
    const baseWhere: Prisma.OrderWhereInput = { userId: context.user.id }

    const statusGroups = await prisma.order.groupBy({
      by: ["status"],
      where: baseWhere,
      _count: { _all: true },
    })

    const statusCounts = Object.fromEntries(
      statusGroups.map((group) => [group.status, group._count._all])
    )
    const total = statusGroups.reduce(
      (sum, group) => sum + group._count._all,
      0
    )
    const filteredTotal = data.status ? (statusCounts[data.status] ?? 0) : total

    const totalPages = Math.max(1, Math.ceil(filteredTotal / data.pageSize))
    const page = Math.min(data.page, totalPages)

    const orders = await prisma.order.findMany({
      where: {
        ...baseWhere,
        ...(data.status ? { status: data.status } : {}),
      },
      include: orderInclude,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * data.pageSize,
      take: data.pageSize,
    })

    return {
      orders: orders.map(toOrderSummary),
      total,
      page,
      pageSize: data.pageSize,
      totalPages,
      statusCounts,
    }
  })
