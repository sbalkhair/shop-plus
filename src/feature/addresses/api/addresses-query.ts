import { queryOptions } from "@tanstack/react-query"

import { getAddresses } from "./addresses"

/** Saved addresses for the signed-in customer. */
export const addressesQueryOptions = queryOptions({
  queryKey: ["addresses"],
  queryFn: () => getAddresses(),
  // The route loaders expect a fresh list after an address is saved, set as
  // default, or deleted, so this query must never be considered fresh.
  staleTime: 0,
})
