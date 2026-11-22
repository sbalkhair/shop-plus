import { requireAdmin } from "@/feature/auth/guards"
import { createFileRoute, Link, Outlet } from "@tanstack/react-router"
import {
  PackageIcon,
  ReceiptTextIcon,
  ShieldIcon,
  StoreIcon,
  TagsIcon,
  TruckIcon,
} from "lucide-react"

export const Route = createFileRoute("/admin")({
  beforeLoad: ({ context, location }) => requireAdmin(context, location.href),
  component: AdminLayout,
})

const adminNav = [
  { to: "/admin/products", label: "Products", icon: PackageIcon },
  { to: "/admin/categories", label: "Categories", icon: TagsIcon },
  { to: "/admin/orders", label: "Orders", icon: ReceiptTextIcon },
  {
    to: "/admin/delivery-partners",
    label: "Delivery partners",
    icon: TruckIcon,
  },
] as const

const navLinkClassName =
  "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50 hover:text-zinc-900 lg:w-full"

const activeNavLinkClassName =
  "bg-orange-50 text-orange-600 hover:bg-orange-50 hover:text-orange-600"

function AdminLayout() {
  return (
    <div className="min-h-screen bg-orange-100/20 lg:flex">
      {/* Left: admin navigation */}
      <aside className="border-b bg-white lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:shrink-0 lg:border-r lg:border-b-0">
        <div className="flex h-full flex-col">
          <div className="border-b p-4">
            <Link to="/admin" className="flex items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-orange-500 text-white">
                <ShieldIcon className="size-5" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">
                  Shop-Plus
                </span>
                <span className="block text-xs text-muted-foreground">
                  Admin panel
                </span>
              </span>
            </Link>
          </div>

          <nav
            aria-label="Admin navigation"
            className="flex gap-1 overflow-x-auto p-2 lg:flex-1 lg:flex-col lg:overflow-visible lg:p-3"
          >
            {adminNav.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                activeProps={{ className: activeNavLinkClassName }}
                className={navLinkClassName}
              >
                <Icon className="size-4 shrink-0" />
                {label}
              </Link>
            ))}
          </nav>

          <div className="hidden border-t p-3 lg:block">
            <Link to="/" className={navLinkClassName}>
              <StoreIcon className="size-4 shrink-0" />
              Back to store
            </Link>
          </div>
        </div>
      </aside>

      {/* Right: admin page content */}
      <main className="min-w-0 flex-1">
        <Outlet />
      </main>
    </div>
  )
}
