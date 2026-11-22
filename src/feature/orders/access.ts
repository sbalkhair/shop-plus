export interface TrackingViewer {
  id: string
  isAdmin: boolean
}

export interface TrackingAccess {
  /** Whether the viewer may read the order's tracking details at all. */
  allowed: boolean
  /** Whether the plaintext delivery code may be included in the response. */
  revealCode: boolean
}

/**
 * Centralizes who may read an order's tracking page and who may see the
 * customer's delivery verification code.
 *
 * - The order owner may read and see the code.
 * - Admins may read any order but never see someone else's code.
 * - Everyone else is denied, so an order id alone is never enough.
 */
export const resolveTrackingAccess = (
  orderUserId: string,
  viewer: TrackingViewer
): TrackingAccess => {
  const isOwner = orderUserId === viewer.id

  if (!isOwner && !viewer.isAdmin) {
    return { allowed: false, revealCode: false }
  }

  return { allowed: true, revealCode: isOwner }
}

/**
 * A driver may only read or mutate an order that is assigned to their own
 * partner row. Centralizing this check keeps the list and details endpoints
 * from drifting apart.
 */
export const isOrderAssignedToDeliveryPartner = (
  orderDeliveryPartnerId: string | null,
  deliveryPartnerId: string
): boolean => orderDeliveryPartnerId === deliveryPartnerId
