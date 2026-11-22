import { queryOptions } from "@tanstack/react-query"

import { getMyOrders } from "./orders"

interface MyOrdersQuery {
  page?: number
  status?: string
}

/**
 * Paginated customer order history. The status is part of the key so the
 * cached "All" list and each filtered tab stay independent.
 */
export const myOrdersQueryOptions = (input: MyOrdersQuery = {}) =>
  queryOptions({
    queryKey: ["orders", "mine", input.page ?? 1, input.status ?? "all"],
    queryFn: () =>
      getMyOrders({
        data: { page: input.page, status: input.status },
      }),
    // A newly placed order must appear as soon as the orders route loads.
    staleTime: 0,
  })
