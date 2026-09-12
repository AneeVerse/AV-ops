import { Metadata } from "next"

import ProfileForm from "@modules/account/components/profile-form"
import ProfilePhone from "@modules/account//components/profile-phone"
import ProfileBillingAddress from "@modules/account/components/profile-billing-address"
import ProfileEmail from "@modules/account/components/profile-email"
import ProfileName from "@modules/account/components/profile-name"
import ProfilePassword from "@modules/account/components/profile-password"

import { notFound } from "next/navigation"
import { listRegions } from "@lib/data/regions"
import { retrieveCustomer } from "@lib/data/customer"

export const metadata: Metadata = {
  title: "Profile",
  description: "View and edit your Cultura Jewels profile.",
}


export default async function Profile() {
  const customer = await retrieveCustomer()
  const regions = await listRegions()

  if (!customer || !regions) {
    notFound()
  }

  return (
    <div className="w-full" data-testid="profile-page-wrapper">
      <div className="mb-8 flex flex-col gap-y-4">
        <h1 className="text-xl font-bold text-gray-900">Account Details</h1>
      </div>
      <div className="flex flex-col gap-y-8 w-full">
        <ProfileForm customer={customer} />

        {/* Preserving Billing Address as it's a required field in the system, though visually separated */}
        <div className="border-t border-gray-100 pt-4 mt-2">
          <ProfileBillingAddress customer={customer} regions={regions} />
        </div>
      </div>
    </div>
  )
}
