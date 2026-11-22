import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import { OrderTotals } from "@/feature/orders/components/order-totals"
import type { PaymentMethod } from "@/feature/orders/schema"
import {
  formatPrice,
  type OrderTotals as OrderTotalsValue,
} from "@/lib/pricing"
import type { CartItem } from "@/store"
import { LockKeyholeIcon, MinusIcon, PlusIcon, Trash2Icon } from "lucide-react"

interface CheckoutSummaryProps {
  items: CartItem[]
  totals: OrderTotalsValue
  paymentMethod: PaymentMethod
  isSubmitting: boolean
  onIncrease: (item: CartItem) => void
  onDecrease: (id: string) => void
  onRemove: (id: string) => void
}

/**
 * Sticky order summary: the editable cart, server-equivalent totals, and the
 * submit button whose label follows the selected payment method.
 */
export function CheckoutSummary({
  items,
  totals,
  paymentMethod,
  isSubmitting,
  onIncrease,
  onDecrease,
  onRemove,
}: CheckoutSummaryProps) {
  const itemCount = items.reduce((count, item) => count + item.quantity, 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Order summary</CardTitle>
        <CardDescription>
          {itemCount} item{itemCount === 1 ? "" : "s"} in your cart
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="max-h-80 space-y-3 overflow-y-auto pr-1">
          {items.map((item) => (
            <div key={item.id} className="flex gap-3">
              <img
                src={item.image}
                alt={item.name}
                className="size-14 shrink-0 rounded-lg object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="line-clamp-1 text-sm font-medium">{item.name}</p>
                <p className="text-xs text-muted-foreground">{item.unit}</p>
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1 rounded-md border p-0.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => onDecrease(item.id)}
                      aria-label={`Decrease ${item.name} quantity`}
                    >
                      <MinusIcon />
                    </Button>
                    <span className="w-5 text-center text-xs font-medium">
                      {item.quantity}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => onIncrease(item)}
                      disabled={item.quantity >= item.stock}
                      aria-label={`Increase ${item.name} quantity`}
                    >
                      <PlusIcon />
                    </Button>
                  </div>
                  <span className="text-sm font-semibold">
                    {formatPrice(item.price * item.quantity)}
                  </span>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => onRemove(item.id)}
                aria-label={`Remove ${item.name} from cart`}
              >
                <Trash2Icon />
              </Button>
            </div>
          ))}
        </div>

        <Separator />

        <OrderTotals {...totals} showFreeIcon />

        <Separator />

        <Button
          type="submit"
          size="lg"
          className="w-full rounded-xl bg-orange-500 hover:bg-orange-600"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Spinner />
              Placing order...
            </>
          ) : (
            <>
              <LockKeyholeIcon />
              {paymentMethod === "card" ? "Continue to payment" : "Place order"}
            </>
          )}
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          By placing this order, you agree to our terms and privacy policy.
        </p>
      </CardContent>
    </Card>
  )
}
