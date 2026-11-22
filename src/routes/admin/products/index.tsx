import { Badge } from "@/components/ui/badge"
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
import { getProducts } from "@/feature/products/api/products"
import { DeleteProductButton } from "@/feature/products/components/delete-product-button"
import { formatPrice } from "@/lib/pricing"
import { createFileRoute, Link } from "@tanstack/react-router"
import { cn } from "cn"
import { PencilIcon, PlusIcon } from "lucide-react"

export const Route = createFileRoute("/admin/products/")({
  loader: async () => {
    const [products, categories] = await Promise.all([
      getProducts(),
      getCategories(),
    ])

    return { products, categories }
  },
  component: RouteComponent,
})

function RouteComponent() {
  const { products, categories } = Route.useLoaderData()

  const getCategoryName = (slug: string) =>
    categories.find((category) => category.slug === slug)?.name ?? slug

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="mt-3 text-2xl font-semibold">Manage products</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {products.length} product{products.length === 1 ? "" : "s"} in the
            catalogue.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link to="/admin/products/new" className={cn(buttonVariants())}>
            <PlusIcon />
            Add product
          </Link>
        </div>
      </div>

      {products.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed bg-white p-10 text-center">
          <p className="text-sm text-muted-foreground">
            No products yet. Add your first product to get started.
          </p>
          <Link
            to="/admin/products/new"
            className={cn(buttonVariants(), "mt-4")}
          >
            <PlusIcon />
            Add product
          </Link>
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-2xl border bg-white">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <img
                          src={product.image}
                          alt=""
                          className="size-10 shrink-0 rounded-lg object-cover"
                        />
                        <div className="min-w-0">
                          <p className="truncate font-medium">{product.name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {product.unit}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{getCategoryName(product.category)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {formatPrice(product.price)}
                        </span>
                        {product.originalPrice > product.price && (
                          <span className="text-xs text-muted-foreground line-through">
                            {formatPrice(product.originalPrice)}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          product.stock <= 0
                            ? "destructive"
                            : product.stock <= 10
                              ? "secondary"
                              : "outline"
                        }
                      >
                        {product.stock <= 0
                          ? "Out of stock"
                          : `${product.stock} in stock`}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          to="/admin/products/$id/edit"
                          params={{ id: product.id }}
                          className={cn(
                            buttonVariants({ variant: "ghost", size: "icon" })
                          )}
                          aria-label={`Edit ${product.name}`}
                        >
                          <PencilIcon />
                        </Link>
                        <DeleteProductButton product={product} />
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
