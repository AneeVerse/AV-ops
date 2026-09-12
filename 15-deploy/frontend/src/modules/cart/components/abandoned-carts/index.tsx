"use client"

import { HttpTypes } from "@medusajs/types"
import { Button, Heading, Text } from "@medusajs/ui"
import Link from "next/link"
import { ShoppingBag, ArrowRight, Zap, RefreshCw, Loader2 } from "lucide-react"
import { Trash } from "@medusajs/icons"
import { useState, useTransition, useEffect } from "react"
import { resumeAbandonedCart, deleteCart } from "@lib/data/cart"
import Modal from "@modules/common/components/modal"
import { convertToLocale } from "@lib/util/money"

type AbandonedCartsProps = {
  abandonedCarts?: {
    buyNowCarts: HttpTypes.StoreCart[]
    reorderCarts: HttpTypes.StoreCart[]
  }
  countryCode: string
}

export default function AbandonedCarts({ abandonedCarts, countryCode }: AbandonedCartsProps) {
  const [dismissed, setDismissed] = useState<Record<string, boolean>>({})
  const [isPending, startTransition] = useTransition()
  const [resumingId, setResumingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [expandedCarts, setExpandedCarts] = useState<Record<string, boolean>>({})
  const [activeTab, setActiveTab] = useState<"buy_now" | "reorder">("buy_now")

  const buyNowCarts = abandonedCarts?.buyNowCarts ?? []
  const reorderCarts = abandonedCarts?.reorderCarts ?? []

  const activeBuyNowCarts = buyNowCarts.filter(cart => !dismissed[cart.id])
  const activeReorderCarts = reorderCarts.filter(cart => !dismissed[cart.id])

  useEffect(() => {
    if (activeBuyNowCarts.length === 0 && activeReorderCarts.length > 0 && activeTab === "buy_now") {
      setActiveTab("reorder")
    } else if (activeReorderCarts.length === 0 && activeBuyNowCarts.length > 0 && activeTab === "reorder") {
      setActiveTab("buy_now")
    }
  }, [activeBuyNowCarts.length, activeReorderCarts.length, activeTab])

  if (!abandonedCarts) return null

  if (activeBuyNowCarts.length === 0 && activeReorderCarts.length === 0) return null

  const handleDelete = async () => {
    if (!deletingId) return
    
    setIsDeleting(true)
    const result = await deleteCart(deletingId)
    
    if (result.success) {
      setDismissed(prev => ({ ...prev, [deletingId]: true }))
      setDeletingId(null)
    }
    setIsDeleting(false)
  }

  const handleResume = (cartId: string) => {
    setResumingId(cartId)
    startTransition(() => {
      resumeAbandonedCart(cartId, countryCode)
    })
  }

  const renderCartCard = (cart: HttpTypes.StoreCart, type: "buy_now" | "reorder") => {
    const itemCount = cart.items?.reduce((acc, item) => acc + item.quantity, 0) || 0
    const items = cart.items || []
    const total = items.reduce((acc, item) => acc + (item.total || 0), 0).toFixed(2)
    
    const isBuyNow = type === "buy_now"
    const isResuming = isPending && resumingId === cart.id

    return (
      <div key={cart.id} className="relative group bg-white border border-gold-accent/10/80 rounded-xl p-3 md:p-4 shadow-sm hover:shadow-md hover:border-gold-accent/20 transition-all duration-300">
        <button
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setDeletingId(cart.id)
          }}
          className="absolute top-1.5 right-1.5 text-gray-400 hover:text-gray-900 bg-transparent hover:bg-gold-accent/10/60 rounded-full p-2 transition-colors z-20 cursor-pointer"
          title="Delete this cart"
          disabled={isResuming || (isDeleting && deletingId === cart.id)}
        >
          {isDeleting && deletingId === cart.id ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Trash className="w-4 h-4 pointer-events-none" />
          )}
        </button>

        <div className="flex flex-col gap-2 relative z-10">
          {/* Badge */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gold-accent bg-royal-blue/10 px-2 py-0.5 rounded-md">
              {isBuyNow ? "Buy Now Order" : "Reorder Order"}
            </span>
          </div>

          {/* Items List */}
          <div className="flex flex-col gap-2">
            {(expandedCarts[cart.id] ? items : items.slice(0, 1)).map((item, index) => (
              <div key={item.id} className={`flex items-center gap-3 ${index > 0 ? 'pt-2 border-t border-gray-100' : ''}`}>
                <div className="w-16 h-16 rounded-lg bg-gold-accent/10/60 flex items-center justify-center flex-shrink-0 overflow-hidden border border-gold-accent/10/60">
                  {item.thumbnail ? (
                    <img src={item.thumbnail} alt={item.title} className="w-full h-full object-cover" />
                  ) : (
                    <ShoppingBag className="w-4 h-4 text-gold-accent/30" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 text-xs md:text-sm line-clamp-1">{item.title}</h3>
                  <p className="text-gray-500 text-[11px] mt-0.5 font-medium">
                    Qty: {item.quantity} &nbsp;•&nbsp;{" "}
                    <span className="text-gray-900 font-semibold">
                      {convertToLocale({
                        amount: item.total ?? 0,
                        currency_code: cart.currency_code,
                      })}
                    </span>
                  </p>
                </div>
              </div>
            ))}
            
            {items.length > 1 && (
              <div className="flex items-center gap-2.5 mt-1">
                <button 
                  onClick={(e) => {
                    e.preventDefault()
                    setExpandedCarts(prev => ({ ...prev, [cart.id]: !prev[cart.id] }))
                  }}
                  className="text-[10px] font-bold text-gold-accent hover:text-gold-hover transition-colors flex items-center gap-1.5 w-fit uppercase tracking-tight whitespace-nowrap"
                >
                  {expandedCarts[cart.id] ? "Show Less" : `+ View ${items.length - 1} more`}
                </button>
                
                {!expandedCarts[cart.id] && (
                  <div className="flex -space-x-1.5">
                    {items.slice(1, 4).map((item, idx) => {
                      const bgColors = ['bg-[#0D9488]', 'bg-[#1E293B]', 'bg-[#0891B2]']
                      return (
                        <div 
                          key={item.id} 
                          className={`w-5 h-5 rounded-full border border-white flex items-center justify-center overflow-hidden shadow-sm ${bgColors[idx % 3]}`}
                          title={item.title}
                        >
                          {item.thumbnail ? (
                            <img src={item.thumbnail} alt={item.title} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-[7px] font-bold text-white">
                              {item.title?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                            </span>
                          )}
                        </div>
                      )
                    })}
                    {items.length > 4 && (
                      <div className="w-5 h-5 rounded-full border border-white bg-gold-accent/10 flex items-center justify-center text-[7px] font-bold text-gold-accent shadow-sm">
                        +{items.length - 4}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer: Total + Resume Button */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-gold-accent/10/40">
            <p className="text-gray-600 text-xs font-medium">
              {itemCount} {itemCount === 1 ? 'item' : 'items'} &nbsp;•&nbsp; Total:{" "}
              <span className="text-gray-900 font-bold text-sm">
                {convertToLocale({
                  amount: Number(total),
                  currency_code: cart.currency_code,
                })}
              </span>
            </p>
            <Button 
              variant="primary"
              onClick={() => handleResume(cart.id)}
              disabled={isResuming || isDeleting}
              className="w-full sm:w-auto rounded-xl bg-royal-blue hover:bg-gold-accent text-white shadow-royal-blue/20 hover:shadow-royal-blue/30 transition-all font-semibold flex items-center justify-center gap-2 h-9 px-4 text-sm group/btn"
            >
              {isResuming ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  {isBuyNow ? "Continue Checkout" : "Continue Reorder"}
                  <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const buyNowTotalItems = activeBuyNowCarts.reduce((acc, cart) => acc + (cart.items?.reduce((a, i) => a + i.quantity, 0) || 0), 0)
  const reorderTotalItems = activeReorderCarts.reduce((acc, cart) => acc + (cart.items?.reduce((a, i) => a + i.quantity, 0) || 0), 0)

  return (
    <>
      <div id="abandoned-carts-section" className="w-full flex flex-col gap-3 animate-in fade-in duration-500 scroll-mt-24 min-[1024px]:scroll-mt-32">
        
        {/* Tabs Navigation */}
        {(activeBuyNowCarts.length > 0 && activeReorderCarts.length > 0) && (
          <div className="flex items-center gap-1 bg-gold-accent/10 p-1 rounded-2xl border border-gold-accent/10/60 w-fit mx-auto">
            <button
              onClick={() => setActiveTab("buy_now")}
              className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === "buy_now" ? "bg-white text-gold-accent shadow-md shadow-gold-accent/20" : "text-gray-500 hover:text-gray-900"}`}
            >
              Buy Now ({activeBuyNowCarts.length})
            </button>
            <button
              onClick={() => setActiveTab("reorder")}
              className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === "reorder" ? "bg-white text-gold-accent shadow-md shadow-gold-accent/20" : "text-gray-500 hover:text-gray-900"}`}
            >
              Reorder ({activeReorderCarts.length})
            </button>
          </div>
        )}

        {/* BUY NOW SECTION */}
        {activeTab === "buy_now" && activeBuyNowCarts.length > 0 && (
          <div className="bg-white rounded-2xl border border-gold-accent/10/80 shadow-sm overflow-hidden relative">
            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-gold-accent/5 to-gold-accent/10 rounded-bl-[100px] -z-10 pointer-events-none" />
            
            <div className="p-3 md:p-4 border-b border-gold-accent/10/60 flex items-start justify-between gap-3 md:gap-4">
              <div className="flex items-start gap-2.5">
                <div className="bg-royal-blue/10 p-1.5 rounded-lg shadow-sm border border-gold-accent/10/50 flex-shrink-0">
                  <Zap className="w-4 h-4 text-gold-accent fill-gold-accent/10" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900 tracking-tight leading-tight">Pending Buy Now Order</h2>
                  <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                    Your Buy Now items are pending. Proceed to checkout to complete your order.
                  </p>
                </div>
              </div>
              <div className="hidden sm:flex items-center mt-0.5">
                <span className="text-gold-accent font-bold bg-royal-blue/10 px-2.5 py-1 rounded-full text-[11px] whitespace-nowrap border border-gold-accent/10">
                  {buyNowTotalItems} {buyNowTotalItems === 1 ? 'Item' : 'Items'} Pending
                </span>
              </div>
            </div>
            <div className={`p-3 md:p-4 grid gap-3 bg-gold-accent/10/10 ${activeBuyNowCarts.length === 1 ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
              {/* Mobile items count */}
              <div className="sm:hidden mb-1">
                 <span className="text-gold-accent font-bold bg-royal-blue/10 px-3 py-1 rounded-full text-xs whitespace-nowrap border border-gold-accent/10 inline-block">
                  {buyNowTotalItems} {buyNowTotalItems === 1 ? 'Item' : 'Items'} Pending
                </span>
              </div>
              {activeBuyNowCarts.map(cart => renderCartCard(cart, "buy_now"))}
            </div>
          </div>
        )}

        {/* REORDER SECTION */}
        {(activeTab === "reorder" || activeBuyNowCarts.length === 0) && activeReorderCarts.length > 0 && (
          <div className="bg-white rounded-2xl border border-gold-accent/10/80 shadow-sm overflow-hidden relative">
            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-gold-accent/5 to-gold-accent/10 rounded-bl-[100px] -z-10 pointer-events-none" />
            
            <div className="p-3 md:p-4 border-b border-gold-accent/10/60 flex items-start justify-between gap-3 md:gap-4">
              <div className="flex items-start gap-2.5">
                <div className="bg-royal-blue/10 p-1.5 rounded-lg shadow-sm border border-gold-accent/10/50 flex-shrink-0">
                  <RefreshCw className="w-4 h-4 text-gold-accent" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900 tracking-tight leading-tight">Pending Reorder Order</h2>
                  <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                    Your reorder items are pending. Proceed to checkout to complete your order.
                  </p>
                </div>
              </div>
              <div className="hidden sm:flex items-center mt-0.5">
                <span className="text-gold-accent font-bold bg-royal-blue/10 px-2.5 py-1 rounded-full text-[11px] whitespace-nowrap border border-gold-accent/10">
                  {reorderTotalItems} {reorderTotalItems === 1 ? 'Item' : 'Items'} Pending
                </span>
              </div>
            </div>
            <div className={`p-3 md:p-4 grid gap-3 bg-gold-accent/10/10 ${activeReorderCarts.length === 1 ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
               {/* Mobile items count */}
               <div className="sm:hidden mb-1">
                 <span className="text-gold-accent font-bold bg-royal-blue/10 px-3 py-1 rounded-full text-xs whitespace-nowrap border border-gold-accent/10 inline-block">
                  {reorderTotalItems} {reorderTotalItems === 1 ? 'Item' : 'Items'} Pending
                </span>
              </div>
              {activeReorderCarts.map(cart => renderCartCard(cart, "reorder"))}
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      <Modal isOpen={!!deletingId} close={() => setDeletingId(null)} size="xsmall">
        <div className="p-7 md:p-9">
          <div className="flex flex-col items-center text-center">
            {/* Icon Container */}
            <div className="w-13 h-13 rounded-full bg-[#FFF5F5] flex items-center justify-center mb-5">
              <Trash className="w-6 h-6 text-[#F34E4E]" />
            </div>
            
            {/* Title */}
            <h2 className="text-xl md:text-2xl font-extrabold text-[#111827] mb-2 tracking-tight">
              Remove Order?
            </h2>
            
            {/* Description */}
            <p className="text-[#6B7280] text-sm md:text-base leading-relaxed mb-7 max-w-[280px]">
              Are you sure you want to remove this pending order? This action cannot be undone.
            </p>
            
            {/* Actions */}
            <div className="flex flex-row gap-3 w-full">
              <button 
                onClick={() => setDeletingId(null)}
                disabled={isDeleting}
                className="flex-1 bg-white hover:bg-gray-50 text-[#111827] font-bold h-[48px] rounded-xl text-sm md:text-base transition-all active:scale-[0.98] border-2 border-[#E5E7EB] disabled:opacity-70 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button 
                onClick={handleDelete} 
                disabled={isDeleting}
                className="flex-1 bg-[#F34E4E] hover:bg-[#E03E3E] text-white font-bold h-[48px] rounded-xl text-sm md:text-base transition-all active:scale-[0.98] flex items-center justify-center border-2 border-[#111827] disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isDeleting ? (
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                ) : (
                  "Yes, Remove"
                )}
              </button>
            </div>
          </div>
        </div>
      </Modal>
    </>
  )
}
