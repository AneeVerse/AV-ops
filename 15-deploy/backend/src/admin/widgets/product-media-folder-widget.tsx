import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { DetailWidgetProps, AdminProduct } from "@medusajs/framework/types"
import { Container, Heading, Button, Label, toast } from "@medusajs/ui"
import { useState, useEffect } from "react"

const ProductMediaFolderWidget = ({ data }: DetailWidgetProps<AdminProduct>) => {
  const product = data
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [filePreview, setFilePreview] = useState<string>("")
  const [uploading, setUploading] = useState(false)

  // Delete Confirm Modal State
  const [confirmDeleteImage, setConfirmDeleteImage] = useState<{ id?: string; url: string } | null>(null)
  const [deleting, setDeleting] = useState(false)

  const productName = product?.title || product?.handle || "unnamed-product"
  const sanitizedFolderName = productName.trim().replace(/[^a-zA-Z0-9\s_-]/g, "").replace(/\s+/g, "-") || "unnamed-product"
  const sanitizedFolder = `/culturajewels/products/${sanitizedFolderName}/images`

  // Hide standard default Medusa Admin "Media" card
  useEffect(() => {
    const hideDefaultMediaSection = () => {
      const allElements = document.querySelectorAll("h1, h2, h3, h4, h5, h6, span, div")
      const myWidget = document.getElementById("cultura-product-media-widget")

      allElements.forEach((el) => {
        if (el.children.length === 0 && el.textContent?.trim() === "Media") {
          let current: HTMLElement | null = el as HTMLElement
          while (current && current !== document.body) {
            if (myWidget && current.contains(myWidget)) {
              return
            }
            if (
              current.classList.contains("shadow-elevation-card-rest") ||
              current.classList.contains("bg-ui-bg-base") ||
              current.tagName === "SECTION" ||
              (current.parentElement && current.parentElement.classList.contains("flex-col") && current.previousElementSibling)
            ) {
              current.style.display = "none"
              break
            }
            current = current.parentElement
          }
        }
      })
    }

    hideDefaultMediaSection()
    const timer = setInterval(hideDefaultMediaSection, 400)
    return () => clearInterval(timer)
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      const reader = new FileReader()
      reader.onload = () => setFilePreview(reader.result as string)
      reader.readAsDataURL(file)
    }
  }

  const handleUploadProductMedia = async () => {
    if (!selectedFile || !product?.id) return

    setUploading(true)

    try {
      const base64Content = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(selectedFile)
      })

      const uploadRes = await fetch("/admin/custom/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          filename: selectedFile.name,
          content: base64Content,
          mimeType: selectedFile.type,
          productName: productName,
        }),
      })

      if (!uploadRes.ok) {
        toast.error("Upload Failed", { description: "Failed to upload file to ImageKit product folder." })
        setUploading(false)
        return
      }

      const uploadData = await uploadRes.json()
      const uploadedUrl = uploadData.url

      const currentImages = (product.images || []).map((img: any) => ({ url: img.url }))
      const updatedImages = [...currentImages, { url: uploadedUrl }]

      const updateProdRes = await fetch(`/admin/products/${product.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          images: updatedImages,
          thumbnail: product.thumbnail || uploadedUrl,
        }),
      })

      if (updateProdRes.ok) {
        setSelectedFile(null)
        setFilePreview("")
        toast.success("Product Media Uploaded!", {
          description: `Saved to ImageKit folder: ${sanitizedFolder}/`,
        })
      } else {
        toast.error("Product Update Failed", { description: "Uploaded to ImageKit, but failed to link to product." })
      }
    } catch (e: any) {
      toast.error("Error", { description: e.message || "An unexpected error occurred." })
    } finally {
      setUploading(false)
    }
  }

  const handleConfirmDelete = async () => {
    if (!confirmDeleteImage || !product?.id) return
    setDeleting(true)

    try {
      // 1. Delete file from ImageKit CDN
      await fetch(`/admin/custom/upload?url=${encodeURIComponent(confirmDeleteImage.url)}`, {
        method: "DELETE",
        credentials: "include",
      })

      // 2. Remove file URL from product images in Medusa
      const updatedImages = (product.images || [])
        .filter((img: any) => img.url !== confirmDeleteImage.url)
        .map((img: any) => ({ url: img.url }))

      const updateProdRes = await fetch(`/admin/products/${product.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          images: updatedImages,
          thumbnail: product.thumbnail === confirmDeleteImage.url ? (updatedImages[0]?.url || "") : (product.thumbnail || ""),
        }),
      })

      if (updateProdRes.ok) {
        toast.success("Product Media Deleted", {
          description: "Media file deleted from ImageKit CDN & product catalog.",
        })
      } else {
        toast.error("Error", { description: "Deleted from ImageKit, but failed to update product in Medusa." })
      }
    } catch (e: any) {
      toast.error("Error", { description: e.message || "Failed to delete product media." })
    } finally {
      setDeleting(false)
      setConfirmDeleteImage(null)
    }
  }

  return (
    <Container id="cultura-product-media-widget" className="p-6 bg-white rounded-lg border border-gray-200 shadow-sm flex flex-col gap-5 my-4 relative">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
        <div>
          <Heading level="h2" className="text-base font-bold text-gray-900">
            Product Media Directory
          </Heading>
          <p className="text-xs text-gray-500 mt-0.5">
            Upload and manage product media files linked to product catalog.
          </p>
        </div>
      </div>

      {/* Upload Box */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gray-50 p-4 rounded-xl border border-gray-200">
        <div className="flex items-center gap-3">
          <input
            type="file"
            accept="image/*,video/*"
            id="product-media-file"
            className="hidden"
            onChange={handleFileChange}
          />
          <label
            htmlFor="product-media-file"
            className="cursor-pointer bg-white border border-gray-300 hover:bg-gray-100 text-gray-800 text-xs font-semibold px-4 py-2 rounded-md shadow-xs transition-colors"
          >
            📁 {selectedFile ? selectedFile.name : "Select Image or Video"}
          </label>
          {filePreview && (
            <div className="w-12 h-12 relative rounded-md overflow-hidden border border-gray-300 bg-black">
              {selectedFile?.type.startsWith("video") ? (
                <video src={filePreview} className="w-full h-full object-cover" />
              ) : (
                <img src={filePreview} alt="Preview" className="w-full h-full object-cover" />
              )}
            </div>
          )}
        </div>

        <Button
          variant="primary"
          size="small"
          onClick={handleUploadProductMedia}
          disabled={!selectedFile}
          isLoading={uploading}
        >
          Upload Media
        </Button>
      </div>

      {/* Product Media Gallery */}
      {product?.images && product.images.length > 0 && (
        <div className="flex flex-col gap-2 pt-2">
          <Label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
            Linked Product Images ({product.images.length})
          </Label>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
            {product.images.map((img: any, idx: number) => (
              <div
                key={img.id || img.url || idx}
                className="relative group border border-gray-200 rounded-lg overflow-hidden bg-gray-100 aspect-square"
              >
                <img
                  src={img.url}
                  alt={`Product Media ${idx + 1}`}
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => setConfirmDeleteImage({ id: img.id, url: img.url })}
                  className="absolute top-1 right-1 bg-red-600 hover:bg-red-700 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold shadow-md opacity-90 group-hover:opacity-100 transition-opacity"
                  title="Delete media from ImageKit & Product"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDeleteImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-gray-100 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-gray-900">Delete Product Media Permanently?</h3>
                <p className="text-xs text-gray-500 mt-0.5">Media file will be purged from CDN</p>
              </div>
              <button
                type="button"
                onClick={() => setConfirmDeleteImage(null)}
                className="text-gray-400 hover:text-gray-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-xl p-3.5 text-xs text-red-900 space-y-1.5">
              <p className="font-bold flex items-center gap-1.5 text-red-700">
                ⚠️ Action is NOT Reversible
              </p>
              <p className="text-red-700/90 leading-relaxed">
                This will permanently delete the media file from <strong>ImageKit CDN</strong> (<code className="text-[10px]">{sanitizedFolder}/</code>) and unlink it from this product in Medusa.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                variant="secondary"
                size="small"
                disabled={deleting}
                onClick={() => setConfirmDeleteImage(null)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="small"
                isLoading={deleting}
                onClick={handleConfirmDelete}
                className="text-xs bg-red-600 hover:bg-red-700 text-white font-bold"
              >
                Yes, Delete Permanently
              </Button>
            </div>
          </div>
        </div>
      )}
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "product.details.after",
})

export default ProductMediaFolderWidget
