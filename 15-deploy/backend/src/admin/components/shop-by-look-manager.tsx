import { Container, Heading, Input, Button, Label, toast } from "@medusajs/ui"
import { useState, useEffect } from "react"
import ProductSelect from "./product-select"

const NONE_VALUE = "__none__"

interface LookItem {
  id: string
  lookName: string
  image: string
  gridSpan: string
  isFeatured?: boolean
  productId: string
}

const ShopByLookManager = () => {
  const [looks, setLooks] = useState<LookItem[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  // Form State
  const [lookName, setLookName] = useState("")
  const [gridSpan, setGridSpan] = useState("col-span-1 row-span-1")
  const [selectedProductId, setSelectedProductId] = useState(NONE_VALUE)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string>("")
  const [uploading, setUploading] = useState(false)

  // Delete Confirmation Modal State
  const [confirmDeleteLook, setConfirmDeleteLook] = useState<LookItem | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchLooksAndProducts = async () => {
    setLoading(true)
    try {
      const res = await fetch("/admin/shop-by-look", { credentials: "include" })
      if (res.ok) {
        const data = await res.json()
        setLooks(data.looks || [])
        setProducts(data.products || [])
      }
    } catch (e) {
      console.error("Failed to load shop by look data:", e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLooksAndProducts()
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      setImageFile(file)
      const reader = new FileReader()
      reader.onload = () => {
        setImagePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleCreateLook = async () => {
    if (!imageFile && !lookName) {
      toast.error("Validation Error", { description: "Please upload an image and specify a look name." })
      return
    }

    setUploading(true)

    try {
      let uploadedImageUrl = ""

      if (imageFile) {
        const base64Content = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = reject
          reader.readAsDataURL(imageFile)
        })

        const uploadRes = await fetch("/admin/custom/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            filename: imageFile.name,
            content: base64Content,
            mimeType: imageFile.type,
            category: "shop-by-look",
          }),
        })

        if (!uploadRes.ok) {
          toast.error("Upload Failed", { description: "Failed to upload image file to ImageKit." })
          setUploading(false)
          return
        }

        const uploadData = await uploadRes.json()
        uploadedImageUrl = uploadData.url
      }

      const newLook = {
        id: `look-${Date.now()}`,
        lookName: lookName || "Look Image",
        image: uploadedImageUrl,
        gridSpan: gridSpan,
        isFeatured: gridSpan.includes("col-span-2"),
        productId: selectedProductId === NONE_VALUE ? "" : selectedProductId,
      }

      const saveRes = await fetch("/admin/shop-by-look", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ look: newLook }),
      })

      if (saveRes.ok) {
        const data = await saveRes.json()
        setLooks(data.looks || [])
        setLookName("")
        setSelectedProductId(NONE_VALUE)
        setImageFile(null)
        setImagePreview("")
        toast.success("Look Saved!", { description: "New look photo successfully added to storefront." })
      } else {
        toast.error("Save Failed", { description: "Could not save look layout configuration." })
      }
    } catch (e: any) {
      toast.error("Error", { description: e.message || "An unexpected error occurred." })
    } finally {
      setUploading(false)
    }
  }

  const handleConfirmDelete = async () => {
    if (!confirmDeleteLook) return
    setDeleting(true)

    try {
      const deleteRes = await fetch(`/admin/shop-by-look?id=${confirmDeleteLook.id}`, {
        method: "DELETE",
        credentials: "include",
      })

      if (deleteRes.ok) {
        const data = await deleteRes.json()
        setLooks(data.looks || [])
        toast.success("Look Deleted", { description: "Look and associated CDN media purged successfully." })
      } else {
        toast.error("Delete Failed", { description: "Failed to remove look item." })
      }
    } catch (e: any) {
      toast.error("Error", { description: e.message || "Failed to delete look." })
    } finally {
      setDeleting(false)
      setConfirmDeleteLook(null)
    }
  }

  return (
    <Container className="p-6 bg-white rounded-lg border border-gray-200 shadow-sm flex flex-col gap-6 relative">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
        <div>
          <Heading level="h2" className="text-xl font-bold text-gray-900">
            Shop By Look Manager
          </Heading>
          <p className="text-xs text-gray-500 mt-1">
            Upload look photos and assign Medusa store products.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold px-2.5 py-1 rounded-full">
            {looks.length} Looks Active
          </span>
        </div>
      </div>

      {/* Upload & Form Section */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-4">
        <div className="text-xs font-bold text-gray-800 uppercase tracking-wider">
          + Add New Look
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs text-gray-600 mb-1 block">Look Title</Label>
            <Input
              placeholder="e.g. Royal Emerald Set"
              value={lookName}
              onChange={(e) => setLookName(e.target.value)}
              className="bg-white text-xs"
            />
          </div>

          <div>
            <Label className="text-xs text-gray-600 mb-1 block">Assigned Product</Label>
            <ProductSelect
              products={products}
              value={selectedProductId}
              onChange={setSelectedProductId}
              noneValue={NONE_VALUE}
            />
          </div>

          <div>
            <Label className="text-xs text-gray-600 mb-1 block">Grid Span Layout</Label>
            <select
              value={gridSpan}
              onChange={(e) => setGridSpan(e.target.value)}
              className="w-full bg-white border border-gray-300 rounded-md text-xs px-3 py-[7px] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="col-span-1 row-span-1">Standard (1×1 Square Tile)</option>
              <option value="col-span-2 row-span-2">Featured Banner (2×2 Large Tile)</option>
            </select>
          </div>
        </div>

        {/* File Picker & Action */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-2 border-t border-gray-200/60">
          <div className="flex items-center gap-3">
            <input
              type="file"
              accept="image/*"
              id="shop-look-file-input"
              className="hidden"
              onChange={handleFileChange}
            />
            <label
              htmlFor="shop-look-file-input"
              className="cursor-pointer bg-white border border-gray-300 hover:bg-gray-100 text-gray-800 text-xs font-semibold px-3.5 py-1.5 rounded-md shadow-xs transition-colors"
            >
              📷 {imageFile ? imageFile.name : "Choose Look Image File"}
            </label>
            {imagePreview && (
              <div className="w-10 h-10 relative rounded-md overflow-hidden border border-gray-300">
                <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
              </div>
            )}
          </div>

          <Button
            variant="primary"
            size="small"
            onClick={handleCreateLook}
            disabled={!imageFile && !lookName}
            isLoading={uploading}
            className="bg-gray-900 hover:bg-black text-white font-semibold text-xs px-4"
          >
            Upload & Save
          </Button>
        </div>
      </div>

      {/* Grid Display */}
      <div className="space-y-3">
        <div className="text-xs font-bold text-gray-700 uppercase tracking-wider">
          Current Shop By Look Grid Items
        </div>

        {loading ? (
          <div className="text-xs text-gray-400 py-6 text-center">Loading storefront looks...</div>
        ) : looks.length === 0 ? (
          <div className="text-xs text-gray-500 bg-gray-50 border border-dashed border-gray-200 rounded-lg p-6 text-center">
            No look photos added yet. Upload your first look photo above.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {looks.map((item) => {
              const matchedProduct = products.find((p) => p.id === item.productId || p.handle === item.productId)

              return (
                <div
                  key={item.id}
                  className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-xs hover:shadow-md transition-shadow group flex flex-col justify-between"
                >
                  <div className="relative aspect-square bg-gray-100">
                    {item.image ? (
                      <img src={item.image} alt={item.lookName} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                        No Image
                      </div>
                    )}
                    {item.isFeatured && (
                      <span className="absolute top-2 left-2 bg-amber-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full shadow-xs uppercase tracking-wider">
                        Featured 2×2
                      </span>
                    )}
                  </div>

                  <div className="p-3 flex items-center justify-between border-t border-gray-100">
                    <div className="min-w-0 flex-1 pr-2">
                      <div className="text-xs font-bold text-gray-900 truncate">
                        {item.lookName || "Look Item"}
                      </div>
                      {matchedProduct && (
                        <div className="text-[10px] text-gray-500 truncate mt-0.5">
                          🏷️ {matchedProduct.title}
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => setConfirmDeleteLook(item)}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded-md transition-colors text-xs"
                      title="Delete look item"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {confirmDeleteLook && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-gray-100 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-gray-900">Delete Look Item Permanently?</h3>
                <p className="text-xs text-gray-500 mt-0.5">Media file will be purged from CDN</p>
              </div>
              <button
                type="button"
                onClick={() => setConfirmDeleteLook(null)}
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
                This will permanently delete the look photo <strong>"{confirmDeleteLook.lookName}"</strong> from ImageKit CDN and remove it from the storefront home page.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                variant="secondary"
                size="small"
                disabled={deleting}
                onClick={() => setConfirmDeleteLook(null)}
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

export default ShopByLookManager
