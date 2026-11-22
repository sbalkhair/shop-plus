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
import { Spinner } from "@/components/ui/spinner"
import { deleteDeliveryPartner } from "@/feature/delivery-partners/api/delivery-partners"
import type { DeliveryPartner } from "@/types"
import { useMutation } from "@tanstack/react-query"
import { useRouter } from "@tanstack/react-router"
import { Trash2Icon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

interface DeleteDeliveryPartnerButtonProps {
  partner: DeliveryPartner
}

/**
 * Deleting a partner only unassigns them from existing orders; the orders keep
 * their status history and remain trackable.
 */
export function DeleteDeliveryPartnerButton({
  partner,
}: DeleteDeliveryPartnerButtonProps) {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  const deleteMutation = useMutation({
    mutationFn: () => deleteDeliveryPartner({ data: { id: partner.id } }),
    onSuccess: async () => {
      setOpen(false)
      toast.success(`"${partner.name}" deleted`)
      await router.invalidate()
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not delete the delivery partner"
      )
    },
  })

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive hover:bg-destructive/10"
            aria-label={`Delete ${partner.name}`}
          />
        }
      >
        <Trash2Icon />
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this delivery partner?</AlertDialogTitle>
          <AlertDialogDescription>
            &quot;{partner.name}&quot; will be permanently removed and
            unassigned from any orders. Existing orders are kept.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteMutation.isPending}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={deleteMutation.isPending}
            onClick={() => deleteMutation.mutate()}
          >
            {deleteMutation.isPending ? (
              <>
                <Spinner />
                Deleting…
              </>
            ) : (
              "Delete"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
