import { Button, buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import {
  getPaymentSession,
  refreshPayment,
} from "@/feature/payments/api/payments"
import { MoyasarCheckoutForm } from "@/feature/payments/components/moyasar-checkout-form"
import { formatMoney, fromMinorUnits } from "@/feature/payments/money"
import { OrderTotals } from "@/feature/orders/components/order-totals"
import { createFileRoute, Link, useRouter } from "@tanstack/react-router"
import {
  CheckCircle2Icon,
  ClockIcon,
  CreditCardIcon,
  LockKeyholeIcon,
  RefreshCwIcon,
  ShieldCheckIcon,
  XCircleIcon,
} from "lucide-react"
import { useState, type ReactNode } from "react"
import { toast } from "sonner"

export const Route = createFileRoute("/(main)/(protected)/payment/$orderId")({
  loader: async ({ params }) =>
    getPaymentSession({ data: { orderId: params.orderId } }),
  errorComponent: ({ error }) => (
    <div className="px-4 py-12 sm:px-6 lg:px-8">
      <Card className="mx-auto max-w-md items-center text-center">
        <CardHeader className="items-center">
          <CardTitle className="text-xl">Payment unavailable</CardTitle>
          <CardDescription>
            {error instanceof Error
              ? error.message
              : "We could not load this order."}
          </CardDescription>
        </CardHeader>
        <CardContent className="w-full">
          <Link
            to="/orders"
            className={buttonVariants({ className: "w-full" })}
          >
            View my orders
          </Link>
        </CardContent>
      </Card>
    </div>
  ),
  component: PaymentPage,
})

function PaymentPage() {
  const session = Route.useLoaderData()
  const router = useRouter()
  const { order } = session
  const [refreshing, setRefreshing] = useState(false)

  const refresh = async () => {
    setRefreshing(true)

    try {
      await refreshPayment({ data: { orderId: order.orderId } })
      await router.invalidate()
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not refresh the payment status. Please try again."
      )
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Complete your payment
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Order #{order.orderNumber}
          </p>
        </div>
        <Link
          to="/orders"
          className="text-sm font-semibold text-orange-500 transition-colors hover:text-orange-700"
        >
          View my orders
        </Link>
      </div>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          {session.state === "paid" ? (
            <StatusCard
              icon={<CheckCircle2Icon className="size-6" />}
              title="Payment received"
              description="Your order is confirmed. We are preparing it for delivery."
              tone="success"
            >
              <Link
                to="/orders"
                className={buttonVariants({ className: "w-full" })}
              >
                View my order
              </Link>
            </StatusCard>
          ) : session.state === "authorized" ? (
            <StatusCard
              icon={<ShieldCheckIcon className="size-6" />}
              title="Payment authorized"
              description="Your payment is authorized. The order will be confirmed once it is captured."
              tone="info"
            >
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={refreshing}
                onClick={refresh}
              >
                {refreshing ? <Spinner /> : <RefreshCwIcon />}
                Refresh status
              </Button>
            </StatusCard>
          ) : session.state === "processing" ? (
            <StatusCard
              icon={<ClockIcon className="size-6" />}
              title="Payment processing"
              description="We are confirming your payment with the bank. This usually takes a few seconds."
              tone="info"
            >
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={refreshing}
                onClick={refresh}
              >
                {refreshing ? <Spinner /> : <RefreshCwIcon />}
                Refresh status
              </Button>
            </StatusCard>
          ) : session.state === "unavailable" ? (
            <StatusCard
              icon={<XCircleIcon className="size-6" />}
              title="Payment unavailable"
              description={
                session.stateMessage ??
                "This order is not awaiting payment. Check your orders for the latest status."
              }
              tone="info"
            >
              <Link
                to="/orders"
                className={buttonVariants({ className: "w-full" })}
              >
                View my orders
              </Link>
            </StatusCard>
          ) : (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CreditCardIcon className="size-5 text-orange-500" />
                  <CardTitle>Card payment</CardTitle>
                </div>
                <CardDescription>
                  Pay securely with your debit or credit card. Your card details
                  are entered directly into Moyasar and never touch our servers.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {session.paymentRef ? (
                  <MoyasarCheckoutForm
                    key={session.paymentRef}
                    orderId={order.orderId}
                    paymentRef={session.paymentRef}
                    amount={session.amount}
                    currency={session.currency}
                    description={session.description}
                    publishableKey={session.publishableKey}
                    callbackUrl={session.callbackUrl}
                  />
                ) : (
                  <div className="flex items-center gap-2 rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">
                    <Spinner />
                    Preparing a new payment session…
                  </div>
                )}

                <div className="flex items-start gap-2 text-xs text-muted-foreground">
                  <LockKeyholeIcon className="mt-0.5 size-3.5 shrink-0" />
                  <span>
                    You will be redirected to your bank if additional
                    verification is required. Do not close this page until the
                    payment completes.
                  </span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <aside className="h-fit lg:sticky lg:top-20">
          <Card>
            <CardHeader>
              <CardTitle>Order summary</CardTitle>
              <CardDescription>
                {order.items.length} item
                {order.items.length === 1 ? "" : "s"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="max-h-80 space-y-3 overflow-y-auto pr-1">
                {order.items.map((item) => (
                  <div key={item.product} className="flex gap-3">
                    <img
                      src={item.image}
                      alt={item.name}
                      className="size-14 shrink-0 rounded-lg object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-1 text-sm font-medium">
                        {item.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.quantity} × {formatMoney(item.price)}
                      </p>
                    </div>
                    <span className="text-sm font-semibold">
                      {formatMoney(item.price * item.quantity)}
                    </span>
                  </div>
                ))}
              </div>

              <Separator />

              <OrderTotals
                subtotal={order.subtotal}
                tax={order.tax}
                deliveryFee={order.deliveryFee}
                total={fromMinorUnits(session.amount)}
                format={(value) => formatMoney(value, session.currency)}
                divided
              />
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  )
}

interface StatusCardProps {
  icon: ReactNode
  title: string
  description: string
  tone: "success" | "info"
  children: ReactNode
}

function StatusCard({
  icon,
  title,
  description,
  tone,
  children,
}: StatusCardProps) {
  return (
    <Card>
      <CardHeader>
        <div
          className={
            tone === "success"
              ? "flex size-12 items-center justify-center rounded-full bg-green-100 text-green-600"
              : "flex size-12 items-center justify-center rounded-full bg-orange-100 text-orange-500"
          }
        >
          {icon}
        </div>
        <CardTitle className="mt-2">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="w-full">{children}</CardContent>
    </Card>
  )
}
