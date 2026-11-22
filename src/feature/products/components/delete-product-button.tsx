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
import { deleteProduct } from "@/feature/products/api/products"
import type { Product } from "@/types"
import { useMutation } from "@tanstack/react-query"
import { useRouter } from "@tanstack/react-router"
import { Trash2Icon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

interface DeleteProductButtonProps {
  product: Product
}

/**
 * Admin-only delete action with a confirmation step.
 *
 * The server enforces `products:delete`; this component only hides the action
 * behind the admin route and prevents accidental clicks.
 */
export function DeleteProductButton({ product }: DeleteProductButtonProps) {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  const deleteProductMutation = useMutation({
    mutationFn: () => deleteProduct({ data: { id: product.id } }),
    onSuccess: async () => {
      setOpen(false)
      toast.success(`"${product.name}" deleted`)
      await router.invalidate()
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Could not delete the product"
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
            aria-label={`Delete ${product.name}`}
          />
        }
      >
        <Trash2Icon />
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this product?</AlertDialogTitle>
          <AlertDialogDescription>
            &quot;{product.name}&quot; will be permanently removed from the
            catalogue. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteProductMutation.isPending}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={deleteProductMutation.isPending}
            onClick={() => deleteProductMutation.mutate()}
          >
            {deleteProductMutation.isPending ? (
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
