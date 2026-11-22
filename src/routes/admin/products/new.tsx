import { getCategories } from "@/feature/categories/api/categories"
import { ProductForm } from "@/feature/products/components/product-form"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"

export const Route = createFileRoute("/admin/products/new")({
  loader: () => getCategories(),
  component: RouteComponent,
})

function RouteComponent() {
  const navigate = useNavigate()
  const categories = Route.useLoaderData()

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <Link
          to="/admin/products"
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          ← Back to products
        </Link>
        <h1 className="mt-3 text-2xl font-semibold">Add a product</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload a product image and fill in the details. Only admins can access
          this page.
        </p>
      </div>

      <ProductForm
        categories={categories}
        onSaved={() => {
          void navigate({ to: "/admin/products" })
        }}
      />
    </div>
  )
}
