"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { submitContactRequest } from "@lib/data/contact"
import ObfuscatedEmail from "@modules/common/components/obfuscated-email"
import { CONTACT_ADDRESS, CONTACT_EMAIL, CONTACT_PHONE } from "@lib/util/brand"

interface ContactDetails {
  phone: string
  email: string
  address: string
}

interface ContactTemplateProps {
  countryCode: string
  contactInfo?: ContactDetails | null
}

const ContactTemplate = ({ countryCode, contactInfo }: ContactTemplateProps) => {
  const [contactDetails, setContactDetails] = useState<ContactDetails>({
    phone: CONTACT_PHONE,
    email: CONTACT_EMAIL,
    address: CONTACT_ADDRESS,
  })

  // Contact form state
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    topic: "",
    message: "",
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)



  const handleFormChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setSubmitSuccess(false)
    setSubmitError(null)

    try {
      const result = await submitContactRequest({
        email: formData.email,
        payload: {
          full_name: formData.name,
          topic: formData.topic || "general_inquiry",
          message: formData.message,
        },
        metadata: {
          source_page: "contact",
        },
        source: "storefront",
      })

      if (result.success) {
        // Track form submission in Google Analytics
        if (typeof window !== 'undefined') {
          (window as any).dataLayer = (window as any).dataLayer || [];
          (window as any).dataLayer.push({
            event: 'form_submit',
            form_type: 'contact_us_form'
          });
        }

        setSubmitSuccess(true)
        setFormData({ name: "", email: "", topic: "", message: "" })
        // Clear success message after 5 seconds
        setTimeout(() => {
          setSubmitSuccess(false)
        }, 5000)
      } else {
        setSubmitError(result.error || "Failed to submit contact request. Please try again.")
      }
    } catch (error: any) {
      setSubmitError("Something went wrong. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }


  return (
    <div className="bg-ivory-bg min-h-screen">
      <div className="w-full max-w-[1360px] mx-auto px-2 min-[340px]:px-3 min-[550px]:px-4 sm:px-6 md:px-8 min-[768px]:px-6 min-[1023px]:px-6 min-[1150px]:px-8 min-[1280px]:px-10 min-[1360px]:px-12 pt-16 min-[340px]:pt-20 min-[550px]:pt-20 sm:pt-20 md:pt-20 min-[768px]:pt-20 min-[1023px]:pt-4 min-[1150px]:pt-5 min-[1280px]:pt-5 min-[1360px]:pt-6 pb-6 min-[340px]:pb-8 min-[550px]:pb-12 sm:pb-16 md:pb-16 min-[768px]:pb-16 min-[1023px]:pb-16 min-[1150px]:pb-[72px] min-[1280px]:pb-20 min-[1360px]:pb-20">
        {/* Top Section: Contact Information and Form */}
        <div className="grid grid-cols-1 min-[1023px]:grid-cols-2 gap-4 min-[340px]:gap-5 min-[550px]:gap-8 sm:gap-10 md:gap-12 min-[1023px]:gap-10 min-[1150px]:gap-12 min-[1280px]:gap-14 min-[1360px]:gap-16 mb-8 min-[340px]:mb-10 min-[550px]:mb-16 sm:mb-20 min-[1023px]:mb-20 min-[1150px]:mb-[88px] min-[1280px]:mb-24 min-[1360px]:mb-24 items-center min-[1023px]:items-center">
          {/* Left Side: Text Information */}
          <div className="flex flex-col justify-start items-start text-left mt-0 min-[340px]:mt-0 min-[550px]:mt-0 sm:mt-0 md:mt-0 min-[768px]:mt-0 min-[1023px]:-mt-14 min-[1150px]:-mt-14 min-[1280px]:-mt-14 min-[1360px]:-mt-14">
            <p className="text-[10px] min-[340px]:text-xs min-[550px]:text-sm font-semibold uppercase tracking-wider mb-1.5 min-[340px]:mb-2 min-[550px]:mb-3 sm:mb-4 text-left text-gold-accent">
              CONTACT US
            </p>
            <h1 className="text-lg min-[340px]:text-xl min-[550px]:text-2xl sm:text-3xl md:text-4xl min-[1023px]:text-3xl min-[1150px]:text-4xl min-[1280px]:text-4xl min-[1360px]:text-5xl font-bold mb-2 min-[340px]:mb-3 min-[550px]:mb-4 sm:mb-5 md:mb-6 min-[1023px]:mb-5 min-[1150px]:mb-6 min-[1280px]:mb-6 min-[1360px]:mb-7 leading-tight text-left" style={{ color: '#04122C' }}>
              Ask us. We're Here to Help You!
            </h1>
            <p className="text-[11px] min-[340px]:text-xs min-[550px]:text-sm min-[1023px]:text-sm min-[1150px]:text-base min-[1280px]:text-base min-[1360px]:text-lg leading-relaxed text-left whitespace-normal" style={{ color: '#222222' }}>
              Get in touch with us through our Contact Us page for personalized assistance. From answering your queries to addressing concerns, our dedicated team is here to lend a helping hand. Whether you're seeking product information or need support, we're committed to providing prompt and reliable solutions. Your satisfaction is our priority, and we're just a message away from making your experience with us even better. Reach out now and let us guide you towards a seamless and enjoyable journey with our services.
            </p>
          </div>

          {/* Right Side: Contact Form */}
          <div className="min-[1023px]:mt-0">
            <div className="bg-white rounded-3xl shadow-lg p-3 min-[340px]:p-4 min-[550px]:p-6 sm:p-8 min-[1023px]:p-8 min-[1150px]:p-9 min-[1280px]:p-10 min-[1360px]:p-12" style={{ borderRadius: '30px' }}>
              <form onSubmit={handleFormSubmit} className="space-y-3 min-[340px]:space-y-4 min-[550px]:space-y-5 sm:space-y-6">
                {/* Name Field */}
                <div className="flex flex-col items-center min-[768px]:items-center min-[1023px]:items-start">
                  <label htmlFor="name" className="block w-full min-[340px]:w-full min-[768px]:w-[660px] min-[1023px]:w-full text-[11px] min-[340px]:text-xs min-[550px]:text-sm font-medium text-gray-700 mb-1 min-[340px]:mb-1.5 min-[550px]:mb-2 text-left">
                    Name
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleFormChange}
                    required
                    className="w-full min-[340px]:w-full min-[768px]:w-[660px] min-[1023px]:w-full px-2.5 min-[340px]:px-3 min-[550px]:px-4 py-1.5 min-[340px]:py-2 min-[550px]:py-2.5 sm:py-3 border border-gray-300 rounded-xl text-[11px] min-[340px]:text-xs min-[550px]:text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-gold-accent focus:border-transparent transition-all"
                    placeholder="Enter your name"
                  />
                </div>

                {/* Email Field */}
                <div className="flex flex-col items-center min-[768px]:items-center min-[1023px]:items-start">
                  <label htmlFor="email" className="block w-full min-[340px]:w-full min-[768px]:w-[660px] min-[1023px]:w-full text-[11px] min-[340px]:text-xs min-[550px]:text-sm font-medium text-gray-700 mb-1 min-[340px]:mb-1.5 min-[550px]:mb-2 text-left">
                    Email Address
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleFormChange}
                    required
                    className="w-full min-[340px]:w-full min-[768px]:w-[660px] min-[1023px]:w-full px-2.5 min-[340px]:px-3 min-[550px]:px-4 py-1.5 min-[340px]:py-2 min-[550px]:py-2.5 sm:py-3 border border-gray-300 rounded-xl text-[11px] min-[340px]:text-xs min-[550px]:text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-gold-accent focus:border-transparent transition-all"
                    placeholder="Enter your email address"
                  />
                </div>


                {/* Topic Field */}
                <div className="flex flex-col items-center min-[768px]:items-center min-[1023px]:items-start">
                  <label htmlFor="topic" className="block w-full min-[340px]:w-full min-[768px]:w-[660px] min-[1023px]:w-full text-[11px] min-[340px]:text-xs min-[550px]:text-sm font-medium text-gray-700 mb-1 min-[340px]:mb-1.5 min-[550px]:mb-2 text-left">
                    Topic
                  </label>
                  <select
                    id="topic"
                    name="topic"
                    value={formData.topic}
                    onChange={handleFormChange}
                    required
                    className="w-full min-[340px]:w-full min-[768px]:w-[660px] min-[1023px]:w-full px-2.5 min-[340px]:px-3 min-[550px]:px-4 py-1.5 min-[340px]:py-2 min-[550px]:py-2.5 sm:py-3 border border-gray-300 rounded-xl text-[11px] min-[340px]:text-xs min-[550px]:text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-gold-accent focus:border-transparent transition-all"
                  >
                    <option value="">Select a topic</option>
                    <option value="general_inquiry">General inquiry</option>
                    <option value="orders_shipping">Orders & shipping</option>
                    <option value="styling_events">Styling & events</option>
                    <option value="wholesale_gifting">Wholesale & gifting</option>
                  </select>
                </div>

                {/* Message Field */}
                <div className="flex flex-col items-center min-[768px]:items-center min-[1023px]:items-start">
                  <label htmlFor="message" className="block w-full min-[340px]:w-full min-[768px]:w-[660px] min-[1023px]:w-full text-[11px] min-[340px]:text-xs min-[550px]:text-sm font-medium text-gray-700 mb-1 min-[340px]:mb-1.5 min-[550px]:mb-2 text-left">
                    Message
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    value={formData.message}
                    onChange={handleFormChange}
                    required
                    rows={4}
                    className="w-full min-[340px]:w-full min-[768px]:w-[660px] min-[1023px]:w-full px-2.5 min-[340px]:px-3 min-[550px]:px-4 py-1.5 min-[340px]:py-2 min-[550px]:py-2.5 sm:py-3 border border-gray-300 rounded-xl text-[11px] min-[340px]:text-xs min-[550px]:text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-gold-accent focus:border-transparent transition-all resize-none"
                    placeholder="Enter your message"
                  />
                </div>

                {/* Success/Error Messages */}
                {submitSuccess && (
                  <div className="p-2.5 min-[340px]:p-3 min-[550px]:p-4 bg-green-50 border border-green-200 rounded-xl">
                    <p className="text-green-800 text-[11px] min-[340px]:text-xs min-[550px]:text-sm font-medium">
                      Thank you for contacting us! We'll get back to you soon.
                    </p>
                  </div>
                )}
                {submitError && (
                  <div className="p-2.5 min-[340px]:p-3 min-[550px]:p-4 bg-red-50 border border-red-200 rounded-xl">
                    <p className="text-red-800 text-[11px] min-[340px]:text-xs min-[550px]:text-sm font-medium">{submitError}</p>
                  </div>
                )}

                {/* Submit Button */}
                <div className="flex justify-center min-[768px]:justify-center min-[1023px]:justify-center">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    data-ga-event="contact_form_submit"
                    data-ga-label="Contact Us Form"
                    className="w-full min-w-[200px] min-[550px]:min-w-[250px] sm:min-w-[300px] py-1.5 min-[340px]:py-2 min-[550px]:py-2.5 px-2.5 min-[340px]:px-3 min-[550px]:px-5 text-[11px] min-[340px]:text-xs min-[550px]:text-sm font-semibold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      backgroundColor: submitSuccess ? '#10b981' : '#D4AF37',
                      borderRadius: '30px'
                    }}
                    onMouseEnter={(e) => {
                      if (!isSubmitting && !submitSuccess) {
                        e.currentTarget.classList.remove('bg-royal-blue'); e.currentTarget.classList.add('bg-gold-accent')
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSubmitting && !submitSuccess) {
                        e.currentTarget.classList.remove('bg-gold-accent'); e.currentTarget.classList.add('bg-royal-blue')
                      }
                    }}
                  >
                    <span className="pointer-events-none flex items-center justify-center">
                      {isSubmitting ? (
                        <span className="flex items-center justify-center gap-2">
                          <svg
                            className="animate-spin h-4 w-4"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            ></circle>
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            ></path>
                          </svg>
                          Submitting...
                        </span>
                      ) : submitSuccess ? (
                        <span className="flex items-center justify-center gap-2">
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                          Submitted!
                        </span>
                      ) : (
                        "Submit"
                      )}
                    </span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>

        {/* Middle Section: Contact Methods */}
        <div className="mb-8 min-[340px]:mb-10 min-[550px]:mb-16 sm:mb-20 min-[768px]:mb-20 min-[1023px]:mb-20 min-[1150px]:mb-[88px] min-[1280px]:mb-24 min-[1360px]:mb-24">
          <div className="grid grid-cols-1 min-[768px]:grid-cols-3 gap-4 min-[340px]:gap-5 min-[550px]:gap-8 min-[768px]:gap-8 min-[1023px]:gap-8 min-[1150px]:gap-10 min-[1280px]:gap-12 min-[1360px]:gap-14">
            {/* Phone Number */}
            <div className="flex flex-col items-center text-center px-3 min-[340px]:px-4 min-[550px]:px-6 py-4 min-[340px]:py-5 min-[550px]:py-6 min-[550px]:py-8 min-[768px]:border-r border-gray-200">
              <div
                className="w-12 h-12 min-[340px]:w-14 min-[340px]:h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center mb-3 min-[550px]:mb-4 shadow-sm border border-[#EADBCA] transition-transform hover:scale-105 duration-300"
                style={{ backgroundColor: '#FAF6F0' }}
              >
                <svg
                  className="w-5 h-5 min-[340px]:w-6 min-[340px]:h-6 sm:w-7 sm:h-7 stroke-[#D4AF37]"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
                </svg>
              </div>
              <h3 className="text-base min-[340px]:text-lg min-[550px]:text-xl font-bold text-gray-900 mb-1 min-[340px]:mb-1.5 min-[550px]:mb-2">Phone Number</h3>
              <p className="text-gray-600 text-[11px] min-[340px]:text-xs min-[550px]:text-sm mb-1 min-[340px]:mb-1.5 min-[550px]:mb-2">Mon-Sat from 9am to 6pm</p>
              <p className="text-gray-900 font-semibold text-xs min-[340px]:text-sm min-[550px]:text-base">{contactDetails.phone}</p>
            </div>

            {/* Our Address */}
            <div className="flex flex-col items-center text-center px-3 min-[340px]:px-4 min-[550px]:px-6 py-4 min-[340px]:py-5 min-[550px]:py-6 min-[550px]:py-8 min-[768px]:border-r border-gray-200">
              <div
                className="w-12 h-12 min-[340px]:w-14 min-[340px]:h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center mb-3 min-[550px]:mb-4 shadow-sm border border-[#EADBCA] transition-transform hover:scale-105 duration-300"
                style={{ backgroundColor: '#FAF6F0' }}
              >
                <svg
                  className="w-5 h-5 min-[340px]:w-6 min-[340px]:h-6 sm:w-7 sm:h-7 stroke-[#D4AF37]"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
              </div>
              <h3 className="text-base min-[340px]:text-lg min-[550px]:text-xl font-bold text-gray-900 mb-1 min-[340px]:mb-1.5 min-[550px]:mb-2">Our Address</h3>
              <p className="text-gray-600 text-[11px] min-[340px]:text-xs min-[550px]:text-sm mb-1 min-[340px]:mb-1.5 min-[550px]:mb-2">Come say hello at our office locations.</p>
              <p className="text-gray-900 font-semibold text-xs min-[340px]:text-sm min-[550px]:text-base">{contactDetails.address}</p>
            </div>

            {/* Email Address */}
            <div className="flex flex-col items-center text-center px-3 min-[340px]:px-4 min-[550px]:px-6 py-4 min-[340px]:py-5 min-[550px]:py-6 min-[550px]:py-8">
              <div
                className="w-12 h-12 min-[340px]:w-14 min-[340px]:h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center mb-3 min-[550px]:mb-4 shadow-sm border border-[#EADBCA] transition-transform hover:scale-105 duration-300"
                style={{ backgroundColor: '#FAF6F0' }}
              >
                <svg
                  className="w-5 h-5 min-[340px]:w-6 min-[340px]:h-6 sm:w-7 sm:h-7 stroke-[#D4AF37]"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="2" y="4" width="20" height="16" rx="3" />
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                </svg>
              </div>
              <h3 className="text-base min-[340px]:text-lg min-[550px]:text-xl font-bold text-gray-900 mb-1 min-[340px]:mb-1.5 min-[550px]:mb-2">Email Address</h3>
              <p className="text-gray-600 text-[11px] min-[340px]:text-xs min-[550px]:text-sm mb-1 min-[340px]:mb-1.5 min-[550px]:mb-2">Drop us an email anytime</p>
              <ObfuscatedEmail
                email={contactDetails.email}
                className="text-gray-900 font-semibold text-xs min-[340px]:text-sm min-[550px]:text-base hover:text-gold-accent transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Middle Section: Contact Methods (Newsletter section removed below) */}
      </div>
    </div>
  )
}

export default ContactTemplate

