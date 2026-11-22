import { z } from "zod"

export const addressIdSchema = z.uuid("Invalid address id")

/**
 * Address fields shared by saved addresses and the checkout shipping address.
 * Keeping one definition means the two forms accept the same values and the
 * order stores the same shape the address book does.
 */
export const addressCoreSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(1, "Full name is required")
    .max(120, "Full name is too long"),
  phone: z
    .string()
    .trim()
    .min(7, "Enter a valid phone number")
    .max(20, "Phone number is too long")
    .regex(/^[0-9+\s()-]+$/, "Enter a valid phone number"),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.union([z.literal(""), z.email("Enter a valid email")])),
  address: z
    .string()
    .trim()
    .min(5, "Street address is required")
    .max(300, "Street address is too long"),
  city: z
    .string()
    .trim()
    .min(1, "City is required")
    .max(100, "City is too long"),
  state: z
    .string()
    .trim()
    .min(1, "State is required")
    .max(100, "State is too long"),
  zip: z
    .string()
    .trim()
    .min(3, "Postal code is required")
    .max(20, "Postal code is too long"),
  /**
   * Optional map pin for the delivery location. Both values are stored on the
   * address book row and copied into the order's JSON shipping address.
   */
  latitude: z
    .number()
    .min(-90, "Latitude must be between -90 and 90")
    .max(90, "Latitude must be between -90 and 90")
    .nullable()
    .optional(),
  longitude: z
    .number()
    .min(-180, "Longitude must be between -180 and 180")
    .max(180, "Longitude must be between -180 and 180")
    .nullable()
    .optional(),
  notes: z.string().trim().max(500, "Notes must be 500 characters or less"),
})

const addressFieldsSchema = addressCoreSchema.extend({
  label: z
    .string()
    .trim()
    .min(1, "Give this address a label")
    .max(40, "Label is too long"),
  isDefault: z.boolean(),
})

export const createAddressSchema = addressFieldsSchema

export const updateAddressSchema = addressFieldsSchema.extend({
  id: addressIdSchema,
})

export const deleteAddressSchema = z.object({ id: addressIdSchema })

export const setDefaultAddressSchema = z.object({ id: addressIdSchema })

export type CreateAddressInput = z.infer<typeof createAddressSchema>
export type UpdateAddressInput = z.infer<typeof updateAddressSchema>
