/*
import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import ImageKit from "imagekit"

export default async function productCreatedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  try {
    const productId = data.id
    if (!productId) return

    const query = container.resolve(ContainerRegistrationKeys.QUERY) as any
    const { data: products } = await query.graph({
      entity: "product",
      fields: ["id", "title", "handle", "thumbnail", "images.url"],
      filters: { id: productId },
    })

    const product = products?.[0]
    if (!product || !product.title || !product.images || product.images.length === 0) {
      return
    }

    const sanitizedTitle = product.title
      .trim()
      .replace(/[^a-zA-Z0-9\s_-]/g, "")
      .replace(/\s+/g, "-") || "general"

    const targetFolder = `/culturajewels/products/${sanitizedTitle}/images`

    const imagekit = new ImageKit({
      urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT || "https://ik.imagekit.io/klyonjb5v",
      publicKey: process.env.IMAGEKIT_PUBLIC_KEY || "public_lKCn/W0POQ1k/Dyg3MJbWyxsz6k=",
      privateKey: process.env.IMAGEKIT_PRIVATE_KEY || "private_XY6DpjDB+kMVEetdkY4S0J4J1Ls=",
    })

    let updated = false
    const updatedImages: { url: string }[] = []

    for (const img of product.images) {
      const url = img.url || ""
      if (!url || url.includes(`/culturajewels/products/${sanitizedTitle}/`)) {
        updatedImages.push({ url })
        continue
      }

      try {
        const res = await imagekit.upload({
          file: url,
          fileName: url.split("/").pop() || "product-image.jpg",
          folder: targetFolder,
          useUniqueFileName: true,
        })

        if (res?.url) {
          updatedImages.push({ url: res.url })
          updated = true
        } else {
          updatedImages.push({ url })
        }
      } catch (err) {
        console.warn(`[productCreatedHandler] Failed to copy image to ${targetFolder}:`, err)
        updatedImages.push({ url })
      }
    }

    if (updated && updatedImages.length > 0) {
      const productModuleService = container.resolve(Modules.PRODUCT) as any
      const updateData: any = {
        images: updatedImages,
      }
      if (updatedImages[0]?.url) {
        updateData.thumbnail = updatedImages[0].url
      }
      await productModuleService.updateProducts(productId, updateData)
      console.log(`[productCreatedHandler] Organized images for product "${product.title}" into ${targetFolder}`)
    }
  } catch (error) {
    console.error("[productCreatedHandler] Error organizing product images:", error)
  }
}

export const config: SubscriberConfig = {
  event: "product.created",
}
*/

// Currently disabled - Product Media Directory Widget manages folder uploads directly
export default async function productCreatedHandler() {}
