"use client"

import { XMark } from "@medusajs/icons"
import { HttpTypes } from "@medusajs/types"
import { Button, Heading, Select, Text, clx } from "@medusajs/ui"
import { listReturnReasons } from "@lib/data/returns"
import React from "react"

type CancelOrderModalProps = {
  isOpen: boolean
  isSubmitting: boolean
  onClose: () => void
  onConfirm: (reasonId: string) => void
}

const CancelOrderModal = ({
  isOpen,
  isSubmitting,
  onClose,
  onConfirm,
}: CancelOrderModalProps) => {
  const [reasons, setReasons] = React.useState<HttpTypes.StoreReturnReason[]>([])
  const [selectedReasonId, setSelectedReasonId] = React.useState("")
  const [isFetchingReasons, setIsFetchingReasons] = React.useState(false)

  React.useEffect(() => {
    if (!isOpen) {
      setSelectedReasonId("")
      return
    }

    let isMounted = true

    const fetchReasons = async () => {
      setIsFetchingReasons(true)
      const res = await listReturnReasons()
      if (isMounted) {
        setReasons(res)
        setIsFetchingReasons(false)
      }
    }

    fetchReasons()

    return () => {
      isMounted = false
    }
  }, [isOpen])

  const handleClose = () => {
    setSelectedReasonId("")
    onClose()
  }

  const handleConfirm = () => {
    if (!selectedReasonId) {
      alert("Please select a reason for cancellation")
      return
    }

    onConfirm(selectedReasonId)
  }

  if (!isOpen) {
    return null
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div
        className="w-full max-w-md p-6 sm:p-8 bg-white rounded-3xl shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cancel-order-title"
      >
        <div className="flex flex-col gap-y-6">
          <div className="flex items-center justify-between">
            <Heading id="cancel-order-title" level="h2" className="text-xl font-bold text-gray-900">
              Cancel Order
            </Heading>
            <button
              type="button"
              onClick={handleClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              aria-label="Close cancel order dialog"
            >
              <XMark className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          <div className="space-y-4">
            <Text className="text-sm text-gray-500 leading-relaxed">
              We're sorry to see you go! Please let us know why you're cancelling this order so we can improve our service.
            </Text>

            <div className="space-y-2">
              <label
                htmlFor="cancel-reason-select"
                className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1"
              >
                Reason for Cancellation
              </label>
              <Select
                value={selectedReasonId || undefined}
                onValueChange={setSelectedReasonId}
              >
                <Select.Trigger
                  id="cancel-reason-select"
                  className={clx(
                    "w-full rounded-2xl h-12 border transition-colors text-sm font-medium",
                    selectedReasonId
                      ? "bg-gold-accent/10 text-gold-accent border-gold-accent/20"
                      : "bg-gray-50/50 text-gray-500 border-gray-200"
                  )}
                >
                  <Select.Value placeholder="Select a reason" />
                </Select.Trigger>
                <Select.Content
                  position="popper"
                  sideOffset={8}
                  collisionPadding={16}
                  className="z-[10001] rounded-2xl border border-gray-100 bg-white shadow-xl p-1.5 min-w-[var(--radix-select-trigger-width)]"
                >
                  {reasons.map((reason) => (
                    <Select.Item
                      key={reason.id}
                      value={reason.id}
                      className="text-sm font-medium rounded-xl px-3 py-2.5 cursor-pointer"
                    >
                      {reason.label}
                    </Select.Item>
                  ))}
                  {reasons.length === 0 && !isFetchingReasons && (
                    <Select.Item value="other" className="text-sm font-medium rounded-xl px-3 py-2.5">
                      Other / Not Specified
                    </Select.Item>
                  )}
                </Select.Content>
              </Select>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={handleClose}
              className="flex-1 rounded-2xl h-12 font-bold border-gray-100"
            >
              Keep Order
            </Button>
            <Button
              type="button"
              onClick={handleConfirm}
              isLoading={isSubmitting}
              disabled={!selectedReasonId || isSubmitting}
              className="flex-1 rounded-2xl h-12 font-bold bg-red-500 hover:bg-red-600 text-white border-none shadow-lg shadow-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel Order
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CancelOrderModal
