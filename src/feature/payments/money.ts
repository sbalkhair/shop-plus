import { formatCurrency } from "@/lib/pricing"
import {
  MIN_PAYMENT_AMOUNT,
  PAYMENT_CURRENCY,
  type PaymentCurrency,
} from "./types"

/**
 * Converts a major-unit amount (e.g. SAR 12.34) to the smallest currency unit
 * (1234 halalas). Moyasar requires an integer.
 */
export const toMinorUnits = (amount: number): number => {
  if (!Number.isFinite(amount)) {
    throw new Error("Cannot convert a non-finite amount.")
  }

  const minor = Math.round(amount * 100)

  if (!Number.isSafeInteger(minor)) {
    throw new Error("Amount is too large to process.")
  }

  return minor
}

export const fromMinorUnits = (minor: number): number => minor / 100

export const formatMoney = (
  amount: number,
  currency: PaymentCurrency = PAYMENT_CURRENCY
): string => formatCurrency(amount, currency)

export const formatMinorUnits = (
  minor: number,
  currency: PaymentCurrency = PAYMENT_CURRENCY
): string => formatMoney(fromMinorUnits(minor), currency)

/**
 * Validates a server-calculated amount before it is sent to Moyasar.
 * Amounts below 1.00 SAR are rejected because Moyasar rejects them too.
 */
export const assertChargeableMinorAmount = (minor: number): number => {
  if (!Number.isSafeInteger(minor) || minor < MIN_PAYMENT_AMOUNT) {
    throw new Error(
      `The minimum payable amount is ${formatMinorUnits(MIN_PAYMENT_AMOUNT)}.`
    )
  }

  return minor
}
