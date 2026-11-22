import { getCategories } from "@/feature/categories/api/categories"
import { ProductForm } from "@/feature/products/components/product-form"
import { getProduct } from "@/feature/products/api/products"
import {
  createFileRoute,
  Link,
  notFound,
  useNavigate,
} from "@tanstack/react-router"

export const Route = createFileRoute("/admin/products/$id/edit")({
  loader: async ({ params }) => {
    const [product, categories] = await Promise.all([
      getProduct({ data: { id: params.id } }),
      getCategories(),
    ])

    if (!product) {
      throw notFound()
    }

    return { product, categories }
  },
  component: RouteComponent,
})

function RouteComponent() {
  const { product, categories } = Route.useLoaderData()
  const navigate = useNavigate()

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <Link
          to="/admin/products"
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          ← Back to products
        </Link>
        <h1 className="mt-3 text-2xl font-semibold">Edit product</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Update the details for &quot;{product.name}&quot; and save your
          changes.
        </p>
      </div>

      <ProductForm
        key={product.id}
        categories={categories}
        product={product}
        onSaved={() => {
          void navigate({ to: "/admin/products" })
        }}
      />
    </div>
  )
}
