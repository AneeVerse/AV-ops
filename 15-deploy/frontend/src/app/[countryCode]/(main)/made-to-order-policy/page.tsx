import { Metadata } from "next"
import { Heading, Text } from "@medusajs/ui"
import PolicyRegionTabs from "@modules/common/components/policy-region-tabs"

export const metadata: Metadata = {
  title: "Made to Order Policy | Cultura Jewels",
  description: "Learn how our Made to Order process works for India and International orders.",
}

const steps = [
  { num: "1", text: "Confirm your details – Tell us your ring size and if you want any engraving (like a name or date)." },
  { num: "2", text: "Order placed – Once you confirm, we start making your jewelry." },
  { num: "3", text: "CAD image – We send you a CAD image first. Think of it like a digital drawing or preview of your jewelry, so you can see exactly how it will look before it's actually made." },
  { num: "4", text: "CPX & casting update – Next, we share an update when your jewelry moves into casting. This is the step where the metal is shaped into your actual design." },
  { num: "5", text: "Stone setting – After casting, the stones (like moissanite or diamonds) are carefully set into the jewelry." },
  { num: "6", text: "Final images – Before we ship anything, we send you final photos of the finished piece." },
  { num: "7", text: "Your approval – You check the photos and give a thumbs up." },
  { num: "8", text: "Shipping – Once you approve, we pack it up and send it to you." },
]

export default async function MadeToOrderPolicyPage(props: {
  params: Promise<{ countryCode: string }>
}) {
  const { countryCode } = await props.params

  const indiaContent = (
    <div className="space-y-8">
      <div className="border-b border-gray-100 pb-4">
        <h2 className="text-2xl font-bold text-[#04122C]">India Orders</h2>
      </div>

      <div>
        <h3 className="text-xl font-semibold text-[#04122C] mb-3">How Made to Order Works</h3>
        <p className="text-gray-700 leading-relaxed mb-6">
          Every piece of jewelry is made just for you, step by step, and you get updates along the way so you always know what's happening.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {steps.map((step) => (
            <div key={step.num} className="flex items-start gap-4 p-4 rounded-2xl bg-gray-50/80 border border-gray-100">
              <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-[#04122C] text-white flex items-center justify-center font-bold text-sm">
                {step.num}
              </div>
              <p className="text-gray-700 text-sm leading-relaxed">{step.text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Handling Time Table */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#04122C] text-white">
              <th className="py-3.5 px-6 font-semibold text-sm">Product</th>
              <th className="py-3.5 px-6 font-semibold text-sm">Handling Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            <tr className="hover:bg-gray-50/50">
              <td className="py-3.5 px-6 text-sm text-gray-800 font-medium">Ring, earring, pendant</td>
              <td className="py-3.5 px-6 text-sm text-gray-600">5-7 business days</td>
            </tr>
            <tr className="hover:bg-gray-50/50">
              <td className="py-3.5 px-6 text-sm text-gray-800 font-medium">Bracelet</td>
              <td className="py-3.5 px-6 text-sm text-gray-600">8-10 business days</td>
            </tr>
            <tr className="hover:bg-gray-50/50">
              <td className="py-3.5 px-6 text-sm text-gray-800 font-medium">Necklace</td>
              <td className="py-3.5 px-6 text-sm text-gray-600">10-15 days</td>
            </tr>
            <tr className="hover:bg-gray-50/50">
              <td className="py-3.5 px-6 text-sm text-gray-800 font-medium">Hip hop pendant</td>
              <td className="py-3.5 px-6 text-sm text-gray-600">10-12 days</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-200/60 text-amber-900 text-sm leading-relaxed">
        <span className="font-semibold">Note:</span> These timelines may increase or decrease depending on your approval time or any sudden/unforeseen circumstances we will keep you informed accordingly.
      </div>
    </div>
  )

  const internationalContent = (
    <div className="space-y-8">
      <div className="border-b border-gray-100 pb-4">
        <h2 className="text-2xl font-bold text-[#04122C]">International orders</h2>
      </div>

      <div>
        <h3 className="text-xl font-semibold text-[#04122C] mb-3">How Made to Order Works</h3>
        <p className="text-gray-700 leading-relaxed mb-6">
          Every piece of jewelry is made just for you, step by step, and you get updates along the way so you always know what's happening.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {steps.map((step) => (
            <div key={step.num} className="flex items-start gap-4 p-4 rounded-2xl bg-gray-50/80 border border-gray-100">
              <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-[#D4AF37] text-white flex items-center justify-center font-bold text-sm">
                {step.num}
              </div>
              <p className="text-gray-700 text-sm leading-relaxed">{step.text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Handling Time Table */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#04122C] text-white">
              <th className="py-3.5 px-6 font-semibold text-sm">Product</th>
              <th className="py-3.5 px-6 font-semibold text-sm">Handling Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            <tr className="hover:bg-gray-50/50">
              <td className="py-3.5 px-6 text-sm text-gray-800 font-medium">Ring, earring, pendant</td>
              <td className="py-3.5 px-6 text-sm text-gray-600">6-8 business days</td>
            </tr>
            <tr className="hover:bg-gray-50/50">
              <td className="py-3.5 px-6 text-sm text-gray-800 font-medium">Bracelet</td>
              <td className="py-3.5 px-6 text-sm text-gray-600">8-10 business days</td>
            </tr>
            <tr className="hover:bg-gray-50/50">
              <td className="py-3.5 px-6 text-sm text-gray-800 font-medium">Necklace</td>
              <td className="py-3.5 px-6 text-sm text-gray-600">12-15 business days</td>
            </tr>
            <tr className="hover:bg-gray-50/50">
              <td className="py-3.5 px-6 text-sm text-gray-800 font-medium">Hip hop pendant</td>
              <td className="py-3.5 px-6 text-sm text-gray-600">12-14 business days</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-200/60 text-amber-900 text-sm leading-relaxed">
        <span className="font-semibold">Note:</span> These timelines may increase or decrease depending on your approval time or any sudden/unforeseen circumstances we will keep you informed accordingly.
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-ivory-bg pb-16 sm:pb-24">
      {/* Hero Header */}
      <div className="bg-[#04122C] text-white py-16 sm:py-20 mb-12 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#D4AF37]/10 rounded-full -mr-32 -mt-32 blur-3xl"></div>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <Heading level="h1" className="text-3xl sm:text-5xl font-extrabold mb-4 tracking-tight">
            Made To Order Policy
          </Heading>
          <Text className="text-gray-300 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed font-light">
            Every piece of jewelry is made just for you, step by step, with regular updates along the way.
          </Text>
        </div>
      </div>

      {/* Main Content Container */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-100 p-6 sm:p-10 md:p-12">
          <PolicyRegionTabs
            countryCode={countryCode}
            indiaContent={indiaContent}
            internationalContent={internationalContent}
          />
        </div>
      </div>
    </div>
  )
}
