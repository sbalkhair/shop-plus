import { authorizationMiddleware } from "@/feature/auth/middleware"
import type { Prisma } from "@/generated/prisma/client"
import { prisma } from "@/lib/db"
import type { Address } from "@/types"
import { createServerFn } from "@tanstack/react-start"
import { mapAddress } from "../map"
import {
  createAddressSchema,
  deleteAddressSchema,
  setDefaultAddressSchema,
  updateAddressSchema,
} from "../schema"

/**
 * Serializes address mutations for one customer. This keeps the "at most one
 * default address per user" invariant intact when two requests race.
 */
const lockAddresses = async (
  tx: Prisma.TransactionClient,
  userId: string
): Promise<void> => {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`address:${userId}`}))`
}

const findOwnedAddress = async (
  tx: Prisma.TransactionClient,
  id: string,
  userId: string
) => {
  const address = await tx.address.findFirst({ where: { id, userId } })

  if (!address) {
    throw new Error("Address not found.")
  }

  return address
}

/** Every saved address for the signed-in customer, default first. */
export const getAddresses = createServerFn({ method: "GET" })
  .middleware([authorizationMiddleware({ permissions: ["addresses:read"] })])
  .handler(async ({ context }): Promise<Address[]> => {
    const addresses = await prisma.address.findMany({
      where: { userId: context.user.id },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    })

    return addresses.map(mapAddress)
  })

/**
 * Saves a new address for the signed-in customer. The first address is always
 * the default; later addresses only become default when requested.
 */
export const createAddress = createServerFn({ method: "POST" })
  .middleware([authorizationMiddleware({ permissions: ["addresses:manage"] })])
  .validator((data: unknown) => createAddressSchema.parse(data))
  .handler(async ({ data, context }): Promise<Address> => {
    return prisma.$transaction(async (tx) => {
      await lockAddresses(tx, context.user.id)

      const existingCount = await tx.address.count({
        where: { userId: context.user.id },
      })
      const makeDefault = data.isDefault || existingCount === 0

      if (makeDefault) {
        await tx.address.updateMany({
          where: { userId: context.user.id, isDefault: true },
          data: { isDefault: false },
        })
      }

      const address = await tx.address.create({
        data: {
          ...data,
          userId: context.user.id,
          isDefault: makeDefault,
        },
      })

      return mapAddress(address)
    })
  })

/**
 * Updates an address owned by the signed-in customer. Unsetting the default on
 * an address promotes the newest other address so one default always remains
 * whenever the customer has saved at least one address.
 */
export const updateAddress = createServerFn({ method: "POST" })
  .middleware([authorizationMiddleware({ permissions: ["addresses:manage"] })])
  .validator((data: unknown) => updateAddressSchema.parse(data))
  .handler(async ({ data, context }): Promise<Address> => {
    const { id, ...fields } = data

    return prisma.$transaction(async (tx) => {
      await lockAddresses(tx, context.user.id)

      const existing = await findOwnedAddress(tx, id, context.user.id)
      let makeDefault = fields.isDefault

      if (makeDefault) {
        await tx.address.updateMany({
          where: {
            userId: context.user.id,
            isDefault: true,
            NOT: { id },
          },
          data: { isDefault: false },
        })
      } else if (existing.isDefault) {
        const otherAddress = await tx.address.findFirst({
          where: { userId: context.user.id, NOT: { id } },
          orderBy: { createdAt: "desc" },
          select: { id: true },
        })

        if (otherAddress) {
          await tx.address.update({
            where: { id: otherAddress.id },
            data: { isDefault: true },
          })
        } else {
          // The only address should stay the default.
          makeDefault = true
        }
      }

      const address = await tx.address.update({
        where: { id },
        data: { ...fields, isDefault: makeDefault },
      })

      return mapAddress(address)
    })
  })

/** Marks one saved address as the customer's default delivery address. */
export const setDefaultAddress = createServerFn({ method: "POST" })
  .middleware([authorizationMiddleware({ permissions: ["addresses:manage"] })])
  .validator((data: unknown) => setDefaultAddressSchema.parse(data))
  .handler(async ({ data, context }): Promise<Address> => {
    return prisma.$transaction(async (tx) => {
      await lockAddresses(tx, context.user.id)

      const existing = await findOwnedAddress(tx, data.id, context.user.id)

      await tx.address.updateMany({
        where: { userId: context.user.id, isDefault: true },
        data: { isDefault: false },
      })

      const address = await tx.address.update({
        where: { id: existing.id },
        data: { isDefault: true },
      })

      return mapAddress(address)
    })
  })

/** Deletes an address and promotes a remaining address when needed. */
export const deleteAddress = createServerFn({ method: "POST" })
  .middleware([authorizationMiddleware({ permissions: ["addresses:manage"] })])
  .validator((data: unknown) => deleteAddressSchema.parse(data))
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    return prisma.$transaction(async (tx) => {
      await lockAddresses(tx, context.user.id)

      const existing = await findOwnedAddress(tx, data.id, context.user.id)

      await tx.address.delete({ where: { id: existing.id } })

      if (existing.isDefault) {
        const fallback = await tx.address.findFirst({
          where: { userId: context.user.id },
          orderBy: { createdAt: "desc" },
          select: { id: true },
        })

        if (fallback) {
          await tx.address.update({
            where: { id: fallback.id },
            data: { isDefault: true },
          })
        }
      }

      return { id: existing.id }
    })
  })
