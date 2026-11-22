import ProductCard from "@/components/product-card"
import { Badge } from "@/components/ui/badge"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { getCategories } from "@/feature/categories/api/categories"
import { getProduct, listProducts } from "@/feature/products/api/products"
import { useCartStore } from "@/store"
import { createFileRoute, Link, notFound } from "@tanstack/react-router"
import { cn } from "cn"
import {
  CheckIcon,
  Minus,
  Plus,
  SaudiRiyal,
  ShieldCheckIcon,
  ShoppingCart,
  Star,
  TruckIcon,
} from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

export const Route = createFileRoute("/(main)/products/$id/")({
  loader: async ({ params }) => {
    const [product, categories] = await Promise.all([
      getProduct({ data: { id: params.id } }),
      getCategories(),
    ])

    if (!product) {
      throw notFound()
    }

    const relatedProducts = (
      await listProducts({
        data: {
          category: product.category,
          excludeId: product.id,
          pageSize: 4,
        },
      })
    ).products

    const categoryName =
      categories.find((item) => item.slug === product.category)?.name ??
      product.category

    return { product, relatedProducts, categoryName }
  },
  component: RouteComponent,
})

function RouteComponent() {
  const { product, relatedProducts, categoryName } = Route.useLoaderData()
  const addToCart = useCartStore((state) => state.addToCart)
  const [quantity, setQuantity] = useState(1)

  const isOutOfStock = product.stock <= 0
  const maxQuantity = Math.max(1, product.stock)
  const currentQuantity = Math.min(quantity, maxQuantity)
  const filledStars = Math.round(product.rating)

  const handleAddToCart = () => {
    if (isOutOfStock) {
      return
    }

    Array.from({ length: currentQuantity }).forEach(() =>
      addToCart({ ...product, quantity: 1 })
    )
    toast.success(`${currentQuantity} × ${product.name} added to cart`)
  }

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <Link to="/" className="transition-colors hover:text-foreground">
              Home
            </Link>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <Link
              to="/products"
              className="transition-colors hover:text-foreground"
            >
              Products
            </Link>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <Link
              to="/products"
              search={{ category: product.category }}
              className="transition-colors hover:text-foreground"
            >
              {categoryName}
            </Link>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage className="line-clamp-1">
              {product.name}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="mt-6 grid gap-8 lg:grid-cols-2">
        <div className="overflow-hidden rounded-3xl border bg-white">
          <div className="relative aspect-square bg-orange-50">
            <img
              src={product.image}
              alt={product.name}
              className="h-full w-full object-cover"
            />
            <div className="absolute top-4 left-4 flex flex-wrap gap-2">
              {product.discount > 0 && (
                <Badge className="bg-orange-500">-{product.discount}%</Badge>
              )}
              {product.isOrganic && (
                <Badge className="bg-green-100 text-green-600">Organic</Badge>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="secondary">{categoryName}</Badge>
              {product.unit && <span>{product.unit}</span>}
            </div>

            <h1 className="mt-3 text-3xl font-semibold tracking-tight">
              {product.name}
            </h1>

            <div className="mt-3 flex items-center gap-2 text-sm">
              <div className="flex items-center gap-0.5">
                {Array.from({ length: 5 }, (_, index) => (
                  <Star
                    key={index}
                    className={cn(
                      "size-4",
                      index < filledStars
                        ? "fill-yellow-400 text-yellow-400"
                        : "text-zinc-300"
                    )}
                  />
                ))}
              </div>
              <span className="font-medium">{product.rating.toFixed(1)}</span>
              <span className="text-muted-foreground">
                ({product.reviewCount} reviews)
              </span>
            </div>
          </div>

          {product.description && (
            <p className="text-sm leading-6 text-muted-foreground">
              {product.description}
            </p>
          )}

          <div className="rounded-2xl border bg-white p-4">
            <div className="flex flex-wrap items-end gap-2">
              <span className="flex items-center gap-1 text-3xl font-bold text-orange-500">
                <SaudiRiyal className="size-6" />
                {product.price}
              </span>
              {product.originalPrice > product.price && (
                <span className="flex items-center gap-0.5 pb-1 text-sm text-muted-foreground line-through">
                  <SaudiRiyal className="size-3.5" />
                  {product.originalPrice}
                </span>
              )}
              {product.discount > 0 && (
                <Badge className="mb-1 bg-green-100 text-green-600">
                  Save {product.discount}%
                </Badge>
              )}
            </div>

            <div className="mt-3 flex items-center gap-2 text-sm">
              {isOutOfStock ? (
                <span className="font-medium text-destructive">
                  Out of stock
                </span>
              ) : (
                <>
                  <CheckIcon className="size-4 text-green-600" />
                  <span className="font-medium text-green-600">In stock</span>
                  {product.stock <= 10 && (
                    <span className="text-muted-foreground">
                      · Only {product.stock} left
                    </span>
                  )}
                </>
              )}
            </div>

            <Separator className="my-4" />

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex w-fit items-center rounded-xl border p-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setQuantity(Math.max(1, currentQuantity - 1))}
                  disabled={currentQuantity <= 1 || isOutOfStock}
                  aria-label="Decrease quantity"
                >
                  <Minus />
                </Button>
                <span className="w-8 text-center text-sm font-medium">
                  {currentQuantity}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    setQuantity(Math.min(maxQuantity, currentQuantity + 1))
                  }
                  disabled={currentQuantity >= maxQuantity || isOutOfStock}
                  aria-label="Increase quantity"
                >
                  <Plus />
                </Button>
              </div>

              <Button
                size="lg"
                className="flex-1 rounded-xl bg-orange-500 hover:bg-orange-600"
                onClick={handleAddToCart}
                disabled={isOutOfStock}
              >
                <ShoppingCart />
                {isOutOfStock ? "Out of stock" : "Add to cart"}
              </Button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-start gap-3 rounded-2xl border bg-white p-4">
              <TruckIcon className="mt-0.5 size-5 shrink-0 text-orange-500" />
              <div>
                <p className="text-sm font-medium">Free delivery</p>
                <p className="text-xs text-muted-foreground">
                  On orders over SR 20
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-2xl border bg-white p-4">
              <ShieldCheckIcon className="mt-0.5 size-5 shrink-0 text-orange-500" />
              <div>
                <p className="text-sm font-medium">Secure payment</p>
                <p className="text-xs text-muted-foreground">
                  Safe and protected checkout
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {relatedProducts.length > 0 && (
        <section className="mt-12">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-2xl font-semibold">You may also like</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                More from {categoryName}
              </p>
            </div>
            <Link
              to="/products"
              search={{ category: product.category }}
              className="text-sm font-semibold text-orange-500 transition-colors hover:text-orange-700"
            >
              View all
            </Link>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {relatedProducts.map((item) => (
              <ProductCard key={item.id} product={item} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
