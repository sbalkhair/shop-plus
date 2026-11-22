import { PrismaPg } from "@prisma/adapter-pg"
import "dotenv/config"
import { randomUUID } from "node:crypto"

import { hashPassword } from "better-auth/crypto"

import { PrismaClient } from "../src/generated/prisma/client.ts"
import {
  encryptDeliveryOtp,
  hashDeliveryOtp,
} from "../src/feature/orders/verification/crypto.ts"
import { getDeliveryOtpEnv } from "../src/feature/orders/verification/env.ts"

/**
 * One-off migration helper.
 *
 * - Every delivery partner gets a Better Auth user + credential account so the
 *   admin can reset a password and the driver can sign in.
 * - Existing plaintext `Order.deliveryOtp` values for out-for-delivery orders
 *   are converted into encrypted `DeliveryVerification` rows.
 *
 * Idempotent: already-linked partners and orders with a verification are
 * skipped. Run it before the migration that drops the legacy columns.
 */
const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error("DATABASE_URL is not set. Add it to your .env file.")
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
})

const main = async () => {
  const env = getDeliveryOtpEnv()
  const partners = await prisma.deliveryPartner.findMany({
    where: { userId: null },
    select: { id: true, name: true, email: true, phone: true },
  })

  let linkedPartners = 0
  let skippedPartners = 0

  for (const partner of partners) {
    const existingUser = await prisma.user.findUnique({
      where: { email: partner.email },
      select: { id: true, isDriver: true },
    })

    if (existingUser && !existingUser.isDriver) {
      // Never silently promote a customer account to a driver. An admin must
      // resolve the duplicate email manually.
      skippedPartners += 1
      continue
    }

    const userId = existingUser?.id ?? randomUUID()

    if (!existingUser) {
      // The password is random and never shown, so the account cannot be used
      // until an admin sets a temporary password from the partner edit page.
      const passwordHash = await hashPassword(randomUUID())
      await prisma.user.create({
        data: {
          id: userId,
          name: partner.name,
          email: partner.email,
          phone: partner.phone,
          isDriver: true,
        },
      })

      await prisma.account.create({
        data: {
          id: randomUUID(),
          accountId: userId,
          providerId: "credential",
          userId,
          password: passwordHash,
        },
      })
    } else {
      const credential = await prisma.account.findFirst({
        where: { userId, providerId: "credential" },
        select: { id: true },
      })

      if (!credential) {
        const passwordHash = await hashPassword(randomUUID())
        await prisma.account.create({
          data: {
            id: randomUUID(),
            accountId: userId,
            providerId: "credential",
            userId,
            password: passwordHash,
          },
        })
      }
    }

    await prisma.deliveryPartner.update({
      where: { id: partner.id },
      data: { userId },
    })
    linkedPartners += 1
  }

  // The legacy plaintext column is read through raw SQL so this script still
  // compiles after the column is dropped from the Prisma schema. On a fresh
  // database the column and its data do not exist, so the step is skipped.
  const [legacyColumn] = await prisma.$queryRaw<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_name = 'Order' AND column_name = 'deliveryOtp'
    ) AS "exists"
  `

  let migratedOrders = 0
  let skippedOrders = 0

  if (!legacyColumn.exists) {
    console.log(
      "Delivery codes: legacy Order.deliveryOtp column not present; nothing to migrate."
    )
  } else {
    const orders = await prisma.$queryRaw<
      { id: string; deliveryOtp: string | null }[]
    >`
      SELECT "id", "deliveryOtp"
      FROM "Order"
      WHERE "status" = 'Out for Delivery' AND "deliveryOtp" IS NOT NULL
    `

    for (const order of orders) {
      const existing = await prisma.deliveryVerification.findUnique({
        where: { orderId: order.id },
        select: { id: true },
      })

      if (existing) {
        continue
      }

      const code = order.deliveryOtp?.trim() ?? ""

      if (!/^\d{6}$/.test(code)) {
        skippedOrders += 1
        continue
      }

      await prisma.deliveryVerification.create({
        data: {
          orderId: order.id,
          codeHash: hashDeliveryOtp(code),
          codeEncrypted: encryptDeliveryOtp(code),
          expiresAt: new Date(
            Date.now() + env.DELIVERY_OTP_TTL_MINUTES * 60_000
          ),
        },
      })
      migratedOrders += 1
    }

    console.log(
      `Delivery codes: ${migratedOrders} migrated, ${skippedOrders} skipped (missing or malformed).`
    )
  }

  console.log(
    `Delivery partners: ${linkedPartners} linked, ${skippedPartners} skipped (duplicate non-driver email).`
  )
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
