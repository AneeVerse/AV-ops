import { Metadata } from "next"
import { Heading, Text } from "@medusajs/ui"
import PolicyRegionTabs from "@modules/common/components/policy-region-tabs"

export const metadata: Metadata = {
  title: "Shipping Policy | Cultura Jewels",
  description: "Read our shipping policy, delivery timelines, and carrier information for India and International orders.",
}

export default async function ShippingPolicyPage(props: {
  params: Promise<{ countryCode: string }>
}) {
  const { countryCode } = await props.params

  const indiaContent = (
    <div className="space-y-8 text-gray-700 leading-relaxed">
      <div className="border-b border-gray-100 pb-4">
        <h2 className="text-2xl font-bold text-[#04122C]">India shipping</h2>
      </div>

      <div>
        <h3 className="text-xl font-bold text-[#04122C] mb-2">Shipping & Handling</h3>
        <h4 className="text-lg font-semibold text-[#04122C] mb-2">Shipping Time (India — Pan India)</h4>
        <p className="mb-4">
          Once your jewelry is made, it takes an additional 5-7 days to ship and deliver anywhere in India.
        </p>

        <h4 className="text-lg font-semibold text-[#04122C] mb-2">Total Delivery Time (India)</h4>
        <p className="mb-4">Simply add handling time + 5-7 days shipping to get your total delivery time:</p>

        {/* Table */}
        <div className="overflow-hidden rounded-2xl border border-gray-200 shadow-sm mb-4">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#04122C] text-white">
                <th className="py-3.5 px-6 font-semibold text-sm">Product</th>
                <th className="py-3.5 px-6 font-semibold text-sm">Handling Time</th>
                <th className="py-3.5 px-6 font-semibold text-sm">+ Shipping (India)</th>
                <th className="py-3.5 px-6 font-semibold text-sm">Total Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              <tr className="hover:bg-gray-50/50">
                <td className="py-3.5 px-6 text-sm text-gray-800 font-medium">Ring, earring, pendant</td>
                <td className="py-3.5 px-6 text-sm text-gray-600">5-7 business days</td>
                <td className="py-3.5 px-6 text-sm text-gray-600">5-7 business days</td>
                <td className="py-3.5 px-6 text-sm text-gray-900 font-semibold">10-14 business days</td>
              </tr>
              <tr className="hover:bg-gray-50/50">
                <td className="py-3.5 px-6 text-sm text-gray-800 font-medium">Bracelet</td>
                <td className="py-3.5 px-6 text-sm text-gray-600">8-10 business days</td>
                <td className="py-3.5 px-6 text-sm text-gray-600">5-7 business days</td>
                <td className="py-3.5 px-6 text-sm text-gray-900 font-semibold">13-17 business days</td>
              </tr>
              <tr className="hover:bg-gray-50/50">
                <td className="py-3.5 px-6 text-sm text-gray-800 font-medium">Necklace</td>
                <td className="py-3.5 px-6 text-sm text-gray-600">10-15 business days</td>
                <td className="py-3.5 px-6 text-sm text-gray-600">5-7 business days</td>
                <td className="py-3.5 px-6 text-sm text-gray-900 font-semibold">15-22 business days</td>
              </tr>
              <tr className="hover:bg-gray-50/50">
                <td className="py-3.5 px-6 text-sm text-gray-800 font-medium">Hip hop pendant</td>
                <td className="py-3.5 px-6 text-sm text-gray-600">10-12 business days</td>
                <td className="py-3.5 px-6 text-sm text-gray-600">5-7 business days</td>
                <td className="py-3.5 px-6 text-sm text-gray-900 font-semibold">15-19 business days</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-200/60 text-amber-900 text-sm leading-relaxed mb-6">
          <span className="font-semibold">Note:</span> These timelines may increase or decrease depending on your approval time or any sudden/unforeseen circumstances we will keep you informed accordingly.
        </div>
      </div>

      <div className="space-y-4 bg-gray-50 p-6 rounded-2xl border border-gray-100">
        <p>
          <strong className="font-bold text-[#04122C]">Shipping Methods:</strong><br />
          We offer fast and reliable shipping options to ensure that your order reaches you in a timely manner. All orders within India are shipped using trusted and reputable carriers such as Multiple courier Partners.
        </p>

        <p>
          <strong className="font-bold text-[#04122C]">Shipping Fees:</strong><br />
          We are pleased to offer free shipping on all orders within India. This means that you can enjoy the convenience of having your jewelry delivered right to your doorstep without any additional cost.
        </p>

        <p>
          <strong className="font-bold text-[#04122C]">Order Tracking:</strong><br />
          We want to keep you informed every step of the way. Once your order has been shipped, you will receive a confirmation email with a tracking number. This allows you to easily track the progress of your shipment and know exactly when to expect your beautiful jewelry to arrive.
        </p>

        <p>
          <strong className="font-bold text-[#04122C]">Shipping Address:</strong><br />
          Please ensure that the shipping address provided during checkout is accurate and complete. We cannot be held responsible for any delays or delivery issues caused by incorrect or incomplete addresses. If you need to make any changes to your shipping address after placing an order, please contact our customer support team as soon as possible.
        </p>

        <p>
          <strong className="font-bold text-[#04122C]">Customer Support:</strong><br />
          If you have any questions or concerns regarding our shipping policy or the status of your order, our dedicated customer support team is here to assist you. You can reach us via email or phone, and we will be more than happy to provide you with the information and assistance you need.
        </p>

        <p className="italic font-medium text-gray-800">
          Thank you for choosing Cultura Jewels for your diamond jewelry needs. We look forward to delivering exceptional quality and service to you.
        </p>
      </div>

      <div className="space-y-4">
        <p>
          We offer FREE shipping on every order only within India. Shipping time is 48 – 72hrs for ‘Available in Stock’ items and 10 to 22 business days for Make to order items. Your order will be shipped to you fully insured. We urge all customers to inspect the package for any damage or tamper before receiving or signing for receipt.
        </p>

        <p>
          For our Indian customers, after your item has been packaged, it will be shipped and delivered free via our Shipping partners namely BVC Logistics, DTDC, Bluedart, etc.
        </p>

        <div className="p-5 rounded-2xl bg-white border border-gray-200 space-y-1 shadow-sm">
          <h4 className="font-bold text-[#04122C]">Packaging</h4>
          <p className="text-sm">
            Every jewellery package from us arrives at your doorstep in a durable, tamper-proof packing. Whether it is a jewellery or solitaire, your item is delivered to you in an exclusive Cultura Jewels box along with the relevant certificates.
          </p>
        </div>

        <p className="text-xs text-gray-500 italic p-4 bg-gray-100 rounded-xl border border-gray-200">
          <strong>We reserve the right to modify this shipping policy at any time, so please review it frequently. Changes and clarifications will take effect immediately upon their posting on the website. If we make material changes to this policy, we will notify you here that it has been updated, so that you are aware of what information we collect, how we use it, and under what circumstances, if any, we use and/or disclose it.</strong>
        </p>

        <div className="p-4 rounded-xl bg-gray-50 border border-gray-100 space-y-1 text-sm">
          <h4 className="font-bold text-[#04122C]">Return shipping</h4>
          <p>
            Return shipping for customised products, including courier charges and insurance, must be handled and borne by the customer. Cultura Jewels will process the exchange only after the returned product has successfully passed quality inspection.
          </p>
        </div>
      </div>
    </div>
  )

  const internationalContent = (
    <div className="space-y-8 text-gray-700 leading-relaxed">
      <div className="border-b border-gray-100 pb-4">
        <h2 className="text-2xl font-bold text-[#04122C]">International Shipping</h2>
      </div>

      {/* US Shipping */}
      <section className="space-y-4">
        <h3 className="text-xl font-bold text-[#04122C]">Shipping Time (US)</h3>
        <p>For US orders, shipping happens in two steps:</p>
        <ul className="list-disc list-inside space-y-1 text-sm bg-gray-50 p-4 rounded-xl border border-gray-100 font-medium">
          <li>India to USPS: 3-5 business days</li>
          <li>USPS Ground Advantage (USPS to buyer's pincode): 3-5 business days</li>
        </ul>
        <p className="text-sm text-gray-600">
          If you need faster delivery, we can book Priority Shipping for you instead of standard Ground Advantage.
        </p>

        <h4 className="text-lg font-semibold text-[#04122C]">Total Delivery Time (US)</h4>
        <p className="text-sm">Simply add handling time + shipping time to get your total delivery time:</p>

        {/* US Table */}
        <div className="overflow-hidden rounded-2xl border border-gray-200 shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#04122C] text-white">
                <th className="py-3.5 px-6 font-semibold text-sm">Product</th>
                <th className="py-3.5 px-6 font-semibold text-sm">Handling Time</th>
                <th className="py-3.5 px-6 font-semibold text-sm">+ Shipping (US)</th>
                <th className="py-3.5 px-6 font-semibold text-sm">Total Time (US)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              <tr className="hover:bg-gray-50/50">
                <td className="py-3.5 px-6 text-sm text-gray-800 font-medium">Ring, earring, pendant</td>
                <td className="py-3.5 px-6 text-sm text-gray-600">5-7 business days</td>
                <td className="py-3.5 px-6 text-sm text-gray-600">6-10 business days</td>
                <td className="py-3.5 px-6 text-sm text-gray-900 font-semibold">11-17 business days</td>
              </tr>
              <tr className="hover:bg-gray-50/50">
                <td className="py-3.5 px-6 text-sm text-gray-800 font-medium">Bracelet</td>
                <td className="py-3.5 px-6 text-sm text-gray-600">8-10 business days</td>
                <td className="py-3.5 px-6 text-sm text-gray-600">6-10 business days</td>
                <td className="py-3.5 px-6 text-sm text-gray-900 font-semibold">14-20 business days</td>
              </tr>
              <tr className="hover:bg-gray-50/50">
                <td className="py-3.5 px-6 text-sm text-gray-800 font-medium">Necklace</td>
                <td className="py-3.5 px-6 text-sm text-gray-600">10-15 business days</td>
                <td className="py-3.5 px-6 text-sm text-gray-600">6-10 business days</td>
                <td className="py-3.5 px-6 text-sm text-gray-900 font-semibold">16-25 business days</td>
              </tr>
              <tr className="hover:bg-gray-50/50">
                <td className="py-3.5 px-6 text-sm text-gray-800 font-medium">Hip hop pendant</td>
                <td className="py-3.5 px-6 text-sm text-gray-600">10-12 business days</td>
                <td className="py-3.5 px-6 text-sm text-gray-600">6-10 business days</td>
                <td className="py-3.5 px-6 text-sm text-gray-900 font-semibold">16-22 business days</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-200/60 text-amber-900 text-sm leading-relaxed">
          <span className="font-semibold">Note:</span> These timelines may increase or decrease depending on your approval time or any sudden/unforeseen circumstances we will keep you informed accordingly.
        </div>
      </section>

      {/* UK Shipping */}
      <section className="space-y-4 pt-6 border-t border-gray-200">
        <h3 className="text-xl font-bold text-[#04122C]">Shipping Time (UK)</h3>
        <p>For UK orders, shipping happens in two steps:</p>
        <ul className="list-disc list-inside space-y-1 text-sm bg-gray-50 p-4 rounded-xl border border-gray-100 font-medium">
          <li>India to Royal Mail: 3-4 business days</li>
          <li>Royal Mail to buyer's pincode: 3-5 business days</li>
        </ul>
        <p className="text-sm text-gray-600">
          If you need faster delivery, we can book Priority Shipping for you instead of standard Royal Mail.
        </p>

        <h4 className="text-lg font-semibold text-[#04122C]">Total Delivery Time (UK)</h4>
        <p className="text-sm">Simply add handling time + shipping time to get your total delivery time:</p>

        {/* UK Table */}
        <div className="overflow-hidden rounded-2xl border border-gray-200 shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#04122C] text-white">
                <th className="py-3.5 px-6 font-semibold text-sm">Product</th>
                <th className="py-3.5 px-6 font-semibold text-sm">Handling Time</th>
                <th className="py-3.5 px-6 font-semibold text-sm">+ Shipping (UK)</th>
                <th className="py-3.5 px-6 font-semibold text-sm">Total Time (UK)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              <tr className="hover:bg-gray-50/50">
                <td className="py-3.5 px-6 text-sm text-gray-800 font-medium">Ring, earring, pendant</td>
                <td className="py-3.5 px-6 text-sm text-gray-600">5-7 business days</td>
                <td className="py-3.5 px-6 text-sm text-gray-600">6-9 business days</td>
                <td className="py-3.5 px-6 text-sm text-gray-900 font-semibold">11-16 business days</td>
              </tr>
              <tr className="hover:bg-gray-50/50">
                <td className="py-3.5 px-6 text-sm text-gray-800 font-medium">Bracelet</td>
                <td className="py-3.5 px-6 text-sm text-gray-600">8-10 business days</td>
                <td className="py-3.5 px-6 text-sm text-gray-600">6-9 business days</td>
                <td className="py-3.5 px-6 text-sm text-gray-900 font-semibold">14-19 business days</td>
              </tr>
              <tr className="hover:bg-gray-50/50">
                <td className="py-3.5 px-6 text-sm text-gray-800 font-medium">Necklace</td>
                <td className="py-3.5 px-6 text-sm text-gray-600">10-15 business days</td>
                <td className="py-3.5 px-6 text-sm text-gray-600">6-9 business days</td>
                <td className="py-3.5 px-6 text-sm text-gray-900 font-semibold">16-24 business days</td>
              </tr>
              <tr className="hover:bg-gray-50/50">
                <td className="py-3.5 px-6 text-sm text-gray-800 font-medium">Hip hop pendant</td>
                <td className="py-3.5 px-6 text-sm text-gray-600">10-12 business days</td>
                <td className="py-3.5 px-6 text-sm text-gray-600">6-9 business days</td>
                <td className="py-3.5 px-6 text-sm text-gray-900 font-semibold">16-21 business days</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-200/60 text-amber-900 text-sm leading-relaxed">
          <span className="font-semibold">Note:</span> These timelines may increase or decrease depending on your approval time or any sudden/unforeseen circumstances we will keep you informed accordingly.
        </div>
      </section>
    </div>
  )

  return (
    <div className="min-h-screen bg-ivory-bg pb-16 sm:pb-24">
      {/* Hero Header */}
      <div className="bg-[#04122C] text-white py-16 sm:py-20 mb-12 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#D4AF37]/10 rounded-full -mr-32 -mt-32 blur-3xl"></div>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <Heading level="h1" className="text-3xl sm:text-5xl font-extrabold mb-4 tracking-tight">
            Shipping Policy
          </Heading>
          <Text className="text-gray-300 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed font-light">
            Shipping options, carrier information, handling times, and delivery estimates for domestic and international destinations.
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
