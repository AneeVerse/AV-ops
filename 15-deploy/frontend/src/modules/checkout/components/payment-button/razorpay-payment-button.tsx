import { Button, clx } from "@medusajs/ui"
import Spinner from "@modules/common/icons/spinner"
import React, { useCallback, useEffect, useState } from "react"
import { useRazorpay, RazorpayOrderOptions } from "react-razorpay"
import { HttpTypes } from "@medusajs/types"
import { placeOrder } from "@lib/data/cart"
import ProcessingOverlay from "@modules/checkout/components/processing-overlay"

export const RazorpayPaymentButton = ({
    session,
    notReady,
    cart,
}: {
    session: HttpTypes.StorePaymentSession
    notReady: boolean
    cart: HttpTypes.StoreCart
}) => {
    const [submitting, setSubmitting] = useState(false)
    const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined)
    const { Razorpay } = useRazorpay()
    const [orderData, setOrderData] = useState({ id: "" })

    const onPaymentCompleted = async () => {
        await placeOrder().catch((err) => {
            if (err.message === "NEXT_REDIRECT") {
                return
            }
            setErrorMessage("Final verification failed. Please contact support.")
            setSubmitting(false)
        })
    }

    useEffect(() => {
        if (session.data?.id) {
            setOrderData({ id: session.data.id as string })
        }
    }, [session.data])

    const handlePayment = useCallback(async () => {
        if (!Razorpay) {
            setErrorMessage("Payment gateway failed to load. Please refresh.")
            setSubmitting(false)
            return;
        }

        const currency = cart.currency_code?.toUpperCase() ?? "USD"
        const value = ((cart as any).total ?? 0) / 100
        const items = (cart.items ?? []).map((item: any, index: number) => {
            const unitTotal = item.total && item.quantity ? item.total / item.quantity : 0
            return {
                item_id: item.variant_id ?? item.id,
                item_name: item.title ?? "",
                price: unitTotal / 100,
                quantity: item.quantity,
                index,
            }
        })
        trackAddPaymentInfo({ currency, value, items })

        const options: RazorpayOrderOptions = {
            callback_url: `${process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL}/razorpay/hooks`,
            key: process.env.NEXT_PUBLIC_RAZORPAY_KEY ?? "",
            amount: session.amount,
            order_id: orderData.id,
            currency: cart.currency_code.toUpperCase(),
            name: process.env.NEXT_PUBLIC_SHOP_NAME ?? "Cultura Jewels",
            description: `Secure checkout for your order`,
            remember_customer: true,
            modal: {
                backdropclose: true,
                escape: true,
                handleback: true,
                confirm_close: true,
                ondismiss: () => {
                    setSubmitting(false)
                },
                animation: true,
            },
            handler: async (response) => {
                setSubmitting(true) // Ensure we show the premium processing state
                await onPaymentCompleted();
            },
            prefill: {
                name: `${cart.billing_address?.first_name || ""} ${cart.billing_address?.last_name || ""}`,
                email: cart.email,
                contact: cart.shipping_address?.phone || cart.billing_address?.phone || undefined,
            },
            theme: {
                color: "#D4AF37"
            }
        };

        try {
            const razorpay = new Razorpay(options);
            razorpay.on("payment.failed", function (response: any) {
                setErrorMessage(response.error.description || "Payment failed");
                setSubmitting(false);
            });
            razorpay.open();
        } catch (error: any) {
            setSubmitting(false);
        }
    }, [Razorpay, cart, orderData.id, session.amount, onPaymentCompleted]);

    return (
        <div className="w-full">
            <ProcessingOverlay isOpen={submitting} />
            <button
                    type="button"
                    disabled={submitting || notReady || !orderData?.id || !Razorpay}
                    onClick={async (e) => {
                        e.preventDefault();
                        setSubmitting(true)
                        handlePayment()
                    }}
                    data-ga-event="razorpay_payment_click"
                    data-ga-label="Pay with Razorpay"
                    className={clx(
                        "w-full py-2.5 min-[550px]:py-3 px-6 rounded-full font-bold text-base transition-all mt-6 shadow-md active:scale-[0.98]",
                        {
                            "bg-royal-blue text-white hover:bg-[#7a4e9d] hover:shadow-lg": !submitting,
                            "bg-gray-200 text-gray-400 cursor-not-allowed": submitting,
                        }
                    )}
                >
                    Pay with Razorpay
                </button>

            {errorMessage && !submitting && (
                <div className="text-red-500 text-xs font-bold mt-3 p-3 bg-red-50 rounded-lg border border-red-100 animate-in fade-in slide-in-from-top-2">
                    ⚠️ {errorMessage}
                </div>
            )}
        </div>
    )
}
