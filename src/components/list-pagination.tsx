import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"

interface ListPaginationProps {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
}

/** Shared numbered pagination for storefront and order lists. */
export function ListPagination({
  page,
  totalPages,
  onPageChange,
}: ListPaginationProps) {
  if (totalPages <= 1) {
    return null
  }

  return (
    <Pagination className="mt-8">
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            href="#"
            className={
              page === 1 ? "pointer-events-none opacity-50" : undefined
            }
            onClick={(event) => {
              event.preventDefault()
              onPageChange(page - 1)
            }}
          />
        </PaginationItem>

        {Array.from({ length: totalPages }, (_, index) => index + 1).map(
          (pageNumber) => (
            <PaginationItem key={pageNumber}>
              <PaginationLink
                href="#"
                isActive={pageNumber === page}
                onClick={(event) => {
                  event.preventDefault()
                  onPageChange(pageNumber)
                }}
              >
                {pageNumber}
              </PaginationLink>
            </PaginationItem>
          )
        )}

        <PaginationItem>
          <PaginationNext
            href="#"
            className={
              page === totalPages ? "pointer-events-none opacity-50" : undefined
            }
            onClick={(event) => {
              event.preventDefault()
              onPageChange(page + 1)
            }}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  )
}
