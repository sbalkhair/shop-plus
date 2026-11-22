import type { DeliveryPartner } from "@/types"
import type { OrderItem, ShippingAddress } from "./schema"

/**
 * Client-safe order line. Mirrors the JSON stored on `Order.items` without
 * exposing any raw provider or session data.
 */
export type OrderItemView = OrderItem

export interface OrderCustomerView {
  id: string
  name: string
  email: string
  phone: string | null
}

/**
 * Sanitized order summary shared by the customer "My orders" page and the
 * admin "Customer orders" page.
 */
export interface OrderSummary {
  id: string
  /** Short, human-friendly reference derived from the order id. */
  orderNumber: string
  items: OrderItemView[]
  itemCount: number
  customer: OrderCustomerView | null
  shippingAddress: ShippingAddress | null
  paymentMethod: string
  subtotal: number
  deliveryFee: number
  tax: number
  total: number
  status: string
  isPaid: boolean
  createdAt: string
}

/**
 * Compact row used by the admin and delivery order lists. It intentionally
 * omits items, the delivery address, and any verification data so large lists
 * stay small and no delivery code can leak through a list endpoint.
 */
export interface OrderListItem {
  id: string
  orderNumber: string
  customerName: string | null
  createdAt: string
  total: number
  itemCount: number
  status: string
  deliveryPartnerName: string | null
}

export interface AdminOrderListCounts {
  active: number
  pending: number
  assigned: number
  all: number
}

export interface DeliveryOrderListCounts {
  active: number
  ready: number
  out: number
  all: number
}

export interface OrderListResult<TCounts> {
  orders: OrderListItem[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  counts: TCounts
}

export type AdminOrderListResult = OrderListResult<AdminOrderListCounts>
export type DeliveryOrderListResult = OrderListResult<DeliveryOrderListCounts>

/** Paginated customer order history plus per-status tab counts. */
export interface MyOrdersResult {
  orders: OrderSummary[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  statusCounts: Record<string, number>
}

export interface OrderStatusEvent {
  status: string
  timestamp: string
  note: string
}

export interface OrderLiveLocation {
  lat: number
  lng: number
  updatedAt?: string
}

/**
 * Client-safe verification state. The code is only ever populated for the
 * order owner and only while the verification is awaiting confirmation.
 */
export interface DeliveryVerificationView {
  status: "awaiting" | "verified" | "expired" | "locked"
  expiresAt: string
  verifiedAt: string | null
  attemptsRemaining: number
  code: string | null
}

/** Everything the customer and admin tracking pages need for one order. */
export interface OrderTracking {
  order: OrderSummary
  statusHistory: OrderStatusEvent[]
  deliveryPartner: DeliveryPartner | null
  deliveryVerification: DeliveryVerificationView | null
  liveLocation: OrderLiveLocation | null
}

/**
 * Driver-safe view of an assigned order. It never contains the verification
 * code, its hash, or its ciphertext.
 */
export interface DriverOrderTracking {
  order: OrderSummary
  statusHistory: OrderStatusEvent[]
  deliveryVerification: DeliveryVerificationView | null
  /** True when this driver may move the order to "Out for Delivery". */
  canStartDelivery: boolean
  /** True when the order is out for delivery and a live code can be entered. */
  canVerify: boolean
}

export const formatOrderNumber = (id: string): string =>
  id.slice(0, 8).toUpperCase()

export const formatOrderDate = (value: string): string =>
  new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
