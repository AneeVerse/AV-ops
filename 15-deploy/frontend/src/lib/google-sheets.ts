import { google } from "googleapis"

export interface CustomWorkRowData {
  timestamp: string
  fullName: string
  phoneNumber: string
  email: string
  category: string
  budget?: string
  description?: string
  referenceImageUrl: string
  status?: string
}

/**
 * Appends a new row to a Google Sheet using the Google Sheets API with a Service Account.
 * Columns: Timestamp | Full Name | Phone Number | Email | Category | Budget | Description | Reference Image URL | Status
 */
export async function appendToGoogleSheet(data: CustomWorkRowData): Promise<void> {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const privateKeyRaw = process.env.GOOGLE_PRIVATE_KEY
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID
  const sheetName = process.env.GOOGLE_SHEETS_SHEET_NAME || "Sheet1"

  if (!clientEmail || !privateKeyRaw || !spreadsheetId) {
    throw new Error(
      "Missing Google Sheets credentials in environment variables (GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY, GOOGLE_SHEETS_SPREADSHEET_ID)."
    )
  }

  // Replace escaped newlines commonly formatted in private key env strings
  const privateKey = privateKeyRaw.replace(/\\n/g, "\n")

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  })

  const sheets = google.sheets({ version: "v4", auth })

  const rowValues = [
    data.timestamp,
    data.fullName,
    data.phoneNumber,
    data.email,
    data.category,
    data.budget || "N/A",
    data.description || "N/A",
    data.referenceImageUrl || "N/A",
    data.status || "New",
  ]

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${sheetName}!A:I`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [rowValues],
    },
  })
}
