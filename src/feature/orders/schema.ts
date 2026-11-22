import { addressCoreSchema } from "@/feature/addresses/schema"
import { MAX_PAGE } from "@/lib/parse-number"
import { z } from "zod"

export const paymentMethodSchema = z.enum(["card", "cash"])

export type PaymentMethod = z.infer<typeof paymentMethodSchema>

export const shippingAddressSchema = addressCoreSchema

export type ShippingAddress = z.infer<typeof shippingAddressSchema>

export const checkoutSchema = shippingAddressSchema.extend({
  paymentMethod: paymentMethodSchema,
})

export type CheckoutFormValues = z.infer<typeof checkoutSchema>

export const createOrderSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().positive().max(99),
      })
    )
    .min(1, "Your cart is empty"),
  shippingAddress: shippingAddressSchema,
  paymentMethod: paymentMethodSchema,
})

export type CreateOrderInput = z.infer<typeof createOrderSchema>

/**
 * Shape of an order line stored in `Order.items` (JSON). Orders own this
 * contract because both checkout and payments validate stored lines with it.
 */
export const orderItemSchema = z.object({
  product: z.string(),
  name: z.string(),
  image: z.string(),
  price: z.number(),
  quantity: z.number().int().positive(),
  unit: z.string().optional().default(""),
})

export type OrderItem = z.infer<typeof orderItemSchema>

export const orderItemsSchema = z.array(orderItemSchema)

export const orderIdSchema = z.uuid("Invalid order id")

export const statusHistoryEntrySchema = z.object({
  status: z.string(),
  timestamp: z.string(),
  note: z.string(),
})

export const statusHistorySchema = z.array(statusHistoryEntrySchema)

export const getOrderTrackingSchema = z.object({ orderId: orderIdSchema })

export const deliveryOtpCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "Enter the 6-digit delivery verification code")

export const verifyDeliveryOtpSchema = z.object({
  orderId: orderIdSchema,
  code: deliveryOtpCodeSchema,
})

export const regenerateDeliveryOtpSchema = z.object({
  orderId: orderIdSchema,
})

export const assignDeliveryPartnerSchema = z.object({
  orderId: orderIdSchema,
  deliveryPartnerId: z.uuid("Invalid delivery partner id").nullable(),
})

export type AssignDeliveryPartnerInput = z.infer<
  typeof assignDeliveryPartnerSchema
>

export const cancelOrderSchema = z.object({
  orderId: orderIdSchema,
  note: z.string().trim().max(300, "Note is too long").optional(),
})

export const startDeliverySchema = z.object({
  orderId: orderIdSchema,
  note: z.string().trim().max(300, "Note is too long").optional(),
})

/**
 * Shared list-query contract for the admin and delivery order dashboards.
 * Pagination and search are always resolved on the server.
 */
export const orderListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(MAX_PAGE).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(50).optional().default(20),
  search: z.string().trim().max(100).optional().default(""),
  sort: z.enum(["priority", "oldest", "newest"]).optional().default("priority"),
})

export const MAX_ORDER_STATUS_LENGTH = 40

/** Customer order history query. Status filtering and paging are server-side. */
export const myOrdersQuerySchema = z.object({
  page: z.number().int().min(1).max(MAX_PAGE).default(1),
  pageSize: z.number().int().min(1).max(50).default(20),
  status: z.string().trim().max(MAX_ORDER_STATUS_LENGTH).optional(),
})

export type MyOrdersQueryInput = z.infer<typeof myOrdersQuerySchema>

export const adminOrderListSchema = orderListQuerySchema.extend({
  tab: z
    .enum(["active", "pending", "assigned", "all"])
    .optional()
    .default("active"),
})

export const deliveryOrderListSchema = orderListQuerySchema.extend({
  tab: z.enum(["active", "ready", "out", "all"]).optional().default("active"),
})

export type AdminOrderListInput = z.infer<typeof adminOrderListSchema>
export type DeliveryOrderListInput = z.infer<typeof deliveryOrderListSchema>
