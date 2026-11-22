import { ListPagination } from "@/components/list-pagination"
import { buttonVariants } from "@/components/ui/button"
import { requireCustomer } from "@/feature/auth/guards"
import { myOrdersQueryOptions } from "@/feature/orders/api/orders-query"
import { OrderCard } from "@/feature/orders/components/order-card"
import {
  ALL_ORDER_STATUSES,
  OrderStatusTabs,
} from "@/feature/orders/components/order-status-tabs"
import { MAX_ORDER_STATUS_LENGTH } from "@/feature/orders/schema"
import { parsePage } from "@/lib/parse-number"
import { createFileRoute, Link } from "@tanstack/react-router"
import { cn } from "cn"
import { MapPinnedIcon, ReceiptTextIcon, ShoppingBagIcon } from "lucide-react"

interface OrdersSearch {
  page?: number
  status?: string
}

/** Drops status filters the server schema would reject. */
const parseStatus = (value: unknown) => {
  if (typeof value !== "string") {
    return undefined
  }

  const status = value.trim()

  return status !== "" &&
    status !== ALL_ORDER_STATUSES &&
    status.length <= MAX_ORDER_STATUS_LENGTH
    ? status
    : undefined
}

export const Route = createFileRoute("/(main)/(protected)/orders/")({
  beforeLoad: ({ context, location }) =>
    requireCustomer(context, location.href),
  validateSearch: (search: Record<string, unknown>): OrdersSearch => ({
    page: parsePage(search.page),
    status: parseStatus(search.status),
  }),
  loaderDeps: ({ search }) => ({ page: search.page, status: search.status }),
  loader: ({ context, deps }) =>
    context.queryClient.ensureQueryData(myOrdersQueryOptions(deps)),
  component: RouteComponent,
})

function RouteComponent() {
  const { orders, total, page, totalPages, statusCounts } =
    Route.useLoaderData()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const status = search.status ?? ALL_ORDER_STATUSES

  const setStatus = (nextStatus: string) => {
    navigate({
      search: (prev) => ({
        ...prev,
        status: nextStatus === ALL_ORDER_STATUSES ? undefined : nextStatus,
        page: undefined,
      }),
      replace: true,
    })
  }

  const updatePage = (nextPage: number) => {
    navigate({
      search: (prev) => ({ ...prev, page: nextPage }),
      replace: true,
    })
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <ReceiptTextIcon className="size-6 text-orange-500" />
            My orders
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {total === 0
              ? "You have not placed any orders yet."
              : `${total} order${total === 1 ? "" : "s"} placed with Shop-Plus.`}
          </p>
        </div>

        <Link
          to="/products"
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          <ShoppingBagIcon />
          Continue shopping
        </Link>
      </div>

      {total === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed bg-white p-10 text-center">
          <ReceiptTextIcon className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium">No orders yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            When you place an order, it will appear here with its status and
            payment details.
          </p>
          <Link to="/products" className={cn(buttonVariants(), "mt-4")}>
            Start shopping
          </Link>
        </div>
      ) : (
        <>
          <OrderStatusTabs
            counts={statusCounts}
            total={total}
            value={status}
            onChange={setStatus}
          />

          {orders.length === 0 ? (
            <p className="mt-10 text-center text-sm text-muted-foreground">
              No orders with the “{status}” status.
            </p>
          ) : (
            <div className="mt-4 space-y-4">
              {orders.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  actions={
                    <Link
                      to="/order-tracking/$orderId"
                      params={{ orderId: order.id }}
                      className={cn(
                        buttonVariants({ variant: "outline", size: "sm" })
                      )}
                    >
                      <MapPinnedIcon />
                      Track order
                    </Link>
                  }
                />
              ))}
            </div>
          )}

          <ListPagination
            page={page}
            totalPages={totalPages}
            onPageChange={updatePage}
          />
        </>
      )}
    </div>
  )
}
