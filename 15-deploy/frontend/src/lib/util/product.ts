import { HttpTypes } from "@medusajs/types";

export const isSimpleProduct = (product: HttpTypes.StoreProduct): boolean => {
    return product.options?.length === 1 && product.options[0].values?.length === 1;
}

export function variantOptionsAsKeymap(
    variantOptions: HttpTypes.StoreProductVariant["options"]
): Record<string, string> {
    return (
        variantOptions?.reduce((acc: Record<string, string>, option) => {
            if (option.option_id) {
                acc[option.option_id] = option.value
            }
            return acc
        }, {}) ?? {}
    )
}

/**
 * Resolves which variant should drive the product gallery.
 * Uses the exact variant when all options match; otherwise the first variant
 * that matches whatever options the shopper has already picked (e.g. color only).
 */
export function resolveDisplayVariant(
    product: HttpTypes.StoreProduct,
    options: Record<string, string | undefined>
): HttpTypes.StoreProductVariant | undefined {
    const exactMatch = findExactVariant(product, options)

    if (exactMatch) {
        return exactMatch
    }

    const matchingVariants = resolveMatchingVariants(product, options)

    return matchingVariants[0]
}

function findExactVariant(
    product: HttpTypes.StoreProduct,
    options: Record<string, string | undefined>
): HttpTypes.StoreProductVariant | undefined {
    if (!product.variants?.length) {
        return undefined
    }

    return product.variants.find((variant) => {
        const variantOptions = variantOptionsAsKeymap(variant.options)

        return Object.entries(variantOptions).every(
            ([optionId, value]) => options[optionId] === value
        )
    })
}

/** All variants matching the currently selected options (supports partial selection). */
export function resolveMatchingVariants(
    product: HttpTypes.StoreProduct,
    options: Record<string, string | undefined>
): HttpTypes.StoreProductVariant[] {
    const selectedEntries = Object.entries(options).filter(
        (entry): entry is [string, string] => Boolean(entry[1])
    )

    if (!selectedEntries.length || !product.variants?.length) {
        return []
    }

    return product.variants.filter((variant) => {
        const variantOptions = variantOptionsAsKeymap(variant.options)

        return selectedEntries.every(
            ([optionId, value]) => variantOptions[optionId] === value
        )
    })
}

function dedupeImages(
    images: HttpTypes.StoreProductImage[]
): HttpTypes.StoreProductImage[] {
    const seen: ImageMatchKeys = {
        urlKeys: new Set<string>(),
        idKeys: new Set<string>(),
    }
    const deduped: HttpTypes.StoreProductImage[] = []

    images.forEach((image) => {
        if (!image.url || imageMatchesKeys(image, seen)) {
            return
        }

        deduped.push(image)
        addImageToMatchKeys(image, seen)
    })

    return deduped
}

type ImageMatchKeys = {
    urlKeys: Set<string>
    idKeys: Set<string>
}

function addImageToMatchKeys(
    image: Pick<HttpTypes.StoreProductImage, "url" | "id"> | undefined | null,
    keys: ImageMatchKeys
) {
    if (!image?.url) {
        return
    }

    const cleanUrl = image.url.split("?")[0].toLowerCase().trim()
    const urlPath = cleanUrl.split("/").pop() || ""

    keys.urlKeys.add(cleanUrl)
    if (urlPath) {
        keys.urlKeys.add(urlPath.toLowerCase())
    }

    if (image.id) {
        keys.idKeys.add(image.id)
    }
}

function imageMatchesKeys(
    image: HttpTypes.StoreProductImage,
    keys: ImageMatchKeys
): boolean {
    if (!image.url) {
        return false
    }

    const cleanUrl = image.url.split("?")[0].toLowerCase().trim()
    const urlPath = cleanUrl.split("/").pop() || ""

    const urlMatches =
        keys.urlKeys.has(cleanUrl) ||
        (urlPath ? keys.urlKeys.has(urlPath.toLowerCase()) : false)
    const idMatches = image.id ? keys.idKeys.has(image.id) : false

    return urlMatches || idMatches
}

