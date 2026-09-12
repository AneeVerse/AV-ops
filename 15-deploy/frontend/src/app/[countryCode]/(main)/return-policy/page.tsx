import { Metadata } from "next"
import { Heading, Text } from "@medusajs/ui"
import PolicyRegionTabs from "@modules/common/components/policy-region-tabs"
import { CONTACT_ADDRESS, CONTACT_EMAIL, CONTACT_PHONE } from "@lib/util/brand"

export const metadata: Metadata = {
  title: "Return Policy | Cultura Jewels",
  description: "View our return, exchange, and refund policy for India and International orders.",
}

export default async function ReturnPolicyPage(props: {
  params: Promise<{ countryCode: string }>
}) {
  const { countryCode } = await props.params

  const indiaContent = (
    <div className="space-y-8 text-gray-700 leading-relaxed">
      <div className="border-b border-gray-100 pb-4">
        <h2 className="text-2xl font-bold text-[#04122C]">India</h2>
      </div>

      {/* Basic Return Policy */}
      <section className="space-y-3">
        <h3 className="text-xl font-bold text-[#04122C]">Return Policy:</h3>
        <p>
          We have a 15 day return policy, which means you have 15 days after receiving your item to request a return.
        </p>
        <p>
          To be eligible for a return, your item must be in the same condition that you received it, unworn or unused, with tags, and in its original packaging. You will also need the receipt or proof of purchase.
        </p>
      </section>

      {/* Moissanite Clause */}
      <section className="p-5 rounded-2xl bg-amber-50/80 border border-amber-200/60 space-y-2">
        <h3 className="text-lg font-bold text-amber-950">Moissanite Stone Return Policy Clause:</h3>
        <ul className="list-disc list-inside space-y-1.5 text-sm text-amber-900">
          <li>
            <span className="font-semibold text-amber-950">Non-Returnable Item:</span> All moissanite stones used in our jewellery are <strong className="font-bold">non-returnable and non-refundable</strong> once the order is delivered.
          </li>
          <li>
            <span className="font-semibold text-amber-950">Quality Assurance:</span> Each moissanite stone undergoes strict quality checks before dispatch. Therefore, returns based on personal preference, change of mind, or minor visual variations will not be accepted.
          </li>
        </ul>
      </section>

      {/* Address & Instructions */}
      <section className="space-y-3 bg-gray-50 p-6 rounded-2xl border border-gray-100">
        <p>
          To start a return, you can contact us at{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-[#04122C] font-semibold underline">
            {CONTACT_EMAIL}
          </a>
          . Please note that returns will need to be sent to the following address:
        </p>
        <div className="bg-white p-4 rounded-xl border border-gray-200 text-sm font-medium text-gray-800 leading-normal">
          <p className="font-bold text-[#04122C]">Cultura Jewels</p>
          <p>{CONTACT_ADDRESS}</p>
        </div>
        <p>
          If your return is accepted, we will send you a return shipping label, as well as instructions on how and where to send your package. Items sent back to us without first requesting a return will not be accepted.
        </p>
        <p>
          You can always contact us for any return questions at{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-[#04122C] font-semibold underline">
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </section>

      {/* Section Blocks */}
      <div className="space-y-6">
        <div>
          <h4 className="text-lg font-bold text-[#04122C] mb-2">Damages and issues</h4>
          <p>
            Please inspect your order upon reception and contact us immediately if the item is defective, damaged or if you receive the wrong item, so that we can evaluate the issue and make it right.
          </p>
        </div>

        <div>
          <h4 className="text-lg font-bold text-[#04122C] mb-2">Exchanges</h4>
          <p>
            The fastest way to ensure you get what you want is to return the item you have, and once the return is accepted, make a separate purchase for the new item.
          </p>
        </div>

        <div>
          <h4 className="text-lg font-bold text-[#04122C] mb-2">Refunds</h4>
          <p className="mb-2">
            We will notify you once we have received and inspected your return, and let you know if the refund was approved or not. If approved, you will be automatically refunded on your original payment method within 10 business days. Please remember it can take some time for your bank or credit card company to process and post the refund too.
          </p>
          <ol className="list-decimal list-inside space-y-1 bg-gray-50 p-4 rounded-xl text-sm font-medium">
            <li>For cash on delivery orders, the refund will be processed to your bank account.</li>
            <li>For prepaid orders, the amount will be credited to the payment source (Credit Card/Debit Card /Net Banking/UPI).</li>
          </ol>
          <p className="mt-3 text-sm text-gray-600">
            If more than 10 business days have passed since we have approved your return, please contact us at{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-[#04122C] font-semibold underline">
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </div>
      </div>

      {/* Customised Product Return & Exchange Policy */}
      <section className="pt-6 border-t border-gray-200 space-y-6">
        <h4 className="text-xl font-bold text-[#04122C]">Customised Product Return & Exchange Policy</h4>

        <div className="space-y-4">
          <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
            <h5 className="font-bold text-[#04122C] mb-1">1. Customised Orders Are Non-Refundable</h5>
            <p className="text-sm">
              All products that are customised, personalised, or specially made as per the customer’s specific requirements are not eligible for cancellation or refund under any circumstances. Once the order is confirmed and production has begun, Cultura Jewels is not responsible for issuing any refunds for customised items.
            </p>
          </div>

          <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
            <h5 className="font-bold text-[#04122C] mb-1">2. Exchange Allowed Only on Same Invoice Value</h5>
            <p className="text-sm">
              Customers may request an exchange only for another product of equal invoice value. Price differences will not be refunded or adjusted.
            </p>
          </div>

          <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
            <h5 className="font-bold text-[#04122C] mb-1">3. Exchange Eligibility Conditions</h5>
            <p className="text-sm">
              An exchange request for customised items will be processed only if the following conditions are met:
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <h5 className="font-bold text-[#04122C]">4. How to return the product to Cultura Jewels within 15 days -</h5>
          <ol className="list-decimal list-inside space-y-2 text-sm bg-gray-50/50 p-5 rounded-2xl border border-gray-100">
            <li>Place a return request on your account on the website or write an email to {CONTACT_EMAIL} within 15 days of delivery to schedule a return pick up.</li>
            <li>Cultura Jewels will send reverse pick up details and instructions.</li>
            <li>Pack your jewellery in the original packaging material along with the certificate and hand it over to the logistics executive.</li>
            <li>The original product certificate and the invoice should accompany the product. Loss of the certificate will result in additional charges of Rs. 2,000 or Rs. 800 per carat – whichever is higher.</li>
            <li>Please collect an acknowledgement for the item being picked up (pickup receipt on paper/ photo of tracking number/ SMS confirmation).</li>
            <li>Once the product is received, we conduct a quality check to check for any signs of damage or wear and tear. Once the quality check is cleared, refund will be processed to your bank account in 10 business days. Any item that shows signs of wear or that has been altered, resized (by a jeweller other than the company) or damaged cannot be accepted for 15 day Return Policy.</li>
            <li>In case the product was earlier purchased through EMI system, we will deduct an amount equivalent to 1% of the Grand Total Amount at the time of refund of initial installment.</li>
          </ol>
        </div>
      </section>

      {/* Changes in Policies */}
      <section className="space-y-2 text-sm text-gray-600 border-t border-gray-100 pt-4">
        <p className="font-semibold text-gray-800">Changes in Policies -</p>
        <p>
          Cultura Jewels reserves the right to modify these policies at any time so it is advisable to review the policies frequently. Changes will take effect immediately upon publishing on the website. Any material changes made to the policies will be made along with a notification here that the policies have been updated.
        </p>
      </section>

      {/* Customer Helpline */}
      <section className="bg-[#04122C] text-white p-6 rounded-2xl space-y-3">
        <h4 className="text-lg font-bold">Customer Helpline</h4>
        <p className="text-gray-300 text-sm">Need help? Think we could have done something better?</p>
        <p className="text-gray-300 text-sm">We are listening and happy to do what we can to improve. Please let us know.</p>
        <p className="text-sm">
          We can be reached at <a href={`mailto:${CONTACT_EMAIL}`} className="text-[#D4AF37] underline font-medium">{CONTACT_EMAIL}</a> or at <span className="font-semibold">{CONTACT_PHONE}</span>.
        </p>
        <div className="pt-2 text-xs text-gray-400 border-t border-white/10">
          <p className="font-semibold text-white">Our registered office address is:</p>
          <p>Cultura Jewels</p>
          <p>{CONTACT_ADDRESS}</p>
        </div>
      </section>

      {/* Buyback & Exchange Policy */}
      <section className="p-4 rounded-xl bg-gray-100 border border-gray-200 text-sm text-gray-800">
        <h4 className="font-bold text-[#04122C] mb-1">Buyback and Exchange Policy</h4>
        <p>
          Cultura Jewels does not currently offer a Lifetime Buyback (Money Back) policy. Cultura Jewels also does not currently offer a Lifetime Money Exchange policy.
        </p>
      </section>
    </div>
  )

  const internationalContent = (
    <div className="space-y-8 text-gray-700 leading-relaxed">
      <div className="border-b border-gray-100 pb-4">
        <h2 className="text-2xl font-bold text-[#04122C]">International</h2>
      </div>

      {/* Basic Return Policy */}
      <section className="space-y-3">
        <h3 className="text-xl font-bold text-[#04122C]">Return Policy:</h3>
        <p>
          We have a 30 day return policy, which means you have 30 days after receiving your item to request a return.
        </p>
        <p>
          To be eligible for a return, your item must be in the same condition that you received it, unworn or unused, with tags, and in its original packaging. You will also need the receipt or proof of purchase.
        </p>
      </section>

      {/* Moissanite Clause */}
      <section className="p-5 rounded-2xl bg-amber-50/80 border border-amber-200/60 space-y-2">
        <h3 className="text-lg font-bold text-amber-950">Moissanite Stone Return Policy Clause:</h3>
        <ul className="list-disc list-inside space-y-1.5 text-sm text-amber-900">
          <li>
            <span className="font-semibold text-amber-950">Non-Returnable Item:</span> All moissanite stones used in our jewellery are <strong className="font-bold">non-returnable and non-refundable</strong> once the order is delivered.
          </li>
          <li>
            <span className="font-semibold text-amber-950">Quality Assurance:</span> Each moissanite stone undergoes strict quality checks before dispatch. Therefore, returns based on personal preference, change of mind, or minor visual variations will not be accepted.
          </li>
        </ul>
      </section>

      {/* Address & Instructions */}
      <section className="space-y-3 bg-gray-50 p-6 rounded-2xl border border-gray-100">
        <p>
          To start a return, you can contact us at{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-[#04122C] font-semibold underline">
            {CONTACT_EMAIL}
          </a>
          . Please note that returns will need to be sent to the following address:
        </p>
        <div className="bg-white p-4 rounded-xl border border-gray-200 text-sm font-medium text-gray-800 leading-normal">
          <p className="font-bold text-[#04122C]">Cultura Jewels</p>
          <p>{CONTACT_ADDRESS}</p>
        </div>
        <p>
          If your return is accepted, we will send you a return shipping label, as well as instructions on how and where to send your package. Items sent back to us without first requesting a return will not be accepted.
        </p>
        <p>
          You can always contact us for any return questions at{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-[#04122C] font-semibold underline">
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </section>

      {/* Section Blocks */}
      <div className="space-y-6">
        <div>
          <h4 className="text-lg font-bold text-[#04122C] mb-2">Damages and issues</h4>
          <p>
            Please inspect your order upon reception and contact us immediately if the item is defective, damaged or if you receive the wrong item, so that we can evaluate the issue and make it right.
          </p>
        </div>

        <div>
          <h4 className="text-lg font-bold text-[#04122C] mb-2">Exchanges</h4>
          <p>
            The fastest way to ensure you get what you want is to return the item you have, and once the return is accepted, make a separate purchase for the new item.
          </p>
        </div>

        <div>
          <h4 className="text-lg font-bold text-[#04122C] mb-2">Refunds</h4>
          <p className="mb-2">
            We will notify you once we have received and inspected your return, and let you know if the refund was approved or not. If approved, you will be automatically refunded on your original payment method within 10 business days. Please remember it can take some time for your bank or credit card company to process and post the refund too.
          </p>
          <ol className="list-decimal list-inside space-y-1 bg-gray-50 p-4 rounded-xl text-sm font-medium">
            <li>For cash on delivery orders, the refund will be processed to your bank account.</li>
            <li>For prepaid orders, the amount will be credited to the payment source (Credit Card/Debit Card /Net Banking/UPI).</li>
          </ol>
          <p className="mt-3 text-sm text-gray-600">
            If more than 10 business days have passed since we have approved your return, please contact us at{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-[#04122C] font-semibold underline">
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </div>
      </div>

      {/* Customised Product Return & Exchange Policy */}
      <section className="pt-6 border-t border-gray-200 space-y-6">
        <h4 className="text-xl font-bold text-[#04122C]">Customised Product Return & Exchange Policy</h4>

        <div className="space-y-4">
          <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
            <h5 className="font-bold text-[#04122C] mb-1">1. Customised Orders Are Non-Refundable</h5>
            <p className="text-sm">
              All products that are customised, personalised, or specially made as per the customer’s specific requirements are not eligible for cancellation or refund under any circumstances. Once the order is confirmed and production has begun, Cultura Jewels is not responsible for issuing any refunds for customised items.
            </p>
          </div>

          <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
            <h5 className="font-bold text-[#04122C] mb-1">2. Exchange Allowed Only on Same Invoice Value</h5>
            <p className="text-sm">
              Customers may request an exchange only for another product of equal invoice value. Price differences will not be refunded or adjusted.
            </p>
          </div>

          <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
            <h5 className="font-bold text-[#04122C] mb-1">3. Exchange Eligibility Conditions</h5>
            <p className="text-sm">
              An exchange request for customised items will be processed only if the following conditions are met:
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <h5 className="font-bold text-[#04122C]">4. How to return the product to Cultura Jewels within 30 days -</h5>
          <ol className="list-decimal list-inside space-y-2 text-sm bg-gray-50/50 p-5 rounded-2xl border border-gray-100">
            <li>Place a return request on your account on the website or write an email to {CONTACT_EMAIL} within 30 days of delivery to schedule a return pick up.</li>
            <li>Cultura Jewels will send reverse pick up details and instructions.</li>
            <li>Pack your jewellery in the original packaging material along with the certificate and hand it over to the logistics executive.</li>
            <li>The original product certificate and the invoice should accompany the product. Loss of the certificate will result in additional charges of Rs. 2,000 or Rs. 800 per carat – whichever is higher.</li>
            <li>Please collect an acknowledgement for the item being picked up (pickup receipt on paper/ photo of tracking number/ SMS confirmation).</li>
            <li>Once the product is received, we conduct a quality check to check for any signs of damage or wear and tear. Once the quality check is cleared, refund will be processed to your bank account in 10 business days. Any item that shows signs of wear or that has been altered, resized (by a jeweller other than the company) or damaged cannot be accepted for 30 day Return Policy.</li>
            <li>In case the product was earlier purchased through EMI system, we will deduct an amount equivalent to 1% of the Grand Total Amount at the time of refund of initial installment.</li>
          </ol>
        </div>
      </section>

      {/* Changes in Policies */}
      <section className="space-y-2 text-sm text-gray-600 border-t border-gray-100 pt-4">
        <p className="font-semibold text-gray-800">Changes in Policies -</p>
        <p>
          Cultura Jewels reserves the right to modify these policies at any time so it is advisable to review the policies frequently. Changes will take effect immediately upon publishing on the website. Any material changes made to the policies will be made along with a notification here that the policies have been updated.
        </p>
      </section>

      {/* Customer Helpline */}
      <section className="bg-[#04122C] text-white p-6 rounded-2xl space-y-3">
        <h4 className="text-lg font-bold">Customer Helpline</h4>
        <p className="text-gray-300 text-sm">Need help? Think we could have done something better?</p>
        <p className="text-gray-300 text-sm">We are listening and happy to do what we can to improve. Please let us know.</p>
        <p className="text-sm">
          We can be reached at <a href={`mailto:${CONTACT_EMAIL}`} className="text-[#D4AF37] underline font-medium">{CONTACT_EMAIL}</a> or at <span className="font-semibold">{CONTACT_PHONE}</span>.
        </p>
        <div className="pt-2 text-xs text-gray-400 border-t border-white/10">
          <p className="font-semibold text-white">Our registered office address is:</p>
          <p>Cultura Jewels</p>
          <p>{CONTACT_ADDRESS}</p>
        </div>
      </section>

      {/* Buyback & Exchange Policy */}
      <section className="p-4 rounded-xl bg-gray-100 border border-gray-200 text-sm text-gray-800">
        <h4 className="font-bold text-[#04122C] mb-1">Buyback and Exchange Policy</h4>
        <p>
          Cultura Jewels does not currently offer a Lifetime Buyback (Money Back) policy. Cultura Jewels also does not currently offer a Lifetime Money Exchange policy.
        </p>
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
            Return Policy
          </Heading>
          <Text className="text-gray-300 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed font-light">
            Comprehensive guidelines on returns, exchanges, refunds, and customised orders for India and International customers.
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
