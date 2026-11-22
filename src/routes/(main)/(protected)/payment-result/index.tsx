import { Button, buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { verifyPayment } from "@/feature/payments/api/payments"
import { formatMinorUnits } from "@/feature/payments/money"
import { PAYMENT_CURRENCY, type PaymentResult } from "@/feature/payments/types"
import { createFileRoute, Link, useRouter } from "@tanstack/react-router"
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  ClockIcon,
  RefreshCwIcon,
  RotateCcwIcon,
  ShieldCheckIcon,
  XCircleIcon,
} from "lucide-react"
import type { ReactNode } from "react"

const invalidResult = (message: string): PaymentResult => ({
  status: "invalid",
  orderId: null,
  orderNumber: null,
  amount: null,
  currency: PAYMENT_CURRENCY,
  message,
  paymentId: null,
  orderStatus: null,
  orderIsPaid: false,
})

export const Route = createFileRoute("/(main)/(protected)/payment-result/")({
  validateSearch: (search: Record<string, unknown>) => ({
    orderId: typeof search.orderId === "string" ? search.orderId : undefined,
    id: typeof search.id === "string" ? search.id : undefined,
    status: typeof search.status === "string" ? search.status : undefined,
    message: typeof search.message === "string" ? search.message : undefined,
  }),
  loaderDeps: ({ search }) => ({ id: search.id }),
  loader: async ({ deps }): Promise<PaymentResult> => {
    if (!deps.id) {
      return invalidResult("No payment reference was provided.")
    }

    try {
      // The query string is not trusted: the server re-fetches the payment from
      // Moyasar with the secret key before reporting a result.
      return await verifyPayment({ data: { paymentId: deps.id } })
    } catch (error) {
      return {
        status: "error",
        orderId: null,
        orderNumber: null,
        amount: null,
        currency: PAYMENT_CURRENCY,
        message:
          error instanceof Error
            ? error.message
            : "We could not verify this payment.",
        paymentId: deps.id,
        orderStatus: null,
        orderIsPaid: false,
      }
    }
  },
  component: PaymentResultPage,
})

function PaymentResultPage() {
  const result = Route.useLoaderData()
  const router = useRouter()

  const { title, description, tone, icon } = describeResult(result)
  const orderId = result.orderId

  return (
    <div className="px-4 py-12 sm:px-6 lg:px-8">
      <Card className="mx-auto max-w-lg">
        <CardHeader className="items-center text-center">
          <div
            className={
              tone === "success"
                ? "flex size-14 items-center justify-center rounded-full bg-green-100 text-green-600"
                : tone === "error"
                  ? "flex size-14 items-center justify-center rounded-full bg-red-100 text-red-600"
                  : "flex size-14 items-center justify-center rounded-full bg-orange-100 text-orange-500"
            }
          >
            {icon}
          </div>
          <CardTitle className="mt-2 text-2xl">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {result.amount !== null && (
            <div className="rounded-xl border bg-muted/30 p-4 text-center">
              <p className="text-xs tracking-wide text-muted-foreground uppercase">
                Amount
              </p>
              <p className="mt-1 text-xl font-semibold">
                {formatMinorUnits(result.amount, result.currency)}
              </p>
              {result.orderNumber && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Order #{result.orderNumber}
                </p>
              )}
            </div>
          )}

          {result.status === "pending" && (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => router.invalidate()}
            >
              <RefreshCwIcon />
              Refresh status
            </Button>
          )}

          <div className="grid gap-2 sm:grid-cols-2">
            <Link
              to="/orders"
              className={buttonVariants({ variant: "outline" })}
            >
              View my orders
            </Link>
            {orderId && canRetry(result.status) ? (
              <Link
                to="/payment/$orderId"
                params={{ orderId }}
                className={buttonVariants()}
              >
                <RotateCcwIcon />
                Try again
              </Link>
            ) : (
              <Link to="/products" className={buttonVariants()}>
                Continue shopping
              </Link>
            )}
          </div>

          {result.message && tone !== "success" && (
            <p className="text-center text-xs text-muted-foreground">
              {result.message}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

const canRetry = (status: PaymentResult["status"]): boolean =>
  status === "failed" ||
  status === "expired" ||
  status === "canceled" ||
  status === "invalid" ||
  status === "error"

interface ResultPresentation {
  title: string
  description: string
  tone: "success" | "info" | "error"
  icon: ReactNode
}

const describeResult = (result: PaymentResult): ResultPresentation => {
  switch (result.status) {
    case "paid":
      if (result.orderIsPaid) {
        return {
          title: "Payment successful",
          description: "Your order has been confirmed.",
          tone: "success",
          icon: <CheckCircle2Icon className="size-7" />,
        }
      }

      return {
        title: "Payment received",
        description:
          result.orderStatus === "Canceled"
            ? "This order was canceled before the payment completed. Please contact support to arrange a refund."
            : "We received your payment, but the order could not be confirmed automatically. Please contact support.",
        tone: "info",
        icon: <AlertTriangleIcon className="size-7" />,
      }
    case "authorized":
      return {
        title: "Payment authorized",
        description:
          "Your payment is authorized. The order will be confirmed once it is captured.",
        tone: "info",
        icon: <ShieldCheckIcon className="size-7" />,
      }
    case "pending":
      return {
        title: "Payment processing",
        description:
          "We are confirming your payment with the bank. This usually takes a few seconds.",
        tone: "info",
        icon: <ClockIcon className="size-7" />,
      }
    case "refunded":
      return {
        title: "Payment refunded",
        description: "This payment has been fully refunded.",
        tone: "info",
        icon: <RotateCcwIcon className="size-7" />,
      }
    case "voided":
      return {
        title: "Payment voided",
        description: "This payment was voided and the order was not charged.",
        tone: "info",
        icon: <XCircleIcon className="size-7" />,
      }
    case "failed":
      return {
        title: "Payment failed",
        description:
          "Your card was not charged. You can try again with a different card.",
        tone: "error",
        icon: <XCircleIcon className="size-7" />,
      }
    case "expired":
    case "canceled":
      return {
        title: "Payment session expired",
        description:
          "This checkout session can no longer be used. Start a new payment to complete your order.",
        tone: "error",
        icon: <ClockIcon className="size-7" />,
      }
    case "invalid":
      return {
        title: "Payment not found",
        description: "We could not match this payment to an order you own.",
        tone: "error",
        icon: <AlertTriangleIcon className="size-7" />,
      }
    case "error":
    default:
      return {
        title: "We could not verify this payment",
        description:
          "The payment may still be processing. Check your orders before trying again.",
        tone: "error",
        icon: <AlertTriangleIcon className="size-7" />,
      }
  }
}
