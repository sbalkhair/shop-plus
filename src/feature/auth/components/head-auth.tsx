import { Link } from "@tanstack/react-router"
import { ShoppingBag } from "lucide-react"

const HeadAuth = () => {
  return (
    <div className="flex justify-center gap-2">
      <Link to="/" className="flex flex-col items-center gap-2 font-medium">
        <div className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <ShoppingBag className="size-5" />
        </div>
        <div className="border-b pb-10 text-4xl font-bold">
          SUPER
          <span className="text-primary">shop</span>
        </div>
      </Link>
    </div>
  )
}

export default HeadAuth
