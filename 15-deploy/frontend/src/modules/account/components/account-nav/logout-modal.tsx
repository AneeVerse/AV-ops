"use client"

import { Dialog, Transition } from "@headlessui/react"
import { ArrowRightOnRectangle } from "@medusajs/icons"
import { Button, clx } from "@medusajs/ui"
import React, { Fragment } from "react"
import { LogoutIcon } from "./icons"

type LogoutModalProps = {
    isOpen: boolean
    close: () => void
    onConfirm: () => void
    isLoggingOut: boolean
}

const LogoutModal = ({
    isOpen,
    close,
    onConfirm,
    isLoggingOut,
}: LogoutModalProps) => {
    return (
        <Transition appear show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-[100]" onClose={close}>
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
                </Transition.Child>

                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4 text-center">
                        <Transition.Child
                            as={Fragment}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0 scale-95"
                            enterTo="opacity-100 scale-100"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100 scale-100"
                            leaveTo="opacity-0 scale-95"
                        >
                            <Dialog.Panel className="w-full max-w-[340px] transform overflow-hidden rounded-[40px] bg-white p-6 text-center align-middle shadow-xl transition-all">
                                <div className="flex flex-col items-center">
                                    {/* Icon Section */}
                                    <div className="w-[110px] h-[110px] rounded-full bg-[#E700001A] grid place-items-center mb-4">
                                        <LogoutIcon width="60" height="60" color="#E70000" />
                                    </div>

                                    {/* Text Section */}
                                    <Dialog.Title
                                        as="h3"
                                        className="text-2xl font-bold text-[#04122C] mb-1"
                                    >
                                        Log Out
                                    </Dialog.Title>
                                    <p className="text-gray-400 text-sm font-medium mb-6">
                                        Are you sure want to log out?
                                    </p>

                                    {/* Buttons Section */}
                                    <div className="flex gap-x-3 w-full">
                                        <button
                                            onClick={close}
                                            className="flex-1 px-4 py-3 rounded-full border border-gray-200 font-bold text-gray-700 hover:bg-gray-50 transition-all text-base"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={onConfirm}
                                            disabled={isLoggingOut}
                                            className="flex-1 px-4 py-3 rounded-full bg-royal-blue font-bold text-white hover:bg-[#784ca1] transition-all text-base disabled:opacity-50"
                                        >
                                            {isLoggingOut ? "..." : "Log Out"}
                                        </button>
                                    </div>
                                </div>
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition>
    )
}

export default LogoutModal
