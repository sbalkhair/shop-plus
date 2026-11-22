import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { statusTone } from "@/feature/orders/status"
import { formatOrderDate, type OrderSummary } from "@/feature/orders/types"
import { formatPrice } from "@/lib/pricing"
import { OrderTotals } from "./order-totals"
import {
  BanknoteIcon,
  CalendarDaysIcon,
  CreditCardIcon,
  MailIcon,
  MapPinIcon,
  PhoneIcon,
  UserRoundIcon,
} from "lucide-react"
import type { ReactNode } from "react"

interface OrderCardProps {
  order: OrderSummary
  /** Admins see who placed the order; customers are viewing their own. */
  showCustomer?: boolean
  /** Optional actions rendered in the card footer (e.g. a tracking link). */
  actions?: ReactNode
}

export function OrderCard({
  order,
  showCustomer = false,
  actions,
}: OrderCardProps) {
  const isCardPayment = order.paymentMethod === "card"

  return (
    <Card className="gap-0">
      <CardHeader className="border-b pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-base font-semibold">
              Order #{order.orderNumber}
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <CalendarDaysIcon className="size-3.5" />
              {formatOrderDate(order.createdAt)}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <Badge className={statusTone(order.status)}>{order.status}</Badge>
            <Badge variant={order.isPaid ? "secondary" : "outline"}>
              {order.isPaid ? "Paid" : "Not paid"}
            </Badge>
            <Badge variant="outline">
              {isCardPayment ? (
                <CreditCardIcon data-icon="inline-start" />
              ) : (
                <BanknoteIcon data-icon="inline-start" />
              )}
              {isCardPayment ? "Card" : "Cash"}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {showCustomer && order.customer && (
          <div className="rounded-xl border bg-muted/30 p-3">
            <p className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              <UserRoundIcon className="size-3.5" />
              Customer
            </p>
            <p className="mt-1.5 text-sm font-medium">{order.customer.name}</p>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <MailIcon className="size-3.5" />
                {order.customer.email}
              </span>
              {order.customer.phone && (
                <span className="flex items-center gap-1">
                  <PhoneIcon className="size-3.5" />
                  {order.customer.phone}
                </span>
              )}
            </div>
          </div>
        )}

        <div>
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Items ({order.itemCount})
          </p>
          {order.items.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              No item details were recorded for this order.
            </p>
          ) : (
            <ul className="mt-2 divide-y">
              {order.items.map((item) => (
                <li
                  key={`${order.id}-${item.product}`}
                  className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
                >
                  <img
                    src={item.image || "/placeholder.svg"}
                    alt=""
                    className="size-11 shrink-0 rounded-lg border object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.quantity} × {formatPrice(item.price)}
                      {item.unit ? ` · ${item.unit}` : ""}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-medium">
                    {formatPrice(item.price * item.quantity)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        {order.shippingAddress && (
          <div className="rounded-xl border p-3">
            <p className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              <MapPinIcon className="size-3.5" />
              Delivery address
            </p>
            <p className="mt-1.5 text-sm font-medium">
              {order.shippingAddress.fullName} · {order.shippingAddress.phone}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {order.shippingAddress.address}, {order.shippingAddress.city},{" "}
              {order.shippingAddress.state} {order.shippingAddress.zip}
            </p>
            {order.shippingAddress.notes && (
              <p className="mt-1 text-xs text-muted-foreground italic">
                “{order.shippingAddress.notes}”
              </p>
            )}
          </div>
        )}

        <Separator />

        <OrderTotals
          subtotal={order.subtotal}
          tax={order.tax}
          deliveryFee={order.deliveryFee}
          total={order.total}
          divided
        />

        {actions && (
          <>
            <Separator />
            <div className="flex flex-wrap items-center justify-end gap-2">
              {actions}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
