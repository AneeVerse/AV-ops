import { Container, Heading, Input, Button, Label, toast } from "@medusajs/ui"
import { useState, useEffect } from "react"
import ProductSelect from "./product-select"

const NONE_VALUE = "__none__"

interface VideoItem {
  id: string
  title: string
  videoUrl: string
  posterUrl?: string
  productId: string
}

const ShopByVideoManager = () => {
  const [videos, setVideos] = useState<VideoItem[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  // Form state
  const [videoTitle, setVideoTitle] = useState("")
  const [selectedProductId, setSelectedProductId] = useState(NONE_VALUE)
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

  // Delete Confirmation Modal state
  const [confirmDeleteVideo, setConfirmDeleteVideo] = useState<VideoItem | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchVideosAndProducts = async () => {
    setLoading(true)
    try {
      const res = await fetch("/admin/shop-by-video", { credentials: "include" })
      if (res.ok) {
        const data = await res.json()
        setVideos(data.videos || [])
        setProducts(data.products || [])
      }
    } catch (e) {
      console.error("Failed to load shop by video data:", e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchVideosAndProducts()
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setVideoFile(e.target.files[0])
    }
  }

  const handleCreateVideo = async () => {
    if (!videoFile && !videoTitle) {
      toast.error("Validation Error", { description: "Please upload a video reel file." })
      return
    }

    setUploading(true)

    try {
      let uploadedVideoUrl = ""

      if (videoFile) {
        const base64Content = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = reject
          reader.readAsDataURL(videoFile)
        })

        const uploadRes = await fetch("/admin/custom/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            filename: videoFile.name,
            content: base64Content,
            mimeType: videoFile.type || "video/mp4",
            category: "shop-by-video",
          }),
        })

        if (!uploadRes.ok) {
          toast.error("Upload Failed", { description: "Failed to upload video reel to ImageKit." })
          setUploading(false)
          return
        }

        const uploadData = await uploadRes.json()
        uploadedVideoUrl = uploadData.url
      }

      const newVideo = {
        id: `vid-${Date.now()}`,
        title: videoTitle || videoFile?.name || "Video Reel",
        videoUrl: uploadedVideoUrl,
        productId: selectedProductId === NONE_VALUE ? "" : selectedProductId,
      }

      const saveRes = await fetch("/admin/shop-by-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ video: newVideo }),
      })

      if (saveRes.ok) {
        const data = await saveRes.json()
        setVideos(data.videos || [])
        setVideoTitle("")
        setSelectedProductId(NONE_VALUE)
        setVideoFile(null)
        toast.success("Video Reel Saved!", { description: "New video reel successfully added to storefront." })
      } else {
        toast.error("Save Failed", { description: "Could not save video configuration." })
      }
    } catch (e: any) {
      toast.error("Error", { description: e.message || "An unexpected error occurred." })
    } finally {
      setUploading(false)
    }
  }

  const handleConfirmDelete = async () => {
    if (!confirmDeleteVideo) return
    setDeleting(true)

    try {
      const deleteRes = await fetch(`/admin/shop-by-video?id=${confirmDeleteVideo.id}`, {
        method: "DELETE",
        credentials: "include",
      })

      if (deleteRes.ok) {
        const data = await deleteRes.json()
        setVideos(data.videos || [])
        toast.success("Video Deleted", { description: "Video reel and associated CDN media purged successfully." })
      } else {
        toast.error("Delete Failed", { description: "Failed to remove video reel." })
      }
    } catch (e: any) {
      toast.error("Error", { description: e.message || "Failed to delete video reel." })
    } finally {
      setDeleting(false)
      setConfirmDeleteVideo(null)
    }
  }

  return (
    <Container className="p-6 bg-white rounded-lg border border-gray-200 shadow-sm flex flex-col gap-6 relative">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
        <div>
          <Heading level="h2" className="text-xl font-bold text-gray-900">
            Shop By Video Reels Manager
          </Heading>
          <p className="text-xs text-gray-500 mt-1">
            Upload video reels and assign Medusa store products.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold px-2.5 py-1 rounded-full">
            {videos.length} Reels Active
          </span>
        </div>
      </div>

      {/* Upload & Form Section */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-4">
        <div className="text-xs font-bold text-gray-800 uppercase tracking-wider">
          + Add New Video Reel
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-gray-600 mb-1 block">Video Reel Title</Label>
            <Input
              placeholder="e.g. Diamond Necklace Reel"
              value={videoTitle}
              onChange={(e) => setVideoTitle(e.target.value)}
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
        </div>

        {/* File Picker & Action */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-2 border-t border-gray-200/60">
          <div className="flex items-center gap-3">
            <input
              type="file"
              accept="video/*"
              id="shop-video-file-input"
              className="hidden"
              onChange={handleFileChange}
            />
            <label
              htmlFor="shop-video-file-input"
              className="cursor-pointer bg-white border border-gray-300 hover:bg-gray-100 text-gray-800 text-xs font-semibold px-3.5 py-1.5 rounded-md shadow-xs transition-colors"
            >
              🎥 {videoFile ? videoFile.name : "Choose Video Reel File"}
            </label>
          </div>

          <Button
            variant="primary"
            size="small"
            onClick={handleCreateVideo}
            disabled={!videoFile && !videoTitle}
            isLoading={uploading}
            className="bg-gray-900 hover:bg-black text-white font-semibold text-xs px-4"
          >
            Upload & Save Video
          </Button>
        </div>
      </div>

      {/* Grid Display */}
      <div className="space-y-3">
        <div className="text-xs font-bold text-gray-700 uppercase tracking-wider">
          Current Video Reels
        </div>

        {loading ? (
          <div className="text-xs text-gray-400 py-6 text-center">Loading video reels...</div>
        ) : videos.length === 0 ? (
          <div className="text-xs text-gray-500 bg-gray-50 border border-dashed border-gray-200 rounded-lg p-6 text-center">
            No video reels added yet. Upload your first video reel above.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {videos.map((item) => {
              const matchedProduct = products.find((p) => p.id === item.productId || p.handle === item.productId)

              return (
                <div
                  key={item.id}
                  className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between"
                >
                  <div className="relative aspect-[9/16] bg-black">
                    {item.videoUrl ? (
                      <video src={item.videoUrl} controls className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                        No Video
                      </div>
                    )}
                  </div>

                  <div className="p-3 flex items-center justify-between border-t border-gray-100">
                    <div className="min-w-0 flex-1 pr-2">
                      <div className="text-xs font-bold text-gray-900 truncate">
                        {item.title || "Video Reel"}
                      </div>
                      {matchedProduct && (
                        <div className="text-[10px] text-gray-500 truncate mt-0.5">
                          🏷️ {matchedProduct.title}
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => setConfirmDeleteVideo(item)}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded-md transition-colors text-xs"
                      title="Delete video reel"
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
      {confirmDeleteVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-gray-100 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-gray-900">Delete Video Reel Permanently?</h3>
                <p className="text-xs text-gray-500 mt-0.5">Media file will be purged from CDN</p>
              </div>
              <button
                type="button"
                onClick={() => setConfirmDeleteVideo(null)}
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
                This will permanently delete the video reel <strong>"{confirmDeleteVideo.title}"</strong> from ImageKit CDN and remove it from the storefront home page.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                variant="secondary"
                size="small"
                disabled={deleting}
                onClick={() => setConfirmDeleteVideo(null)}
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

export default ShopByVideoManager
