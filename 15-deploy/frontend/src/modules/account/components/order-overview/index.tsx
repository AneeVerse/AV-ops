"use client"

import { Button } from "@medusajs/ui"
import { useState, useMemo } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import OrderCard from "../order-card"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { Pagination } from "@modules/store/components/pagination"
import { HttpTypes } from "@medusajs/types"

const ORDERS_PER_PAGE = 5

const OrderOverview = ({ orders }: { orders: HttpTypes.StoreOrder[] }) => {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [searchQuery, setSearchQuery] = useState("")

  const currentPage = Math.max(1, Number(searchParams.get("page")) || 1)

  // Sort orders by created_at descending (latest first)
  const sortedOrders = useMemo(() => {
    return [...orders].sort((a, b) => {
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    })
  }, [orders])

  // Filter orders based on search query
  const filteredOrders = useMemo(() => {
    if (!searchQuery.trim()) return sortedOrders

    return sortedOrders.filter((order) => {
      const searchLower = searchQuery.toLowerCase()
      return (
        order.display_id?.toString().includes(searchLower) ||
        order.items?.some((item) =>
          item.title?.toLowerCase().includes(searchLower)
        )
      )
    })
  }, [sortedOrders, searchQuery])

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / ORDERS_PER_PAGE))
  const safePage = Math.min(currentPage, totalPages)

  const displayedOrders = useMemo(() => {
    const start = (safePage - 1) * ORDERS_PER_PAGE
    return filteredOrders.slice(start, start + ORDERS_PER_PAGE)
  }, [filteredOrders, safePage])

  const handleSearchChange = (value: string) => {
    setSearchQuery(value)

    const params = new URLSearchParams(searchParams)
    params.set("page", "1")
    router.replace(`${pathname}?${params.toString()}`)
  }

  const rangeStart = filteredOrders.length === 0 ? 0 : (safePage - 1) * ORDERS_PER_PAGE + 1
  const rangeEnd = Math.min(safePage * ORDERS_PER_PAGE, filteredOrders.length)

  if (orders?.length) {
    return (
      <div className="flex flex-col gap-y-6 w-full">
        {/* Header with Search */}
        <div className="flex flex-col small:flex-row items-start small:items-center justify-between gap-4 w-full">
          <h2 className="text-2xl font-bold text-gray-900 whitespace-nowrap">All Orders</h2>
          <div className="relative w-full max-w-md">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              placeholder="Search orders"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl bg-gray-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-gold-accent/30 focus:border-transparent transition-all"
            />
          </div>
        </div>

        {/* Orders List */}
        <div className="flex flex-col gap-y-4 w-full">
          {displayedOrders.length > 0 ? (
            displayedOrders.map((o) => (
              <div key={o.id}>
                <OrderCard order={o} />
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-gray-500">
              No orders found matching your search.
            </div>
          )}
        </div>

        {filteredOrders.length > ORDERS_PER_PAGE && (
          <Pagination
            page={safePage}
            totalPages={totalPages}
            data-testid="orders-pagination"
          />
        )}

        <div className="text-center text-sm text-gray-500">
          {filteredOrders.length > 0
            ? `Showing ${rangeStart}-${rangeEnd} of ${filteredOrders.length} orders`
            : "No orders to display"}
        </div>
      </div>
    )
  }

  return (
    <div
      className="w-full flex flex-col items-center gap-y-6 py-12"
      data-testid="no-orders-container"
    >
      <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-2">
        <svg
          className="w-10 h-10 text-gray-300"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
          />
        </svg>
      </div>
      <h2 className="text-2xl font-bold text-gray-900">Nothing to see here</h2>
      <p className="text-base-regular">
        You don&apos;t have any orders yet, let us change that 🛍️
      </p>
      <div className="mt-4">
        <LocalizedClientLink href="/" passHref>
          <Button data-testid="continue-shopping-button">
            Continue shopping
          </Button>
        </LocalizedClientLink>
      </div>
    </div>
  )
}

export default OrderOverview
