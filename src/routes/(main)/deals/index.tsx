import { ListPagination } from "@/components/list-pagination"
import ProductCard from "@/components/product-card"
import { listProducts } from "@/feature/products/api/products"
import { parsePage } from "@/lib/parse-number"
import { createFileRoute } from "@tanstack/react-router"

export interface DealsSearch {
  page?: number
}

export const Route = createFileRoute("/(main)/deals/")({
  validateSearch: (search: Record<string, unknown>): DealsSearch => ({
    page: parsePage(search.page),
  }),
  loaderDeps: ({ search }) => ({ page: search.page }),
  loader: ({ deps }) =>
    listProducts({
      data: { page: deps.page, onSale: true, sort: "newest" },
    }),
  component: RouteComponent,
})

function RouteComponent() {
  const { products, page: currentPage, totalPages } = Route.useLoaderData()
  const navigate = Route.useNavigate()

  const updatePage = (nextPage: number) => {
    navigate({
      search: (prev) => ({ ...prev, page: nextPage }),
      replace: true,
    })
  }

  return (
    <div>
      <div className="rounded-2xl bg-orange-400 py-3 text-center font-semibold text-white">
        Flash Deals
      </div>

      {products.length === 0 ? (
        <p className="mt-10 text-center text-sm text-muted-foreground">
          No deals available right now.
        </p>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>

          <ListPagination
            page={currentPage}
            totalPages={totalPages}
            onPageChange={updatePage}
          />
        </>
      )}
    </div>
  )
}
