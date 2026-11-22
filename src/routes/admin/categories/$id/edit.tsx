import { CategoryForm } from "@/feature/categories/components/category-form"
import { getCategory } from "@/feature/categories/api/categories"
import {
  createFileRoute,
  Link,
  notFound,
  useNavigate,
} from "@tanstack/react-router"

export const Route = createFileRoute("/admin/categories/$id/edit")({
  loader: async ({ params }) => {
    const category = await getCategory({ data: { id: params.id } })

    if (!category) {
      throw notFound()
    }

    return { category }
  },
  component: RouteComponent,
})

function RouteComponent() {
  const { category } = Route.useLoaderData()
  const navigate = useNavigate()

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <Link
          to="/admin/categories"
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          ← Back to categories
        </Link>
        <h1 className="mt-3 text-2xl font-semibold">Edit category</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Update the details for &quot;{category.name}&quot; and save your
          changes.
        </p>
      </div>

      <CategoryForm
        key={category.id}
        category={category}
        onSaved={() => {
          void navigate({ to: "/admin/categories" })
        }}
      />
    </div>
  )
}
