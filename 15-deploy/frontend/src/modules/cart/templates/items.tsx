import repeat from "@lib/util/repeat"
import { HttpTypes } from "@medusajs/types"
import { Heading } from "@medusajs/ui"

import CartItemCard from "@modules/cart/components/cart-item-card"
import AppliedPromotions from "@modules/cart/components/applied-promotions"
import SkeletonLineItem from "@modules/skeletons/components/skeleton-line-item"

type ItemsTemplateProps = {
  cart?: HttpTypes.StoreCart
}

const ItemsTemplate = ({ cart }: ItemsTemplateProps) => {
  const items = cart?.items
  return (
    <div className="flex flex-col gap-y-4 min-[550px]:gap-y-6">
      <div className="bg-white border border-gray-200 rounded-lg p-3 min-[550px]:p-4 sm:p-5 md:p-6 min-[1023px]:p-4 min-[1150px]:p-5 min-[1360px]:p-6 w-full overflow-hidden">
        <div className="pb-2.5 min-[550px]:pb-3 sm:pb-4 min-[1023px]:pb-3 min-[1150px]:pb-4 min-[1360px]:pb-4 flex items-center justify-between border-b border-gray-200 mb-2.5 min-[550px]:mb-3 sm:mb-4 min-[1023px]:mb-3 min-[1150px]:mb-4 min-[1360px]:mb-4">
          <Heading className="text-lg min-[550px]:text-xl sm:text-2xl min-[1023px]:text-xl min-[1150px]:text-2xl min-[1360px]:text-2xl font-bold text-gray-900">Your Bag</Heading>
          {items && items.length > 0 && (
            <span className="text-xs min-[550px]:text-xs sm:text-sm min-[1023px]:text-xs min-[1150px]:text-sm min-[1360px]:text-sm text-gray-600">{items.length} {items.length === 1 ? 'item' : 'items'}</span>
          )}
        </div>
        <div className="w-full">
          {items
            ? items
                .sort((a, b) => {
                  return (a.created_at ?? "") > (b.created_at ?? "") ? -1 : 1
                })
                .map((item) => {
                  return (
                    <CartItemCard
                      key={item.id}
                      item={item}
                      currencyCode={cart?.currency_code || "INR"}
                    />
                  )
                })
            : repeat(5).map((i) => {
                return <SkeletonLineItem key={i} />
              })}
        </div>
      </div>
      <AppliedPromotions cart={cart as any} />
    </div>
  )
}

export default ItemsTemplate
