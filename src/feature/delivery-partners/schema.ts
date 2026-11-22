import { z } from "zod"

export const deliveryPartnerVehicleSchema = z.enum(["bike", "scooter", "car"])

export type DeliveryPartnerVehicle = z.infer<
  typeof deliveryPartnerVehicleSchema
>

const deliveryPartnerFieldsSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(80, "Name is too long"),
  email: z.email("Enter a valid email").trim().toLowerCase(),
  phone: z
    .string()
    .trim()
    .min(7, "Enter a valid phone number")
    .max(20, "Phone number is too long")
    .regex(/^[0-9+\s()-]+$/, "Enter a valid phone number"),
  vehicleType: deliveryPartnerVehicleSchema,
  isActive: z.boolean(),
})

/**
 * Drivers sign in through the main login page, so creating one provisions a
 * Better Auth credential account. The admin communicates the temporary
 * password directly; it is only ever stored as a hash.
 */
const driverPasswordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(200, "Password is too long")

export const createDeliveryPartnerSchema = deliveryPartnerFieldsSchema.extend({
  password: driverPasswordSchema,
})

export const updateDeliveryPartnerSchema = deliveryPartnerFieldsSchema.extend({
  id: z.uuid("Invalid delivery partner id"),
  /**
   * Optional password reset for the linked driver account. An empty value from
   * the edit form means "keep the current password".
   */
  password: z.union([z.literal(""), driverPasswordSchema]).optional(),
})

export const deliveryPartnerIdSchema = z.object({
  id: z.uuid("Invalid delivery partner id"),
})

export type CreateDeliveryPartnerInput = z.infer<
  typeof createDeliveryPartnerSchema
>
export type UpdateDeliveryPartnerInput = z.infer<
  typeof updateDeliveryPartnerSchema
>
