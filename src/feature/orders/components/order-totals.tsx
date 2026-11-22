import { CheckIcon } from "lucide-react"
import { cn } from "cn"

import { formatPrice, TAX_RATE } from "@/lib/pricing"

interface OrderTotalsProps {
  subtotal: number
  tax: number
  deliveryFee: number
  total: number
  /** Amount formatter for non-store currencies, e.g. the payment page. */
  format?: (value: number) => string
  /** Draw a divider above the total row. */
  divided?: boolean
  /** Show a check mark next to "Free" delivery. */
  showFreeIcon?: boolean
  className?: string
}

/**
 * Subtotal, tax, delivery, and total for an order. Checkout, the payment page,
 * and the order cards all render the same rows, so the labels and the
 * free-delivery treatment live here.
 */
export function OrderTotals({
  subtotal,
  tax,
  deliveryFee,
  total,
  format = formatPrice,
  divided = false,
  showFreeIcon = false,
  className,
}: OrderTotalsProps) {
  return (
    <dl className={cn("space-y-1.5 text-sm", className)}>
      <div className="flex items-center justify-between">
        <dt className="text-muted-foreground">Subtotal</dt>
        <dd>{format(subtotal)}</dd>
      </div>
      <div className="flex items-center justify-between">
        <dt className="text-muted-foreground">
          Tax ({Math.round(TAX_RATE * 100)}%)
        </dt>
        <dd>{format(tax)}</dd>
      </div>
      <div className="flex items-center justify-between">
        <dt className="text-muted-foreground">Delivery</dt>
        <dd
          className={
            deliveryFee === 0 && showFreeIcon
              ? "flex items-center gap-1 font-medium text-green-600"
              : undefined
          }
        >
          {deliveryFee === 0 ? (
            <>
              {showFreeIcon && <CheckIcon className="size-3.5" />}
              Free
            </>
          ) : (
            format(deliveryFee)
          )}
        </dd>
      </div>
      <div
        className={cn(
          "flex items-center justify-between text-base font-semibold",
          divided && "border-t pt-1.5"
        )}
      >
        <dt>Total</dt>
        <dd>{format(total)}</dd>
      </div>
    </dl>
  )
}
