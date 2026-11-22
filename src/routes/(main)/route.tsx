import Banner from "@/components/banner"
import Footer from "@/components/footer"
import Navbar from "@/components/navbar"
import { createFileRoute, Outlet } from "@tanstack/react-router"

export const Route = createFileRoute("/(main)")({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div className="flex min-h-screen flex-col">
      <Banner />
      <Navbar />
      <main className="mx-auto w-full max-w-7xl flex-1 px-2 sm:px-6 lg:px-8">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
