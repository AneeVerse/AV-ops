import { getPromoBarConfig } from "@lib/data/dynamic-config"
import PromoBarContent from "./promo-bar-content"

export default async function PromoBar() {
  const { text, code, value, active } = await getPromoBarConfig()

  if (!active || !text) {
    return null
  }

  return (
    <div className="relative group overflow-hidden bg-gradient-to-r from-royal-blue via-[#182C4A] to-royal-blue text-white py-1.5 sm:py-2 px-4 shadow-lg transition-all duration-300 hover:brightness-110">
      {/* Dynamic background element */}
      <div className="absolute inset-0 opacity-20 pointer-events-none bg-[radial-gradient(circle_at_center,_var(--tw-gradient-from)_0%,_transparent_70%)] from-white" />
      
      {/* Subtle shimmer effect */}
      <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-[shimmer_4s_infinite]" />
      
      <PromoBarContent text={text} code={code} value={value} />

    </div>
  )
}
