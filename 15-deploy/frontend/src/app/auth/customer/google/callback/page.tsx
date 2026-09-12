"use client"

import { GoogleCallbackPage } from "@pradip1995/commerce-auth/components/google-callback"
import {
  handleGoogleAuthCallback,
  handleGoogleCallback,
} from "@lib/data/customer"

export default function GoogleCallbackRoute() {
  return (
    <GoogleCallbackPage
      handleAuthCallback={handleGoogleAuthCallback}
      handleCustomerCallback={handleGoogleCallback}
      errorButtonClassName="px-4 py-2 bg-royal-blue text-white rounded-lg"
    />
  )
}