function getVariantAssignedImageKeys(
    product: HttpTypes.StoreProduct,
    excludeVariantId?: string
): ImageMatchKeys {
    const keys: ImageMatchKeys = {
        urlKeys: new Set<string>(),
        idKeys: new Set<string>(),
    }

    product.variants?.forEach((variant) => {
        if (excludeVariantId && variant.id === excludeVariantId) {
            return
        }

        variant.images?.forEach((image) => {
            addImageToMatchKeys(image as HttpTypes.StoreProductImage, keys)
        })
    })

    return keys
}

function getUnsupportedProductImages(
    product: HttpTypes.StoreProduct,
    selectedVariantId: string
): HttpTypes.StoreProductImage[] {
    const productImages = product.images || []
    if (productImages.length === 0) {
        return []
    }

    const assignedKeys = getVariantAssignedImageKeys(product, selectedVariantId)

    return productImages.filter((image) => !imageMatchesKeys(image, assignedKeys))
}

function getKeysForImages(images: HttpTypes.StoreProductImage[]): ImageMatchKeys {
    const keys: ImageMatchKeys = {
        urlKeys: new Set<string>(),
        idKeys: new Set<string>(),
    }

    images.forEach((image) => addImageToMatchKeys(image, keys))

    return keys
}

function mergeVariantAndGeneralImages(
    variantImages: HttpTypes.StoreProductImage[],
    generalImages: HttpTypes.StoreProductImage[]
): HttpTypes.StoreProductImage[] {
    const variantKeys = getKeysForImages(variantImages)
    const merged = [...variantImages]

    generalImages.forEach((image) => {
        if (!imageMatchesKeys(image, variantKeys)) {
            merged.push(image)
        }
    })

    return merged
}

/**
 * Images assigned to this variant but not to any other variant.
 * Medusa often includes shared product images on every variant; the admin-selected
 * variant image is typically the extra one appended last for that variant.
 */
function getVariantExclusiveImages(
    product: HttpTypes.StoreProduct,
    variant: HttpTypes.StoreProductVariant
): HttpTypes.StoreProductImage[] {
    const variantImages = (variant.images || []) as HttpTypes.StoreProductImage[]

    if (!variantImages.length) {
        return []
    }

    const otherVariantKeys = getVariantAssignedImageKeys(product, variant.id)

    return variantImages.filter(
        (image) => !imageMatchesKeys(image, otherVariantKeys)
    )
}

function getPrimaryVariantImage(
    product: HttpTypes.StoreProduct,
    variant: HttpTypes.StoreProductVariant
): HttpTypes.StoreProductImage | undefined {
    const variantImages = (variant.images || []) as HttpTypes.StoreProductImage[]

    if (!variantImages.length) {
        return undefined
    }

    const exclusiveImages = getVariantExclusiveImages(product, variant)

    if (exclusiveImages.length > 0) {
        const exclusiveKeys = getKeysForImages(exclusiveImages)
        let primaryIndex = -1

        variantImages.forEach((image, index) => {
            if (imageMatchesKeys(image, exclusiveKeys)) {
                primaryIndex = index
            }
        })

        if (primaryIndex >= 0) {
            return variantImages[primaryIndex]
        }

        return exclusiveImages[exclusiveImages.length - 1]
    }

    return variantImages[0]
}

function reorderWithPrimaryFirst(
    images: HttpTypes.StoreProductImage[],
    primaryImage?: HttpTypes.StoreProductImage
): HttpTypes.StoreProductImage[] {
    if (!primaryImage) {
        return images
    }

    const primaryKeys = getKeysForImages([primaryImage])
    const primaryIndex = images.findIndex((image) =>
        imageMatchesKeys(image, primaryKeys)
    )

    if (primaryIndex <= 0) {
        return images
    }

    const reordered = [...images]
    const [primary] = reordered.splice(primaryIndex, 1)

    return [primary, ...reordered]
}

/**
 * Index of the variant's primary assigned image inside the gallery list.
 * Falls back to 0 when the variant has no dedicated media.
 */
