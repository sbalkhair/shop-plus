import type { AuthUser, UserRole } from "./roles"

/**
 * Central permission catalog. Add permissions here as server operations are
 * introduced; authorization code should reference these constants rather than
 * ad-hoc strings.
 */
export const PERMISSIONS = [
  "orders:create",
  "orders:read",
  "orders:read-all",
  "orders:update",
  "addresses:read",
  "addresses:manage",
  "delivery-partners:read",
  "delivery-partners:manage",
  "delivery:read-assigned",
  "delivery:start",
  "delivery:verify",
  "payments:create",
  "products:create",
  "products:update",
  "products:delete",
  "categories:create",
  "categories:update",
  "categories:delete",
] as const

export type Permission = (typeof PERMISSIONS)[number]

/**
 * Role-to-permission mapping is the single source of truth for authorization.
 * Roles remain derived from the existing `User.isAdmin` field.
 */
export const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  customer: [
    "orders:create",
    "orders:read",
    "payments:create",
    "addresses:read",
    "addresses:manage",
  ],
  driver: ["delivery:read-assigned", "delivery:start", "delivery:verify"],
  admin: [
    "orders:create",
    "orders:read",
    "orders:read-all",
    "orders:update",
    "delivery-partners:read",
    "delivery-partners:manage",
    "payments:create",
    "products:create",
    "products:update",
    "products:delete",
    "categories:create",
    "categories:update",
    "categories:delete",
  ],
}

export const hasPermission = (
  user: AuthUser,
  permission: Permission
): boolean => ROLE_PERMISSIONS[user.role].includes(permission)

export const hasPermissions = (
  user: AuthUser,
  permissions: readonly Permission[]
): boolean => permissions.every((permission) => hasPermission(user, permission))
