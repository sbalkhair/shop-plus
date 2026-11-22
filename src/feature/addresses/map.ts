import type { Address } from "@/types"

export interface AddressRow {
  id: string
  label: string
  fullName: string
  phone: string
  email: string
  address: string
  city: string
  state: string
  zip: string
  latitude: number | null
  longitude: number | null
  notes: string
  isDefault: boolean
  createdAt: Date
  updatedAt: Date
}

/**
 * Converts a Prisma address row into the client-safe shape. Dates are
 * serialized so the value survives the server-function boundary.
 */
export const mapAddress = (address: AddressRow): Address => ({
  id: address.id,
  label: address.label,
  fullName: address.fullName,
  phone: address.phone,
  email: address.email,
  address: address.address,
  city: address.city,
  state: address.state,
  zip: address.zip,
  latitude: address.latitude ?? null,
  longitude: address.longitude ?? null,
  notes: address.notes,
  isDefault: address.isDefault,
  createdAt: address.createdAt.toISOString(),
  updatedAt: address.updatedAt.toISOString(),
})
