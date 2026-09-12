"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"

export function Pagination({
  page,
  totalPages,
  'data-testid': dataTestid
}: {
  page: number
  totalPages: number
  'data-testid'?: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams)
    params.set("page", newPage.toString())
    router.push(`${pathname}?${params.toString()}`)
    // Scroll to top smoothly
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  // Generate page numbers to display
  const getPageNumbers = (): (number | "ellipsis")[] => {
    const pages: (number | "ellipsis")[] = []

    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i)
    } else if (page <= 3) {
      pages.push(1, 2, 3, 4, "ellipsis", totalPages)
    } else if (page >= totalPages - 2) {
      pages.push(1, "ellipsis", totalPages - 3, totalPages - 2, totalPages - 1, totalPages)
    } else {
      pages.push(1, "ellipsis", page - 1, page, page + 1, "ellipsis", totalPages)
    }

    return pages
  }

  const pageNumbers = getPageNumbers()

  return (
    <div className="flex flex-col items-center gap-5 mt-12 mb-4" data-testid={dataTestid}>
      {/* Page Info */}
      <p className="text-sm text-gray-400 font-medium tracking-wide">
        Page <span className="text-gray-800 font-bold">{page}</span> of <span className="text-gray-800 font-bold">{totalPages}</span>
      </p>

      {/* Pagination Controls */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Previous Button */}
        <button
          onClick={() => handlePageChange(page - 1)}
          disabled={page <= 1}
          className="group flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-xl border border-gray-200 bg-white text-gray-500 transition-all duration-200 hover:border-gold-accent hover:text-gold-accent hover:shadow-md hover:shadow-gold-accent/10/50 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:border-gray-200 disabled:hover:text-gray-400 disabled:hover:shadow-none"
          aria-label="Previous page"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-hover:-translate-x-0.5">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>

        {/* Page Numbers */}
        <div className="flex items-center gap-1 sm:gap-1.5">
          {pageNumbers.map((p, idx) => {
            if (p === "ellipsis") {
              return (
                <span
                  key={`ellipsis-${idx}`}
                  className="w-8 h-10 sm:w-10 sm:h-11 flex items-center justify-center text-gray-300 text-lg font-medium select-none"
                >
                  •••
                </span>
              )
            }

            const isCurrent = p === page

            return (
              <button
                key={p}
                onClick={() => handlePageChange(p)}
                disabled={isCurrent}
                className={`
                  relative w-10 h-10 sm:w-11 sm:h-11 rounded-xl text-sm font-bold transition-all duration-200
                  ${isCurrent
                    ? "bg-royal-blue text-white shadow-lg shadow-royal-blue/30 scale-105 cursor-default"
                    : "bg-white border border-gray-200 text-gray-600 hover:border-gold-accent hover:text-gold-accent hover:bg-gold-accent/10 hover:shadow-sm"
                  }
                `}
              >
                {p}
                {isCurrent && (
                  <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-4 h-1 bg-royal-blue rounded-full opacity-60" />
                )}
              </button>
            )
          })}
        </div>

        {/* Next Button */}
        <button
          onClick={() => handlePageChange(page + 1)}
          disabled={page >= totalPages}
          className="group flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-xl border border-gray-200 bg-white text-gray-500 transition-all duration-200 hover:border-gold-accent hover:text-gold-accent hover:shadow-md hover:shadow-gold-accent/10/50 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:border-gray-200 disabled:hover:text-gray-400 disabled:hover:shadow-none"
          aria-label="Next page"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-hover:translate-x-0.5">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>
    </div>
  )
}
