"use client"

import React, { useState, useEffect } from "react"
import { submitContactRequest } from "@lib/data/contact"
import ObfuscatedEmail from "@modules/common/components/obfuscated-email"
import { CONTACT_ADDRESS, CONTACT_EMAIL, CONTACT_PHONE } from "@lib/util/brand"

interface ContactDetails {
  phone: string
  email: string
  address: string
}

interface HelpTemplateProps {
  countryCode: string
  contactInfo?: ContactDetails | null
  dynamicFaqs?: Array<{ category: string; items: Array<{ q: string; a: string }> }> | null
}

const categoryIcons: Record<string, React.ReactNode> = {
  "Order & Delivery": (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
    </svg>
  ),
  "Returns & Exchanges": (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  ),
  "Payment & Refunds": (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
      <rect x="2" y="5" width="20" height="14" rx="2" strokeLinecap="round" strokeLinejoin="round" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M2 10h20M6 15h4" />
    </svg>
  ),
  "Product Inquiry": (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 2L2 7l10 15 10-15-10-5zM2 7h20M12 22V7" />
    </svg>
  ),
}

const defaultFaqs = [
  {
    category: "Order & Delivery",
    items: [
      { q: "When will I receive my order?", a: "Orders are typically processed within 1-2 business days. Delivery takes 3-5 business days depending on your location. Express delivery options may be available at checkout." },
      { q: "How can I track my order?", a: "Once your order ships, you will receive a tracking link via email and SMS. You can also track your order anytime from your account dashboard under 'My Orders'." },
      { q: "Can I cancel or change my order?", a: "You can cancel or change your order within 24 hours of placing it. Please contact our support team immediately or use the cancel option in your account. After 24 hours, the order may already be in processing." },
      { q: "Do you offer free shipping?", a: "Yes! We offer free shipping on all orders above ₹999. For orders below this amount, a nominal shipping fee applies based on your delivery location and the chosen shipping method." },
    ]
  },
  {
    category: "Returns & Exchanges",
    items: [
      { q: "What is your return policy?", a: "We offer a 7-day return policy for unworn jewelry in its original packaging with tags attached. Items must be in their original condition to qualify for a return." },
      { q: "How do I initiate a return?", a: "Go to your account, click on the specific order, and select 'Return Items'. Follow the instructions to generate a pickup request. Our team will schedule a pickup within 2 business days." },
      { q: "Do you offer exchanges?", a: "Yes, you can request an exchange for a different size or color within 7 days of delivery, subject to availability. Exchange items must be in original condition with all tags intact." },
      { q: "When will I receive my exchanged item?", a: "Once we receive and verify your returned item, the exchange will be dispatched within 2 business days. You'll receive a tracking link as soon as it ships." },
    ]
  },
  {
    category: "Payment & Refunds",
    items: [
      { q: "When will I receive my refund?", a: "Refunds are processed within 5-7 business days after we receive and inspect your returned items. The amount will be credited to your original payment method." },
      { q: "What payment methods do you accept?", a: "We accept all major credit/debit cards, UPI, Net Banking, Wallets (Paytm, PhonePe, etc.), and Cash on Delivery (COD) for most PIN codes across India." },
      { q: "Is my payment information secure?", a: "Absolutely! We use industry-standard SSL encryption and our payment gateway (Razorpay) is PCI-DSS compliant. We never store your card details on our servers." },
    ]
  },
  {
    category: "Product Inquiry",
    items: [
      { q: "What is moissanite and how does it compare to diamonds?", a: "Moissanite is a lab-created gemstone with exceptional brilliance and fire — often more sparkly than diamonds. Our stones are GRA-certified and set in 925 sterling silver for lasting beauty at a fraction of diamond prices." },
      { q: "Is Cultura Jewels jewelry hypoallergenic?", a: "Yes! All our pieces use pure 925 sterling silver, which is nickel-free and safe for sensitive skin. Our moissanite stones are lab-created with no allergens." },
      { q: "How should I care for my Cultura Jewels jewelry?", a: "Store pieces in the provided pouch, avoid harsh chemicals and chlorine, and clean gently with a soft cloth. For sterling silver, occasional polishing keeps the shine bright. Remove jewelry before swimming or exercising." },
    ]
  },
]

