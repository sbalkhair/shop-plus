import ProductCard from "@/components/product-card"
import { popularProductsQueryOptions } from "@/feature/home/api/popular-products"
import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { ArrowRightIcon } from "lucide-react"

const PopularProducts = () => {
  const {
    data: products = [],
    isPending,
    isError,
  } = useQuery(popularProductsQueryOptions)

  if (isPending) {
    return (
      <section className="py-5">
        <p className="text-sm text-muted-foreground">Loading products...</p>
      </section>
    )
  }

  if (isError) {
    return (
      <section className="py-5">
        <p className="text-sm text-destructive">Failed to load products.</p>
      </section>
    )
  }

  return (
    <section className="py-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Popular Products</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Most loved products from our customers
          </p>
        </div>
        <Link
          to="/products"
          className="flex items-center justify-end gap-1 text-sm font-semibold text-orange-500 transition-colors hover:text-orange-700"
        >
          View All
          <ArrowRightIcon className="size-4" />
        </Link>
      </div>
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {products.map((product) => (
          <ProductCard product={product} key={product.id} />
        ))}
      </div>
      <Link
        to="/products"
        className="mt-5 flex items-center justify-end gap-1 text-sm font-semibold text-orange-500 transition-colors hover:text-orange-700"
      >
        View All
        <ArrowRightIcon className="size-4" />
      </Link>
    </section>
  )
}

export default PopularProducts
