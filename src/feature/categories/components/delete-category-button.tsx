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
import { deleteCategory } from "@/feature/categories/api/categories"
import type { Category } from "@/types"
import { useMutation } from "@tanstack/react-query"
import { useRouter } from "@tanstack/react-router"
import { Trash2Icon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

interface DeleteCategoryButtonProps {
  category: Category
}

/**
 * Admin-only delete action with a confirmation step.
 *
 * The server enforces `categories:delete` and refuses to delete a category that
 * still has products. This component only prevents accidental clicks.
 */
export function DeleteCategoryButton({ category }: DeleteCategoryButtonProps) {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  const deleteCategoryMutation = useMutation({
    mutationFn: () => deleteCategory({ data: { id: category.id } }),
    onSuccess: async () => {
      setOpen(false)
      toast.success(`"${category.name}" deleted`)
      await router.invalidate()
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Could not delete the category"
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
            aria-label={`Delete ${category.name}`}
          />
        }
      >
        <Trash2Icon />
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this category?</AlertDialogTitle>
          <AlertDialogDescription>
            &quot;{category.name}&quot; will be permanently removed. Categories
            that still have products cannot be deleted.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteCategoryMutation.isPending}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={deleteCategoryMutation.isPending}
            onClick={() => deleteCategoryMutation.mutate()}
          >
            {deleteCategoryMutation.isPending ? (
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
