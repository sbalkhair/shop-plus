import type { Category } from "@/types"
import { Link } from "@tanstack/react-router"

interface HomeCategoriesProps {
  categories: Category[]
}

const HomeCategories = ({ categories }: HomeCategoriesProps) => {
  if (categories.length === 0) {
    return null
  }

  return (
    <section className="py-5">
      <div>
        <h2 className="text-2xl font-semibold">Browse Categories</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Find exactly what you need using
        </p>
      </div>
      <div className="mt-8 no-scrollbar flex items-center overflow-x-scroll rounded-2xl bg-orange-500/10">
        {categories.map((category) => (
          <Link
            to="/products"
            search={{ category: category.slug }}
            key={category.id}
            onClick={() => window.scrollTo(0, 0)}
            className="group flex flex-col items-center gap-3 p-4"
          >
            <div className="size-18 overflow-hidden rounded-2xl bg-orange-200/70 ring-orange-300/75 transition-all group-hover:ring-2 sm:size-26 sm:p-2">
              <img
                src={category.image || "/placeholder.svg"}
                alt={category.name}
                className="h-full w-full rounded-full object-contain transition-all"
              />
            </div>
            <span className="text-center text-xs leading-tight font-medium text-zinc-600">
              {category.name}
            </span>
          </Link>
        ))}
      </div>
    </section>
  )
}

export default HomeCategories
