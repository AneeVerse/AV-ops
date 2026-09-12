import Delivered from "@modules/common/icons/delivered"
import { HttpTypes } from "@medusajs/types"
import { ReactNode } from "react"

export type OrderStatusConfig = {
  label: string
  bgColor: string
  textColor: string
  iconBg: string
  icon: ReactNode | string
}

export const getStatusConfig = (status: string): OrderStatusConfig => {
  const statusLower = status?.toLowerCase() || ""

  if (statusLower.includes("cancel")) {
    return {
      label: "Cancelled",
      bgColor: "bg-[#FFF1F2]",
      textColor: "text-[#BE123C]",
      iconBg: "bg-[#BE123C]",
      icon: "×",
    }
  }

  if (statusLower === "delivered" || statusLower === "complete" || statusLower === "completed") {
    return {
      label: "Delivered",
      bgColor: "bg-[#E6F4F0]",
      textColor: "text-[#008A5D]",
      iconBg: "bg-[#008A5D]",
      icon: <Delivered />,
    }
  }

  if (statusLower === "shipped" || statusLower === "partially_shipped") {
    return {
      label: "Out For Delivery",
      bgColor: "bg-[#EBF5FF]",
      textColor: "text-[#0068D2]",
      iconBg: "bg-[#0068D2]",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="1" y="3" width="15" height="13" />
          <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
          <circle cx="5.5" cy="18.5" r="2.5" />
          <circle cx="18.5" cy="18.5" r="2.5" />
        </svg>
      ),
    }
  }

  if (statusLower === "fulfilled" || statusLower === "partially_fulfilled") {
    return {
      label: "Shipped",
      bgColor: "bg-[#F3E8FF]",
      textColor: "text-gold-accent",
      iconBg: "bg-royal-blue",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
          <polyline points="3.29 7 12 12 20.71 7" />
          <line x1="12" y1="22" x2="12" y2="12" />
        </svg>
      ),
    }
  }

  if (statusLower === "returned" || statusLower === "partially_returned") {
    return {
      label: statusLower === "returned" ? "Returned" : "Partially Returned",
      bgColor: "bg-[#F0F9FF]",
      textColor: "text-[#0284C7]",
      iconBg: "bg-[#0284C7]",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" /><path d="M3 21v-5h5" />
        </svg>
      ),
    }
  }

  if (statusLower === "return_requested") {
    return {
      label: "Return Requested",
      bgColor: "bg-[#FEFCE8]",
      textColor: "text-[#D97706]",
      iconBg: "bg-[#CA8A04]",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
          <polyline points="22,6 12,13 2,6" />
          <path d="M12 13v5" />
        </svg>
      ),
    }
  }

  return {
    label: "Order Confirmed",
    bgColor: "bg-[#F0FDF4]",
    textColor: "text-[#16A34A]",
    iconBg: "bg-[#16A34A]",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    ),
  }
}

export const getOrderDisplayStatus = (order: HttpTypes.StoreOrder): string => {
  const isCancelled = order.status === "canceled" || order.status === "cancelled"

  const returns = (order as HttpTypes.StoreOrder & { returns?: { status: string }[] }).returns || []
  const isReviewedReturn = returns.some(
    (r) => r.status === "received" || r.status === "partially_received"
  )
  const isRequestedReturn = returns.some((r) => r.status === "requested")

  if (isCancelled) return "canceled"
  if (isReviewedReturn) return "returned"
  if (isRequestedReturn) return "return_requested"

  return order.fulfillment_status || order.status || "pending"
}
