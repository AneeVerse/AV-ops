"use client"

import { Badge, Heading, Input, Label, Text } from "@medusajs/ui"
import React from "react"
import { useRouter } from "next/navigation"

import { applyPromotions } from "@lib/data/cart"
import { convertToLocale } from "@lib/util/money"
import { HttpTypes } from "@medusajs/types"
import Trash from "@modules/common/icons/trash"
import ErrorMessage from "../error-message"
import { SubmitButton } from "../submit-button"

type DiscountCodeProps = {
  cart: HttpTypes.StoreCart & {
    promotions: HttpTypes.StorePromotion[]
  }
}

const DiscountCode: React.FC<DiscountCodeProps> = ({ cart }) => {
  const router = useRouter()
  const [isOpen, setIsOpen] = React.useState(false)
  const [errorMessage, setErrorMessage] = React.useState("")
  const [successMessage, setSuccessMessage] = React.useState("")

  const { promotions = [] } = cart
  const removePromotionCode = async (code: string) => {
    const validPromotions = promotions.filter(
      (promotion) => promotion.code !== code
    )

    await applyPromotions(
      validPromotions.filter((p) => p.code !== undefined).map((p) => p.code!)
    )
    setSuccessMessage("")
    router.refresh()
  }

  const addPromotionCode = async (formData: FormData) => {
    setErrorMessage("")
    setSuccessMessage("")

    const code = formData.get("code")
    if (!code) {
      return
    }
    const input = document.getElementById("promotion-input") as HTMLInputElement
    const codes = promotions
      .filter((p) => p.code !== undefined)
      .map((p) => p.code!)
    codes.push(code.toString())

    try {
      const updatedCart = await applyPromotions(codes)
      const hasDiscount = (updatedCart?.discount_total || 0) > 0
      
      if (hasDiscount) {
        setSuccessMessage("Coupon applied successfully!")
      } else {
        setErrorMessage("Coupon added, but it doesn't apply to the items in your bag.")
      }
      router.refresh()
    } catch (e: any) {
      setErrorMessage("Invalid coupon code. Please check the code and try again.")
    }

    if (input) {
      input.value = ""
    }
  }

  return (
    <div
      className="border border-gray-200 rounded-lg p-6 flex flex-col"
      style={{ width: '480px', maxWidth: '100%' }}
    >
      {/* COUPONS Heading */}
      <Heading className="text-lg font-bold text-gray-900 mb-4 uppercase">
        COUPONS
      </Heading>

      {/* Apply Coupons Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        type="button"
        className="w-full rounded-lg p-4 flex items-center justify-between transition-colors border border-gold-accent/20"
        style={{ backgroundColor: '#D195FF33' }}
        data-testid="add-discount-button"
      >
        <div className="flex items-center gap-3">
          {/* Percentage Icon - White circle with black % symbol */}
          <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center flex-shrink-0 shadow-sm">
            <span className="text-gray-900 font-bold text-xl">%</span>
          </div>

          {/* Text Content */}
          <div className="flex flex-col items-start">
            <span className="font-bold text-base text-gray-900">
              Apply Coupons
            </span>
            <span className="text-sm text-gray-500">
              View all offers
            </span>
          </div>
        </div>

        {/* Chevron Icon */}
        <svg
          className="w-5 h-5 text-gray-900"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5l7 7-7 7"
          />
        </svg>
      </button>

      {/* Promotion Code Input Form */}
      {isOpen && (
        <form action={(a) => addPromotionCode(a)} className="w-full mt-4">
          <div className="flex w-full gap-x-2">
            <Input
              className="size-full"
              id="promotion-input"
              name="code"
              type="text"
              autoFocus={false}
              placeholder="Enter coupon code"
              data-testid="discount-input"
            />
            <SubmitButton
              variant="secondary"
              className="!bg-royal-blue hover:!bg-gold-accent text-white border-0"
              data-testid="discount-apply-button"
            >
              Apply
            </SubmitButton>
          </div>

          <ErrorMessage
            error={errorMessage}
            data-testid="discount-error-message"
          />

          {successMessage && (
            <div
              className="mt-2 text-sm text-green-500"
              data-testid="discount-success-message"
            >
              {successMessage}
            </div>
          )}
        </form>
      )}

      {/* Applied Promotions - Clean Card Redesign */}
      {promotions.length > 0 && (
        <div className="w-full flex flex-col mt-6 pt-4 border-t border-gray-100">
          <Heading className="text-sm font-bold mb-3 text-gray-900 uppercase tracking-tight">
            Promotion(s) applied:
          </Heading>

          <div className="flex flex-col gap-y-2">
            {promotions.map((promotion) => {
              return (
                <div
                  key={promotion.id}
                  className="flex items-center justify-between w-full p-3 rounded-xl border border-gold-accent/10 bg-gold-accent/10 transition-all hover:bg-gold-accent/10 group"
                  data-testid="discount-row"
                >
                  <div className="flex items-center gap-x-3 overflow-hidden">
                    {/* Tag Icon */}
                    <div className="flex-shrink-0 text-gold-accent">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
                        <line x1="7" y1="7" x2="7.01" y2="7"></line>
                      </svg>
                    </div>

                    <div className="flex flex-col overflow-hidden">
                      <span className="font-bold truncate text-sm uppercase tracking-wider text-gold-accent" data-testid="discount-code">
                        {promotion.code}
                      </span>
                      {promotion.application_method?.value !== undefined && (
                        <span className="text-xs font-bold" style={{ color: '#D4AF37' }}>
                          {promotion.application_method.type === "percentage"
                            ? `${promotion.application_method.value}% OFF`
                            : `${convertToLocale({
                                amount: +promotion.application_method.value,
                                currency_code: promotion.application_method.currency_code || "INR",
                              })} OFF`}
                        </span>
                      )}
                    </div>
                  </div>

                  {!promotion.is_automatic && (
                    <button
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all"
                      onClick={() => {
                        if (!promotion.code) return
                        removePromotionCode(promotion.code)
                      }}
                      data-testid="remove-discount-button"
                    >
                      <Trash size={16} />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default DiscountCode
