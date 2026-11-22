/**
 * Thrown by server-function middleware when no authenticated user is present.
 *
 * The `status` property documents the intended HTTP semantics, but it is not
 * enough on its own: Start serializes function-middleware errors into the
 * response body, which leaves the HTTP status at `200`. `authMiddleware` calls
 * `setResponseStatus(401)` before throwing so the wire response is a real 401
 * while the client still decodes the serialized error.
 */
export class UnauthorizedError extends Error {
  readonly status = 401

  constructor(message = "Unauthorized: please sign in to continue.") {
    super(message)
    this.name = "UnauthorizedError"
  }
}

/**
 * Thrown by server-function middleware when an authenticated user is not
 * allowed to perform the requested operation. `authorizationMiddleware` sets
 * the HTTP status to `403` before throwing; see `UnauthorizedError`.
 */
export class ForbiddenError extends Error {
  readonly status = 403

  constructor(message = "Forbidden: you do not have access to this resource.") {
    super(message)
    this.name = "ForbiddenError"
  }
}
