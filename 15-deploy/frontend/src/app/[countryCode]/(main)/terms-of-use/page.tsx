import { Metadata } from "next"
import { Heading, Text } from "@medusajs/ui"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { CONTACT_ADDRESS, CONTACT_EMAIL, CONTACT_PHONE } from "@lib/util/brand"

export const metadata: Metadata = {
  title: "Terms and Conditions | Cultura Jewels",
  description: "Read our terms and conditions for using the Cultura Jewels store.",
}

export default function TermsOfUsePage() {
  return (
    <div className="min-h-screen bg-ivory-bg pb-16 sm:pb-24">
      {/* Header Section */}
      <div className="bg-[#04122C] text-white py-16 sm:py-24 mb-12 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#D4AF37]/10 rounded-full -mr-32 -mt-32 blur-3xl"></div>
        
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <Heading level="h1" className="text-3xl sm:text-5xl font-extrabold mb-4 tracking-tight">
            Terms And Conditions
          </Heading>
          <Text className="text-gray-300 text-base sm:text-xl max-w-2xl mx-auto leading-relaxed font-light">
            Terms, conditions, policies, and legal disclaimers governing your use of Cultura Jewels.
          </Text>
        </div>
      </div>

      {/* Content Section */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-100 p-6 sm:p-10 md:p-14 space-y-8 text-gray-700 leading-relaxed">
          
          {/* Use of the Website */}
          <section className="space-y-2">
            <h2 className="text-xl font-bold text-[#04122C]">Use of the Website</h2>
            <p>
              By accessing the website, you warrant and represent to the website owner that you are legally entitled to do so and to make use of information made available via the website, call centre or any other means of communication.
            </p>
          </section>

          {/* Definition */}
          <section className="space-y-2">
            <h2 className="text-xl font-bold text-[#04122C]">Definition</h2>
            <p>
              "Jewellery" means the jewellery that is predesigned or jewellery set with gold and natural diamonds that are available for sale on our website/retail stores. Please note that all Jewellery is sold on "as is" basis. "Mounts" are defined as designs that hold a diamond(s) in place, which may or may not have diamonds. Members can select Mounts and diamonds separately to create customized Jewellery. "Loose Diamonds" are individual natural diamonds that can be bought without being set on Mounts.
            </p>
          </section>

          {/* Trademarks */}
          <section className="space-y-2">
            <h2 className="text-xl font-bold text-[#04122C]">Trademarks</h2>
            <p>
              The trademarks, names, logos and service marks (collectively "trademarks") displayed on this website are registered and unregistered trademarks of Cultura Jewels. Nothing contained on this website should be construed as granting any license or right to use any trademark without the prior written permission of Cultura Jewels.
            </p>
          </section>

          {/* External Links */}
          <section className="space-y-2">
            <h2 className="text-xl font-bold text-[#04122C]">External Links</h2>
            <p>
              External links may be provided for your convenience, but they are beyond the control of the website owner and no representation is made as to their content. Use or reliance on any external links and the content thereon provided is at your own risk.
            </p>
          </section>

          {/* Warranties */}
          <section className="space-y-2">
            <h2 className="text-xl font-bold text-[#04122C]">Warranties</h2>
            <p>
              The website owner makes no warranties, representations, statements or guarantees (whether express, implied in law or residual) regarding the website.
            </p>
          </section>

          {/* Prices */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-[#04122C]">Prices</h2>
            <p>
              Our pricing is calculated using current precious metal and gem prices to give you the best possible value. These prices do change from time to time, owing to the fluctuations in prices of precious metal and diamond prices, so our prices change as well. The pricing of the metal on the day of purchase/advance payment will be considered in pricing for customer.
            </p>
            <p>
              Prices on Cultura Jewels Store are subject to change without notice. Please expect to be charged the price for the Cultura Jewels Store merchandise you buy as it is listed on the day of purchase.
            </p>
            <p>
              Pricing may change slightly due to variance between metal and diamond estimate provided on website and the actual finished product. Such increase/decrease would be collected/refunded to the customer at the time of final sale.
            </p>
          </section>

          {/* Other Information */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-[#04122C]">Other Information</h2>
            <p>
              This Website provides access to trading, pricing, news and other information services related to diamonds and jewellery. Certain Services available on this Website are for the use of Members only. This Website offers services for Members who wish to purchase diamonds/jewellery for personal consumption, inclusive of, customized and readymade Jewellery.
            </p>
            <p>
              Some items may appear slightly larger or smaller than actual size due to screen defaults and photography techniques. Sometimes the items may be represented larger than the actual size in order to clearly show details or smaller than the actual size in order to show the entire item. The Company shall not be liable for any legal action on this account.
            </p>
          </section>

          {/* Disclaimer of Liability */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-[#04122C]">Disclaimer of Liability</h2>
            <p>
              The website owner shall not be responsible for and disclaims all liability for any loss, liability, damage (whether direct, indirect or consequential), personal injury or expense of any nature whatsoever which may be suffered by you or any third party (including your company), as a result of or which may be attributable, directly or indirectly, to your access and use of the website, any information contained on the website, your or your company's personal information or material and information transmitted over our system. In particular, neither the website owner nor any third party or data or content provider shall be liable in any way to you or to any other person, firm or corporation whatsoever for any loss, liability, damage (whether direct or consequential), personal injury or expense of any nature whatsoever arising from any delays, inaccuracies, errors in, or omission of any share price information or the transmission thereof, or for any actions taken in reliance thereon or occasioned thereby or by reason of non-performance or interruption, or termination thereof.
            </p>
            <p>
              We as a merchant shall be under no liability whatsoever in respect of any loss or damage arising directly or indirectly out of the decline of authorization for any Transaction, on Account of the Cardholder having exceeded the preset limit mutually agreed by us with our acquiring bank from time to time.
            </p>
          </section>

          {/* Conflict of Terms */}
          <section className="space-y-2">
            <h2 className="text-xl font-bold text-[#04122C]">Conflict of Terms</h2>
            <p>
              If there is a conflict or contradiction between the provisions of these website terms and conditions and any other relevant terms and conditions, policies or notices, the other relevant terms and conditions, policies or notices which relate specifically to a particular section or module of the website shall prevail in respect of your use of the relevant section or module of the website.
            </p>
          </section>

          {/* Severability */}
          <section className="space-y-2">
            <h2 className="text-xl font-bold text-[#04122C]">Severability</h2>
            <p>
              Any provision of any relevant terms and conditions, policies and notices, which is or becomes unenforceable in any jurisdiction, whether due to being void, invalidity, illegality, unlawfulness or for any reason whatever, shall, in such jurisdiction only and only to the extent that it is so unenforceable, be treated as void and the remaining provisions of any relevant terms and conditions, policies and notices shall remain in full force and effect.
            </p>
          </section>

          {/* Cancellation & Returns */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-[#04122C]">Cancellation & Returns</h2>
            <p>
              Refunds will be made for any cancelled orders. Orders cancelled within 24 hours of placing the order are entitled for full refund subject to deduction of payment gateway charges of 2%. Orders canceled 24 hours after placing the order will lead to a Processing Charge of Rs. 1000 that will be borne by the customer along with 2% payment gateway charges.
            </p>
            <p>
              However if the order is customised and is made as per customers order, making charges would be charged and forfeited. You can cancel one order item within an order without cancelling the entire order if the order contains 2 or more order items.
            </p>
            <ul className="list-disc list-inside space-y-1.5 pl-2 text-sm">
              <li>For prepaid orders, the amount will be credited to the payment source (Credit Card/Debit Card/Net Banking).</li>
            </ul>
            <p>
              Once the product is returned under our 15 Day Money Back policy (not applicable on coins) the refund will be credited to your account. You may choose to either make another purchase using the same or get the amount refunded to your bank account.
            </p>
            <p>
              For cash on delivery orders, the refund will be processed to your bank account.
            </p>
            <ul className="list-disc list-inside space-y-1.5 pl-2 text-sm">
              <li>For prepaid orders, the amount will be credited to the payment source (Credit Card/Debit Card/Net Banking).</li>
              <li>Upon cancellation/return of orders placed using gift cards, the gift card amount will be refunded back to the gift card.</li>
              <li>
                Please visit our{" "}
                <LocalizedClientLink href="/return-policy" className="text-[#04122C] font-semibold underline">
                  Return Policy
                </LocalizedClientLink>{" "}
                page for more details.
              </li>
            </ul>
          </section>

          {/* Applicable Laws */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-[#04122C]">Applicable Laws</h2>
            <p>
              Use of this website shall in all respects be governed by the laws of the state of Maharashtra, India, regardless of the laws that might be applicable under principles of conflicts of law. The parties agree that the courts located in Thane/Mumbai, Maharashtra, shall have exclusive jurisdiction over all controversies arising under this agreement and agree that venue is proper in those courts.
            </p>
            <p className="text-sm bg-gray-50 p-4 rounded-xl border border-gray-200">
              As per the current guidelines mandated by the Government of India, a customer has to provide the Permanent Account Number (PAN) for all purchases above INR 2 lakh in a day.
            </p>
          </section>

          {/* Free Gift */}
          <section className="space-y-2">
            <h2 className="text-xl font-bold text-[#04122C]">Free Gift</h2>
            <p>All free gifts are treated as discounts.</p>
            <ul className="list-disc list-inside space-y-1 pl-2 text-sm">
              <li>In Case of Partial Cancellation or Returns of Orders with a Free gift, the Amount refunded will not include the discount attributed to the Free Gift.</li>
            </ul>
          </section>

          {/* Offer Terms & Conditions */}
          <section className="space-y-2 bg-gray-50 p-6 rounded-2xl border border-gray-100">
            <h2 className="text-xl font-bold text-[#04122C]">Offer Terms & Conditions</h2>
            <ul className="list-disc list-inside space-y-1.5 text-sm">
              <li>Special offer is valid only on select designs on jewellery.</li>
              <li>Cultura Jewels Store may change (add to, delete, or amend) these terms from time to time.</li>
              <li>All disputes, with respect to the products and services offered in this connection, are subject to Maharashtra jurisdiction.</li>
            </ul>
          </section>

          {/* Contact Information Section */}
          <section className="bg-[#04122C] text-white p-6 sm:p-8 rounded-2xl space-y-3">
            <h2 className="text-xl font-bold">Contact Us</h2>
            <p className="text-gray-300 text-sm">
              Have questions about our Terms & Conditions? We are happy to assist you.
            </p>
            <p className="text-sm">
              Email us at{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-[#D4AF37] underline font-medium">
                {CONTACT_EMAIL}
              </a>{" "}
              or call us at <span className="font-semibold">{CONTACT_PHONE}</span>.
            </p>
            <div className="pt-2 text-xs text-gray-400 border-t border-white/10 space-y-1">
              <p className="font-semibold text-white">Registered Address:</p>
              <p>Cultura Jewels</p>
              <p>{CONTACT_ADDRESS}</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

