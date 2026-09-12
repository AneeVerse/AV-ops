import React from "react"
import { Resend } from "resend"
import AdminCustomWorkEmail from "../emails/AdminCustomWorkEmail"
import CustomerConfirmationEmail from "../emails/CustomerConfirmationEmail"

export interface SendCustomWorkEmailParams {
  fullName: string
  phoneNumber: string
  email: string
  category: string
  budget?: string
  description?: string
  referenceImageUrl: string
  submissionTime: string
}

/**
 * Sends notification emails via Resend:
 * 1. Admin Email with submitter details, custom request info, reference image link.
 * 2. Customer Confirmation Email with greeting, thank you message, SLA, summary.
 */
export async function sendCustomWorkEmails(data: SendCustomWorkEmailParams) {
  const apiKey = process.env.RESEND_API_KEY
  const adminEmail = process.env.ADMIN_EMAIL

  if (!apiKey || !adminEmail) {
    console.log("ℹ️ RESEND_API_KEY or ADMIN_EMAIL environment variable is not configured yet. Skipping email dispatch for now.")
    return
  }

  const resend = new Resend(apiKey)
  const fromEmail = process.env.RESEND_FROM_EMAIL || "Cultura Jewels <onboarding@resend.dev>"

  const results = await Promise.allSettled([
    // Admin Notification Email
    resend.emails.send({
      from: fromEmail,
      to: adminEmail,
      subject: `New Custom Work Enquiry from ${data.fullName}`,
      react: React.createElement(AdminCustomWorkEmail, {
        fullName: data.fullName,
        phoneNumber: data.phoneNumber,
        email: data.email,
        category: data.category,
        budget: data.budget || "",
        description: data.description || "",
        referenceImageUrl: data.referenceImageUrl,
        submissionTime: data.submissionTime,
      }) as React.ReactElement,
    }),
    // Customer Confirmation Email
    resend.emails.send({
      from: fromEmail,
      to: data.email,
      subject: "We've Received Your Custom Work Request",
      react: React.createElement(CustomerConfirmationEmail, {
        fullName: data.fullName,
        category: data.category,
        budget: data.budget || "",
        description: data.description || "",
        referenceImageUrl: data.referenceImageUrl,
      }) as React.ReactElement,
    }),
  ])

  // Check for failures
  results.forEach((result, idx) => {
    if (result.status === "rejected") {
      console.error(`Email dispatch #${idx + 1} failed:`, result.reason)
    }
  })
}