export function getDefaultImageIndexForVariant(
    product: HttpTypes.StoreProduct,
    selectedVariantId: string | undefined,
    images: HttpTypes.StoreProductImage[]
): number {
    if (!images.length) {
        return 0
    }

    if (!selectedVariantId || !product.variants) {
        return 0
    }

    const variant = product.variants.find((v) => v.id === selectedVariantId)
    const primaryVariantImage = variant
        ? getPrimaryVariantImage(product, variant)
        : undefined

    if (!primaryVariantImage) {
        return 0
    }

    const primaryKeys = getKeysForImages([primaryVariantImage])
    const index = images.findIndex((image) => imageMatchesKeys(image, primaryKeys))

    return index >= 0 ? index : 0
}

/**
 * Consistently determines which images to show for a product or a specific variant.
 * Used on both server and client to prevent flickering during hydration.
 */
export function getImagesForVariant(
    product: HttpTypes.StoreProduct,
    selectedVariantId?: string
): HttpTypes.StoreProductImage[] {
    if (!product) {
        return []
    }

    // 1. If no variant is selected, show general product images
    if (!selectedVariantId || !product.variants) {
        return product.images || []
    }

    // 2. Find the selected variant
    const variant = product.variants.find((v) => v.id === selectedVariantId)

    // 3. Variant has specific images — primary assigned image first, then the rest
    if (variant?.images && variant.images.length > 0) {
        const variantImages = [...variant.images] as HttpTypes.StoreProductImage[]
        const generalImages = getUnsupportedProductImages(product, selectedVariantId)
        const primaryImage = getPrimaryVariantImage(product, variant)
        const merged = mergeVariantAndGeneralImages(variantImages, generalImages)

        return reorderWithPrimaryFirst(merged, primaryImage)
    }

    // 4. No variant images: show product images not assigned to other variants
    const unsupportedImages = getUnsupportedProductImages(product, selectedVariantId)
    if (unsupportedImages.length > 0) {
        return unsupportedImages
    }

    if (product.thumbnail) {
        return [
            {
                id: "default-thumb",
                url: product.thumbnail,
            } as HttpTypes.StoreProductImage,
        ]
    }

    return []
}

/**
 * Gallery images for the current option selection.
 * - No selection → all product images
 * - Exact variant (color + size, etc.) → that variant's gallery
 * - Partial selection (e.g. color only) → unique images from all matching variants
 */
export function getImagesForSelection(
    product: HttpTypes.StoreProduct,
    options: Record<string, string | undefined>
): HttpTypes.StoreProductImage[] {
    const hasSelection = Object.values(options).some(Boolean)

    if (!hasSelection) {
        return product.images || []
    }

    const exactVariant = findExactVariant(product, options)

    if (exactVariant) {
        return getImagesForVariant(product, exactVariant.id)
    }

    const matchingVariants = resolveMatchingVariants(product, options)

    if (!matchingVariants.length) {
        return product.images || []
    }

    const aggregated: HttpTypes.StoreProductImage[] = []
    const exclusivePrimaries: HttpTypes.StoreProductImage[] = []

    matchingVariants.forEach((variant) => {
        aggregated.push(...getImagesForVariant(product, variant.id))

        const exclusiveImages = getVariantExclusiveImages(product, variant)

        if (exclusiveImages.length > 0) {
            const primary = getPrimaryVariantImage(product, variant)

            if (primary) {
                exclusivePrimaries.push(primary)
            }
        }
    })

    let images = dedupeImages(aggregated)
    const uniquePrimaries = dedupeImages(exclusivePrimaries)

    uniquePrimaries.forEach((primary) => {
        images = reorderWithPrimaryFirst(images, primary)
    })

    return images
}

/**
 * Default main-image index for the current option selection.
 */
export function getDefaultImageIndexForSelection(
    product: HttpTypes.StoreProduct,
    options: Record<string, string | undefined>,
    images: HttpTypes.StoreProductImage[]
): number {
    if (!images.length) {
        return 0
    }

    const exactVariant = findExactVariant(product, options)

    if (exactVariant) {
        return getDefaultImageIndexForVariant(product, exactVariant.id, images)
    }

    return 0
}
