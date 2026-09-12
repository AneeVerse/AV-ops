import { NextRequest, NextResponse } from "next/server"
import { customWorkSchema } from "@lib/validations/custom-work"
import { uploadToImageKit } from "@lib/imagekit"
import { appendToGoogleSheet } from "@lib/google-sheets"
import { sendCustomWorkEmailsNodemailer } from "@lib/nodemailer"
// import { sendCustomWorkEmails } from "@lib/resend" // Uncomment if switching back to Resend in future

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()

    // Extract text fields
    const rawData = {
      fullName: (formData.get("fullName") as string) || "",
      phoneNumber: (formData.get("phoneNumber") as string) || "",
      email: (formData.get("email") as string) || "",
      category: (formData.get("category") as string) || "",
      budget: (formData.get("budget") as string) || "",
      description: (formData.get("description") as string) || "",
    }

    // Server-side Zod validation
    const validationResult = customWorkSchema.safeParse(rawData)
    if (!validationResult.success) {
      const fieldErrors = validationResult.error.flatten().fieldErrors
      return NextResponse.json(
        {
          success: false,
          error: "Validation failed",
          fieldErrors,
        },
        { status: 400 }
      )
    }

    const validData = validationResult.data

    // Extract file (if uploaded)
    const file = formData.get("referenceImage") as File | null
    let referenceImageUrl = ""

    if (file && file.size > 0 && typeof file.arrayBuffer === "function") {
      // Validate file size limit (10MB)
      if (file.size > 10 * 1024 * 1024) {
        return NextResponse.json(
          {
            success: false,
            error: "File size exceeds 10MB limit.",
          },
          { status: 400 }
        )
      }

      // Convert File to Buffer for ImageKit upload
      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      try {
        referenceImageUrl = await uploadToImageKit(buffer, file.name)
      } catch (imgError: any) {
        console.error("ImageKit upload error:", imgError)
        return NextResponse.json(
          {
            success: false,
            error: `Image upload failed: ${imgError.message || "Unknown error"}`,
          },
          { status: 500 }
        )
      }
    }

    const timestamp = new Date().toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "UTC",
    })

    // Execute Google Sheets append and Email dispatch in PARALLEL for ultra-fast performance
    const [sheetResult, emailResult] = await Promise.allSettled([
      appendToGoogleSheet({
        timestamp,
        fullName: validData.fullName,
        phoneNumber: validData.phoneNumber,
        email: validData.email,
        category: validData.category,
        budget: validData.budget || "",
        description: validData.description || "",
        referenceImageUrl,
        status: "New",
      }),
      sendCustomWorkEmailsNodemailer({
        fullName: validData.fullName,
        phoneNumber: validData.phoneNumber,
        email: validData.email,
        category: validData.category,
        budget: validData.budget || "",
        description: validData.description || "",
        referenceImageUrl,
        submissionTime: timestamp,
      }),
    ])

    if (sheetResult.status === "rejected") {
      console.error("Google Sheets API error:", sheetResult.reason)
      return NextResponse.json(
        {
          success: false,
          error: `Failed to record data in Google Sheets: ${sheetResult.reason?.message || "Unknown error"}`,
        },
        { status: 500 }
      )
    }

    if (emailResult.status === "rejected") {
      console.error("Nodemailer email dispatch error:", emailResult.reason)
    }

    return NextResponse.json({
      success: true,
      message: "Custom work request submitted successfully!",
      referenceImageUrl: referenceImageUrl || null,
    })
  } catch (error: any) {
    console.error("Custom Work submission error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || "An unexpected error occurred while processing your request.",
      },
      { status: 500 }
    )
  }
}
