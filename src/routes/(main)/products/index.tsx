import { ListPagination } from "@/components/list-pagination"
import ProductCard from "@/components/product-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { getCategories } from "@/feature/categories/api/categories"
import { listProducts } from "@/feature/products/api/products"
import {
  MAX_PRODUCT_CATEGORY_LENGTH,
  MAX_PRODUCT_PRICE,
} from "@/feature/products/schema"
import { parseNumber, parsePage } from "@/lib/parse-number"
import { createFileRoute } from "@tanstack/react-router"
import { cn } from "cn"
import { FilterXIcon } from "lucide-react"

const SORT_OPTIONS = [
  { value: "featured", label: "Featured" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
  { value: "rating", label: "Top Rated" },
  { value: "newest", label: "Newest" },
] as const

type SortOption = (typeof SORT_OPTIONS)[number]["value"]

interface ProductSearch {
  category?: string
  organic?: boolean
  sort?: SortOption
  page?: number
  minPrice?: number
  maxPrice?: number
}

const isSortOption = (value: unknown): value is SortOption =>
  SORT_OPTIONS.some((option) => option.value === value)

/** Drops price filters the server schema would reject. */
const parsePrice = (value: unknown) => {
  const price = parseNumber(value)

  return price !== undefined && price >= 0 && price <= MAX_PRODUCT_PRICE
    ? price
    : undefined
}

/** Drops category filters the server schema would reject. */
const parseCategory = (value: unknown) => {
  if (typeof value !== "string") {
    return undefined
  }

  const category = value.trim()

  return category !== "" && category.length <= MAX_PRODUCT_CATEGORY_LENGTH
    ? category
    : undefined
}

export const Route = createFileRoute("/(main)/products/")({
  validateSearch: (search: Record<string, unknown>): ProductSearch => ({
    category: parseCategory(search.category),
    organic:
      search.organic === true || search.organic === "true" ? true : undefined,

    sort: isSortOption(search.sort) ? search.sort : undefined,
    page: parsePage(search.page),
    minPrice: parsePrice(search.minPrice),
    maxPrice: parsePrice(search.maxPrice),
  }),
  loaderDeps: ({ search }) => ({
    category: search.category,
    organic: search.organic,
    sort: search.sort,
    page: search.page,
    minPrice: search.minPrice,
    maxPrice: search.maxPrice,
  }),
  loader: async ({ deps }) => {
    const [result, categories] = await Promise.all([
      listProducts({ data: deps }),
      getCategories(),
    ])

    return { ...result, categories }
  },
  component: RouteComponent,
})

function RouteComponent() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const {
    products,
    categories,
    total,
    page: currentPage,
    totalPages,
    categoryCounts,
    totalProducts,
  } = Route.useLoaderData()

  const { category, organic, sort = "featured", minPrice, maxPrice } = search

  const updateFilters = (updates: Partial<ProductSearch>) => {
    navigate({
      search: (prev) => ({ ...prev, ...updates, page: undefined }),
      replace: true,
    })
  }

  const updatePage = (nextPage: number) => {
    navigate({
      search: (prev) => ({ ...prev, page: nextPage }),
      replace: true,
    })
  }

  const selectCategory = (nextCategory?: string) => {
    navigate({
      search: (prev) => ({ ...prev, category: nextCategory, page: undefined }),
      replace: true,
    })
  }

  const categoryName = categories.find((item) => item.slug === category)?.name

  const hasFilters = Boolean(
    category ||
    organic ||
    sort ||
    minPrice !== undefined ||
    maxPrice !== undefined
  )

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <div>
        <h1 className="text-2xl font-semibold">
          {categoryName ?? "All Products"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Browse the Shop-Plus catalogue
        </p>
      </div>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[260px_1fr]">
        {/* Sidebar: categories + filters */}
        <aside className="space-y-4">
          <div className="rounded-2xl border bg-white p-4">
            <h2 className="text-sm font-semibold">Categories</h2>
            <ul className="mt-3 space-y-0.5">
              <li>
                <button
                  type="button"
                  onClick={() => selectCategory(undefined)}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
                    !category
                      ? "bg-orange-50 font-medium text-orange-500"
                      : "text-zinc-600 hover:bg-zinc-50"
                  )}
                >
                  <span className="truncate">All Products</span>
                  <span
                    className={cn(
                      "text-xs",
                      !category ? "text-orange-400" : "text-muted-foreground"
                    )}
                  >
                    {totalProducts}
                  </span>
                </button>
              </li>
              {categories.map((item) => {
                const active = item.slug === category
                return (
                  <li key={item.slug}>
                    <button
                      type="button"
                      onClick={() => selectCategory(item.slug)}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
                        active
                          ? "bg-orange-50 font-medium text-orange-500"
                          : "text-zinc-600 hover:bg-zinc-50"
                      )}
                    >
                      <span className="truncate">{item.name}</span>
                      <span
                        className={cn(
                          "text-xs",
                          active ? "text-orange-400" : "text-muted-foreground"
                        )}
                      >
                        {categoryCounts[item.slug] ?? 0}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>

          <div className="space-y-4 rounded-2xl border bg-white p-4">
            <h2 className="text-sm font-semibold">Filters</h2>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="min-price">Min price</Label>
                <Input
                  id="min-price"
                  type="number"
                  min={0}
                  placeholder="0"
                  value={minPrice ?? ""}
                  onChange={(event) =>
                    updateFilters({
                      minPrice:
                        event.target.value === ""
                          ? undefined
                          : Number(event.target.value),
                    })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="max-price">Max price</Label>
                <Input
                  id="max-price"
                  type="number"
                  min={0}
                  placeholder="Any"
                  value={maxPrice ?? ""}
                  onChange={(event) =>
                    updateFilters({
                      maxPrice:
                        event.target.value === ""
                          ? undefined
                          : Number(event.target.value),
                    })
                  }
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2">
              <Label htmlFor="organic" className="text-sm font-normal">
                Organic only
              </Label>
              <Switch
                id="organic"
                checked={organic ?? false}
                onCheckedChange={(checked) =>
                  updateFilters({ organic: checked ? true : undefined })
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label>Sort by</Label>
              <Select
                value={sort}
                onValueChange={(value) =>
                  updateFilters({
                    sort:
                      isSortOption(value) && value !== "featured"
                        ? value
                        : undefined,
                  })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Featured" />
                </SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </aside>

        {/* Results */}
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              {total} product{total === 1 ? "" : "s"}
            </p>
            {hasFilters && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => navigate({ search: {}, replace: true })}
              >
                <FilterXIcon />
                Clear all filters
              </Button>
            )}
          </div>

          {products.length === 0 ? (
            <p className="mt-10 text-center text-sm text-muted-foreground">
              No products match your filters.
            </p>
          ) : (
            <>
              <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
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
      </div>
    </div>
  )
}
