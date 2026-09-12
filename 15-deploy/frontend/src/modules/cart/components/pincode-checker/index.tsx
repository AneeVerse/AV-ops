"use client"

import { Button, Heading, Text, Input, clx } from "@medusajs/ui"
import { useState } from "react"
import { getShiprocketServiceability } from "@lib/data/fulfillment"
import { MapPin, Truck, CheckCircle2, AlertCircle, X } from "lucide-react"

const PincodeChecker = ({ variantId }: { variantId?: string }) => {
    const [pincode, setPincode] = useState("")
    const [isChecking, setIsChecking] = useState(false)
    const [result, setResult] = useState<any>(null)
    const [error, setError] = useState<string | null>(null)
    const [showInput, setShowInput] = useState(false)

    const handleCheck = async () => {
        if (!variantId) {
            setError("Please select a variant (size/color) first")
            return
        }

        if (pincode.length !== 6) {
            setError("Please enter a valid 6-digit pincode")
            return
        }

        setIsChecking(true)
        setError(null)
        setResult(null)

        try {
            const data = await getShiprocketServiceability(pincode, variantId)
            // Handle both wrapped list response and direct response format
            if (data && (data.etd || data.data?.etd || (data.data?.available_courier_companies?.length > 0))) {
                setResult(data)
            } else {
                setError("Delivery not available for this pincode")
            }
        } catch (err: any) {
            setError(err.message || "Failed to check serviceability. Please try again.")
        } finally {
            setIsChecking(false)
        }
    }

    const getDeliveryInfo = () => {
        if (!result) return null

        // If result is the courier object directly (new format)
        if (result.etd) return { etd: result.etd, days: result.estimated_delivery_days }

        // If it's wrapped in data (old format or variations)
        if (result.data) {
            if (result.data.etd) return { etd: result.data.etd, days: result.data.estimated_delivery_days }
            
            if (result.data.available_courier_companies?.length > 0) {
                const best = result.data.available_courier_companies[0]
                return { etd: best.etd, days: best.estimated_delivery_days }
            }
        }

        return null
    }

    const deliveryInfo = getDeliveryInfo()

    const handleReset = () => {
        setPincode("")
        setResult(null)
        setError(null)
        setShowInput(false)
        setIsChecking(false)
    }

    return (
        <div className="w-full bg-white border border-gray-200 rounded-xl p-4 min-[550px]:p-5 mb-0 shadow-sm overflow-hidden min-h-[80px] flex flex-col justify-center">
            {/* Initial State */}
            {!showInput && (
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gold-accent/10 flex items-center justify-center flex-shrink-0">
                            <Truck className="w-5 h-5 text-gold-accent" />
                        </div>
                        <Text className="text-sm min-[550px]:text-base font-medium text-gray-700">
                            Check delivery time & services
                        </Text>
                    </div>
                    <button
                        onClick={() => setShowInput(true)}
                        className="bg-royal-blue text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-[#764999] transition-colors shadow-sm whitespace-nowrap"
                    >
                        Enter Pincode
                    </button>
                </div>
            )}

            {/* Input & Error State */}
            {showInput && !result && (
                <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                        <Text className="text-sm font-bold text-gray-900">Enter Delivery Pincode</Text>
                        <button onClick={handleReset} className="text-gray-400 hover:text-gray-600">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="flex gap-2">
                        <Input
                            type="text"
                            maxLength={6}
                            placeholder="Ex: 380001"
                            value={pincode}
                            onChange={(e) => setPincode(e.target.value.replace(/\D/g, ""))}
                            className="flex-1"
                        />
                        <Button
                            variant="primary"
                            onClick={handleCheck}
                            isLoading={isChecking}
                            className="bg-royal-blue hover:bg-[#764999]"
                        >
                            Check
                        </Button>
                    </div>
                    {error && !isChecking && (
                        <div className="flex items-center gap-3 bg-red-50 p-3 rounded-lg border border-red-100 mt-1">
                            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                            <Text className="text-sm font-bold text-red-800">
                                {error}
                            </Text>
                        </div>
                    )}
                </div>
            )}

            {/* Success Result State */}
            {showInput && result && !isChecking && (
                <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                        <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-gold-accent" />
                            <Text className="text-sm font-bold text-gray-900">Results for {pincode}</Text>
                        </div>
                        <button
                            onClick={() => {
                                setResult(null)
                                setError(null)
                                setPincode("")
                                setShowInput(true)
                            }}
                            className="text-gold-accent text-xs font-bold hover:underline"
                        >
                            Change
                        </button>
                    </div>

                    <div className="flex items-center gap-3 bg-green-50 p-3 rounded-lg border border-green-100">
                        <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                        <div>
                            <Text className="text-sm font-bold text-green-800">
                                Delivery available
                            </Text>
                            {deliveryInfo?.etd && (
                                <Text className="text-xs text-green-700">
                                    Estimated delivery by <span className="font-bold">{new Date(deliveryInfo.etd).toDateString()}</span>
                                </Text>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default PincodeChecker
