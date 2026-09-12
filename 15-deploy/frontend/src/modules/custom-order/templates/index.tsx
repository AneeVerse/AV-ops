"use client"

import React, { useState, useRef } from "react"
import Image from "next/image"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  customWorkSchema,
  CustomWorkFormData,
  CATEGORY_OPTIONS,
} from "@lib/validations/custom-work"

export default function CustomOrderTemplate() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [filePreview, setFilePreview] = useState<string | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CustomWorkFormData>({
    resolver: zodResolver(customWorkSchema),
    defaultValues: {
      fullName: "",
      phoneNumber: "",
      email: "",
      category: "Ring",
      budget: "",
      description: "",
    },
  })

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    setFileError(null)

    if (file) {
      // Validate file size limit (10MB)
      if (file.size > 10 * 1024 * 1024) {
        setFileError("File size exceeds 10MB limit. Please upload a smaller image.")
        return
      }

      // Validate image MIME type
      if (!file.type.startsWith("image/")) {
        setFileError("Only image files (PNG, JPG, WEBP, etc.) are allowed.")
        return
      }

      setSelectedFile(file)

      const reader = new FileReader()
      reader.onloadend = () => {
        setFilePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleRemoveFile = () => {
    setSelectedFile(null)
    setFilePreview(null)
    setFileError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const onSubmit = async (data: CustomWorkFormData) => {
    setServerError(null)
    setSubmitSuccess(false)

    try {
      const formData = new FormData()
      formData.append("fullName", data.fullName)
      formData.append("phoneNumber", data.phoneNumber)
      formData.append("email", data.email)
      formData.append("category", data.category)
      formData.append("budget", data.budget || "")
      formData.append("description", data.description || "")

      if (selectedFile) {
        formData.append("referenceImage", selectedFile)
      }

      const res = await fetch("/api/custom-work", {
        method: "POST",
        body: formData,
      })

      const result = await res.json()

      if (!res.ok || !result.success) {
        throw new Error(result.error || "Failed to submit custom work request.")
      }

      setSubmitSuccess(true)
      reset()
      handleRemoveFile()

      // Auto dismiss success toast after 8 seconds
      setTimeout(() => {
        setSubmitSuccess(false)
      }, 8000)
    } catch (err: any) {
      setServerError(err.message || "An error occurred while submitting your request. Please try again.")
    }
  }

  return (
    <div className="bg-ivory-bg min-h-screen py-10 sm:py-16 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background Ambient Glow */}
      <div className="pointer-events-none absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-[#D4AF37]/[0.05] rounded-full blur-3xl" />

      <div className="w-full max-w-4xl mx-auto relative z-10">
        {/* Header Title */}
        <div className="text-center mb-10 sm:mb-12">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-[0.2em] text-[#102a43] uppercase font-sans">
            CUSTOM WORK
          </h1>
          <div className="w-12 h-0.5 bg-[#102a43] opacity-80 mx-auto mt-3" />
          <p className="mt-4 text-xs sm:text-sm text-gray-600 font-sans max-w-lg mx-auto">
            Bring your vision to life. Share your reference design or custom specifications, and our master artisans will craft your bespoke statement piece.
          </p>
        </div>

        {/* Form Container Card */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-xl p-6 sm:p-10 max-w-2xl mx-auto transition-all duration-300">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
            {/* Full Name (Required) */}
            <div>
              <label htmlFor="fullName" className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2 font-sans">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="fullName"
                {...register("fullName")}
                className={`w-full px-4 py-3 rounded-lg border text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#D4AF37] transition-all font-sans ${
                  errors.fullName ? "border-red-500 bg-red-50/20" : "border-gray-300"
                }`}
                placeholder="Enter your full name"
              />
              {errors.fullName && (
                <p className="mt-1.5 text-xs text-red-600 font-medium font-sans">
                  {errors.fullName.message}
                </p>
              )}
            </div>

            {/* Phone Number (Required & Valid Format) */}
            <div>
              <label htmlFor="phoneNumber" className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2 font-sans">
                Phone Number <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                id="phoneNumber"
                {...register("phoneNumber")}
                className={`w-full px-4 py-3 rounded-lg border text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#D4AF37] transition-all font-sans ${
                  errors.phoneNumber ? "border-red-500 bg-red-50/20" : "border-gray-300"
                }`}
                placeholder="Enter your contact number (e.g. +91 9876543210)"
              />
              {errors.phoneNumber && (
                <p className="mt-1.5 text-xs text-red-600 font-medium font-sans">
                  {errors.phoneNumber.message}
                </p>
              )}
            </div>

            {/* Email (Required & Valid Email) */}
            <div>
              <label htmlFor="email" className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2 font-sans">
                Email Address <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                id="email"
                {...register("email")}
                className={`w-full px-4 py-3 rounded-lg border text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#D4AF37] transition-all font-sans ${
                  errors.email ? "border-red-500 bg-red-50/20" : "border-gray-300"
                }`}
                placeholder="Enter your email address"
              />
              {errors.email && (
                <p className="mt-1.5 text-xs text-red-600 font-medium font-sans">
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* Category Dropdown (Required) */}
            <div>
              <label htmlFor="category" className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2 font-sans">
                Category <span className="text-red-500">*</span>
              </label>
              <select
                id="category"
                {...register("category")}
                className={`w-full px-4 py-3 rounded-lg border text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#D4AF37] transition-all font-sans bg-white ${
                  errors.category ? "border-red-500 bg-red-50/20" : "border-gray-300"
                }`}
              >
                {CATEGORY_OPTIONS.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              {errors.category && (
                <p className="mt-1.5 text-xs text-red-600 font-medium font-sans">
                  {errors.category.message}
                </p>
              )}
            </div>

            {/* Budget (Optional) */}
            <div>
              <label htmlFor="budget" className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2 font-sans">
                Budget <span className="text-gray-400 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                id="budget"
                {...register("budget")}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#D4AF37] transition-all font-sans"
                placeholder="e.g. ₹35,000 or $500"
              />
            </div>

            {/* Description (Optional) */}
            <div>
              <label htmlFor="description" className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2 font-sans">
                Description / Specifications <span className="text-gray-400 font-normal">(Optional)</span>
              </label>
              <textarea
                id="description"
                rows={4}
                {...register("description")}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#D4AF37] transition-all font-sans resize-none"
                placeholder="Describe your design concept, preferred metal (Gold/Silver/Platinum), stone specifications, dimensions, or custom text..."
              />
            </div>

            {/* Reference Image (Single File Upload - Optional) */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2 font-sans">
                Reference Image <span className="text-gray-400 font-normal">(Optional, Single Image)</span>
              </label>
              <div className="relative border border-gray-300 rounded-lg p-3 bg-gray-50/50 hover:bg-gray-50 transition-colors">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*"
                  className="w-full text-xs text-gray-600 file:mr-4 file:py-2 file:px-5 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-[#D4AF37] file:text-[#0d1a11] hover:file:bg-[#0A1D37] hover:file:text-white transition-all cursor-pointer"
                />

                {/* File Preview Card */}
                {selectedFile && (
                  <div className="mt-3 flex items-center justify-between p-2.5 bg-white border border-gray-200 rounded-lg shadow-sm">
                    <div className="flex items-center gap-3 overflow-hidden">
                      {filePreview ? (
                        <div className="relative w-12 h-12 rounded overflow-hidden shrink-0 border border-gray-200">
                          <Image src={filePreview} alt="Reference Preview" fill className="object-cover" />
                        </div>
                      ) : (
                        <div className="w-12 h-12 rounded bg-gray-100 flex items-center justify-center text-gray-500 shrink-0">
                          📷
                        </div>
                      )}
                      <div className="overflow-hidden text-left">
                        <p className="text-xs font-medium text-gray-800 truncate font-sans">
                          {selectedFile.name}
                        </p>
                        <p className="text-[10px] text-gray-500 font-sans">
                          {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleRemoveFile}
                      className="p-1 text-gray-400 hover:text-red-500 rounded-full transition-colors font-bold text-sm"
                      title="Remove image"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>
              {fileError && (
                <p className="mt-1.5 text-xs text-red-600 font-medium font-sans">
                  {fileError}
                </p>
              )}
            </div>

            {/* Server Error Banner */}
            {serverError && (
              <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-medium text-center font-sans">
                ⚠️ {serverError}
              </div>
            )}

            {/* Success Toast Notification */}
            {submitSuccess && (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs sm:text-sm font-semibold text-center animate-in fade-in duration-300 shadow-md font-sans">
                ✓ Thank you! Your custom work request has been received. Check your email for confirmation!
              </div>
            )}

            {/* Submit Button */}
            <div className="pt-3 text-center">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full sm:w-auto px-12 py-3.5 rounded-full bg-[#D4AF37] text-[#0d1a11] hover:bg-[#0A1D37] hover:text-white transition-all duration-300 font-bold text-xs uppercase tracking-widest shadow-lg hover:scale-105 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 mx-auto"
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>SUBMITTING...</span>
                  </>
                ) : (
                  <span>SUBMIT REQUEST</span>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
