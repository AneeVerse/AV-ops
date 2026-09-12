"use client"

import {
    Popover,
    PopoverButton,
    PopoverPanel,
    Transition,
} from "@headlessui/react"
import Image from "next/image"
import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { signout } from "@lib/data/customer"
import { useParams } from "next/navigation"
import { Fragment, useState } from "react"

const AccountDropdown = ({
    customer,
}: {
    customer: HttpTypes.StoreCustomer
}) => {
    const getProfileImageUrl = (customer: HttpTypes.StoreCustomer): string | null => {
        const metadata = customer.metadata as Record<string, any> | undefined
        return metadata?.profile_image_url || null
    }

    return (
        <div className="h-full z-50 flex items-center">
            <LocalizedClientLink
                href="/account"
                className="hover:opacity-80 transition-opacity flex items-center h-full"
            >
                {getProfileImageUrl(customer) ? (
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full overflow-hidden border border-gray-200">
                        <Image
                            src={getProfileImageUrl(customer)!}
                            alt="Account"
                            width={36}
                            height={36}
                            className="w-full h-full object-cover"
                        />
                    </div>
                ) : (
                    <Image
                        src="/Account.svg"
                        alt="Account"
                        width={26}
                        height={26}
                        className="w-5 h-5"
                    />
                )}
            </LocalizedClientLink>
        </div>
    )
}

export default AccountDropdown
