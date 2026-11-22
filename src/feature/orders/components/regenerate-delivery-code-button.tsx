import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { regenerateDeliveryOtp } from "@/feature/orders/api/tracking"
import { useMutation } from "@tanstack/react-query"
import { useRouter } from "@tanstack/react-router"
import { RefreshCwIcon } from "lucide-react"
import { toast } from "sonner"

interface RegenerateDeliveryCodeButtonProps {
  orderId: string
}

/**
 * Issues a fresh code for an out-for-delivery order. The new code is never
 * returned here; it appears only on the customer's tracking page.
 */
export function RegenerateDeliveryCodeButton({
  orderId,
}: RegenerateDeliveryCodeButtonProps) {
  const router = useRouter()

  const regenerateMutation = useMutation({
    mutationFn: () => regenerateDeliveryOtp({ data: { orderId } }),
    onSuccess: async () => {
      toast.success("A new delivery verification code was issued")
      await router.invalidate()
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not issue a new verification code"
      )
    },
  })

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={regenerateMutation.isPending}
      onClick={() => regenerateMutation.mutate()}
    >
      {regenerateMutation.isPending ? (
        <>
          <Spinner />
          Issuing…
        </>
      ) : (
        <>
          <RefreshCwIcon />
          Regenerate code
        </>
      )}
    </Button>
  )
}
