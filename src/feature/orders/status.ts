/**
 * Order status lifecycle shared by the API, the order cards, and both tracking
 * pages. Keeping the role-specific transitions here means the admin UI, the
 * driver portal, and the server validation cannot drift apart.
 */
export const ORDER_STATUSES = [
  "Pending Payment",
  "Placed",
  "Processing",
  "Out for Delivery",
  "Delivered",
  "Canceled",
  "Refunded",
  "Voided",
] as const

export type OrderStatus = (typeof ORDER_STATUSES)[number]

export const isOrderStatus = (value: unknown): value is OrderStatus =>
  ORDER_STATUSES.some((status) => status === value)

/**
 * Admins may only cancel an order. They can never move an order into the
 * delivery stages; that belongs to the assigned driver.
 */
const ADMIN_CANCELABLE_STATUSES: readonly OrderStatus[] = [
  "Pending Payment",
  "Placed",
  "Processing",
  "Out for Delivery",
]

/**
 * The assigned driver starts delivery from a placed/processing order. The
 * `Delivered` transition is intentionally absent: it is only reachable through
 * `verifyDeliveryOtp`, after the customer's code has been confirmed.
 */
const DRIVER_STARTABLE_STATUSES: readonly OrderStatus[] = [
  "Placed",
  "Processing",
]

const TERMINAL_STATUSES: readonly OrderStatus[] = [
  "Delivered",
  "Canceled",
  "Refunded",
  "Voided",
]

export const canAdminCancelOrder = (status: string): boolean =>
  isOrderStatus(status) && ADMIN_CANCELABLE_STATUSES.includes(status)

export const canDriverStartDelivery = (status: string): boolean =>
  isOrderStatus(status) && DRIVER_STARTABLE_STATUSES.includes(status)

export const isTerminalOrderStatus = (status: string): boolean =>
  isOrderStatus(status) && TERMINAL_STATUSES.includes(status)

export const statusTone = (status: string): string => {
  switch (status) {
    case "Placed":
    case "Processing":
    case "Delivered":
      return "bg-green-100 text-green-700"
    case "Pending Payment":
      return "bg-amber-100 text-amber-700"
    case "Out for Delivery":
      return "bg-orange-100 text-orange-700"
    case "Refunded":
      return "bg-sky-100 text-sky-700"
    case "Voided":
    case "Canceled":
      return "bg-red-100 text-red-700"
    default:
      return "bg-zinc-100 text-zinc-700"
  }
}
