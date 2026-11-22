import { Spinner } from "@/components/ui/spinner"
import {
  attachPayment,
  createPaymentIntent,
} from "@/feature/payments/api/payments"
import {
  loadMoyasarForm,
  type MoyasarFormConfig,
} from "@/feature/payments/form"
import type { PaymentCurrency } from "@/feature/payments/types"
import { useNavigate } from "@tanstack/react-router"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"

interface MoyasarCheckoutFormProps {
  orderId: string
  paymentRef: string
  /** Amount in the smallest currency unit (halalas). */
  amount: number
  currency: PaymentCurrency
  description: string
  publishableKey: string
  callbackUrl: string
}

type LoadState = "loading" | "ready" | "error"

/**
 * Mounts the official Moyasar payment form.
 *
 * The form collects card data and posts it directly to Moyasar. Our code only
 * creates a server-side intent, then verifies the resulting payment id
 * server-side before the order is fulfilled.
 */
export const MoyasarCheckoutForm = ({
  orderId,
  paymentRef,
  amount,
  currency,
  description,
  publishableKey,
  callbackUrl,
}: MoyasarCheckoutFormProps) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const [loadState, setLoadState] = useState<LoadState>("loading")
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const container = containerRef.current

    if (!container) {
      return
    }

    // A fresh attempt gets a fresh container.
    container.replaceChildren()

    loadMoyasarForm()
      .then((moyasar) => {
        if (cancelled || !containerRef.current) {
          return
        }

        const config: MoyasarFormConfig = {
          element: containerRef.current,
          amount,
          currency,
          description,
          publishable_api_key: publishableKey,
          callback_url: callbackUrl,
          // Deterministic Moyasar payment id for this attempt.
          given_id: paymentRef,
          // Searchable provider-side reference used to recover a payment when
          // the callback and webhook are both delayed or lost.
          metadata: {
            shop_plus_order: orderId,
            shop_plus_payment: paymentRef,
          },
          methods: ["creditcard"],
          language: "en",
          fixed_width: false,
          use_payment_intent: true,
          on_initiating: async () => {
            try {
              const result = await createPaymentIntent({
                data: { orderId, paymentRef },
              })

              if (!result.ok) {
                if (
                  result.reason === "payment_already_submitted" &&
                  result.paymentId
                ) {
                  toast.info(result.message)
                  navigate({
                    to: "/payment-result",
                    search: {
                      orderId: result.orderId,
                      id: result.paymentId,
                      status: undefined,
                      message: undefined,
                    },
                  })
                } else if (result.reason === "already_paid") {
                  toast.info(result.message)
                  navigate({ to: "/orders" })
                } else if (result.reason === "payment_processing") {
                  toast.info(result.message)
                  navigate({
                    to: "/payment/$orderId",
                    params: { orderId: result.orderId },
                    replace: true,
                  })
                } else {
                  toast.error(result.message)
                }

                return false
              }

              return {
                payment_intent: {
                  id: result.intentId,
                  client_secret: result.clientSecret,
                },
              }
            } catch (error) {
              toast.error(
                error instanceof Error
                  ? error.message
                  : "Could not start the payment. Please try again."
              )
              return false
            }
          },
          on_completed: async (payment) => {
            try {
              const result = await attachPayment({
                data: { orderId, paymentId: payment.id },
              })

              if (result.status === "invalid") {
                toast.error(
                  result.message ?? "We could not verify this payment."
                )
              }
            } catch {
              // The return page re-verifies with the secret key, so a transient
              // failure here must not block the redirect.
            }
          },
          on_failure: (message) => {
            toast.error(
              message || "The payment failed. Please try a different card."
            )
          },
        }

        moyasar.init(config)
        setLoadState("ready")
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return
        }

        setLoadError(
          error instanceof Error
            ? error.message
            : "Could not load the secure payment form."
        )
        setLoadState("error")
      })

    return () => {
      cancelled = true
    }
  }, [
    amount,
    callbackUrl,
    currency,
    description,
    navigate,
    orderId,
    paymentRef,
    publishableKey,
  ])

  if (loadState === "error") {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        <p className="font-medium">Payment form unavailable</p>
        <p className="mt-1 text-destructive/80">{loadError}</p>
        <p className="mt-2 text-xs">
          Refresh the page to try again. You have not been charged.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {loadState === "loading" && (
        <div className="flex items-center gap-2 rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">
          <Spinner />
          Loading the secure payment form…
        </div>
      )}
      <div ref={containerRef} className="moyasar-form-container" />
    </div>
  )
}
