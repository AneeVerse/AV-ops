import { Metadata } from "next"
import { notFound } from "next/navigation"
import { listProducts } from "@lib/data/products"
import { getRegion } from "@lib/data/regions"
import ProductTemplate from "@modules/products/templates"
import { HttpTypes } from "@medusajs/types"
import { getImagesForVariant } from "@lib/util/product"

type Props = {
  params: Promise<{ countryCode: string; handle: string }>
  searchParams: Promise<{ v_id?: string }>
}

// Always render on demand — avoid static-path workers that corrupt .next on Windows
export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const revalidate = 0

export async function generateMetadata(props: Props): Promise<Metadata> {
  try {
    const params = await props.params
    const { handle } = params
    const region = await getRegion(params.countryCode)

    if (!region) {
      // During build, if backend is unavailable, return default metadata
      if (process.env.NODE_ENV === 'production' || process.env.CI) {
        return {
          title: 'Product | Cultura Jewels',
          description: 'Product',
        }
      }
      notFound()
    }

    const product = await listProducts({
      countryCode: params.countryCode,
      queryParams: { handle },
    }).then(({ response }) => response.products[0])

    if (!product) {
      // During build, if backend is unavailable, return default metadata
      if (process.env.NODE_ENV === 'production' || process.env.CI) {
        return {
          title: 'Product | Cultura Jewels',
          description: 'Product',
        }
      }
      notFound()
    }

    return {
      title: `${product.title} | Cultura Jewels`,
      description: `${product.title}`,
      openGraph: {
        title: `${product.title} | Cultura Jewels`,
        description: `${product.title}`,
        images: product.thumbnail ? [product.thumbnail] : [],
      },
    }
  } catch (error: any) {
    // During build, if backend is unavailable, return default metadata
    if (process.env.NODE_ENV === 'production' || process.env.CI) {
      return {
        title: 'Product | Cultura Jewels',
        description: 'Product',
      }
    }
    notFound()
  }
}

export default async function ProductPage(props: Props) {
  const params = await props.params
  const searchParams = await props.searchParams



  const region = await getRegion(params.countryCode)

  if (!region) {
    notFound()
  }

  const selectedVariantId = searchParams.v_id



  const loadByHandle = async (handle: string) =>
    listProducts({
      countryCode: params.countryCode,
      queryParams: { handle },
    })
      .then(({ response }) => response.products[0])
      .catch(() => null)

  // Prefer exact handle; also accept underscore/hyphen swaps so old URLs still resolve.
  let pricedProduct = await loadByHandle(params.handle)
  if (!pricedProduct && params.handle.includes("_")) {
    pricedProduct = await loadByHandle(params.handle.replaceAll("_", "-"))
  } else if (!pricedProduct && params.handle.includes("-")) {
    pricedProduct = await loadByHandle(params.handle.replaceAll("-", "_"))
  }

  if (!pricedProduct) {
    notFound()
  }

  const images = getImagesForVariant(pricedProduct, selectedVariantId)

  // Detailed product information for single product page
  const productDetails = {
    id: pricedProduct.id,
    title: pricedProduct.title,
    handle: pricedProduct.handle,
    description: pricedProduct.description,
    status: pricedProduct.status,
    thumbnail: pricedProduct.thumbnail,
    images: pricedProduct.images?.map((img: any) => ({
      id: img.id,
      url: img.url,
    })) || [],
    imagesCount: images?.length || 0,
    selectedVariantId: selectedVariantId,
    variants: pricedProduct.variants?.map((v: any) => ({
      id: v.id,
      sku: v.sku,
      title: v.title,
      inventory_quantity: v.inventory_quantity,
      calculated_price: v.calculated_price?.calculated_amount
        ? `${(v.calculated_price.calculated_amount / 100).toFixed(2)} ${v.calculated_price.currency_code || ''}`
        : 'N/A',
      imagesCount: v.images?.length || 0,
      options: v.options?.map((o: any) => ({
        option_id: o.option_id,
        value: o.value,
      })) || [],
    })) || [],
    variantsCount: pricedProduct.variants?.length || 0,
    tags: pricedProduct.tags?.map((t: any) => t.value) || [],
    metadata: pricedProduct.metadata || {},
    average_rating: (pricedProduct as any).average_rating,
    total_rating_count: (pricedProduct as any).total_rating_count,
    total_rating_sum: (pricedProduct as any).total_rating_sum,
    created_at: pricedProduct.created_at,
    updated_at: pricedProduct.updated_at,
    region: {
      id: region.id,
      name: region.name,
      currency_code: region.currency_code,
    },
  }



  return (
    <ProductTemplate
      product={pricedProduct}
      region={region}
      countryCode={params.countryCode}
      images={images || []}
      selectedVariantId={selectedVariantId}
    />
  )
}
