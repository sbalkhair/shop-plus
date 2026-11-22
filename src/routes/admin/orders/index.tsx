import { buttonVariants } from "@/components/ui/button"
import { getAdminOrderList } from "@/feature/orders/api/order-lists"
import { OrderList } from "@/feature/orders/components/order-list"
import {
  isAdminOrderTab,
  isOrderSort,
  parseOrderListPage,
  type AdminOrderTab,
  type OrderSort,
} from "@/feature/orders/list"
import { createFileRoute, Link } from "@tanstack/react-router"
import { cn } from "cn"
import { ReceiptTextIcon, StoreIcon } from "lucide-react"

interface AdminOrdersSearch {
  tab?: AdminOrderTab
  q?: string
  sort?: OrderSort
  page?: number
}

export const Route = createFileRoute("/admin/orders/")({
  validateSearch: (search: Record<string, unknown>): AdminOrdersSearch => ({
    tab: isAdminOrderTab(search.tab) ? search.tab : undefined,
    q:
      typeof search.q === "string" && search.q.trim()
        ? search.q.trim()
        : undefined,
    sort: isOrderSort(search.sort) ? search.sort : undefined,
    page: parseOrderListPage(search.page),
  }),
  loaderDeps: ({ search }) => ({
    tab: search.tab ?? "active",
    search: search.q ?? "",
    sort: search.sort ?? "priority",
    page: search.page ?? 1,
  }),
  loader: ({ deps }) => getAdminOrderList({ data: deps }),
  component: RouteComponent,
})

function RouteComponent() {
  const result = Route.useLoaderData()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()

  const activeTab = search.tab ?? "active"
  const sort = search.sort ?? "priority"
  const query = search.q ?? ""

  const updateFilters = (updates: Partial<AdminOrdersSearch>) => {
    navigate({
      search: (previous) => ({ ...previous, ...updates, page: undefined }),
      replace: true,
    })
  }

  const updatePage = (page: number) => {
    navigate({
      search: (previous) => ({ ...previous, page }),
    })
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <ReceiptTextIcon className="size-6 text-orange-500" />
            Orders
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {result.counts.all === 0 && !query
              ? "No customer orders have been placed yet."
              : `${result.counts.active} active · ${result.counts.pending} awaiting assignment · ${result.counts.assigned} assigned`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link to="/" className={cn(buttonVariants({ variant: "outline" }))}>
            <StoreIcon />
            View store
          </Link>
        </div>
      </div>

      <OrderList
        orders={result.orders}
        total={result.total}
        page={result.page}
        pageSize={result.pageSize}
        totalPages={result.totalPages}
        tabs={[
          {
            value: "active",
            label: "Active orders",
            count: result.counts.active,
          },
          {
            value: "pending",
            label: "Pending assignment",
            count: result.counts.pending,
          },
          {
            value: "assigned",
            label: "Assigned orders",
            count: result.counts.assigned,
          },
          { value: "all", label: "All orders", count: result.counts.all },
        ]}
        activeTab={activeTab}
        onTabChange={(tab) =>
          updateFilters({ tab: isAdminOrderTab(tab) ? tab : undefined })
        }
        search={query}
        onSearchChange={(value) =>
          updateFilters({ q: value.trim() || undefined })
        }
        sort={sort}
        onSortChange={(value) => updateFilters({ sort: value })}
        onPageChange={updatePage}
        showDeliveryPartner
        detailsTo="/admin/orders/$orderId"
        emptyTitle={
          query
            ? "No orders match your search"
            : activeTab === "pending"
              ? "No orders are waiting for assignment"
              : activeTab === "assigned"
                ? "No assigned orders right now"
                : activeTab === "all"
                  ? "No orders yet"
                  : "No active orders right now"
        }
        emptyDescription={
          query
            ? "Try a different order number, customer name, email, or phone."
            : "Orders placed by customers will appear here as soon as they need attention."
        }
      />
    </div>
  )
}
