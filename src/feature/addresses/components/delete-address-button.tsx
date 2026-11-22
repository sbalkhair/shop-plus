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
import { deleteAddress } from "@/feature/addresses/api/addresses"
import type { Address } from "@/types"
import { useMutation } from "@tanstack/react-query"
import { useRouter } from "@tanstack/react-router"
import { Trash2Icon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

interface DeleteAddressButtonProps {
  address: Address
}

export function DeleteAddressButton({ address }: DeleteAddressButtonProps) {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  const deleteAddressMutation = useMutation({
    mutationFn: () => deleteAddress({ data: { id: address.id } }),
    onSuccess: async () => {
      setOpen(false)
      toast.success(`"${address.label}" deleted`)
      await router.invalidate()
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Could not delete the address"
      )
    },
  })

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-destructive hover:bg-destructive/10"
            aria-label={`Delete ${address.label}`}
          />
        }
      >
        <Trash2Icon />
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this address?</AlertDialogTitle>
          <AlertDialogDescription>
            &quot;{address.label}&quot; will be removed from your saved
            addresses. Orders already placed are not affected.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteAddressMutation.isPending}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={deleteAddressMutation.isPending}
            onClick={() => deleteAddressMutation.mutate()}
          >
            {deleteAddressMutation.isPending ? (
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
