import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { DetailWidgetProps, AdminProduct } from "@medusajs/framework/types"
import { Container, Heading, Input, Button, Label, toast } from "@medusajs/ui"
import { useState, useEffect } from "react"

const ProductReviewsWidget = ({ data }: DetailWidgetProps<AdminProduct>) => {
  const product = data
  const metaRating = product?.metadata?.rating ?? product?.metadata?.review_rating ?? ""
  const metaCount = product?.metadata?.review_count ?? product?.metadata?.reviews_count ?? ""

  const [rating, setRating] = useState<string>(metaRating ? String(metaRating) : "")
  const [reviewCount, setReviewCount] = useState<string>(metaCount ? String(metaCount) : "")
  const [loading, setLoading] = useState<boolean>(false)

  useEffect(() => {
    if (product?.metadata) {
      const r = product.metadata.rating ?? product.metadata.review_rating
      const c = product.metadata.review_count ?? product.metadata.reviews_count
      setRating(r !== undefined && r !== null ? String(r) : "")
      setReviewCount(c !== undefined && c !== null ? String(c) : "")
    }
  }, [product?.metadata])

  const handleSave = async () => {
    if (!product?.id) return
    setLoading(true)

    try {
      const parsedRating = rating.trim() !== "" ? parseFloat(rating) : null
      const parsedCount = reviewCount.trim() !== "" ? parseInt(reviewCount, 10) : null

      const updatedMetadata = {
        ...(product.metadata || {}),
        rating: parsedRating,
        review_count: parsedCount,
        reviews_count: parsedCount,
      }

      const response = await fetch(`/admin/products/${product.id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          metadata: updatedMetadata,
        }),
      })

      if (response.ok) {
        toast.success("Success", {
          description: "Rating & review count saved successfully!",
        })
      } else {
        const err = await response.json().catch(() => ({}))
        toast.error("Error", {
          description: err.message || "Failed to update product rating.",
        })
      }
    } catch (e: any) {
      toast.error("Error", {
        description: e.message || "An unexpected error occurred.",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleClear = async () => {
    if (!product?.id) return
    setLoading(true)
    try {
      const updatedMetadata = { ...(product.metadata || {}) }
      delete updatedMetadata.rating
      delete updatedMetadata.review_rating
      delete updatedMetadata.average_rating
      delete updatedMetadata.review_count
      delete updatedMetadata.reviews_count
      delete updatedMetadata.total_reviews

      const response = await fetch(`/admin/products/${product.id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          metadata: updatedMetadata,
        }),
      })

      if (response.ok) {
        setRating("")
        setReviewCount("")
        toast.success("Success", {
          description: "Rating & review count cleared!",
        })
      } else {
        toast.error("Error", {
          description: "Failed to clear rating metadata.",
        })
      }
    } catch (e: any) {
      toast.error("Error", {
        description: e.message || "An error occurred.",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Container className="p-6 bg-white rounded-lg border border-gray-200 shadow-sm flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 w-full">
        <div className="flex-1 min-w-0">
          <Heading level="h2" className="text-lg font-bold text-gray-900">
            Product Rating & Review Count
          </Heading>
        </div>
        {(rating || reviewCount) && (
          <div className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-900 text-xs font-semibold px-3 py-1.5 rounded-full border border-amber-200/80 shadow-xs whitespace-nowrap flex-shrink-0 self-start sm:self-auto">
            <span className="text-amber-500">★</span>
            <span>{rating || "0.0"} ({reviewCount || "0"} reviews)</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs font-semibold text-gray-700">
            Star Rating (0.0 - 5.0)
          </Label>
          <Input
            type="number"
            step="0.1"
            min="0"
            max="5"
            placeholder="e.g. 4.9"
            value={rating}
            onChange={(e) => setRating(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="text-xs font-semibold text-gray-700">
            Total Review Count (Customers)
          </Label>
          <Input
            type="number"
            step="1"
            min="0"
            placeholder="e.g. 443"
            value={reviewCount}
            onChange={(e) => setReviewCount(e.target.value)}
          />
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 mt-4 pt-3 border-t border-gray-100">
        {(rating || reviewCount) && (
          <Button
            variant="secondary"
            size="small"
            onClick={handleClear}
            isLoading={loading}
          >
            Clear Override
          </Button>
        )}
        <Button
          variant="primary"
          size="small"
          onClick={handleSave}
          isLoading={loading}
        >
          Save Rating & Review Count
        </Button>
      </div>
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "product.details.after",
})

export default ProductReviewsWidget
