import { buttonVariants } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getCategories } from "@/feature/categories/api/categories"
import { DeleteCategoryButton } from "@/feature/categories/components/delete-category-button"
import { createFileRoute, Link } from "@tanstack/react-router"
import { cn } from "cn"
import { PencilIcon, PlusIcon } from "lucide-react"

export const Route = createFileRoute("/admin/categories/")({
  loader: () => getCategories(),
  component: RouteComponent,
})

function RouteComponent() {
  const categories = Route.useLoaderData()

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="mt-3 text-2xl font-semibold">Manage categories</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {categories.length} categor{categories.length === 1 ? "y" : "ies"}{" "}
            in the catalogue.
          </p>
        </div>

        <Link to="/admin/categories/new" className={cn(buttonVariants())}>
          <PlusIcon />
          Add category
        </Link>
      </div>

      {categories.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed bg-white p-10 text-center">
          <p className="text-sm text-muted-foreground">
            No categories yet. Add your first category to get started.
          </p>
          <Link
            to="/admin/categories/new"
            className={cn(buttonVariants(), "mt-4")}
          >
            <PlusIcon />
            Add category
          </Link>
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-2xl border bg-white">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((category) => (
                  <TableRow key={category.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted">
                          {category.image ? (
                            <img
                              src={category.image}
                              alt=""
                              className="size-full object-cover"
                            />
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              —
                            </span>
                          )}
                        </div>
                        <p className="truncate font-medium">{category.name}</p>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {category.slug}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          to="/admin/categories/$id/edit"
                          params={{ id: category.id }}
                          className={cn(
                            buttonVariants({ variant: "ghost", size: "icon" })
                          )}
                          aria-label={`Edit ${category.name}`}
                        >
                          <PencilIcon />
                        </Link>
                        <DeleteCategoryButton category={category} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  )
}
