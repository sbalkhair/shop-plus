/**
 * Shared helpers for the delivery-location pin. Coordinates are optional: an
 * order can always fall back to the written delivery address, so every helper
 * here treats missing/invalid coordinates as "no pin" instead of throwing.
 */
export interface MapCoordinate {
  latitude: number
  longitude: number
}

/** Anything that may carry a pin: saved addresses and order shipping addresses. */
export interface CoordinateSource {
  latitude?: number | null
  longitude?: number | null
}

export interface NavigationTarget extends CoordinateSource {
  address?: string | null
}

/**
 * Fallback view used before a customer drops a pin. There is no geocoding in
 * the app, so the picker starts on a neutral city centre and lets the customer
 * move the pin (or use their device location).
 */
export const DEFAULT_MAP_CENTER: MapCoordinate = {
  latitude: 24.7136,
  longitude: 46.6753,
}

export const isValidMapCoordinate = (
  coordinate: MapCoordinate | null | undefined
): coordinate is MapCoordinate => {
  if (!coordinate) {
    return false
  }

  const { latitude, longitude } = coordinate

  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  )
}

/** Returns the pin only when both coordinates are present and in range. */
export const getShippingLocation = (
  source: CoordinateSource | null | undefined
): MapCoordinate | null => {
  if (!source) {
    return null
  }

  const { latitude, longitude } = source

  if (typeof latitude !== "number" || typeof longitude !== "number") {
    return null
  }

  const coordinate = { latitude, longitude }

  return isValidMapCoordinate(coordinate) ? coordinate : null
}

export const formatMapCoordinate = (coordinate: MapCoordinate): string =>
  `${coordinate.latitude.toFixed(5)}, ${coordinate.longitude.toFixed(5)}`

/**
 * Builds a Google Maps directions link. Drivers get turn-by-turn navigation on
 * their phone; when the customer did not pin a location we navigate to the
 * written address instead of losing the action entirely.
 */
export const buildNavigationUrl = (
  target: NavigationTarget | null | undefined
): string | null => {
  if (!target) {
    return null
  }

  const coordinate = getShippingLocation(target)

  if (coordinate) {
    return `https://www.google.com/maps/dir/?api=1&destination=${coordinate.latitude},${coordinate.longitude}&travelmode=driving`
  }

  const address = target.address?.trim()

  if (!address) {
    return null
  }

  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}&travelmode=driving`
}
