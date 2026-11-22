import { describe, expect, it } from "vitest"
import {
  addressIdSchema,
  createAddressSchema,
  deleteAddressSchema,
  setDefaultAddressSchema,
  updateAddressSchema,
} from "./schema"

const addressId = "0f8fad5b-d9cb-469f-a165-70867728950e"

const validAddress = {
  label: "Home",
  fullName: "Sara Ahmed",
  phone: "+966 50 000 0000",
  email: "sara@example.com",
  address: "123 King Fahd Road, Building 4",
  city: "Riyadh",
  state: "Riyadh Province",
  zip: "12345",
  notes: "Ring the bell twice",
  isDefault: true,
}

const parse = (input: unknown) => createAddressSchema.safeParse(input)

describe("createAddressSchema", () => {
  it("accepts a complete address", () => {
    const result = parse(validAddress)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toEqual(validAddress)
    }
  })

  it("accepts a blank optional email", () => {
    expect(parse({ ...validAddress, email: "" }).success).toBe(true)
  })

  it("rejects an invalid email", () => {
    expect(parse({ ...validAddress, email: "not-an-email" }).success).toBe(
      false
    )
  })

  it("requires a label, name, phone, and street address", () => {
    expect(parse({ ...validAddress, label: "" }).success).toBe(false)
    expect(parse({ ...validAddress, fullName: "" }).success).toBe(false)
    expect(parse({ ...validAddress, phone: "123" }).success).toBe(false)
    expect(parse({ ...validAddress, address: "A" }).success).toBe(false)
  })

  it("rejects a phone with invalid characters", () => {
    expect(parse({ ...validAddress, phone: "call-me" }).success).toBe(false)
  })

  it("trims whitespace and lowercases the email", () => {
    const result = parse({
      ...validAddress,
      label: "  Work  ",
      fullName: "  Sara Ahmed  ",
      email: "  SARA@EXAMPLE.COM  ",
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.label).toBe("Work")
      expect(result.data.fullName).toBe("Sara Ahmed")
      expect(result.data.email).toBe("sara@example.com")
    }
  })

  it("accepts optional delivery coordinates", () => {
    const result = parse({
      ...validAddress,
      latitude: 24.7136,
      longitude: 46.6753,
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.latitude).toBe(24.7136)
      expect(result.data.longitude).toBe(46.6753)
    }
  })

  it("accepts null coordinates when no pin was chosen", () => {
    expect(
      parse({ ...validAddress, latitude: null, longitude: null }).success
    ).toBe(true)
  })

  it("rejects out-of-range coordinates", () => {
    expect(parse({ ...validAddress, latitude: 91 }).success).toBe(false)
    expect(parse({ ...validAddress, latitude: -91 }).success).toBe(false)
    expect(parse({ ...validAddress, longitude: 181 }).success).toBe(false)
    expect(parse({ ...validAddress, longitude: -181 }).success).toBe(false)
  })

  it("limits notes to 500 characters", () => {
    expect(parse({ ...validAddress, notes: "a".repeat(501) }).success).toBe(
      false
    )
  })
})

describe("updateAddressSchema", () => {
  it("accepts a complete address with a UUID id", () => {
    expect(
      updateAddressSchema.safeParse({ ...validAddress, id: addressId }).success
    ).toBe(true)
  })

  it("requires a valid UUID id", () => {
    expect(updateAddressSchema.safeParse(validAddress).success).toBe(false)
    expect(
      updateAddressSchema.safeParse({ ...validAddress, id: "" }).success
    ).toBe(false)
  })
})

describe("address id schemas", () => {
  it("accepts a valid id", () => {
    expect(deleteAddressSchema.safeParse({ id: addressId }).success).toBe(true)
    expect(setDefaultAddressSchema.safeParse({ id: addressId }).success).toBe(
      true
    )
    expect(addressIdSchema.safeParse(addressId).success).toBe(true)
  })

  it("rejects malformed ids", () => {
    expect(deleteAddressSchema.safeParse({}).success).toBe(false)
    expect(
      setDefaultAddressSchema.safeParse({ id: "not-a-uuid" }).success
    ).toBe(false)
  })
})
