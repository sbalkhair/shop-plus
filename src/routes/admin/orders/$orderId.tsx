import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getDeliveryPartners } from "@/feature/delivery-partners/api/delivery-partners"
import { getOrderTracking } from "@/feature/orders/api/tracking"
import { DeliveryPartnerCard } from "@/feature/orders/components/delivery-partner-card"
import { DeliveryVerificationCard } from "@/feature/orders/components/delivery-verification-card"
import { OrderCard } from "@/feature/orders/components/order-card"
import { OrderTimeline } from "@/feature/orders/components/order-timeline"
import { OrderTrackingForm } from "@/feature/orders/components/order-tracking-form"
import { RegenerateDeliveryCodeButton } from "@/feature/orders/components/regenerate-delivery-code-button"
import { statusTone } from "@/feature/orders/status"
import { DeliveryLocationCard } from "@/feature/maps/components/delivery-location-card"
import {
  isAdminOrderTab,
  isOrderSort,
  parseOrderListPage,
  type AdminOrderTab,
  type OrderSort,
} from "@/feature/orders/list"
import { Badge } from "@/components/ui/badge"
import { createFileRoute, Link, notFound } from "@tanstack/react-router"
import { ReceiptTextIcon } from "lucide-react"

interface AdminOrderDetailsSearch {
  tab?: AdminOrderTab
  q?: string
  sort?: OrderSort
  page?: number
}

export const Route = createFileRoute("/admin/orders/$orderId")({
  validateSearch: (
    search: Record<string, unknown>
  ): AdminOrderDetailsSearch => ({
    tab: isAdminOrderTab(search.tab) ? search.tab : undefined,
    q:
      typeof search.q === "string" && search.q.trim()
        ? search.q.trim()
        : undefined,
    sort: isOrderSort(search.sort) ? search.sort : undefined,
    page: parseOrderListPage(search.page),
  }),
  loader: async ({ params }) => {
    const [tracking, partners] = await Promise.all([
      getOrderTracking({ data: { orderId: params.orderId } }),
      getDeliveryPartners(),
    ])

    if (!tracking) {
      throw notFound()
    }

    return { tracking, partners }
  },
  component: RouteComponent,
})

function RouteComponent() {
  const { tracking, partners } = Route.useLoaderData()
  const { order } = tracking

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <Link
          to="/admin/orders"
          search={true}
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          ← Back to orders
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <ReceiptTextIcon className="size-6 text-orange-500" />
            Order #{order.orderNumber}
          </h1>
          <Badge className={statusTone(order.status)}>{order.status}</Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Assign a delivery person, cancel the order, and review the tracking
          timeline.
        </p>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <OrderCard order={order} showCustomer />
          <DeliveryLocationCard
            address={order.shippingAddress}
            description="The pin the customer chose for this delivery."
          />
          <OrderTrackingForm tracking={tracking} partners={partners} />
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

          {tracking.deliveryVerification && (
            <DeliveryVerificationCard
              verification={tracking.deliveryVerification}
              revealCode={false}
            />
          )}

          {order.status === "Out for Delivery" && (
            <RegenerateDeliveryCodeButton orderId={order.id} />
          )}

          {tracking.deliveryPartner && (
            <DeliveryPartnerCard partner={tracking.deliveryPartner} />
          )}
        </div>
      </div>
    </div>
  )
}
