/**
 * Single source of truth for order pricing and money display.
 *
 * The same values are used by the checkout server function, the cart drawer,
 * and the order screens. Totals are always recalculated on the server from
 * database prices; the client only mirrors them for display.
 */

export const CURRENCY = "SAR" as const

export const TAX_RATE = 0.15
export const DELIVERY_FEE = 5
export const FREE_DELIVERY_THRESHOLD = 20

export interface OrderTotals {
  subtotal: number
  tax: number
  deliveryFee: number
  total: number
}

/**
 * Rounds a major-unit amount to two decimals. Order rows are stored with two
 * decimal places, matching how prices are displayed and charged.
 */
export const roundMoney = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100

/**
 * Applies the store pricing rule: 15% tax, and a flat delivery fee that is
 * waived once the subtotal exceeds the free-delivery threshold.
 */
export const calculateTotals = (subtotal: number): OrderTotals => {
  const roundedSubtotal = roundMoney(subtotal)
  const tax = roundMoney(roundedSubtotal * TAX_RATE)
  const deliveryFee =
    roundedSubtotal > FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_FEE
  const total = roundMoney(roundedSubtotal + tax + deliveryFee)

  return { subtotal: roundedSubtotal, tax, deliveryFee, total }
}

export const formatCurrency = (
  amount: number,
  currency: string = CURRENCY
): string => `${currency} ${amount.toFixed(2)}`

export const formatPrice = (amount: number): string => formatCurrency(amount)
