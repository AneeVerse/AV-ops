import { Heading, Text } from "@medusajs/ui"
import { cookies as nextCookies } from "next/headers"
import Image from "next/image"
import Link from "next/link"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

import OnboardingCta from "@modules/order/components/onboarding-cta"
import OrderConfirmationBackHandler from "@modules/order/components/order-confirmation-back-handler"
import { HttpTypes } from "@medusajs/types"
import Thumbnail from "@modules/products/components/thumbnail"
import { convertToLocale } from "@lib/util/money"
import OrderPurchaseTracker from "@modules/order/components/order-purchase-tracker"

type OrderCompletedTemplateProps = {
  order: HttpTypes.StoreOrder
}

export default async function OrderCompletedTemplate({
  order,
}: OrderCompletedTemplateProps) {
  const cookies = await nextCookies()

  const isOnboarding = cookies.get("_medusa_onboarding")?.value === "true"

  const shippingAddress = order.shipping_address
  const fullName = `${shippingAddress?.first_name || ""} ${shippingAddress?.last_name || ""}`.trim()
  const phone = shippingAddress?.phone ? (shippingAddress.phone.startsWith("+") ? shippingAddress.phone : `+${shippingAddress.phone}`) : ""
  const address = [
    shippingAddress?.address_1,
    shippingAddress?.address_2,
    shippingAddress?.city,
    shippingAddress?.province,
    shippingAddress?.postal_code,
    shippingAddress?.country_code?.toUpperCase(),
  ]
    .filter(Boolean)
    .join(", ")

  return (
    <div className="min-h-[calc(100vh-64px)] bg-ivory-bg py-12">
      <div className="content-container max-w-4xl mx-auto">
        <OrderPurchaseTracker order={order} />
        {isOnboarding && <OnboardingCta orderId={order.id} />}

        <div className="flex flex-col gap-8" data-testid="order-complete-container">
          <OrderConfirmationBackHandler />
          {/* Top Illustration Section */}
          <div className="flex justify-center items-center pb-2 pt-2">
            <div className="relative w-full max-w-2xl h-64">
              <Image
                src="/Successful purchase-pana 1.png"
                alt="Order Successful"
                fill
                className="object-contain"
                priority
              />
            </div>
          </div>

          {/* Order Confirmed Heading */}
          <div className="text-center">
            <Heading
              level="h1"
              className="text-4xl font-bold mb-2 text-gold-accent"
            >
              Order Confirmed
            </Heading>
            <Text className="text-gray-700 text-lg max-w-2xl mx-auto">
              Your order is confirmed. You will receive an order confirmation email/SMS shortly with the expected delivery date for your items.
            </Text>
          </div>

          {/* Delivery Details Card */}
          <div className="bg-ivory-bg rounded-lg p-6 shadow-md border" style={{ borderColor: '#C0C0C0' }}>
            <div className="flex flex-col md:flex-row justify-between items-start gap-6">
              <div className="flex-1">
                <Text className="text-gray-600 text-sm mb-2">Delivering to:</Text>
                <Text className="text-lg font-semibold text-gray-900 mb-1">
                  {fullName || "Customer"} {phone && `| ${phone}`}
                </Text>
                {order.email && (
                  <Text className="text-gray-700 mt-1" data-testid="order-confirm-email">
                    Email: {order.email}
                  </Text>
                )}
                <Text className="text-gray-700 mt-2">
                  {address || "Address not available"}
                </Text>
                {cookies.get("_medusa_jwt")?.value && (
                  <LocalizedClientLink
                    href={`/orders/${order.id}`}
                    className="inline-block mt-4 px-4 py-2 border text-sm font-medium transition-colors"
                    style={{
                      className: 'border-gold-accent',
                      className: 'text-gold-accent',
                      borderRadius: '30px'
                    }}
                  >
                    Order Details &gt;
                  </LocalizedClientLink>
                )}
              </div>
              <div className="flex-shrink-0">
                <div className="relative w-32 h-32">
                  <Image
                    src="/BIKE.png"
                    alt="Delivery"
                    fill
                    className="object-contain"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Order Items Card */}
          <div className="bg-ivory-bg rounded-lg p-6 shadow-md border" style={{ borderColor: '#C0C0C0' }}>
            <Heading
              level="h2"
              className="text-2xl font-bold mb-6 text-gold-accent"
            >
              Order Items
            </Heading>
            <div className="space-y-6">
              {order.items?.map((item) => (
                <LocalizedClientLink 
                  key={item.id} 
                  href={`/products/${item.variant?.product?.handle}`}
                  className="flex items-center gap-6 pb-6 border-b last:border-b-0 last:pb-0 group" 
                  style={{ borderColor: '#F3F4F6' }}
                >
                  <div className="w-20 h-20 sm:w-24 sm:h-24 flex-shrink-0 bg-gray-50 rounded-xl overflow-hidden border border-gray-100 group-hover:opacity-80 transition-opacity">
                    <Thumbnail
                      thumbnail={item.thumbnail}
                      variantImages={item.variant?.images}
                      images={item.variant?.product?.images}
                      size="square"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <Text className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold block mb-1">
                      Cultura Jewels
                    </Text>
                    <Heading level="h3" className="font-bold text-[#04122C] text-lg mb-1 truncate group-hover:text-gold-accent transition-colors">
                      {item.product_title || item.title}
                    </Heading>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                      <Text className="text-sm font-medium text-gray-500">
                        {item.variant?.title && `Variant: ${item.variant.title}`}
                      </Text>
                      {item.variant?.title && <Text className="text-sm font-medium text-gray-300">|</Text>}
                      <Text className="text-sm font-medium text-gray-500">
                        Qty: {item.quantity}
                      </Text>
                    </div>
                  </div>
                  <div className="text-right flex flex-col items-end gap-1">
                    <Text className="font-bold text-[#04122C] text-lg whitespace-nowrap">
                      {convertToLocale({
                        amount: item.total || (item.unit_price || 0) * (item.quantity || 0),
                        currency_code: order.currency_code,
                      })}
                    </Text>
                    <Text className="text-xs text-gray-400 whitespace-nowrap">
                      {convertToLocale({
                        amount: item.unit_price || 0,
                        currency_code: order.currency_code,
                      })} Each
                    </Text>
                  </div>
                </LocalizedClientLink>
              ))}
            </div>

            {/* Order Summary */}
            <div className="mt-8 pt-6 border-t border-gray-100 space-y-3">
              <div className="flex justify-between items-center text-gray-600">
                <Text>Subtotal</Text>
                <Text className="font-medium">{convertToLocale({ amount: order.subtotal || 0, currency_code: order.currency_code })}</Text>
              </div>
              <div className="flex justify-between items-center text-gray-600">
                <Text>Shipping</Text>
                <Text className="font-medium">{convertToLocale({ amount: order.shipping_total || 0, currency_code: order.currency_code })}</Text>
              </div>
              {(order.tax_total || 0) > 0 && (
                <div className="flex justify-between items-center text-gray-600">
                  <Text>Tax</Text>
                  <Text className="font-medium">{convertToLocale({ amount: order.tax_total || 0, currency_code: order.currency_code })}</Text>
                </div>
              )}
              {(order.discount_total || 0) > 0 && (
                <div className="flex justify-between items-center text-red-500">
                  <Text>Discount</Text>
                  <Text className="font-medium">-{convertToLocale({ amount: order.discount_total || 0, currency_code: order.currency_code })}</Text>
                </div>
              )}
              <div className="flex justify-between items-center mt-6 pt-4 border-t-2" style={{ borderColor: '#F3F4F6' }}>
                <Text className="text-xl font-bold text-gray-900">Total Amount Paid</Text>
                <Text className="text-2xl font-black text-gold-accent">
                  {convertToLocale({ amount: order.total || 0, currency_code: order.currency_code })}
                </Text>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <LocalizedClientLink
              href="/store"
              className="px-16 py-3 border-2 text-center font-semibold transition-colors bg-ivory-bg"
              style={{
                className: 'border-gold-accent',
                className: 'text-gold-accent',
                borderRadius: '30px',
                minWidth: '250px'
              }}
            >
              Continue Shopping
            </LocalizedClientLink>
            <LocalizedClientLink
              href={cookies.get("_medusa_jwt")?.value ? "/account/orders" : `/account?view=guest&email=${order.email}`}
              className="px-16 py-3 text-center font-semibold text-white transition-colors"
              style={{
                backgroundColor: '#0A1D37',
                borderRadius: '30px',
                minWidth: '250px'
              }}
            >
              {cookies.get("_medusa_jwt")?.value ? "View Orders" : "Track Guest Order"}
            </LocalizedClientLink>
          </div>
        </div>
      </div>
    </div>
  )
}
