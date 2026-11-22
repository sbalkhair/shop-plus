import { describe, expect, it } from "vitest"
import {
  buildNavigationUrl,
  formatMapCoordinate,
  getShippingLocation,
  isValidMapCoordinate,
} from "./location"

describe("getShippingLocation", () => {
  it("returns a valid pin", () => {
    expect(
      getShippingLocation({ latitude: 24.7136, longitude: 46.6753 })
    ).toEqual({
      latitude: 24.7136,
      longitude: 46.6753,
    })
  })

  it("returns null when either coordinate is missing", () => {
    expect(getShippingLocation({ latitude: 24.7136 })).toBeNull()
    expect(getShippingLocation({ longitude: 46.6753 })).toBeNull()
    expect(
      getShippingLocation({ latitude: null, longitude: 46.6753 })
    ).toBeNull()
    expect(getShippingLocation({})).toBeNull()
  })

  it("returns null for missing sources", () => {
    expect(getShippingLocation(null)).toBeNull()
    expect(getShippingLocation(undefined)).toBeNull()
  })

  it("rejects out-of-range coordinates", () => {
    expect(getShippingLocation({ latitude: 91, longitude: 46 })).toBeNull()
    expect(getShippingLocation({ latitude: -91, longitude: 46 })).toBeNull()
    expect(getShippingLocation({ latitude: 24, longitude: 181 })).toBeNull()
    expect(getShippingLocation({ latitude: 24, longitude: -181 })).toBeNull()
  })

  it("rejects non-finite coordinates", () => {
    expect(getShippingLocation({ latitude: NaN, longitude: 46 })).toBeNull()
    expect(
      getShippingLocation({ latitude: 24, longitude: Infinity })
    ).toBeNull()
  })
})

describe("isValidMapCoordinate", () => {
  it("accepts the bounds", () => {
    expect(isValidMapCoordinate({ latitude: 90, longitude: 180 })).toBe(true)
    expect(isValidMapCoordinate({ latitude: -90, longitude: -180 })).toBe(true)
  })

  it("rejects null and invalid values", () => {
    expect(isValidMapCoordinate(null)).toBe(false)
    expect(isValidMapCoordinate({ latitude: 90.1, longitude: 0 })).toBe(false)
  })
})

describe("formatMapCoordinate", () => {
  it("formats coordinates with five decimal places", () => {
    expect(
      formatMapCoordinate({ latitude: 24.71355, longitude: 46.67531 })
    ).toBe("24.71355, 46.67531")
  })
})

describe("buildNavigationUrl", () => {
  it("navigates to the pin when one exists", () => {
    expect(
      buildNavigationUrl({
        latitude: 24.7136,
        longitude: 46.6753,
        address: "123 King Fahd Road",
      })
    ).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=24.7136,46.6753&travelmode=driving"
    )
  })

  it("falls back to the written address", () => {
    expect(buildNavigationUrl({ address: "123 King Fahd Road, Riyadh" })).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=123%20King%20Fahd%20Road%2C%20Riyadh&travelmode=driving"
    )
  })

  it("ignores invalid pins and uses the written address", () => {
    expect(
      buildNavigationUrl({
        latitude: 120,
        longitude: 46,
        address: "Riyadh",
      })
    ).toContain("destination=Riyadh")
  })

  it("returns null when there is no usable destination", () => {
    expect(buildNavigationUrl(null)).toBeNull()
    expect(buildNavigationUrl({})).toBeNull()
    expect(buildNavigationUrl({ address: "   " })).toBeNull()
  })
})