const HelpTemplate = ({ contactInfo, dynamicFaqs }: HelpTemplateProps) => {
  const faqsToDisplay = dynamicFaqs && dynamicFaqs.length > 0 ? dynamicFaqs : defaultFaqs

  const [activeTab, setActiveTab] = useState(0)
  const [openFaq, setOpenFaq] = useState<string | null>("item-0")
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<Array<{ catIndex: number; catName: string; q: string; a: string; itemIndex: number }> | null>(null)

  const [contactDetails] = useState<ContactDetails>({
    phone: CONTACT_PHONE,
    email: CONTACT_EMAIL,
    address: CONTACT_ADDRESS,
  })

  const [formData, setFormData] = useState({ name: "", email: "", topic: "", message: "" })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const handleSearch = (value: string) => {
    setSearchQuery(value)
    if (!value.trim()) {
      setSearchResults(null)
      return
    }
    const lower = value.toLowerCase()
    const results: typeof searchResults = []
    faqsToDisplay.forEach((cat, catIndex) => {
      cat.items.forEach((item, itemIndex) => {
        if (item.q.toLowerCase().includes(lower) || item.a.toLowerCase().includes(lower)) {
          results!.push({ catIndex, catName: cat.category, q: item.q, a: item.a, itemIndex })
        }
      })
    })
    setSearchResults(results)
  }

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setSubmitSuccess(false)
    setSubmitError(null)
    try {
      const result = await submitContactRequest({
        email: formData.email,
        payload: { full_name: formData.name, topic: formData.topic || "general_inquiry", message: formData.message },
        metadata: { source_page: "help" },
        source: "storefront",
      })
      if (result.success) {
        if (typeof window !== "undefined") {
          ;(window as any).dataLayer = (window as any).dataLayer || []
          ;(window as any).dataLayer.push({ event: "form_submit", form_type: "help_contact_form" })
        }
        setSubmitSuccess(true)
        setFormData({ name: "", email: "", topic: "", message: "" })
        setTimeout(() => setSubmitSuccess(false), 5000)
      } else {
        setSubmitError(result.error || "Failed to submit request. Please try again.")
      }
    } catch {
      setSubmitError("Something went wrong. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const currentCategory = faqsToDisplay[activeTab] || faqsToDisplay[0]

  return (
    <div className="bg-ivory-bg min-h-screen pb-24 font-sans text-gray-800">
      {/* ── HERO SECTION ── */}
      <div className="relative pt-16 md:pt-24 pb-12 md:pb-16 overflow-hidden">
        <div className="max-w-4xl mx-auto px-4 text-center relative z-10">
          <span className="inline-flex items-center gap-2 py-1.5 px-5 rounded-full text-[10px] sm:text-xs font-semibold tracking-[0.2em] uppercase mb-6 bg-[#FAF6F0] border border-[#EADBCA] text-[#D4AF37]">
            SUPPORT CENTER
          </span>

          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-serif font-medium text-[#0A1D37] mb-6 tracking-tight leading-tight">
            How Can We Help You Today?
          </h1>

          <p className="text-gray-600 text-sm sm:text-base md:text-lg max-w-2xl mx-auto leading-relaxed mb-8 font-light">
            Find answers to common questions or reach out to our dedicated support team. We&apos;re committed to making your Cultura Jewels experience exceptional.
          </p>

          {/* Search Input */}
          <div className="max-w-xl mx-auto relative shadow-sm">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search questions (e.g. shipping, returns, moissanite)..."
              className="w-full px-6 py-4 pr-12 rounded-2xl bg-white border border-[#EBE5DB] text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#D4AF37] focus:border-transparent transition-all shadow-sm"
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
              <svg className="w-5 h-5 stroke-[#D4AF37]" fill="none" viewBox="0 0 24 24" strokeWidth="1.75">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full max-w-[1240px] mx-auto px-4 md:px-8">
        {/* Search Results if active */}
        {searchResults && (
          <div className="mb-12 bg-white rounded-3xl p-6 md:p-8 border border-[#EBE5DB] shadow-md">
            <h3 className="font-serif text-xl text-[#0A1D37] mb-4">
              Search Results ({searchResults.length})
            </h3>
            {searchResults.length === 0 ? (
              <p className="text-gray-500 text-sm">No matching questions found. Try another search term or contact support below.</p>
            ) : (
              <div className="space-y-4">
                {searchResults.map((res, i) => (
                  <div key={i} className="p-4 rounded-xl bg-[#FAF8F5] border border-gray-100">
                    <p className="text-xs font-semibold text-[#D4AF37] uppercase tracking-wider mb-1">{res.catName}</p>
                    <p className="font-bold text-[#0A1D37] text-sm mb-1">{res.q}</p>
                    <p className="text-gray-600 text-xs sm:text-sm leading-relaxed">{res.a}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── FAQ SECTION ── */}
        <div id="faq-section" className="mb-20">
          <div className="text-center mb-10">
            <span className="inline-block py-1.5 px-5 rounded-full text-[10px] sm:text-xs font-semibold tracking-[0.2em] uppercase mb-3 bg-[#FAF6F0] border border-[#EADBCA] text-[#D4AF37]">
              KNOWLEDGE BASE
            </span>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-serif text-[#0A1D37] tracking-tight">
              Frequently Asked Questions
            </h2>
            <p className="text-gray-500 text-xs sm:text-sm md:text-base max-w-xl mx-auto mt-2 font-light">
              Organized by topic for quick and effortless navigation.
            </p>
          </div>

          {/* Category Tabs */}
          <div className="flex flex-wrap gap-3 justify-center mb-10">
            {faqsToDisplay.map((cat, i) => {
              const isActive = activeTab === i
              const icon = categoryIcons[cat.category] || (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
                  <circle cx="12" cy="12" r="10" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 16v-4m0-4h.01" />
                </svg>
              )
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => { setActiveTab(i); setOpenFaq("item-0") }}
                  className={`flex items-center gap-2.5 py-3 px-6 rounded-full font-medium text-xs sm:text-sm transition-all duration-300 ${
                    isActive
                      ? "bg-[#0A1D37] text-white shadow-md border border-[#0A1D37]"
                      : "bg-white text-gray-700 border border-gray-200 hover:border-[#D4AF37]/60 hover:text-[#D4AF37]"
                  }`}
                >
                  <span className={isActive ? "text-[#D4AF37]" : "text-gray-400"}>{icon}</span>
                  {cat.category}
                </button>
              )
            })}
          </div>

          {/* FAQ Accordion Panel */}
          <div className="bg-white rounded-3xl overflow-hidden border border-[#EBE5DB] shadow-lg">
            {/* Panel Header */}
            <div className="px-6 md:px-10 py-6 bg-[#0A1D37] text-white flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-[#FAF6F0]/10 border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37]">
                  {categoryIcons[currentCategory.category] || (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
                      <circle cx="12" cy="12" r="10" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 16v-4m0-4h.01" />
                    </svg>
                  )}
                </div>
                <div>
                  <h3 className="font-serif text-lg md:text-xl text-white font-medium">{currentCategory.category}</h3>
                  <p className="text-gray-300 text-xs font-light mt-0.5">{currentCategory.items.length} questions in this topic</p>
                </div>
              </div>
            </div>

            {/* Accordion Items */}
            <div className="divide-y divide-gray-100">
              {currentCategory.items.map((faq, idx) => {
                const id = `item-${idx}`
                const isOpen = openFaq === id
                return (
                  <div key={id} className={`transition-colors duration-200 ${isOpen ? "bg-[#FAF8F5]" : "bg-white hover:bg-gray-50/50"}`}>
                    <button
                      type="button"
                      onClick={() => setOpenFaq(isOpen ? null : id)}
                      className="w-full flex items-center justify-between gap-4 px-6 md:px-10 py-5 text-left focus:outline-none"
                    >
                      <div className="flex items-center gap-4">
                        <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${
                          isOpen ? "bg-[#0A1D37] text-[#D4AF37]" : "bg-gray-100 text-gray-500"
                        }`}>
                          {String(idx + 1).padStart(2, "0")}
                        </span>
                        <span className={`font-serif text-sm sm:text-base leading-snug ${isOpen ? "text-[#0A1D37] font-medium" : "text-gray-800"}`}>
                          {faq.q}
                        </span>
                      </div>
                      <span className={`w-8 h-8 rounded-full flex items-center justify-center transition-transform duration-300 ${isOpen ? "rotate-180 bg-[#0A1D37] text-white" : "bg-gray-100 text-gray-400"}`}>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </span>
                    </button>

                    {isOpen && (
                      <div className="px-6 md:px-10 pb-6 pl-[4.25rem] md:pl-[5.25rem]">
                        <p className="text-gray-600 text-xs sm:text-sm leading-relaxed font-light">
                          {faq.a}
                        </p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* ── CONTACT SECTION ── */}
        <div id="contact-section" className="relative pt-4">
          <div className="text-center mb-12">
            <span className="inline-block py-1.5 px-5 rounded-full text-[10px] sm:text-xs font-semibold tracking-[0.2em] uppercase mb-3 bg-[#FAF6F0] border border-[#EADBCA] text-[#D4AF37]">
              DIRECT ASSISTANCE
            </span>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-serif text-[#0A1D37] tracking-tight">
              Still Need Help?
            </h2>
            <p className="text-gray-500 text-xs sm:text-sm max-w-lg mx-auto mt-2 font-light">
              Our dedicated support team is ready to assist you with any questions.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            {/* Left: Contact Info Cards */}
            <div className="lg:col-span-5 flex flex-col gap-4">
              {[
                {
                  icon: (
                    <svg className="w-5 h-5 stroke-[#D4AF37]" fill="none" viewBox="0 0 24 24" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
                    </svg>
                  ),
                  label: "Call Us",
                  value: contactDetails.phone,
                  sub: "Mon–Sat, 9am – 6pm IST",
                },
                {
                  icon: (
                    <svg className="w-5 h-5 stroke-[#D4AF37]" fill="none" viewBox="0 0 24 24" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="4" width="20" height="16" rx="3" />
                      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                    </svg>
                  ),
                  label: "Email Us",
                  value: (
                    <ObfuscatedEmail
                      email={contactDetails.email}
                      className="hover:text-gold-accent transition-colors"
                    />
                  ),
                  sub: "Response within 24 hours",
                },
                {
                  icon: (
                    <svg className="w-5 h-5 stroke-[#D4AF37]" fill="none" viewBox="0 0 24 24" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                  ),
                  label: "Our Atelier",
                  value: contactDetails.address,
                  sub: "Visit us at our office location",
                },
              ].map((card, i) => (
                <div key={i} className="flex items-center gap-4 p-5 rounded-2xl bg-white border border-[#EBE5DB] shadow-sm">
                  <div className="w-12 h-12 rounded-full bg-[#FAF6F0] border border-[#EADBCA] flex items-center justify-center shrink-0">
                    {card.icon}
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <p className="text-[10px] font-semibold text-gold-accent uppercase tracking-wider mb-0.5">{card.label}</p>
                    <p className="font-semibold text-[#0A1D37] text-sm leading-tight break-words">{card.value}</p>
                    <p className="text-gray-400 text-xs mt-0.5 font-light">{card.sub}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Right: Contact Form */}
            <div className="lg:col-span-7">
              <div className="bg-white rounded-3xl p-6 sm:p-8 md:p-10 border border-[#EBE5DB] shadow-lg">
                <h3 className="font-serif text-2xl text-[#0A1D37] mb-2 font-medium">Send Us a Message</h3>
                <p className="text-gray-500 text-xs sm:text-sm mb-6 font-light">Fill out the details below and our team will get back to you shortly.</p>

                <form onSubmit={handleFormSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="help-name" className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                        Full Name <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text" id="help-name" name="name"
                        value={formData.name} onChange={handleFormChange} required
                        placeholder="Your full name"
                        className="w-full px-4 py-3 rounded-xl bg-[#FAF8F5] border border-gray-200 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#D4AF37] focus:border-transparent transition-all"
                      />
                    </div>
                    <div>
                      <label htmlFor="help-email" className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                        Email Address <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="email" id="help-email" name="email"
                        value={formData.email} onChange={handleFormChange} required
                        placeholder="you@example.com"
                        className="w-full px-4 py-3 rounded-xl bg-[#FAF8F5] border border-gray-200 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#D4AF37] focus:border-transparent transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="help-topic" className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                      Topic <span className="text-red-400">*</span>
                    </label>
                    <select
                      id="help-topic" name="topic"
                      value={formData.topic} onChange={handleFormChange} required
                      className="w-full px-4 py-3 rounded-xl bg-[#FAF8F5] border border-gray-200 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#D4AF37] focus:border-transparent transition-all"
                    >
                      <option value="" disabled>Select a topic...</option>
                      <option value="general_inquiry">General Inquiry</option>
                      <option value="order_delivery_issue">Order & Delivery Issue</option>
                      <option value="returns_refunds">Returns & Refunds</option>
                      <option value="product_inquiry">Product Inquiry</option>
                      <option value="payment_billing">Payment & Billing</option>
                      <option value="account_login">Account & Login</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="help-message" className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                      Your Message <span className="text-red-400">*</span>
                    </label>
                    <textarea
                      id="help-message" name="message"
                      value={formData.message} onChange={handleFormChange} required
                      rows={4}
                      placeholder="Please describe your query in detail..."
                      className="w-full px-4 py-3 rounded-xl bg-[#FAF8F5] border border-gray-200 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#D4AF37] focus:border-transparent transition-all resize-none"
                    />
                  </div>

                  {submitSuccess && (
                    <div className="p-4 rounded-xl bg-green-50 border border-green-200">
                      <p className="text-green-800 text-xs font-semibold">Thank you! Your message has been sent successfully.</p>
                    </div>
                  )}
                  {submitError && (
                    <div className="p-4 rounded-xl bg-red-50 border border-red-200">
                      <p className="text-red-800 text-xs font-semibold">{submitError}</p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3.5 px-6 rounded-full bg-[#1c1b18] text-white hover:bg-[#D4AF37] hover:text-[#1c1b18] font-semibold text-xs uppercase tracking-[0.2em] transition-all duration-300 shadow-md disabled:opacity-50"
                  >
                    {isSubmitting ? "Submitting..." : submitSuccess ? "Message Sent!" : "Submit Inquiry"}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

export default HelpTemplate
