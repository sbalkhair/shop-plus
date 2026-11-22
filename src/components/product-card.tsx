import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useCartStore } from "@/store"
import type { Product } from "@/types"
import { Link } from "@tanstack/react-router"
import { Plus, SaudiRiyal, Star } from "lucide-react"

interface ProductProp {
  product: Product
}

const ProductCard = ({ product }: ProductProp) => {
  const addToCart = useCartStore((state) => state.addToCart)

  const handleAddToCart = () => {
    addToCart({ ...product, quantity: 1 })
  }

  return (
    <div className="group animate-in cursor-pointer overflow-hidden rounded-2xl bg-white shadow transition-all duration-300 fade-in hover:shadow-2xs">
      <Link to="/products/$id" params={{ id: product.id }} className="block">
        <div className="relative aspect-square overflow-hidden bg-orange-50">
          <img
            src={product.image}
            alt={product.name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
          {product.discount > 0 && (
            <Badge className="absolute top-2 left-2 bg-orange-500">
              -{product.discount}%
            </Badge>
          )}
          {product.isOrganic && (
            <Badge className="absolute top-2 right-2 bg-green-100 text-green-500">
              Organic
            </Badge>
          )}
        </div>
        <div className="space-y-1 p-3 pb-0">
          <p className="line-clamp-1 text-sm font-medium">{product.name}</p>
          <p className="text-xs text-muted-foreground">{product.unit}</p>
          <div className="flex items-center gap-1 text-xs text-zinc-500">
            <Star className="size-3 fill-yellow-400 text-yellow-400" />
            <span>{product.rating}</span>
            <span>({product.reviewCount})</span>
          </div>
        </div>
      </Link>

      <div className="flex items-center justify-between gap-2 p-3 pt-2">
        <div className="flex items-baseline gap-1.5">
          <span className="text-sm font-semibold">
            <span className="flex gap-1">
              <SaudiRiyal className="size-4" />
              {product.price}
            </span>
          </span>
          {product.originalPrice > product.price && (
            <span className="text-xs text-muted-foreground line-through">
              {product.originalPrice}
            </span>
          )}
        </div>
        <Button
          className="rounded-full"
          type="button"
          size="icon-lg"
          onClick={handleAddToCart}
          disabled={product.stock <= 0}
          aria-label={`Add ${product.name} to cart`}
        >
          <Plus />
        </Button>
      </div>
    </div>
  )
}

export default ProductCard
