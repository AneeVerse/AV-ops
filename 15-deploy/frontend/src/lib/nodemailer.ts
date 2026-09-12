import React from "react"
import nodemailer from "nodemailer"
import { render } from "@react-email/render"
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
 * Sends notification emails via Nodemailer (SMTP):
 * 1. Admin Email with submitter details, custom request info, reference image link.
 * 2. Customer Confirmation Email with greeting, thank you message, SLA, summary.
 */
export async function sendCustomWorkEmailsNodemailer(data: SendCustomWorkEmailParams) {
  const host = process.env.SMTP_HOST
  const port = Number(process.env.SMTP_PORT) || 587
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  const adminEmail = process.env.ADMIN_EMAIL || "team.culturajewels@gmail.com"

  if (!host || !user || !pass) {
    console.log("ℹ️ SMTP credentials (SMTP_HOST, SMTP_USER, SMTP_PASS) not fully configured yet. Skipping Nodemailer email dispatch.")
    return
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // true for 465, false for 587 / other ports
    auth: {
      user,
      pass,
    },
  })

  // Render React Email components to clean HTML strings concurrently
  const [adminHtml, customerHtml] = await Promise.all([
    render(
      React.createElement(AdminCustomWorkEmail, {
        fullName: data.fullName,
        phoneNumber: data.phoneNumber,
        email: data.email,
        category: data.category,
        budget: data.budget || "",
        description: data.description || "",
        referenceImageUrl: data.referenceImageUrl,
        submissionTime: data.submissionTime,
      })
    ),
    render(
      React.createElement(CustomerConfirmationEmail, {
        fullName: data.fullName,
        category: data.category,
        budget: data.budget || "",
        description: data.description || "",
        referenceImageUrl: data.referenceImageUrl,
      })
    ),
  ])

  const fromAddress = process.env.SMTP_FROM || `Cultura Jewels <${user}>`

  const results = await Promise.allSettled([
    // Admin Notification Email
    transporter.sendMail({
      from: fromAddress,
      to: adminEmail,
      subject: `New Custom Work Enquiry from ${data.fullName}`,
      html: adminHtml,
    }),
    // Customer Confirmation Email
    transporter.sendMail({
      from: fromAddress,
      to: data.email,
      subject: "We've Received Your Custom Work Request",
      html: customerHtml,
    }),
  ])

  results.forEach((result, idx) => {
    if (result.status === "rejected") {
      console.error(`Nodemailer email dispatch #${idx + 1} failed:`, result.reason)
    }
  })
}
