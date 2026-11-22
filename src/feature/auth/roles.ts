export const USER_ROLES = ["customer", "driver", "admin"] as const

export type UserRole = (typeof USER_ROLES)[number]

export interface AuthUser {
  id: string
  name: string
  email: string
  phone: string | null
  image: string | null
  role: UserRole
  isAdmin: boolean
  isDriver: boolean
}

interface SessionUser {
  id: string
  name: string
  email: string
  phone?: string | null
  image?: string | null
  isAdmin?: boolean | null
  isDriver?: boolean | null
}

export const toAuthUser = (user: SessionUser): AuthUser => {
  const isAdmin = Boolean(user.isAdmin)
  const isDriver = Boolean(user.isDriver)

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone ?? null,
    image: user.image ?? null,
    role: isAdmin ? "admin" : isDriver ? "driver" : "customer",
    isAdmin,
    isDriver,
  }
}

export const hasRole = (
  user: AuthUser,
  allowedRoles: readonly UserRole[]
): boolean => allowedRoles.includes(user.role)

/**
 * Compares two client-safe users without relying on object identity.
 * Used to detect when hydrated router context is out of date.
 */
export const isSameAuthUser = (
  left: AuthUser | null,
  right: AuthUser | null
): boolean =>
  left?.id === right?.id &&
  left?.role === right?.role &&
  left?.isAdmin === right?.isAdmin &&
  left?.isDriver === right?.isDriver
