import { listProducts } from "@/feature/products/api/products"
import type { Product } from "@/types"
import { queryOptions } from "@tanstack/react-query"

export const popularProductsQueryOptions = queryOptions({
  queryKey: ["products", "popular"],
  queryFn: async (): Promise<Product[]> =>
    (await listProducts({ data: { pageSize: 8, sort: "newest" } })).products,
})
