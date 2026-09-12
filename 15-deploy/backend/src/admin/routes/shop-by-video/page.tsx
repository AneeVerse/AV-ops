import { defineRouteConfig } from "@medusajs/admin-sdk"
import { PlaySolid } from "@medusajs/icons"
import ShopByVideoManager from "../../components/shop-by-video-manager"

const ShopByVideoPage = () => {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <ShopByVideoManager />
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Shop By Video",
  icon: PlaySolid,
})

export default ShopByVideoPage
