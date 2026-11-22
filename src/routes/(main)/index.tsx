import { getCategories } from "@/feature/categories/api/categories"
import Features from "@/feature/home/components/features"
import Hero from "@/feature/home/components/hero"
import HomeCategories from "@/feature/home/components/home-categories"
import PopularProducts from "@/feature/home/components/popular-products"
import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/(main)/")({
  loader: () => getCategories(),
  component: App,
})

function App() {
  const categories = Route.useLoaderData()

  return (
    <div className="space-y-10">
      <Hero />
      <Features />
      <HomeCategories categories={categories} />
      <PopularProducts />
    </div>
  )
}
