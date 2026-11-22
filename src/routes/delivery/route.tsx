import { requireDriver } from "@/feature/auth/guards"
import { createFileRoute, Link, Outlet } from "@tanstack/react-router"
import { ReceiptTextIcon, StoreIcon, TruckIcon } from "lucide-react"

export const Route = createFileRoute("/delivery")({
  beforeLoad: ({ context, location }) => requireDriver(context, location.href),
  component: DriverLayout,
})

const navLinkClassName =
  "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50 hover:text-zinc-900 lg:w-full"

const activeNavLinkClassName =
  "bg-orange-50 text-orange-600 hover:bg-orange-50 hover:text-orange-600"

function DriverLayout() {
  return (
    <div className="min-h-screen bg-orange-100/20 lg:flex">
      {/* Left: driver navigation */}
      <aside className="border-b bg-white lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:shrink-0 lg:border-r lg:border-b-0">
        <div className="flex h-full flex-col">
          <div className="border-b p-4">
            <Link to="/delivery" className="flex items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-orange-500 text-white">
                <TruckIcon className="size-5" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">
                  Shop-Plus
                </span>
                <span className="block text-xs text-muted-foreground">
                  Driver portal
                </span>
              </span>
            </Link>
          </div>

          <nav
            aria-label="Driver navigation"
            className="flex gap-1 overflow-x-auto p-2 lg:flex-1 lg:flex-col lg:overflow-visible lg:p-3"
          >
            <Link
              to="/delivery"
              activeProps={{ className: activeNavLinkClassName }}
              className={navLinkClassName}
            >
              <ReceiptTextIcon className="size-4 shrink-0" />
              Assigned orders
            </Link>
          </nav>

          <div className="hidden border-t p-3 lg:block">
            <Link to="/" className={navLinkClassName}>
              <StoreIcon className="size-4 shrink-0" />
              Back to store
            </Link>
          </div>
        </div>
      </aside>

      {/* Right: driver page content */}
      <main className="min-w-0 flex-1">
        <Outlet />
      </main>
    </div>
  )
}
