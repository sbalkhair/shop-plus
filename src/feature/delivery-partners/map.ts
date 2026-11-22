import type { DeliveryPartner } from "@/types"

export interface DeliveryPartnerRow {
  id: string
  name: string
  email: string
  phone: string
  avatar: string | null
  vehicleType: string | null
  isActive: boolean | null
  createdAt: Date
}

const toVehicleType = (value: string | null): DeliveryPartner["vehicleType"] =>
  value === "car" || value === "scooter" ? value : "bike"

/**
 * Never return `password` (or anything else the partner row stores internally)
 * to the client.
 */
export const mapDeliveryPartner = (
  partner: DeliveryPartnerRow
): DeliveryPartner => ({
  id: partner.id,
  name: partner.name,
  email: partner.email,
  phone: partner.phone,
  avatar: partner.avatar ?? "",
  vehicleType: toVehicleType(partner.vehicleType),
  isActive: Boolean(partner.isActive),
  createdAt: partner.createdAt.toISOString(),
})
