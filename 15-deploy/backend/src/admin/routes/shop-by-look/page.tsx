import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Camera } from "@medusajs/icons"
import ShopByLookManager from "../../components/shop-by-look-manager"

const ShopByLookPage = () => {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <ShopByLookManager />
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Shop By Look",
  icon: Camera,
})

export default ShopByLookPage
