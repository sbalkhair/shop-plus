import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import { startDelivery } from "@/feature/orders/api/delivery"
import { useMutation } from "@tanstack/react-query"
import { useRouter } from "@tanstack/react-router"
import { TruckIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

interface StartDeliveryButtonProps {
  orderId: string
}

/**
 * The assigned driver starts delivery from here. The backend verifies the
 * assignment, active account, and current status before issuing the customer's
 * verification code.
 */
export function StartDeliveryButton({ orderId }: StartDeliveryButtonProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  const startMutation = useMutation({
    mutationFn: () => startDelivery({ data: { orderId } }),
    onSuccess: async () => {
      setOpen(false)
      toast.success(
        "Delivery started. Ask the customer for their verification code on arrival."
      )
      await router.invalidate()
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Could not start the delivery"
      )
    },
  })

  return (
    <Card className="border-orange-200 bg-orange-50/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TruckIcon className="size-5 text-orange-500" />
          Ready to deliver
        </CardTitle>
        <CardDescription>
          Start delivery when you leave with this order. Starting also issues
          the customer&apos;s verification code.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <AlertDialog open={open} onOpenChange={setOpen}>
          <AlertDialogTrigger
            render={<Button type="button" disabled={startMutation.isPending} />}
          >
            <TruckIcon />
            Start delivery
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Start this delivery?</AlertDialogTitle>
              <AlertDialogDescription>
                Order #{orderId.slice(0, 8).toUpperCase()} will move to
                &quot;Out for Delivery&quot; and the customer will be able to
                see their verification code. Confirm the code when you hand the
                order over.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={startMutation.isPending}>
                Not yet
              </AlertDialogCancel>
              <AlertDialogAction
                disabled={startMutation.isPending}
                onClick={() => startMutation.mutate()}
              >
                {startMutation.isPending ? (
                  <>
                    <Spinner />
                    Starting…
                  </>
                ) : (
                  "Start delivery"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  )
}
