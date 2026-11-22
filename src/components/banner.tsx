import { TruckIcon, XIcon, ZapIcon } from "lucide-react"
import { useEffect, useState } from "react"

const Banner = () => {
  const [isBannerVisible, setIsBannerVisible] = useState(true)

  useEffect(() => {
    if (typeof window !== "undefined") {
      const dismissed = sessionStorage.getItem("banner-dismissed") === "true"
      setIsBannerVisible(!dismissed)
    }
  }, [])

  const dismissBanner = () => {
    setIsBannerVisible(false)
    if (typeof window !== "undefined") {
      sessionStorage.setItem("banner-dismissed", "true")
    }
  }
  return (
    <div>
      {isBannerVisible && (
        <div className="relative overflow-hidden bg-primary text-xs text-white sm:text-sm">
          <div className="mx-auto flex max-w-7xl items-center justify-center gap-6 px-4 py-2 sm:px-6 lg:px-8">
            <div className="flex items-center justify-center gap-2">
              <TruckIcon className="size-4 shrink-0" />
              <span className="font-medium">
                Free delivery on address above $20
              </span>
            </div>
            <span className="hidden text-white/40 sm:inline">|</span>
            <div className="hidden items-center justify-center gap-2 sm:flex">
              <ZapIcon className="size-3.5 shrink-0 text-yellow-400" />
              <span>Farm-fresh products delivery daily</span>
            </div>
          </div>
          <button
            onClick={dismissBanner}
            className="absolute top-2.5 right-2 -translate-y-1.5 rounded-full p-1 transition-colors hover:bg-white/10"
          >
            <XIcon className="size-3.5" />
          </button>
        </div>
      )}
    </div>
  )
}

export default Banner
