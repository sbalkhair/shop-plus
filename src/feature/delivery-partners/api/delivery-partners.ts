import { authorizationMiddleware } from "@/feature/auth/middleware"
import { prisma } from "@/lib/db"
import type { DeliveryPartner } from "@/types"
import { createServerFn } from "@tanstack/react-start"
import { mapDeliveryPartner } from "../map"
import {
  createDeliveryPartnerSchema,
  deliveryPartnerIdSchema,
  updateDeliveryPartnerSchema,
} from "../schema"

const isUniqueConstraintError = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  (error as { code?: string }).code === "P2002"

/**
 * Creates the Better Auth user and credential account for a driver. Better Auth
 * stores the `credential` account's id as the user id, so this mirrors the
 * sign-up flow without creating a session.
 */
const provisionDriverAccount = async ({
  id,
  name,
  email,
  phone,
  password,
}: {
  id: string
  name: string
  email: string
  phone: string
  password: string
}) => {
  const { hashPassword } = await import("better-auth/crypto")

  return {
    user: {
      id,
      name,
      email,
      phone,
      isDriver: true,
    },
    passwordHash: await hashPassword(password),
  }
}

export const getDeliveryPartners = createServerFn({ method: "GET" })
  .middleware([
    authorizationMiddleware({ permissions: ["delivery-partners:read"] }),
  ])
  .handler(async (): Promise<DeliveryPartner[]> => {
    const partners = await prisma.deliveryPartner.findMany({
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
    })

    return partners.map(mapDeliveryPartner)
  })

export const getDeliveryPartner = createServerFn({ method: "GET" })
  .middleware([
    authorizationMiddleware({ permissions: ["delivery-partners:read"] }),
  ])
  .validator((data: unknown) => deliveryPartnerIdSchema.parse(data))
  .handler(async ({ data }): Promise<DeliveryPartner | null> => {
    const partner = await prisma.deliveryPartner.findUnique({
      where: { id: data.id },
    })

    return partner ? mapDeliveryPartner(partner) : null
  })

export const createDeliveryPartner = createServerFn({ method: "POST" })
  .middleware([
    authorizationMiddleware({ permissions: ["delivery-partners:manage"] }),
  ])
  .validator((data: unknown) => createDeliveryPartnerSchema.parse(data))
  .handler(async ({ data }): Promise<DeliveryPartner> => {
    const { randomUUID } = await import("node:crypto")
    const { password, ...fields } = data

    const account = await provisionDriverAccount({
      id: randomUUID(),
      name: fields.name,
      email: fields.email,
      phone: fields.phone,
      password,
    })

    try {
      return await prisma.$transaction(async (tx) => {
        await tx.user.create({ data: account.user })

        await tx.account.create({
          data: {
            id: randomUUID(),
            accountId: account.user.id,
            providerId: "credential",
            userId: account.user.id,
            password: account.passwordHash,
          },
        })

        const partner = await tx.deliveryPartner.create({
          data: {
            ...fields,
            userId: account.user.id,
          },
        })

        return mapDeliveryPartner(partner)
      })
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new Error(
          "A delivery partner or user with this email already exists"
        )
      }

      throw error
    }
  })

export const updateDeliveryPartner = createServerFn({ method: "POST" })
  .middleware([
    authorizationMiddleware({ permissions: ["delivery-partners:manage"] }),
  ])
  .validator((data: unknown) => updateDeliveryPartnerSchema.parse(data))
  .handler(async ({ data }): Promise<DeliveryPartner> => {
    const { randomUUID } = await import("node:crypto")
    const { id, password, ...fields } = data
    const passwordHash = password
      ? await (await import("better-auth/crypto")).hashPassword(password)
      : null

    try {
      return await prisma.$transaction(async (tx) => {
        const existing = await tx.deliveryPartner.findUnique({ where: { id } })

        if (!existing) {
          throw new Error("Delivery partner not found.")
        }

        const partner = await tx.deliveryPartner.update({
          where: { id },
          data: fields,
        })

        if (existing.userId) {
          await tx.user.update({
            where: { id: existing.userId },
            data: {
              name: fields.name,
              email: fields.email,
              phone: fields.phone,
              isDriver: true,
            },
          })

          if (passwordHash) {
            const credential = await tx.account.findFirst({
              where: {
                userId: existing.userId,
                providerId: "credential",
              },
              select: { id: true },
            })

            if (credential) {
              await tx.account.update({
                where: { id: credential.id },
                data: { password: passwordHash },
              })
            } else {
              await tx.account.create({
                data: {
                  id: randomUUID(),
                  accountId: existing.userId,
                  providerId: "credential",
                  userId: existing.userId,
                  password: passwordHash,
                },
              })
            }
          }
        } else if (passwordHash) {
          // Backfill path for partners created before driver accounts existed.
          const userId = randomUUID()

          await tx.user.create({
            data: {
              id: userId,
              name: fields.name,
              email: fields.email,
              phone: fields.phone,
              isDriver: true,
            },
          })

          await tx.account.create({
            data: {
              id: randomUUID(),
              accountId: userId,
              providerId: "credential",
              userId,
              password: passwordHash,
            },
          })

          await tx.deliveryPartner.update({
            where: { id },
            data: { userId },
          })
        }

        return mapDeliveryPartner(partner)
      })
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new Error(
          "A delivery partner or user with this email already exists"
        )
      }

      throw error
    }
  })

export const deleteDeliveryPartner = createServerFn({ method: "POST" })
  .middleware([
    authorizationMiddleware({ permissions: ["delivery-partners:manage"] }),
  ])
  .validator((data: unknown) => deliveryPartnerIdSchema.parse(data))
  .handler(async ({ data }): Promise<{ id: string }> => {
    await prisma.$transaction(async (tx) => {
      const partner = await tx.deliveryPartner.findUnique({
        where: { id: data.id },
        select: { userId: true },
      })

      // Orders keep their history; `onDelete: SetNull` simply unassigns them.
      await tx.deliveryPartner.delete({ where: { id: data.id } })

      if (partner?.userId) {
        // A driver account is useless once the partner is gone. Keep it only if
        // it somehow owns customer orders, which cascade on user deletion.
        const orderCount = await tx.order.count({
          where: { userId: partner.userId },
        })

        if (orderCount === 0) {
          await tx.user.delete({ where: { id: partner.userId } })
        }
      }
    })

    return { id: data.id }
  })
