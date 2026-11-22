import { Button } from "@/components/ui/button"
import type * as Leaflet from "leaflet"
import { LocateFixedIcon, XIcon } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { cn } from "cn"
import "leaflet/dist/leaflet.css"
import { DEFAULT_MAP_CENTER, type MapCoordinate } from "../location"

type LeafletModule = typeof Leaflet

const OPEN_STREET_MAP_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

const PIN_HTML =
  '<span style="display:block;width:28px;height:28px;border-radius:9999px;background:#f97316;border:3px solid #fff;box-shadow:0 2px 8px rgba(15,23,42,0.45)"></span>'

/**
 * Leaflet ships a UMD bundle, so Vite exposes it as a default export at
 * runtime while the TypeScript types use named exports. Normalizing here keeps
 * the rest of the component typed and browser-only.
 */
const loadLeaflet = async (): Promise<LeafletModule> => {
  const module = await import("leaflet")

  return (
    (module as LeafletModule & { default?: LeafletModule }).default ?? module
  )
}

const createPinIcon = (leaflet: LeafletModule): Leaflet.DivIcon =>
  leaflet.divIcon({
    className: "",
    html: PIN_HTML,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  })

const placeMarker = (
  leaflet: LeafletModule,
  map: Leaflet.Map,
  existing: Leaflet.Marker | null,
  coordinate: MapCoordinate,
  options: {
    interactive: boolean
    onChange: (coordinate: MapCoordinate) => void
  }
): Leaflet.Marker => {
  const latlng: Leaflet.LatLngTuple = [
    coordinate.latitude,
    coordinate.longitude,
  ]

  if (existing) {
    existing.setLatLng(latlng)
    return existing
  }

  const marker = leaflet.marker(latlng, {
    draggable: options.interactive,
    icon: createPinIcon(leaflet),
    keyboard: false,
  })

  if (options.interactive) {
    marker.on("dragend", () => {
      const position = marker.getLatLng()

      options.onChange({
        latitude: position.lat,
        longitude: position.lng,
      })
    })
  }

  marker.addTo(map)

  return marker
}

export interface DeliveryLocationMapProps {
  value: MapCoordinate | null
  /**
   * Makes the map interactive. The customer can click the map, drag the pin,
   * or use their device location. Omit it for a read-only preview.
   */
  onChange?: (coordinate: MapCoordinate) => void
  /** Shows a "remove pin" control when supplied. */
  onClear?: () => void
  className?: string
}

/**
 * Client-only Leaflet wrapper. Leaflet touches `window` on import, so the
 * library is loaded inside an effect and never during server rendering.
 */
export function DeliveryLocationMap({
  value,
  onChange,
  onClear,
  className,
}: DeliveryLocationMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<Leaflet.Map | null>(null)
  const markerRef = useRef<Leaflet.Marker | null>(null)
  const leafletRef = useRef<LeafletModule | null>(null)
  const onChangeRef = useRef(onChange)
  const valueRef = useRef(value)
  const interactive = Boolean(onChange)
  const interactiveRef = useRef(interactive)
  const [locating, setLocating] = useState(false)
  const latitude = value?.latitude ?? null
  const longitude = value?.longitude ?? null

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    valueRef.current = value
  }, [value])

  useEffect(() => {
    interactiveRef.current = interactive
  }, [interactive])

  useEffect(() => {
    const container = containerRef.current

    if (!container) {
      return
    }

    let disposed = false
    let resizeObserver: ResizeObserver | null = null

    const initialize = async () => {
      const leaflet = await loadLeaflet()

      if (disposed || mapRef.current || !containerRef.current) {
        return
      }

      leafletRef.current = leaflet

      const initial = valueRef.current
      const center = initial ?? DEFAULT_MAP_CENTER
      const map = leaflet.map(container, {
        center: [center.latitude, center.longitude],
        zoom: initial ? 16 : 12,
        scrollWheelZoom: false,
      })

      leaflet
        .tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: OPEN_STREET_MAP_ATTRIBUTION,
          maxZoom: 19,
        })
        .addTo(map)

      if (initial) {
        markerRef.current = placeMarker(leaflet, map, null, initial, {
          interactive: interactiveRef.current,
          onChange: (coordinate) => onChangeRef.current?.(coordinate),
        })
      }

      if (interactiveRef.current) {
        map.on("click", (event: Leaflet.LeafletMouseEvent) => {
          const coordinate = {
            latitude: event.latlng.lat,
            longitude: event.latlng.lng,
          }

          markerRef.current = placeMarker(
            leaflet,
            map,
            markerRef.current,
            coordinate,
            {
              interactive: true,
              onChange: (next) => onChangeRef.current?.(next),
            }
          )
          onChangeRef.current?.(coordinate)
        })
      }

      mapRef.current = map

      if (typeof ResizeObserver !== "undefined") {
        resizeObserver = new ResizeObserver(() => map.invalidateSize())
        resizeObserver.observe(container)
      }
    }

    void initialize()

    return () => {
      disposed = true
      resizeObserver?.disconnect()
      mapRef.current?.remove()
      mapRef.current = null
      markerRef.current = null
      leafletRef.current = null
    }
  }, [])

  // Keep the pin in sync with the form value (saved-address switches, cleared
  // pin, device location). Panning only happens when the pin would be off
  // screen, so dragging the marker does not fight the user.
  useEffect(() => {
    if (latitude === null || longitude === null) {
      markerRef.current?.remove()
      markerRef.current = null
      return
    }

    const leaflet = leafletRef.current
    const map = mapRef.current

    if (!leaflet || !map) {
      return
    }

    const coordinate = { latitude, longitude }

    markerRef.current = placeMarker(
      leaflet,
      map,
      markerRef.current,
      coordinate,
      {
        interactive: interactiveRef.current,
        onChange: (next) => onChangeRef.current?.(next),
      }
    )

    const latlng: Leaflet.LatLngTuple = [latitude, longitude]

    if (!map.getBounds().contains(latlng)) {
      map.setView(latlng, Math.max(map.getZoom(), 14))
    }
  }, [latitude, longitude])

  const handleUseCurrentLocation = () => {
    if (!("geolocation" in navigator)) {
      toast.error("Location is not available in this browser.")
      return
    }

    setLocating(true)

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false)

        const coordinate = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }

        onChangeRef.current?.(coordinate)
        mapRef.current?.setView([coordinate.latitude, coordinate.longitude], 16)
      },
      (error) => {
        setLocating(false)
        toast.error(
          error.code === error.PERMISSION_DENIED
            ? "Location permission was denied. Drop the pin manually instead."
            : "Could not get your current location. Drop the pin manually instead."
        )
      },
      { enableHighAccuracy: true, timeout: 10_000 }
    )
  }

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border bg-muted",
        className
      )}
    >
      <div
        ref={containerRef}
        className="h-64 w-full"
        role="application"
        aria-label="Delivery location map"
      />

      {interactive && (
        <div className="absolute top-2 right-2 z-[1000] flex flex-col items-end gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleUseCurrentLocation}
            disabled={locating}
          >
            <LocateFixedIcon />
            {locating ? "Locating…" : "My location"}
          </Button>

          {value && onClear && (
            <Button type="button" size="sm" variant="outline" onClick={onClear}>
              <XIcon />
              Remove pin
            </Button>
          )}
        </div>
      )}

      {interactive && !value && (
        <p className="pointer-events-none absolute bottom-2 left-2 z-[1000] max-w-[calc(100%-1rem)] rounded-lg bg-background/90 px-2 py-1 text-xs text-muted-foreground">
          Tap the map to drop a pin on your delivery location.
        </p>
      )}
    </div>
  )
}
