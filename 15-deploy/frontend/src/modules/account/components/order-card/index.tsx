import Thumbnail from "@modules/products/components/thumbnail"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { convertToLocale } from "@lib/util/money"
import { HttpTypes } from "@medusajs/types"
import Delivered from "@modules/common/icons/delivered"

type OrderCardProps = {
  order: HttpTypes.StoreOrder
}

const getStatusConfig = (status: string) => {
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
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    ),
  }
}

const OrderCard = ({ order }: OrderCardProps) => {
  const isCancelled = order.status === "canceled" || order.status === "cancelled"

  const returns = (order as HttpTypes.StoreOrder & { returns?: { status: string }[]; return_orders?: { status: string }[] }).returns
    || (order as HttpTypes.StoreOrder & { return_orders?: { status: string }[] }).return_orders
    || []
  const isReviewedReturn = returns.some((r) => r.status === "received" || r.status === "partially_received")
  const isRequestedReturn = returns.some((r) => r.status === "requested")

  const isRefunded = order.payment_status === "refunded" || order.payment_status === "partially_refunded"

  const statusToDisplay = isCancelled
    ? "canceled"
    : isReviewedReturn
      ? "returned"
      : isRequestedReturn
        ? "return_requested"
        : (order.fulfillment_status || order.status)

  const statusConfig = getStatusConfig(statusToDisplay)

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const day = date.getDate()
    const month = date.toLocaleDateString("en-US", { month: "short" })
    const weekday = date.toLocaleDateString("en-US", { weekday: "short" })
    return `${weekday}, ${day} ${month}`
  }

  const renderStatusIcon = () => {
    if (statusConfig.label === "Delivered") {
      return <Delivered width={36} height={36} className="shrink-0" />
    }

    return (
      <div
        className={`${statusConfig.iconBg} w-9 h-9 rounded-full flex items-center justify-center text-white shrink-0 text-sm font-bold leading-none [&>svg]:w-4 [&>svg]:h-4`}
      >
        {statusConfig.icon}
      </div>
    )
  }

  return (
    <LocalizedClientLink href={`/orders/${order.id}`}>
      <div
        className="bg-ivory-bg rounded-lg p-4 transition-all hover:shadow-md cursor-pointer border border-gray-100"
        data-testid="order-card"
      >
        <div className="flex items-center gap-3 mb-4">
          {renderStatusIcon()}
          <div className="flex-1 text-left min-w-0">
            <div className="flex items-center flex-wrap gap-2">
              <h3 className={`font-bold ${statusConfig.textColor} text-lg tracking-tight leading-tight`}>
                {statusConfig.label}
              </h3>
              {isRefunded && (
                <span className="text-[10px] font-bold text-[#008A5D] bg-[#E1F2ED] px-2.5 py-1 rounded-full uppercase tracking-widest border border-[#008A5D]/10">
                  Amount Refunded ✨
                </span>
              )}
            </div>
            <p className="text-sm text-gray-400 font-medium tracking-tight mt-1">
              on {formatDate(order.created_at?.toString() || new Date().toISOString())}
            </p>
          </div>
        </div>

        <div className="bg-[#F5F5F5] rounded-2xl p-4 space-y-4">
          {order.items?.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-4 small:gap-6"
              data-testid="order-item"
            >
              <div className="w-24 h-24 flex-shrink-0 rounded-xl overflow-hidden bg-ivory-bg">
                <Thumbnail
                  thumbnail={item.thumbnail}
                  variantImages={item.variant?.images}
                  images={item.variant?.product?.images}
                  size="square"
                />
              </div>

              <div className="flex-1 min-w-0">
                <span className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold block mb-0.5">
                  Cultura Jewels
                </span>
                <h4 className="font-bold text-[#04122C] text-base mb-1 line-clamp-2 whitespace-normal break-words">
                  {item.product_title || item.title}
                </h4>
                <div className="flex items-center gap-3">
                  <p className="text-sm font-medium text-gray-500">
                    {item.variant_title && `Size: ${item.variant_title}`}
                  </p>
                  <p className="font-bold text-[#04122C] text-base">
                    {convertToLocale({
                      amount: item.total || (item.unit_price * item.quantity) || 0,
                      currency_code: order.currency_code,
                    })}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </LocalizedClientLink>
  )
}

export default OrderCard
