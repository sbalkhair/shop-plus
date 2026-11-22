import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getAssignedOrder } from "@/feature/orders/api/delivery"
import { DeliveryVerificationCard } from "@/feature/orders/components/delivery-verification-card"
import { DeliveryVerificationForm } from "@/feature/orders/components/delivery-verification-form"
import { OrderCard } from "@/feature/orders/components/order-card"
import { OrderTimeline } from "@/feature/orders/components/order-timeline"
import { StartDeliveryButton } from "@/feature/orders/components/start-delivery-button"
import { statusTone } from "@/feature/orders/status"
import { DeliveryLocationCard } from "@/feature/maps/components/delivery-location-card"
import {
  isDeliveryOrderTab,
  isOrderSort,
  parseOrderListPage,
  type DeliveryOrderTab,
  type OrderSort,
} from "@/feature/orders/list"
import { createFileRoute, Link, notFound } from "@tanstack/react-router"
import { ReceiptTextIcon } from "lucide-react"

interface DeliveryOrderDetailsSearch {
  tab?: DeliveryOrderTab
  q?: string
  sort?: OrderSort
  page?: number
}

export const Route = createFileRoute("/delivery/$orderId")({
  validateSearch: (
    search: Record<string, unknown>
  ): DeliveryOrderDetailsSearch => ({
    tab: isDeliveryOrderTab(search.tab) ? search.tab : undefined,
    q:
      typeof search.q === "string" && search.q.trim()
        ? search.q.trim()
        : undefined,
    sort: isOrderSort(search.sort) ? search.sort : undefined,
    page: parseOrderListPage(search.page),
  }),
  loader: async ({ params }) => {
    const delivery = await getAssignedOrder({
      data: { orderId: params.orderId },
    })

    if (!delivery) {
      throw notFound()
    }

    return { delivery }
  },
  component: RouteComponent,
})

function RouteComponent() {
  const { delivery } = Route.useLoaderData()
  const { order } = delivery

  const guidance = delivery.canVerify
    ? "Ask the customer for the verification code before confirming this delivery."
    : delivery.canStartDelivery
      ? "Start the delivery when you leave with this order."
      : order.status === "Delivered"
        ? "This order has already been delivered."
        : order.status === "Canceled"
          ? "This order was canceled and cannot be delivered."
          : delivery.deliveryVerification?.status === "expired"
            ? "The verification code expired. Ask the store to issue a new one."
            : delivery.deliveryVerification?.status === "locked"
              ? "Too many incorrect attempts. Ask the store to issue a new code."
              : "This order is not currently awaiting a delivery action."

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <Link
          to="/delivery"
          search={true}
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          ← Back to assigned orders
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <ReceiptTextIcon className="size-6 text-orange-500" />
            Order #{order.orderNumber}
          </h1>
          <Badge className={statusTone(order.status)}>{order.status}</Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{guidance}</p>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <OrderCard order={order} showCustomer />
          <DeliveryLocationCard
            address={order.shippingAddress}
            title="Delivery destination"
            description="Use the pin for turn-by-turn navigation. The written address is included when no pin was saved."
            showNavigation
          />
          {delivery.canStartDelivery && (
            <StartDeliveryButton orderId={order.id} />
          )}
          {delivery.canVerify && (
            <DeliveryVerificationForm orderId={order.id} />
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Tracking timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <OrderTimeline history={delivery.statusHistory} />
            </CardContent>
          </Card>

          {delivery.deliveryVerification && (
            <DeliveryVerificationCard
              verification={delivery.deliveryVerification}
              revealCode={false}
            />
          )}
        </div>
      </div>
    </div>
  )
}
