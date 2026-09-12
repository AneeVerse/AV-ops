import { z } from "zod"

/**
 * Custom Work Form Schema
 * To add future fields, simply add them here with their Zod validation rules.
 */
export const customWorkSchema = z.object({
  fullName: z
    .string()
    .min(1, "Full Name is required")
    .min(2, "Full Name must be at least 2 characters"),
  phoneNumber: z
    .string()
    .min(1, "Phone Number is required")
    .regex(
      /^[+]*[(]?[0-9]{1,4}[)]?[-\s./0-9]{6,15}$/,
      "Please enter a valid phone number"
    ),
  email: z
    .string()
    .min(1, "Email is required")
    .email("Please enter a valid email address"),
  category: z
    .string()
    .min(1, "Category is required"),
  budget: z.string().optional(),
  description: z.string().optional(),
})

export type CustomWorkFormData = z.infer<typeof customWorkSchema>

export const CATEGORY_OPTIONS = [
  "Ring",
  "Pendant",
  "Bracelet",
  "Chain",
  "Earrings",
  "Other Custom Jewelry",
] as const
