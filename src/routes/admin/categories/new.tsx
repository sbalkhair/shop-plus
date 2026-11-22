import { CategoryForm } from "@/feature/categories/components/category-form"
import { createFileRoute, useNavigate } from "@tanstack/react-router"

export const Route = createFileRoute("/admin/categories/new")({
  component: RouteComponent,
})

function RouteComponent() {
  const navigate = useNavigate()

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="mt-3 text-2xl font-semibold">Add a category</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Give the category a name, a URL-safe slug, and an optional image. Only
          admins can access this page.
        </p>
      </div>

      <CategoryForm
        onSaved={() => {
          void navigate({ to: "/admin/categories" })
        }}
      />
    </div>
  )
}
