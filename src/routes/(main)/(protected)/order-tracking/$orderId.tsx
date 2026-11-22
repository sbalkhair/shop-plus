import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getOrderTracking } from "@/feature/orders/api/tracking"
import { DeliveryPartnerCard } from "@/feature/orders/components/delivery-partner-card"
import { DeliveryVerificationCard } from "@/feature/orders/components/delivery-verification-card"
import { OrderCard } from "@/feature/orders/components/order-card"
import { OrderTimeline } from "@/feature/orders/components/order-timeline"
import { statusTone } from "@/feature/orders/status"
import { DeliveryLocationCard } from "@/feature/maps/components/delivery-location-card"
import { createFileRoute, Link, notFound } from "@tanstack/react-router"
import { ReceiptTextIcon } from "lucide-react"

export const Route = createFileRoute(
  "/(main)/(protected)/order-tracking/$orderId"
)({
  loader: async ({ params }) => {
    const tracking = await getOrderTracking({
      data: { orderId: params.orderId },
    })

    if (!tracking) {
      throw notFound()
    }

    return { tracking }
  },
  component: RouteComponent,
})

function RouteComponent() {
  const { tracking } = Route.useLoaderData()
  const { order } = tracking

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <Link
          to="/orders"
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          ← Back to my orders
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <ReceiptTextIcon className="size-6 text-orange-500" />
            Order #{order.orderNumber}
          </h1>
          <Badge className={statusTone(order.status)}>{order.status}</Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Follow your order from the shop to your door.
        </p>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <OrderCard order={order} />
          <DeliveryLocationCard
            address={order.shippingAddress}
            title="Your delivery location"
            description="This is the pin the driver will navigate to."
          />
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Tracking timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <OrderTimeline history={tracking.statusHistory} />
            </CardContent>
          </Card>

          {tracking.deliveryVerification &&
            order.status === "Out for Delivery" && (
              <DeliveryVerificationCard
                verification={tracking.deliveryVerification}
                revealCode
              />
            )}

          {tracking.deliveryPartner && (
            <DeliveryPartnerCard partner={tracking.deliveryPartner} />
          )}
        </div>
      </div>
    </div>
  )
}
