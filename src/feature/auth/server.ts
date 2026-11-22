import { toAuthUser, type AuthUser } from "./roles"

/**
 * Client-safe, sanitized view of a Better Auth session.
 *
 * The raw Better Auth session (token, IP address, user agent, etc.) stays on
 * the server. Only these fields may ever leave the server boundary.
 */
export interface AuthSession {
  id: string
  userId: string
  expiresAt: Date
}

export interface AuthSessionResult {
  session: AuthSession
  user: AuthUser
}

/**
 * Both imports stay dynamic because this is a plain helper, not a
 * server-function handler. Start only strips handler bodies (and the imports
 * used solely by them), so a static `@/lib/auth` import here would place Better
 * Auth and the Prisma singleton in the client module graph.
 */
export const getAuthSession = async (): Promise<AuthSessionResult | null> => {
  const { auth } = await import("@/lib/auth")
  const { getRequestHeaders } = await import("@tanstack/react-start/server")

  const session = await auth.api.getSession({
    headers: getRequestHeaders(),
  })

  if (!session?.user) {
    return null
  }

  return {
    session: {
      id: session.session.id,
      userId: session.session.userId,
      expiresAt: session.session.expiresAt,
    },
    user: toAuthUser(session.user),
  }
}
