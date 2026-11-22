import { getDeliveryOrderList } from "@/feature/orders/api/order-lists"
import { OrderList } from "@/feature/orders/components/order-list"
import {
  isDeliveryOrderTab,
  isOrderSort,
  parseOrderListPage,
  type DeliveryOrderTab,
  type OrderSort,
} from "@/feature/orders/list"
import { createFileRoute } from "@tanstack/react-router"
import { ClipboardListIcon } from "lucide-react"

interface DeliveryOrdersSearch {
  tab?: DeliveryOrderTab
  q?: string
  sort?: OrderSort
  page?: number
}

export const Route = createFileRoute("/delivery/")({
  validateSearch: (search: Record<string, unknown>): DeliveryOrdersSearch => ({
    tab: isDeliveryOrderTab(search.tab) ? search.tab : undefined,
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
  loader: ({ deps }) => getDeliveryOrderList({ data: deps }),
  component: RouteComponent,
})

function RouteComponent() {
  const result = Route.useLoaderData()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()

  const activeTab = search.tab ?? "active"
  const sort = search.sort ?? "priority"
  const query = search.q ?? ""

  const updateFilters = (updates: Partial<DeliveryOrdersSearch>) => {
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
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <ClipboardListIcon className="size-6 text-orange-500" />
            Assigned orders
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {result.counts.all === 0 && !query
              ? "No orders are assigned to you right now."
              : `${result.counts.active} active · ${result.counts.ready} ready for delivery · ${result.counts.out} out for delivery`}
          </p>
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
            value: "ready",
            label: "Ready for delivery",
            count: result.counts.ready,
          },
          {
            value: "out",
            label: "Out for delivery",
            count: result.counts.out,
          },
          { value: "all", label: "All orders", count: result.counts.all },
        ]}
        activeTab={activeTab}
        onTabChange={(tab) =>
          updateFilters({ tab: isDeliveryOrderTab(tab) ? tab : undefined })
        }
        search={query}
        onSearchChange={(value) =>
          updateFilters({ q: value.trim() || undefined })
        }
        sort={sort}
        onSortChange={(value) => updateFilters({ sort: value })}
        onPageChange={updatePage}
        detailsTo="/delivery/$orderId"
        emptyTitle={
          query
            ? "No orders match your search"
            : activeTab === "ready"
              ? "Nothing ready for delivery"
              : activeTab === "out"
                ? "No orders are out for delivery"
                : activeTab === "all"
                  ? "No orders assigned to you yet"
                  : "Nothing to deliver right now"
        }
        emptyDescription={
          query
            ? "Try a different order number, customer name, email, or phone."
            : "Orders assigned to you by the store will appear here."
        }
      />
    </div>
  )
}
