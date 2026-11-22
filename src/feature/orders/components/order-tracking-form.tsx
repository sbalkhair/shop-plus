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
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import {
  assignDeliveryPartner,
  cancelOrder,
} from "@/feature/orders/api/tracking"
import {
  canAdminCancelOrder,
  isTerminalOrderStatus,
} from "@/feature/orders/status"
import type { OrderTracking } from "@/feature/orders/types"
import type { DeliveryPartner } from "@/types"
import { useMutation } from "@tanstack/react-query"
import { useRouter } from "@tanstack/react-router"
import { BanIcon, SaveIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

interface OrderTrackingFormProps {
  tracking: OrderTracking
  partners: DeliveryPartner[]
}

const NO_PARTNER = "none"

/**
 * Admin-only controls for one order: assigning/removing the delivery person and
 * cancelling the order. Delivery status changes are intentionally not available
 * here; the assigned driver owns those from the driver portal.
 */
export function OrderTrackingForm({
  tracking,
  partners,
}: OrderTrackingFormProps) {
  const router = useRouter()
  const { order } = tracking

  const [partnerId, setPartnerId] = useState(
    tracking.deliveryPartner?.id ?? NO_PARTNER
  )
  const [note, setNote] = useState("")
  const [cancelOpen, setCancelOpen] = useState(false)

  const isTerminal = isTerminalOrderStatus(order.status)
  const isOutForDelivery = order.status === "Out for Delivery"
  const canCancel = canAdminCancelOrder(order.status)

  const selectedPartnerId = partnerId === NO_PARTNER ? null : partnerId
  const partnerChanged =
    selectedPartnerId !== (tracking.deliveryPartner?.id ?? null)

  const assignMutation = useMutation({
    mutationFn: () =>
      assignDeliveryPartner({
        data: { orderId: order.id, deliveryPartnerId: selectedPartnerId },
      }),
    onSuccess: async () => {
      toast.success(
        selectedPartnerId
          ? "Delivery person assigned"
          : "Delivery person removed"
      )
      await router.invalidate()
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not update the delivery person"
      )
    },
  })

  const cancelMutation = useMutation({
    mutationFn: () =>
      cancelOrder({
        data: { orderId: order.id, note: note.trim() || undefined },
      }),
    onSuccess: async () => {
      setCancelOpen(false)
      setNote("")
      toast.success("Order canceled")
      await router.invalidate()
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Could not cancel the order"
      )
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Delivery assignment</CardTitle>
        <CardDescription>
          {isTerminal
            ? "This order is in a final state, so its delivery person can no longer change."
            : isOutForDelivery
              ? "The assigned driver is delivering this order. Delivery status is updated from the driver portal."
              : "Assign a courier to this order. The assigned driver starts and completes the delivery."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            assignMutation.mutate()
          }}
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="delivery-partner">
                Delivery person
              </FieldLabel>
              <FieldContent>
                <Select
                  value={partnerId}
                  onValueChange={(value) => setPartnerId(value ?? NO_PARTNER)}
                  disabled={isTerminal}
                >
                  <SelectTrigger id="delivery-partner" className="w-full">
                    <SelectValue placeholder="No delivery person assigned">
                      {(value: string | null) => {
                        const partner = partners.find(
                          (candidate) => candidate.id === value
                        )

                        return partner
                          ? `${partner.name} · ${partner.phone}${partner.isActive ? "" : " (inactive)"}`
                          : "No delivery person assigned"
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_PARTNER} disabled={isOutForDelivery}>
                      No delivery person assigned
                    </SelectItem>
                    {partners.map((partner) => (
                      <SelectItem key={partner.id} value={partner.id}>
                        {partner.name} · {partner.phone}
                        {partner.isActive ? "" : " (inactive)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FieldContent>
              <FieldDescription>
                {tracking.deliveryPartner
                  ? `Currently assigned to ${tracking.deliveryPartner.name}.`
                  : "No delivery person is assigned to this order yet."}
              </FieldDescription>
            </Field>

            <Field orientation="horizontal">
              <Button
                type="submit"
                disabled={
                  isTerminal || assignMutation.isPending || !partnerChanged
                }
              >
                {assignMutation.isPending ? (
                  <>
                    <Spinner />
                    Saving…
                  </>
                ) : (
                  <>
                    <SaveIcon />
                    Save assignment
                  </>
                )}
              </Button>
            </Field>
          </FieldGroup>
        </form>

        <Separator className="my-5" />

        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium">Cancel order</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {canCancel
                ? "Cancelling stops the delivery workflow and invalidates any active delivery code."
                : "This order can no longer be canceled."}
            </p>
          </div>

          {canCancel && (
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="cancel-note">
                  Cancellation note (optional)
                </FieldLabel>
                <FieldContent>
                  <Textarea
                    id="cancel-note"
                    placeholder="e.g. Customer requested cancellation"
                    maxLength={300}
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                  />
                </FieldContent>
                <FieldDescription>
                  Saved with the cancellation in the tracking timeline.
                </FieldDescription>
              </Field>

              <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
                <AlertDialogTrigger
                  render={
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      disabled={cancelMutation.isPending}
                    />
                  }
                >
                  <BanIcon />
                  Cancel order
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Cancel this order?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Order #{order.orderNumber} will be marked as canceled and
                      can no longer continue through delivery. This cannot be
                      undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={cancelMutation.isPending}>
                      Keep order
                    </AlertDialogCancel>
                    <AlertDialogAction
                      variant="destructive"
                      disabled={cancelMutation.isPending}
                      onClick={() => cancelMutation.mutate()}
                    >
                      {cancelMutation.isPending ? (
                        <>
                          <Spinner />
                          Canceling…
                        </>
                      ) : (
                        "Cancel order"
                      )}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </FieldGroup>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
